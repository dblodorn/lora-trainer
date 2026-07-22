import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "../trpc";
import { getDb, LoraTrainingDoc, GeneratedImageDoc } from "../db";
import { requireFalApiKey } from "../env";
import { fal } from "@fal-ai/client";
import { isPaymentExempt } from "./payment";
import { loraScaleSchema, DEFAULT_LORA_SCALE, getLoraScaleLabel } from "@/lib/lora-scale";
import { imageDimensionsSchema, DEFAULT_IMAGE_WIDTH, DEFAULT_IMAGE_HEIGHT } from "@/lib/image-dimensions";
import crypto from "node:crypto";

function generateId(): string {
  return crypto.randomBytes(16).toString("hex");
}

function ensureFalConfigured() {
  const key = requireFalApiKey();
  fal.config({ credentials: key });
}

const RATE_LIMIT_BATCHES = 8;
const IMAGES_PER_BATCH = 4;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export const generateRouter = router({
  images: protectedProcedure
    .input(
      z.object({
        loraTrainingId: z.string().min(1),
        prompt: z.string().min(1).max(500),
        loraScale: loraScaleSchema.default(DEFAULT_LORA_SCALE),
        imageWidth: imageDimensionsSchema.shape.imageWidth,
        imageHeight: imageDimensionsSchema.shape.imageHeight,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const walletAddress = ctx.session.user.walletAddress;
      const db = await getDb();

      // Look up the LoRA training record
      const lora = await db.collection<LoraTrainingDoc>("lora_trainings").findOne({
        _id: input.loraTrainingId,
      });

      if (!lora) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "LoRA not found.",
        });
      }

      if (lora.status !== "completed" || !lora.loraWeightsUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This LoRA is not ready for generation. Training must be completed first.",
        });
      }

      // Check rate limit (admin/QA exempt)
      const exempt = isPaymentExempt(walletAddress);

      if (!exempt) {
        const windowStart = new Date(
          Date.now() - RATE_LIMIT_WINDOW_MS,
        ).toISOString();

        const imageCount = await db
          .collection<GeneratedImageDoc>("generated_images")
          .countDocuments({
            walletAddress,
            createdAt: { $gt: windowStart },
          });

        const batchCount = Math.ceil(imageCount / IMAGES_PER_BATCH);

        if (batchCount >= RATE_LIMIT_BATCHES) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Rate limit reached. You can generate up to ${RATE_LIMIT_BATCHES} batches per 24 hours. Try again later.`,
          });
        }
      }

      // Build full prompt with trigger word
      const fullPrompt = `${input.prompt} in the style of ${lora.triggerWord}`;

      // Call fal.ai
      ensureFalConfigured();

      let result: {
        images: { url: string; width?: number; height?: number; content_type?: string }[];
        seed?: number;
        has_nsfw_concepts?: boolean[];
      };

      try {
        const response = await fal.subscribe("fal-ai/flux-lora", {
          input: {
            prompt: fullPrompt,
            loras: [{ path: lora.loraWeightsUrl, scale: parseFloat(input.loraScale) }],
            image_size: { width: input.imageWidth, height: input.imageHeight },
            num_inference_steps: 28,
            guidance_scale: 3.5,
            num_images: IMAGES_PER_BATCH,
            enable_safety_checker: true,
            output_format: "jpeg",
          },
        });
        result = response.data as typeof result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        console.error("Image generation error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Image generation failed: ${msg}`,
        });
      }

      if (!result.images || result.images.length === 0) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No images were generated. The safety checker may have filtered all results.",
        });
      }

      // Save generated images to DB
      const now = new Date().toISOString();
      const savedImages: {
        id: string;
        imageUrl: string;
        width: number | null;
        height: number | null;
        seed: string | null;
        loraScaleValue: string;
        loraScaleName: string;
        genWidth: number;
        genHeight: number;
      }[] = [];

      for (const image of result.images) {
        const id = generateId();
        await db.collection<GeneratedImageDoc>("generated_images").insertOne({
          _id: id,
          loraTrainingId: input.loraTrainingId,
          walletAddress,
          prompt: input.prompt,
          imageUrl: image.url,
          imageWidth: image.width ?? null,
          imageHeight: image.height ?? null,
          seed: result.seed != null ? String(result.seed) : null,
          loraScaleValue: input.loraScale,
          loraScaleName: getLoraScaleLabel(input.loraScale),
          genWidth: input.imageWidth,
          genHeight: input.imageHeight,
          createdAt: now,
        });

        savedImages.push({
          id,
          imageUrl: image.url,
          width: image.width ?? null,
          height: image.height ?? null,
          seed: result.seed != null ? String(result.seed) : null,
          loraScaleValue: input.loraScale,
          loraScaleName: getLoraScaleLabel(input.loraScale),
          genWidth: input.imageWidth,
          genHeight: input.imageHeight,
        });
      }

      const nsfwFiltered =
        result.has_nsfw_concepts?.some(Boolean) === true;

      return {
        images: savedImages,
        prompt: input.prompt,
        nsfwFiltered,
        totalGenerated: result.images.length,
      };
    }),

  listByLora: publicProcedure
    .input(z.object({ loraTrainingId: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();

      const docs = await db
        .collection<GeneratedImageDoc>("generated_images")
        .find({ loraTrainingId: input.loraTrainingId })
        .sort({ createdAt: -1 })
        .toArray();

      return docs.map((doc) => ({
        id: doc._id,
        walletAddress: doc.walletAddress,
        prompt: doc.prompt,
        imageUrl: doc.imageUrl,
        width: doc.imageWidth,
        height: doc.imageHeight,
        seed: doc.seed,
        loraScaleValue: doc.loraScaleValue,
        loraScaleName: doc.loraScaleName,
        genWidth: doc.genWidth,
        genHeight: doc.genHeight,
        createdAt: doc.createdAt,
      }));
    }),

  remaining: protectedProcedure.query(async ({ ctx }) => {
    const walletAddress = ctx.session.user.walletAddress;
    const exempt = isPaymentExempt(walletAddress);

    if (exempt) {
      return { remaining: RATE_LIMIT_BATCHES, limit: RATE_LIMIT_BATCHES, isExempt: true };
    }

    const db = await getDb();

    const windowStart = new Date(
      Date.now() - RATE_LIMIT_WINDOW_MS,
    ).toISOString();

    const imageCount = await db
      .collection<GeneratedImageDoc>("generated_images")
      .countDocuments({
        walletAddress,
        createdAt: { $gt: windowStart },
      });

    const batchCount = Math.ceil(imageCount / IMAGES_PER_BATCH);
    const remaining = Math.max(0, RATE_LIMIT_BATCHES - batchCount);

    return { remaining, limit: RATE_LIMIT_BATCHES, isExempt: false };
  }),
});
