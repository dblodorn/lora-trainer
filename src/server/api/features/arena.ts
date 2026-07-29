/// <reference path="../types/arena.d.ts" />
import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import Arena from "are.na";

const arena = new Arena();

const urlSchema = z.string().regex(/^https:\/\/www\.are\.na\/[^\/]+\/[^\/]+$/, {
  message:
    "Invalid are.na URL format. Expected format: https://www.are.na/username/channel-name",
});

/** Fetch channel metadata (title, slug) from the are.na REST API. */
async function fetchChannelMetadata(
  slug: string,
): Promise<{ title: string; slug: string }> {
  try {
    const res = await fetch(`https://api.are.na/v2/channels/${slug}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { title: data.title || slug, slug: data.slug || slug };
  } catch {
    // Fallback: use the slug as the title
    return { title: slug, slug };
  }
}

export const arenaRouter = router({
  getChannelImages: publicProcedure
    .input(z.object({ url: urlSchema }))
    .query(async ({ input }) => {
      try {
        // Extract channel slug from URL
        const urlParts = input.url.split("/");
        const channelSlug = urlParts[urlParts.length - 1];

        // Fetch channel metadata and contents in parallel
        const [channelMeta, contents] = await Promise.all([
          fetchChannelMetadata(channelSlug),
          arena.channel(channelSlug).contents({ per: 100 }),
        ]);

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
            title: channelMeta.title,
            slug: channelMeta.slug,
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
