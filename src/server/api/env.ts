import { config } from "dotenv";
import { z } from "zod";

// Load environment variables from .env files
config({ path: ".env.local" }); // project root
config(); // default .env file

// Define the environment schema — all keys optional at load time
// so that routes that don't need them can still work.
const envSchema = z.object({
  FAL_AI_API_KEY: z.string().optional(),
  DO_SPACES_ENDPOINT: z.string().optional(),
  DO_SPACES_REGION: z.string().optional(),
  DO_SPACES_KEY: z.string().optional(),
  DO_SPACES_SECRET: z.string().optional(),
  DO_SPACES_BUCKET: z.string().optional(),
  DO_SPACES_CDN_URL: z.string().optional(),
});

// Parse environment variables (will not throw since all keys are optional)
const envResult = envSchema.safeParse(process.env);

export const env = envResult.success
  ? envResult.data
  : {
      FAL_AI_API_KEY: undefined,
      DO_SPACES_ENDPOINT: undefined,
      DO_SPACES_REGION: undefined,
      DO_SPACES_KEY: undefined,
      DO_SPACES_SECRET: undefined,
      DO_SPACES_BUCKET: undefined,
      DO_SPACES_CDN_URL: undefined,
    };

/**
 * Require a specific env variable at runtime. Call this inside procedures
 * that need the key so that only those routes fail — not the entire router.
 */
export function requireFalApiKey(): string {
  const key = env.FAL_AI_API_KEY;
  if (!key) {
    throw new Error(
      "FAL_AI_API_KEY is not configured. Set it in .env.local to use fal.ai features.",
    );
  }
  return key;
}

export interface SpacesConfig {
  endpoint: string;
  region: string;
  key: string;
  secret: string;
  bucket: string;
  cdnUrl: string;
}

/**
 * Require DO Spaces configuration at runtime. Call this inside procedures
 * that need Spaces so only those routes fail — not the entire router.
 */
export function requireSpacesConfig(): SpacesConfig {
  const cfg: SpacesConfig = {
    endpoint: env.DO_SPACES_ENDPOINT ?? "",
    region: env.DO_SPACES_REGION ?? "",
    key: env.DO_SPACES_KEY ?? "",
    secret: env.DO_SPACES_SECRET ?? "",
    bucket: env.DO_SPACES_BUCKET ?? "",
    cdnUrl: env.DO_SPACES_CDN_URL ?? "",
  };
  const missing = (Object.keys(cfg) as (keyof SpacesConfig)[]).filter(
    (k) => !cfg[k],
  );
  if (missing.length) {
    throw new Error(
      `DO Spaces not configured. Missing: ${missing.join(", ")}. Set them in .env.local`,
    );
  }
  return cfg;
}
