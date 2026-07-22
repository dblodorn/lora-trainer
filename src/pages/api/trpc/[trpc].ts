import { createNextApiHandler } from "@trpc/server/adapters/next";
import { appRouter } from "@/server/api";
import type { Context } from "@/server/api";
import { getAuth } from "@/lib/auth";
import { fromNodeHeaders } from "better-auth/node";
import { isAddress } from "viem";

/**
 * Extract the wallet address from a better-auth SIWE session user.
 * The SIWE plugin with `anonymous: true` stores the address as:
 *   1. user.walletAddress (if the plugin schema includes it)
 *   2. user.name (anonymous SIWE sets name = full address)
 *   3. user.email prefix (anonymous SIWE sets email = `${address}@ethereum.siwe`)
 */
function extractWalletAddress(user: Record<string, unknown>): string {
  // 1. Direct walletAddress field
  if (typeof user.walletAddress === "string" && isAddress(user.walletAddress)) {
    return user.walletAddress;
  }
  // 2. Name field (anonymous SIWE sets name to the full address)
  if (typeof user.name === "string" && isAddress(user.name)) {
    return user.name;
  }
  // 3. Email prefix (anonymous SIWE sets email to `${address}@ethereum.siwe`)
  if (typeof user.email === "string") {
    const prefix = user.email.split("@")[0];
    if (prefix && isAddress(prefix)) {
      return prefix;
    }
  }
  return "";
}

export default createNextApiHandler({
  router: appRouter,
  createContext: async ({ req }): Promise<Context> => {
    const host = (req.headers["x-forwarded-host"] as string) || req.headers.host;
    const session = await getAuth(host).api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    return {
      session: session
        ? {
            user: {
              id: session.user.id,
              walletAddress: extractWalletAddress(
                session.user as Record<string, unknown>,
              ),
            },
          }
        : null,
    };
  },
});
