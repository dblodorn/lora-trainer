import { router } from "./trpc";
import { falRouter } from "./features/fal";

/*
 * Only the fal.ai work lives here. Every LoRA record, the slideshow and
 * Are.na come from the dmbk API, through Relay and /api/graphql in the
 * browser, or through ./lora-api from these procedures.
 */
export const appRouter = router({
  fal: falRouter,
});

export type AppRouter = typeof appRouter;
export type { Context } from "./trpc";
