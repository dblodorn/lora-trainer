import { config } from "dotenv";
import { z } from "zod";

// Load environment variables from .env files
config({ path: ".env.local" }); // project root
config(); // default .env file

// Define the environment schema — all keys optional at load time
// so that routes that don't need them can still work.
const envSchema = z.object({
  FAL_AI_API_KEY: z.string().optional(),
  TRAINING_PRICE_USD: z.string().optional(),
  ADMIN_WALLET: z.string().optional(),
  PAYMENT_WALLET_PRIVATE_KEY: z.string().optional(),
  PAYMENT_RECIPIENT: z.string().optional(),
  QA_WALLETS: z.string().optional(),
});

// Parse environment variables (will not throw since all keys are optional)
const envResult = envSchema.safeParse(process.env);

export const env = envResult.success
  ? envResult.data
  : {
      FAL_AI_API_KEY: undefined,
      TRAINING_PRICE_USD: undefined,
      ADMIN_WALLET: undefined,
      PAYMENT_WALLET_PRIVATE_KEY: undefined,
      PAYMENT_RECIPIENT: undefined,
      QA_WALLETS: undefined,
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

/**
 * Get the training price in USD. Defaults to 4 if not set.
 */
export function getTrainingPriceUsd(): number {
  const raw = env.TRAINING_PRICE_USD;
  if (!raw) return 4;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 4;
}

/**
 * Get the admin wallet address (full privileges, no payment required).
 */
export function getAdminWallet(): string | undefined {
  return env.ADMIN_WALLET;
}

/**
 * Require the payment wallet private key for signing refund transactions.
 */
export function requirePaymentWalletKey(): string {
  const key = env.PAYMENT_WALLET_PRIVATE_KEY;
  if (!key) {
    throw new Error(
      "PAYMENT_WALLET_PRIVATE_KEY is not configured. Set it in .env to enable refunds.",
    );
  }
  return key;
}

/**
 * Get the payment recipient wallet address on BASE.
 * Required for payment verification and transaction routing.
 */
export function getPaymentRecipient(): string {
  const addr = env.PAYMENT_RECIPIENT;
  if (!addr) {
    throw new Error(
      "PAYMENT_RECIPIENT is not configured. Set it in .env to enable payments.",
    );
  }
  return addr;
}

/**
 * Get the list of QA wallet addresses that bypass the payment gate.
 * Returns an empty array if not configured.
 */
export function getQaWallets(): string[] {
  const raw = env.QA_WALLETS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
