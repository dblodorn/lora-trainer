import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "../trpc";
import { getDb, ensureLoraTable, ensureGeneratedImagesTable } from "../db";
import { requireFalApiKey } from "../env";
import { fal } from "@fal-ai/client";
import { isPaymentExempt } from "./payment";
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
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const walletAddress = ctx.session.user.walletAddress;

      // Look up the LoRA training record
      await ensureLoraTable();
      const db = getDb();
      const lora = await db
        .selectFrom("lora_trainings")
        .select(["id", "trigger_word", "lora_weights_url", "status"])
        .where("id", "=", input.loraTrainingId)
        .executeTakeFirst();

      if (!lora) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "LoRA not found.",
        });
      }

      if (lora.status !== "completed" || !lora.lora_weights_url) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This LoRA is not ready for generation. Training must be completed first.",
        });
      }

      // Check rate limit (admin/QA exempt)
      await ensureGeneratedImagesTable();
      const exempt = isPaymentExempt(walletAddress);

      if (!exempt) {
        const windowStart = new Date(
          Date.now() - RATE_LIMIT_WINDOW_MS,
        ).toISOString();

        const countResult = await db
          .selectFrom("generated_images")
          .select(db.fn.countAll().as("count"))
          .where("wallet_address", "=", walletAddress)
          .where("created_at", ">", windowStart)
          .executeTakeFirst();

        const imageCount = Number(countResult?.count ?? 0);
        const batchCount = Math.ceil(imageCount / IMAGES_PER_BATCH);

        if (batchCount >= RATE_LIMIT_BATCHES) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Rate limit reached. You can generate up to ${RATE_LIMIT_BATCHES} batches per 24 hours. Try again later.`,
          });
        }
      }

      // Build full prompt with trigger word
      const fullPrompt = `${input.prompt} in the style of ${lora.trigger_word}`;

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
            loras: [{ path: lora.lora_weights_url, scale: 1.5 }],
            image_size: "square_hd",
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
      }[] = [];

      for (const image of result.images) {
        const id = generateId();
        await db
          .insertInto("generated_images")
          .values({
            id,
            lora_training_id: input.loraTrainingId,
            wallet_address: walletAddress,
            prompt: input.prompt,
            image_url: image.url,
            image_width: image.width ?? null,
            image_height: image.height ?? null,
            seed: result.seed != null ? String(result.seed) : null,
            created_at: now,
          })
          .execute();

        savedImages.push({
          id,
          imageUrl: image.url,
          width: image.width ?? null,
          height: image.height ?? null,
          seed: result.seed != null ? String(result.seed) : null,
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
      await ensureGeneratedImagesTable();
      const db = getDb();

      const rows = await db
        .selectFrom("generated_images")
        .select([
          "id",
          "wallet_address",
          "prompt",
          "image_url",
          "image_width",
          "image_height",
          "seed",
          "created_at",
        ])
        .where("lora_training_id", "=", input.loraTrainingId)
        .orderBy("created_at", "desc")
        .execute();

      return rows.map((row) => ({
        id: row.id,
        walletAddress: row.wallet_address,
        prompt: row.prompt,
        imageUrl: row.image_url,
        width: row.image_width,
        height: row.image_height,
        seed: row.seed,
        createdAt: row.created_at,
      }));
    }),

  remaining: protectedProcedure.query(async ({ ctx }) => {
    const walletAddress = ctx.session.user.walletAddress;
    const exempt = isPaymentExempt(walletAddress);

    if (exempt) {
      return { remaining: RATE_LIMIT_BATCHES, limit: RATE_LIMIT_BATCHES, isExempt: true };
    }

    await ensureGeneratedImagesTable();
    const db = getDb();

    const windowStart = new Date(
      Date.now() - RATE_LIMIT_WINDOW_MS,
    ).toISOString();

    const countResult = await db
      .selectFrom("generated_images")
      .select(db.fn.countAll().as("count"))
      .where("wallet_address", "=", walletAddress)
      .where("created_at", ">", windowStart)
      .executeTakeFirst();

    const imageCount = Number(countResult?.count ?? 0);
    const batchCount = Math.ceil(imageCount / IMAGES_PER_BATCH);
    const remaining = Math.max(0, RATE_LIMIT_BATCHES - batchCount);

    return { remaining, limit: RATE_LIMIT_BATCHES, isExempt: false };
  }),
});
