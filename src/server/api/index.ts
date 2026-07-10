import { router } from "./trpc";
import { falRouter } from "./features/fal";
import { arenaRouter } from "./features/arena";
import { paymentRouter } from "./features/payment";
import { loraRouter } from "./features/lora";
import { generateRouter } from "./features/generate";
import { slideshowRouter } from "./features/slideshow";

export const appRouter = router({
  fal: falRouter,
  arena: arenaRouter,
  payment: paymentRouter,
  lora: loraRouter,
  generate: generateRouter,
  slideshow: slideshowRouter,
});

export type AppRouter = typeof appRouter;
export type { Context } from "./trpc";
