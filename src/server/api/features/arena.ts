/// <reference path="../types/arena.d.ts" />
import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import Arena from "are.na";

const arena = new Arena();

const urlSchema = z.string().regex(/^https:\/\/www\.are\.na\/[^\/]+\/[^\/]+$/, {
  message:
    "Invalid are.na URL format. Expected format: https://www.are.na/username/channel-name",
});

export const arenaRouter = router({
  getChannelImages: publicProcedure
    .input(z.object({ url: urlSchema }))
    .query(async ({ input }) => {
      try {
        // Extract channel slug from URL
        const urlParts = input.url.split("/");
        const channelSlug = urlParts[urlParts.length - 1];

        // Fetch channel contents
        const contents = await arena
          .channel(channelSlug)
          .contents({ per: 100 });

        // Filter for image blocks and extract image URLs
        const images = contents
          .filter((block) => block.class === "Image")
          .map((block) => ({
            id: block.id,
            title: block.title,
            image: block.image,
            source: block.source,
            created_at: block.created_at,
          }));

        return {
          channel: {
            title: contents.attrs?.title || "Unknown Channel",
            slug: channelSlug,
            url: input.url,
          },
          images,
          total: images.length,
        };
      } catch (error) {
        throw new Error(
          `Failed to fetch channel: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }),
});
