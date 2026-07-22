import { betterAuth } from "better-auth";
import { siwe } from "better-auth/plugins/siwe";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { MongoClient } from "mongodb";
import { verifyMessage } from "viem";
import crypto from "node:crypto";

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  throw new Error(
    "MONGODB_URI is not configured. Set it in .env to use authentication.",
  );
}

const authMongoClient = new MongoClient(mongoUri);
const authDb = authMongoClient.db();

const productionHost = process.env.BETTER_AUTH_URL
  ? new URL(process.env.BETTER_AUTH_URL).host
  : "localhost:3000";

// Hosts SIWE is allowed to bind its domain to. Vercel preview deployments get
// a different hostname per branch/commit, so `*.vercel.app` is trusted as a
// pattern rather than hardcoding every possible preview URL.
const ALLOWED_HOSTS = [productionHost, "*.vercel.app", "localhost:3000"];

function isAllowedHost(host: string): boolean {
  return ALLOWED_HOSTS.some((pattern) =>
    pattern.startsWith("*.") ? host.endsWith(pattern.slice(1)) : host === pattern,
  );
}

function buildAuth(host: string) {
  const protocol = host.startsWith("localhost") ? "http" : "https";

  return betterAuth({
    database: mongodbAdapter(authDb, { client: authMongoClient }),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: `${protocol}://${host}`,
    plugins: [
      siwe({
        domain: host,
        anonymous: true,
        getNonce: async () => crypto.randomBytes(32).toString("hex"),
        verifyMessage: async ({ message, signature, address }) => {
          const valid = await verifyMessage({
            address: address as `0x${string}`,
            message,
            signature: signature as `0x${string}`,
          });
          if (valid && process.env.ALLOWED_ADDRESSES) {
            const allowed = process.env.ALLOWED_ADDRESSES.split(",").map((a) =>
              a.trim().toLowerCase(),
            );
            return allowed.includes(address.toLowerCase());
          }
          return valid;
        },
      }),
    ],
  });
}

const authInstances = new Map<string, ReturnType<typeof buildAuth>>();

/**
 * Get (or lazily create) the better-auth instance for the requesting host.
 * SIWE binds its domain at plugin-config time, so each distinct host — the
 * production domain, each Vercel preview URL, localhost — needs its own
 * instance for wallet sign-in to work there. Falls back to the production
 * host for anything not in the allowlist.
 */
export function getAuth(requestHost: string | undefined) {
  const host = requestHost && isAllowedHost(requestHost) ? requestHost : productionHost;

  const existing = authInstances.get(host);
  if (existing) return existing;

  const instance = buildAuth(host);
  authInstances.set(host, instance);
  return instance;
}
