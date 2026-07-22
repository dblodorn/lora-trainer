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

export const auth = betterAuth({
  database: mongodbAdapter(authMongoClient.db(), { client: authMongoClient }),
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
