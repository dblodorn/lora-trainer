import { z } from "zod";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatUnits,
  isAddress,
  isAddressEqual,
  type Hex,
} from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { publicProcedure, protectedProcedure, router } from "../trpc";
import {
  getTrainingPriceUsd,
  getAdminWallet,
  requirePaymentWalletKey,
  getPaymentRecipient,
  getQaWallets,
} from "../env";

// ─── Constants ───────────────────────────────────────────────────────────────

/** Uniswap V3 QuoterV2 on BASE */
const UNISWAP_QUOTER_V2 =
  "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a" as const;

/** WETH on BASE */
const WETH_BASE = "0x4200000000000000000000000000000000000006" as const;

/** USDC on BASE (6 decimals) */
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

/** Fee tier: 0.05% = 500 */
const FEE_TIER = 500;

// ─── Viem clients ────────────────────────────────────────────────────────────

const basePublicClient = createPublicClient({
  chain: base,
  transport: http(),
});

// ─── In-memory replay protection ─────────────────────────────────────────────

const usedTxHashes = new Set<string>();

// ─── QuoterV2 ABI (minimal, only what we need) ──────────────────────────────

const quoterV2Abi = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
    stateMutability: "nonpayable",
  },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Get the current ETH price in USD by quoting 1 ETH → USDC on Uniswap V3 (BASE).
 */
export async function getEthPriceFromUniswap(): Promise<number> {
  const oneEth = parseEther("1");

  // Use simulateContract to call the quoter (it's a non-view function that we simulate)
  const { result } = await basePublicClient.simulateContract({
    address: UNISWAP_QUOTER_V2,
    abi: quoterV2Abi,
    functionName: "quoteExactInputSingle",
    args: [
      {
        tokenIn: WETH_BASE,
        tokenOut: USDC_BASE,
        amountIn: oneEth,
        fee: FEE_TIER,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });

  // result[0] is amountOut in USDC (6 decimals)
  const amountOut = result[0];
  const ethPriceUsd = Number(formatUnits(amountOut, 6));

  return ethPriceUsd;
}

/**
 * Calculate the required ETH amount in wei for a given USD amount.
 */
export function calculateRequiredEthWei(
  ethPriceUsd: number,
  targetUsd: number,
): bigint {
  if (ethPriceUsd <= 0) throw new Error("Invalid ETH price");

  // Calculate ETH amount with 18 decimal precision
  // requiredEth = targetUsd / ethPriceUsd
  // Convert to wei: requiredEth * 1e18
  const requiredEthFloat = targetUsd / ethPriceUsd;

  // Use string conversion to avoid floating point issues with parseEther
  // Round to 18 decimal places
  const requiredEthStr = requiredEthFloat.toFixed(18);
  return parseEther(requiredEthStr);
}

/**
 * Verify a payment transaction on BASE.
 * Returns the transaction value if valid, throws otherwise.
 */
export async function verifyPaymentTx(
  txHash: Hex,
  expectedMinValueWei: bigint,
): Promise<{ value: bigint; from: string }> {
  // Check replay protection
  const hashLower = txHash.toLowerCase();
  if (usedTxHashes.has(hashLower)) {
    throw new Error("This transaction has already been used for a training run");
  }

  // Fetch transaction and receipt in parallel
  const [tx, receipt] = await Promise.all([
    basePublicClient.getTransaction({ hash: txHash }),
    basePublicClient.getTransactionReceipt({ hash: txHash }),
  ]);

  // Verify receipt status
  if (receipt.status !== "success") {
    throw new Error("Transaction failed on-chain");
  }

  // Verify recipient
  const paymentRecipient = getPaymentRecipient();
  if (tx.to?.toLowerCase() !== paymentRecipient.toLowerCase()) {
    throw new Error(
      `Transaction recipient mismatch. Expected ${paymentRecipient}, got ${tx.to}`,
    );
  }

  // Verify minimum value (allow 5% slippage buffer)
  const minAcceptable = (expectedMinValueWei * 95n) / 100n;
  if (tx.value < minAcceptable) {
    throw new Error(
      `Insufficient payment. Expected at least ${formatUnits(minAcceptable, 18)} ETH, got ${formatUnits(tx.value, 18)} ETH`,
    );
  }

  // Mark as used
  usedTxHashes.add(hashLower);

  return { value: tx.value, from: tx.from };
}

/**
 * Send a refund transaction on BASE from the payment wallet to the user.
 */
export async function sendRefund(
  toAddress: string,
  amountWei: bigint,
): Promise<Hex> {
  const privateKey = requirePaymentWalletKey();
  const account = privateKeyToAccount(privateKey as Hex);

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(),
  });

  const txHash = await walletClient.sendTransaction({
    to: toAddress as Hex,
    value: amountWei,
  });

  console.log(
    `Refund sent: ${txHash} (${formatUnits(amountWei, 18)} ETH to ${toAddress})`,
  );

  return txHash;
}

/**
 * Check if a wallet address is exempt from payment (admin or QA).
 */
export function isPaymentExempt(walletAddress: string): boolean {
  if (!walletAddress || !isAddress(walletAddress)) return false;

  // Check admin wallet
  const adminWallet = getAdminWallet();
  if (adminWallet && isAddress(adminWallet)) {
    if (isAddressEqual(walletAddress, adminWallet)) return true;
  }

  // Check QA wallets
  const qaWallets = getQaWallets();
  return qaWallets.some(
    (qa) => isAddress(qa) && isAddressEqual(walletAddress, qa),
  );
}

// ─── tRPC Router ─────────────────────────────────────────────────────────────

export const paymentRouter = router({
  /**
   * Get current ETH price and required payment amount.
   * Public so the frontend can display pricing before auth.
   */
  getEthPrice: publicProcedure.query(async () => {
    const trainingPriceUsd = getTrainingPriceUsd();
    const ethPriceUsd = await getEthPriceFromUniswap();
    const requiredEthWei = calculateRequiredEthWei(
      ethPriceUsd,
      trainingPriceUsd,
    );

    return {
      trainingPriceUsd,
      ethPriceUsd,
      requiredEthWei: requiredEthWei.toString(), // bigint → string for JSON
      paymentRecipient: getPaymentRecipient(),
      adminWallet: getAdminWallet() ?? null,
      qaWallets: getQaWallets(),
    };
  }),

  /**
   * Verify a payment transaction on-chain.
   */
  verifyPayment: protectedProcedure
    .input(
      z.object({
        txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
      }),
    )
    .mutation(async ({ input }) => {
      const trainingPriceUsd = getTrainingPriceUsd();
      const ethPriceUsd = await getEthPriceFromUniswap();
      const requiredEthWei = calculateRequiredEthWei(
        ethPriceUsd,
        trainingPriceUsd,
      );

      const result = await verifyPaymentTx(
        input.txHash as Hex,
        requiredEthWei,
      );

      return {
        verified: true,
        value: result.value.toString(),
        from: result.from,
      };
    }),
});
