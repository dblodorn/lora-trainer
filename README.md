# lora-trainer

Next.js Pages Router app for selecting [Are.na](https://are.na) images and training LoRA models via [FAL.ai](https://fal.ai).

## Getting Started

### Prerequisites

- Node.js >= 18
- npm or pnpm

### Environment Variables

Create `.env` (or `.env.local`) in the project root:

```env
# Auth (Google, via the dmbk accounts API)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<the dmbk web OAuth client ID>
DMBK_GRAPHQL_API_URL=https://graphql.dmbk.network/graphql  # optional, this is the default

# Database (MongoDB)
MONGODB_URI=mongodb+srv://user:pass@your-cluster.mongodb.net/lora-trainer

# FAL.ai (server-side only)
FAL_AI_API_KEY=your_fal_ai_api_key
```

### Database Setup

App data is stored in MongoDB (`lora_trainings`, `generated_images`). Collections and indexes are created on first use. Accounts are not stored here: they live in the dmbk GraphQL API.

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

| Variable                       | Description                                                       |
| ------------------------------ | ----------------------------------------------------------------- |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | The dmbk web OAuth client ID (same client the API verifies)       |
| `DMBK_GRAPHQL_API_URL`         | Optional; defaults to `https://graphql.dmbk.network/graphql`      |
| `MONGODB_URI`                  | MongoDB connection string                                         |
| `FAL_AI_API_KEY`               | [FAL.ai](https://fal.ai/dashboard) API key                        |
| `DO_SPACES_*`                  | DigitalOcean Spaces config for mirrored images and weights        |

## Architecture

This is a standalone Next.js app (no monorepo). The tRPC API backend is inlined at `src/server/api/`.

- **Pages Router** (`src/pages/`): Next.js pages with tRPC + React Query
- **tRPC backend**: Inlined at `src/server/api/` — originally from the `@dmbk-world/api` package
- **UI**: [Reshaped](https://reshaped.so) design system (v3.9.0) with custom "lora-trainer" theme
- **Auth**: Google sign-in through the dmbk GraphQL API (see below)
- **Database**: MongoDB (native driver)

## Auth

Accounts belong to the [dmbk GraphQL API](https://github.com/dblodorn/dmbk-graphql-api) (`graphql.dmbk.network`), which verifies Google ID tokens and decides who may sign in (`ALLOWED_EMAILS`) and who is an admin (`ADMIN_EMAILS`).

1. Google Identity Services renders the button and returns an ID token.
2. `POST /api/session` trades it with the API's `signInWithGoogle` for a session token, stored in an HTTP-only `lora_trainer_session` cookie. Page scripts never see it.
3. Each tRPC request resolves the viewer by asking the API's `viewer { id email name isAdmin }` with that token. Nothing is cached, so revoking a session or removing an email from the API's lists takes effect at the next request.

Training and generation spend fal.ai credit and there is no payment step, so only admins can hold a session for now. Records are owned by `ownerId`, the account's id at the API. Older records also carry the SIWE `walletAddress` they were created with, which is no longer read or written.

The page's origin must be an authorized JavaScript origin on the Google OAuth client, so sign-in works on `https://arenatrainer.dmbk.io` and `http://localhost:3000`, but not on Vercel preview URLs.
