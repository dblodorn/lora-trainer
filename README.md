# lora-trainer

Next.js Pages Router app for selecting [Are.na](https://are.na) images, training LoRA models on them via [FAL.ai](https://fal.ai), and generating images with the results. Live at [arenatrainer.dmbk.io](https://arenatrainer.dmbk.io).

## What it does

- **Train** (`/`): paste an Are.na channel URL, or pick one of your channels once your Are.na username is saved on `/auth`. Then pick images, set a trigger word and step count, and train a FLUX LoRA (`fal-ai/flux-lora-fast-training`). Progress is polled from the FAL queue.
- **Loras** (`/loras`, `/loras/[id]`): the gallery of completed LoRAs. Each detail page shows the training images, the weights URL, and images generated with it. Signed in, you can generate 4 images at a time (`fal-ai/flux-lora`) at a chosen LoRA scale and size.
- **Hide**: the owner can hide a LoRA or a generated image from the public pages. Hidden ones are listed at `/hidden` and `/hidden-generations`.
- **Are.na**: channels are read through the dmbk API (`arenaChannel`, `viewer.arena`), which uses Are.na's v3 API without credentials, so only public and closed channels can be used. The picker lists your own channels and your groups' channels, up to 100 images per channel.
- **Storage**: training images, the training zip, LoRA weights and generated images are mirrored to DigitalOcean Spaces. A generated image whose mirror failed keeps its fal.media URL.

Browsing is public. Training, generating and hiding need a signed-in account (see [Auth](#auth)).

## Getting Started

### Prerequisites

- Node.js 20 or later (Vercel builds on 24.x)
- npm

### Environment Variables

Create `.env.local` in the project root (or run `vercel env pull .env.local`):

```env
# Auth (Google, via the dmbk accounts API)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<the dmbk web OAuth client ID>
DMBK_GRAPHQL_API_URL=https://graphql.dmbk.network/graphql  # optional, this is the default
DMBK_GRAPHQL_API_KEY=<this app's key for the dmbk API>      # server-only; required in production

# Database (MongoDB)
MONGODB_URI=mongodb+srv://user:pass@your-cluster.mongodb.net/lora-trainer

# FAL.ai (server-side only)
FAL_AI_API_KEY=your_fal_ai_api_key

# DigitalOcean Spaces (mirrored images and weights)
DO_SPACES_ENDPOINT=https://<region>.digitaloceanspaces.com
DO_SPACES_REGION=<region>
DO_SPACES_KEY=...
DO_SPACES_SECRET=...
DO_SPACES_BUCKET=...
DO_SPACES_CDN_URL=https://<bucket>.<region>.cdn.digitaloceanspaces.com
```

Each feature checks its own variables when it's used, so the app still serves pages with only some of them set.

### Database

App data lives in MongoDB: `lora_trainings` and `generated_images`. The database name comes from the URI path, defaulting to `lora-trainer`. Collections and indexes are created on first use. Accounts are not stored here: they live in the dmbk GraphQL API.

### Run Dev Server

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Google sign-in only works on authorized origins, so use `http://localhost:3000` or plain `http://localhost` (`npx next dev -p 80`), not another port.

`npm run typecheck` runs `tsc --noEmit`.

## Deploy on Vercel

Pushes to `main` deploy to production. Set these in the Vercel project:

| Variable                       | Description                                                  |
| ------------------------------ | ------------------------------------------------------------ |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | The dmbk web OAuth client ID (same client the API verifies)  |
| `DMBK_GRAPHQL_API_URL`         | Optional; defaults to `https://graphql.dmbk.network/graphql` |
| `DMBK_GRAPHQL_API_KEY`         | This app's key for the dmbk API, sent as `x-api-key`; issued with `npm run api-client -- create lora-trainer` in dmbk-graphql-api. Never `NEXT_PUBLIC_` |
| `MONGODB_URI`                  | MongoDB connection string                                    |
| `FAL_AI_API_KEY`               | [FAL.ai](https://fal.ai/dashboard) API key                   |
| `DO_SPACES_*`                  | DigitalOcean Spaces config, as above                         |

## Architecture

A standalone Next.js app (no monorepo).

- **Pages Router** (`src/pages/`): pages with tRPC + React Query.
- **tRPC backend** (`src/server/api/`): routers for `fal` (training), `lora`, `generate`, `arena`, `slideshow`. Mounted at `/api/trpc`. `arena` calls the dmbk API through `dmbk-api.ts`, passing the viewer's session token.
- **Auth** (`src/server/auth/session.ts`, `src/pages/api/session.ts`): Google sign-in through the dmbk GraphQL API.
- **UI**: [Reshaped](https://reshaped.so) with a custom "lora-trainer" theme.
- **Database**: MongoDB (native driver).
- **Scripts** (`scripts/`): one-off migrations from earlier versions (FAL → Spaces, channel titles).

## Auth

Accounts belong to the [dmbk GraphQL API](https://github.com/dblodorn/dmbk-graphql-api) (`graphql.dmbk.network`). It verifies Google ID tokens and decides who may sign in (`ALLOWED_EMAILS`) and who is an admin (`ADMIN_EMAILS`).

1. Google Identity Services renders the button and returns an ID token.
2. `POST /api/session` trades it with the API's `signInWithGoogle` for a session token. That token is stored in an HTTP-only `lora_trainer_session` cookie, so page scripts never see it.
3. Each tRPC request resolves the viewer by asking the API's `viewer { id email name isAdmin }` with that token. Nothing is cached, so revoking a session, or removing an email from the API's lists, takes effect at the next request.

Training and generation spend fal.ai credit and there is no payment step, so only admins can hold a session for now. LoRAs and generated images are owned by `ownerId`, the account's id at the API.

Sign-in works on `https://arenatrainer.dmbk.io` and localhost, but not on Vercel preview URLs, which aren't authorized origins on the Google OAuth client.
