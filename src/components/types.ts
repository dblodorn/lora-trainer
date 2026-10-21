import { z } from "zod";

const arenaUrlRegex = /^https?:\/\/(www\.)?are\.na\/[^/]+\/[^/]+\/?$/;

export const formSchema = z.object({
  url: z
    .string()
    .min(1, "Channel URL is required")
    .regex(
      arenaUrlRegex,
      "Must be a valid Are.na channel URL (e.g. https://www.are.na/user/channel-slug)",
    ),
  selectedImages: z.array(z.string()),
  triggerWord: z.string(),
  trainingSteps: z.number(),
});

export type FormData = z.infer<typeof formSchema>;

export type { ArenaImage } from "@/server/api/features/arena";
