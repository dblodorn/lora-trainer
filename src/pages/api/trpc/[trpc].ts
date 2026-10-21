import { createNextApiHandler } from "@trpc/server/adapters/next";
import { appRouter } from "@/server/api";
import type { Context } from "@/server/api";
import { readSessionCookie, resolveViewer } from "@/server/auth/session";

export default createNextApiHandler({
  router: appRouter,
  createContext: async ({ req }): Promise<Context> => {
    const viewer = await resolveViewer(req.headers.cookie);
    return { viewer, sessionToken: viewer ? readSessionCookie(req.headers.cookie) : null };
  },
});
