# lora-trainer

Next.js Pages Router app for selecting [Are.na](https://are.na) images and training LoRA models via [FAL.ai](https://fal.ai).

## Getting Started

### Prerequisites

- Node.js >= 18
- npm or pnpm

### Environment Variables

Create `.env` (or `.env.local`) in the project root:

```env
# Auth (Better Auth + SIWE)
BETTER_AUTH_SECRET=<generate with: openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3000
ALLOWED_ADDRESSES=0xYOUR_WALLET_ADDRESS  # optional, comma-separated

# Database (MongoDB)
MONGODB_URI=mongodb+srv://user:pass@your-cluster.mongodb.net/lora-trainer

# FAL.ai (server-side only)
FAL_AI_API_KEY=your_fal_ai_api_key

# Payment (ETH on BASE)
TRAINING_PRICE_USD=4                          # USD per training run (default: 4)
ADMIN_WALLET=0xYOUR_ADMIN_WALLET              # exempt from payment gate
PAYMENT_WALLET_PRIVATE_KEY=your_private_key   # for signing refund txs
NEXT_PUBLIC_CHAIN_ID=8453                     # BASE Mainnet (default: 8453)
```

### Database Setup

Auth data and app data are both stored in MongoDB. The Better Auth MongoDB adapter is schemaless, so no migration step is required — collections are created automatically on first use.

### Run Dev Server

```bash
npm install
npm run dev
# or
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy on Vercel

### Environment Variables

Set the following in your Vercel project's Environment Variables settings:

| Variable                     | Description                                                           |
| ---------------------------- | --------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`         | Auth secret key                                                       |
| `BETTER_AUTH_URL`            | Production URL (e.g. `https://arenatrainer.dmbk.io`)                  |
| `ALLOWED_ADDRESSES`          | Comma-separated wallet addresses allowed to sign in                   |
| `MONGODB_URI`                | MongoDB connection string                                             |
| `FAL_AI_API_KEY`             | [FAL.ai](https://fal.ai/dashboard) API key                            |
| `TRAINING_PRICE_USD`         | USD price per training run (default: `4`)                              |
| `ADMIN_WALLET`              | Admin wallet address (exempt from payment)                             |
| `PAYMENT_WALLET_PRIVATE_KEY` | Private key for the payment/refund wallet                              |
| `NEXT_PUBLIC_CHAIN_ID`       | Chain ID for payment network (default: `8453` / BASE Mainnet)        |

## Architecture

This is a standalone Next.js app (no monorepo). The tRPC API backend is inlined at `src/server/api/`.

- **Pages Router** (`src/pages/`): Next.js pages with tRPC + React Query
- **tRPC backend**: Inlined at `src/server/api/` — originally from the `@dmbk-world/api` package
- **UI**: [Reshaped](https://reshaped.so) design system (v3.9.0) with custom "lora-trainer" theme
- **Auth**: Better Auth with SIWE (Sign-In with Ethereum)
- **Database**: MongoDB (native driver)
- **Blockchain**: Wagmi + Viem for wallet connections and payment verification