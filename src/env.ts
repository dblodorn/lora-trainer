import { z } from "zod";

// Environment variables schema for the lora-trainer app
const envSchema = z.object({
  // Server-side only environment variables
  FAL_AI_API_KEY: z.string().min(1, "FAL_AI_API_KEY is required"),

  // Node environment
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

// Validate environment variables
const envResult = envSchema.safeParse(process.env);

if (!envResult.success) {
  console.error("❌ Invalid environment variables in lora-trainer:");
  console.error(envResult.error.format());
  throw new Error("Invalid environment variables");
}

export const env = envResult.data;

// Helper to check if we're on the server side
export const isServer = typeof window === "undefined";
