import { initTRPC, TRPCError } from '@trpc/server';
import type { Viewer } from '@/server/auth/session';

export type Context = {
  /** The signed-in account, resolved per request by the dmbk accounts API. */
  viewer: Viewer | null;
  /**
   * The viewer's session token, set only when `viewer` is. Procedures pass it
   * on to the dmbk API so it acts as the viewer.
   */
  sessionToken: string | null;
};

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.viewer || !ctx.sessionToken) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { viewer: ctx.viewer, sessionToken: ctx.sessionToken } });
});

export const protectedProcedure = t.procedure.use(enforceAuth);

/** Whether the viewer owns a record. Records from before accounts have no `ownerId`. */
export function isOwner(viewer: Viewer | null, doc: { ownerId?: string | null }): boolean {
  return !!viewer && !!doc.ownerId && doc.ownerId === viewer.id;
}
