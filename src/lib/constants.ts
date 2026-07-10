// Payment recipient wallet on BASE Mainnet (from public env var)
export const PAYMENT_RECIPIENT =
  process.env.NEXT_PUBLIC_PAYMENT_RECIPIENT ?? "";

// Admin wallet that bypasses the payment gate (from public env var, no API dependency)
export const ADMIN_WALLET = process.env.NEXT_PUBLIC_ADMIN_WALLET ?? null;

// QA wallets that bypass the payment gate (from public env var, comma-separated)
export const QA_WALLETS: string[] = (
  process.env.NEXT_PUBLIC_QA_WALLETS ?? ""
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Default chain ID — configurable via NEXT_PUBLIC_CHAIN_ID env var (defaults to BASE Mainnet: 8453)
export const BASE_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_CHAIN_ID ?? "8453",
);
