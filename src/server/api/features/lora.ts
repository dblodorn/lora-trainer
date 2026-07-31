import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "../trpc";
import { getDb, LoraTrainingDoc } from "../db";
import { mirrorUrlToSpaces } from "./storage";
import crypto from "node:crypto";

function generateId(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Create a pending lora_trainings record. Called internally from trainLora.
 */
export async function createPendingLora(params: {
  requestId: string;
  walletAddress: string;
  triggerWord: string;
  steps: number;
  imageUrls: string[];
  imageUrlsSpaces?: string[];
  trainingZipUrl?: string | null;
  arenaChannelUrl?: string;
  arenaChannelTitle?: string;
}): Promise<{ id: string }> {
  const db = await getDb();
  const id = generateId();
  await db.collection<LoraTrainingDoc>("lora_trainings").insertOne({
    _id: id,
    requestId: params.requestId,
    walletAddress: params.walletAddress,
    triggerWord: params.triggerWord,
    steps: params.steps,
    imageUrls: params.imageUrls,
    imageUrlsSpaces: params.imageUrlsSpaces ?? [],
    trainingZipUrl: params.trainingZipUrl ?? null,
    loraWeightsUrl: null,
    arenaChannelUrl: params.arenaChannelUrl ?? null,
    arenaChannelTitle: params.arenaChannelTitle ?? null,
    hidden: false,
    status: "pending",
    createdAt: new Date().toISOString(),
  });
  return { id };
}

export const loraRouter = router({
  complete: protectedProcedure
    .input(
      z.object({
        requestId: z.string().min(1),
        loraWeightsUrl: z.string().url(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const walletAddress = ctx.session.user.walletAddress;

      const existing = await db
        .collection<LoraTrainingDoc>("lora_trainings")
        .findOne({ requestId: input.requestId });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No training record found for this request ID.",
        });
      }

      if (existing.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not the owner of this training record.",
        });
      }

      if (existing.status === "completed") {
        return { success: true };
      }

      // Mirror LoRA weights to DO Spaces
      const loraId = existing._id;
      const weightsExt = input.loraWeightsUrl.endsWith(".safetensors")
        ? "safetensors"
        : "bin";
      const spacesKey = `lora-trainer/loras/${loraId}/${loraId}.${weightsExt}`;

      let cdnUrl: string;
      try {
        cdnUrl = await mirrorUrlToSpaces(
          input.loraWeightsUrl,
          spacesKey,
          "application/octet-stream",
        );
      } catch (err) {
        console.error("Failed to mirror LoRA weights to Spaces, using FAL URL:", err);
        cdnUrl = input.loraWeightsUrl;
      }

      // Backfill training images if not yet mirrored to Spaces
      let imageUrlsSpaces: string[] = existing.imageUrlsSpaces ?? [];
      if (
        imageUrlsSpaces.length === 0 &&
        existing.imageUrls &&
        existing.imageUrls.length > 0
      ) {
        try {
          const mirrorPromises = existing.imageUrls.map((url, index) => {
            const filename =
              url.split("/").pop()?.split("?")[0] || `image_${index}.jpg`;
            const ext = /\.(jpg|jpeg|png|gif|webp)$/i.test(filename) ? "" : ".jpg";
            const key = `lora-trainer/training-images/${existing._id}/${index + 1}_${filename}${ext}`;
            return mirrorUrlToSpaces(url, key, "image/jpeg").catch(() => null);
          });
          const results = await Promise.all(mirrorPromises);
          imageUrlsSpaces = results.filter((r): r is string => r !== null);
          console.log(
            `Backfilled ${imageUrlsSpaces.length}/${existing.imageUrls.length} training images to Spaces`,
          );
        } catch (err) {
          console.error("Failed to backfill training images:", err);
        }
      }

      const updateFields: Record<string, unknown> = {
        loraWeightsUrl: cdnUrl,
        status: "completed",
      };
      if (imageUrlsSpaces.length > 0) {
        updateFields.imageUrlsSpaces = imageUrlsSpaces;
      }

      await db.collection<LoraTrainingDoc>("lora_trainings").updateOne(
        { _id: existing._id },
        { $set: updateFields },
      );

      return { success: true };
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();

      const doc = await db
        .collection<LoraTrainingDoc>("lora_trainings")
        .findOne({ _id: input.id });

      if (!doc) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "LoRA not found.",
        });
      }
      return {
        id: doc._id,
        requestId: doc.requestId,
        walletAddress: doc.walletAddress,
        triggerWord: doc.triggerWord,
        steps: doc.steps,
        imageUrls: doc.imageUrls,
        imageUrlsSpaces: doc.imageUrlsSpaces ?? [],
        trainingZipUrl: doc.trainingZipUrl ?? null,
        loraWeightsUrl: doc.loraWeightsUrl,
        arenaChannelUrl: doc.arenaChannelUrl,
        arenaChannelTitle: doc.arenaChannelTitle,
        hidden: doc.hidden ?? false,
        status: doc.status,
        createdAt: doc.createdAt,
      };
    }),

  hide: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const walletAddress = ctx.session.user.walletAddress;

      const doc = await db
        .collection<LoraTrainingDoc>("lora_trainings")
        .findOne({ _id: input.id });

      if (!doc) {
        throw new TRPCError({ code: "NOT_FOUND", message: "LoRA not found." });
      }

      if (doc.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You are not the owner of this LoRA." });
      }

      await db
        .collection<LoraTrainingDoc>("lora_trainings")
        .updateOne({ _id: input.id }, { $set: { hidden: true } });

      return { success: true };
    }),

  unhide: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const walletAddress = ctx.session.user.walletAddress;

      const doc = await db
        .collection<LoraTrainingDoc>("lora_trainings")
        .findOne({ _id: input.id });

      if (!doc) {
        throw new TRPCError({ code: "NOT_FOUND", message: "LoRA not found." });
      }

      if (doc.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You are not the owner of this LoRA." });
      }

      await db
        .collection<LoraTrainingDoc>("lora_trainings")
        .updateOne({ _id: input.id }, { $set: { hidden: false } });

      return { success: true };
    }),

  listHidden: publicProcedure
      .input(z.object({ walletAddress: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const db = await getDb();

        const filter: Record<string, unknown> = { status: "completed", hidden: true };
        if (input?.walletAddress) {
          filter.walletAddress = { $regex: `^${input.walletAddress.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: "i" };
        }

        const docs = await db
          .collection<LoraTrainingDoc>("lora_trainings")
          .find(filter)
          .sort({ createdAt: -1 })
          .toArray();

    return docs.map((doc) => ({
      id: doc._id,
      requestId: doc.requestId,
      walletAddress: doc.walletAddress,
      triggerWord: doc.triggerWord,
      steps: doc.steps,
      imageUrls: doc.imageUrls,
      imageUrlsSpaces: doc.imageUrlsSpaces ?? [],
      trainingZipUrl: doc.trainingZipUrl ?? null,
      loraWeightsUrl: doc.loraWeightsUrl,
      arenaChannelUrl: doc.arenaChannelUrl,
      arenaChannelTitle: doc.arenaChannelTitle,
      createdAt: doc.createdAt,
    }));
  }),

  list: publicProcedure.query(async () => {
      const db = await getDb();

      const docs = await db
        .collection<LoraTrainingDoc>("lora_trainings")
        .find({ status: "completed", hidden: { $ne: true } })
        .sort({ createdAt: -1 })
        .toArray();

      return docs.map((doc) => ({
        id: doc._id,
        requestId: doc.requestId,
        walletAddress: doc.walletAddress,
        triggerWord: doc.triggerWord,
        steps: doc.steps,
        imageUrls: doc.imageUrls,
        imageUrlsSpaces: doc.imageUrlsSpaces ?? [],
        trainingZipUrl: doc.trainingZipUrl ?? null,
        loraWeightsUrl: doc.loraWeightsUrl,
        arenaChannelUrl: doc.arenaChannelUrl,
        arenaChannelTitle: doc.arenaChannelTitle,
        createdAt: doc.createdAt,
      }));
  }),
});