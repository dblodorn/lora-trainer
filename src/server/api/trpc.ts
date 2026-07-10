import { initTRPC, TRPCError } from '@trpc/server';

export type Context = {
  session: { user: { id: string; walletAddress: string } } | null;
};

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { session: ctx.session } });
});

export const protectedProcedure = t.procedure.use(enforceAuth);
