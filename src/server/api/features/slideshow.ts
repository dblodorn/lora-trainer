import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import { getDb, ensureLoraTable, ensureGeneratedImagesTable } from "../db";

/** Fisher-Yates shuffle (in-place) */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const slideshowRouter = router({
  /**
   * Return a random batch of image URLs drawn from both
   * training source images and generated images.
   */
  randomImages: publicProcedure
    .input(
      z
        .object({ count: z.number().int().min(1).max(20).default(10) })
        .default({}),
    )
    .query(async ({ input }) => {
      await ensureLoraTable();
      await ensureGeneratedImagesTable();
      const db = getDb();

      // 1. Random generated images
      const genRows = await db
        .selectFrom("generated_images")
        .select(["image_url"])
        .orderBy(db.fn("RANDOM", []))
        .limit(input.count)
        .execute();

      const genUrls = genRows.map((r) => r.image_url);

      // 2. Random training rows (each has a JSON array of URLs)
      const trainingRows = await db
        .selectFrom("lora_trainings")
        .select(["image_urls"])
        .where("status", "=", "completed")
        .orderBy(db.fn("RANDOM", []))
        .limit(5)
        .execute();

      const trainingUrls: string[] = [];
      for (const row of trainingRows) {
        try {
          const urls = JSON.parse(row.image_urls) as string[];
          trainingUrls.push(...urls);
        } catch {
          // skip malformed rows
        }
      }

      // 3. Combine, deduplicate, shuffle, take `count`
      const allUrls = [...new Set([...genUrls, ...trainingUrls])];
      shuffle(allUrls);

      return { urls: allUrls.slice(0, input.count) };
    }),
});
