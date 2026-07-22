import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import { getDb, LoraTrainingDoc, GeneratedImageDoc } from "../db";

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
      const db = await getDb();

      // 1. Random generated images via $sample
      const genDocs = await db
        .collection<GeneratedImageDoc>("generated_images")
        .aggregate<Pick<GeneratedImageDoc, "imageUrl">>([
          { $sample: { size: input.count } },
          { $project: { imageUrl: 1, _id: 0 } },
        ])
        .toArray();

      const genUrls = genDocs.map((d) => d.imageUrl);

      // 2. Random training rows (each has a native array of URLs)
      const trainingDocs = await db
        .collection<LoraTrainingDoc>("lora_trainings")
        .aggregate<Pick<LoraTrainingDoc, "imageUrls">>([
          { $match: { status: "completed" } },
          { $sample: { size: 5 } },
          { $project: { imageUrls: 1, _id: 0 } },
        ])
        .toArray();

      const trainingUrls: string[] = [];
      for (const doc of trainingDocs) {
        if (Array.isArray(doc.imageUrls)) {
          trainingUrls.push(...doc.imageUrls);
        }
      }

      // 3. Combine, deduplicate, shuffle, take `count`
      const allUrls = [...new Set([...genUrls, ...trainingUrls])];
      shuffle(allUrls);

      return { urls: allUrls.slice(0, input.count) };
    }),
});
