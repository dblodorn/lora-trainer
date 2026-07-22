import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "../trpc";
import { getDb, LoraTrainingDoc } from "../db";
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
    loraWeightsUrl: null,
    arenaChannelUrl: params.arenaChannelUrl ?? null,
    arenaChannelTitle: params.arenaChannelTitle ?? null,
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

      await db.collection<LoraTrainingDoc>("lora_trainings").updateOne(
        { _id: existing._id },
        {
          $set: {
            loraWeightsUrl: input.loraWeightsUrl,
            status: "completed",
          },
        },
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
        loraWeightsUrl: doc.loraWeightsUrl,
        arenaChannelUrl: doc.arenaChannelUrl,
        arenaChannelTitle: doc.arenaChannelTitle,
        status: doc.status,
        createdAt: doc.createdAt,
      };
    }),

  list: publicProcedure.query(async () => {
      const db = await getDb();

      const docs = await db
        .collection<LoraTrainingDoc>("lora_trainings")
        .find({ status: "completed" })
        .sort({ createdAt: -1 })
        .toArray();

      return docs.map((doc) => ({
        id: doc._id,
        requestId: doc.requestId,
        walletAddress: doc.walletAddress,
        triggerWord: doc.triggerWord,
        steps: doc.steps,
        imageUrls: doc.imageUrls,
        loraWeightsUrl: doc.loraWeightsUrl,
        arenaChannelUrl: doc.arenaChannelUrl,
        arenaChannelTitle: doc.arenaChannelTitle,
        createdAt: doc.createdAt,
      }));
  }),
});
