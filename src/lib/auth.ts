import { betterAuth } from "better-auth";
import { siwe } from "better-auth/plugins/siwe";
import { LibsqlDialect } from "@libsql/kysely-libsql";
import { verifyMessage } from "viem";
import crypto from "node:crypto";

export const auth = betterAuth({
  database: {
    dialect: new LibsqlDialect({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    }),
    type: "sqlite",
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  plugins: [
    siwe({
      domain: new URL(process.env.BETTER_AUTH_URL || "http://localhost:3000")
        .host,
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
