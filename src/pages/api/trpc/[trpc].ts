import { createNextApiHandler } from "@trpc/server/adapters/next";
import { appRouter } from "@/server/api";
import type { Context } from "@/server/api";
import { resolveViewer } from "@/server/auth/session";

export default createNextApiHandler({
  router: appRouter,
  createContext: async ({ req }): Promise<Context> => ({
    viewer: await resolveViewer(req.headers.cookie),
  }),
});
