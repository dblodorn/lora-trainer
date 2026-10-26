# Proposal

## Why

Accounts and Are.na now come from dmbk-graphql-api, and the API already exposes LoRA trainings and generated images as Relay nodes (`loraTrainerTrainings`, `LoraTraining.images`, `loraTrainerSet*Hidden`). lora-trainer still opens its own Mongo connection for the same `lora_trainings` / `generated_images` data. That leaves two writers to one database with two copies of the ownership and visibility rules. Moving every Mongo read and write behind the API, and reading that data in the UI with Relay (as dmbk-photo already does), makes the API the only owner of the data. tRPC stays for what is genuinely local to this app: the FAL.ai calls.

## What Changes

- **Relay is the client for API data.** Pages and components read trainings, generated images, the viewer and Are.na channels with Relay fragments and queries compiled against a checked-in copy of the API schema. They write with Relay mutations (hide/unhide, Are.na user).
- **Same-origin GraphQL proxy.** The browser posts persisted Relay operations to an app route (e.g. `/api/graphql`). The route checks that the request is same-origin, reads the HTTP-only `lora_trainer_session` cookie and forwards the operation with `Authorization: Bearer <session>` and the app's `X-API-Key`. Neither secret reaches page scripts. This follows dmbk-photo's `/api/admin/graphql`.
- **tRPC narrows to FAL.** The `fal` router keeps the image download/zip, training submit/status/cancel/result and image generation. Where these procedures persist records today, they call API mutations server-side instead of `getDb()`: create the pending training, attach the Spaces mirror URLs, complete the training with its weights URL, and record generated images.
- **Removed:** `src/server/api/db.ts`, the `lora`, `generate` (list/hide parts), `slideshow` and `arena` tRPC routers, and the `mongodb` dependency. Their reads and writes move to Relay or to the API mutations above.
- **BREAKING (deploy):** `MONGODB_URI` is no longer used. The proxy relies on `DMBK_GRAPHQL_API_KEY`, which the app already sends and the API already enforces (its `api-access` spec).
- **BREAKING (prerequisite):** the API must first gain the operations this app needs that don't exist yet. These are the owner-scoped mutations listed above, a lookup of the viewer's training by fal.ai request id, and the slideshow. (The hidden lists already exist as `viewer.loraTrainerTrainings` / `loraTrainerImages` with `visibility: HIDDEN`.) That work is the companion change `lora-trainer-writes` in `dmbk-graphql-api`, and it must ship before this one is switched over.
- **Not changed:** what users see and can do. Training, generation, hiding and the slideshow behave as they do now. Spaces mirroring stays best-effort and app-side.

## Capabilities

### New Capabilities

- `graphql-data-access`: how lora-trainer reaches persistent data. All Mongo data goes through dmbk-graphql-api, and the app holds no database connection. Browser reads and writes are Relay operations sent through the same-origin proxy, which attaches the session and API key. The proxy accepts only persisted operations from this origin. FAL work stays in tRPC and persists its results through API mutations, with mirroring failures still non-fatal.

### Modified Capabilities

(none. The project has no existing specs.)

## Impact

- **Code (this repo):** new Relay environment and provider in `_app.tsx`, `relay.config.json`, `compiler.relay` in `next.config.ts`, `schemas/dmbk-graphql-api.graphql` plus a pull script, and the proxy route with its persisted-operations map. Pages under `src/pages/` and their components get rewritten from `trpc.*` hooks to Relay. `features/fal.ts` and the generation procedure switch from `getDb()` to API calls through `src/server/api/dmbk-api.ts`. `src/server/api/db.ts` and four routers are deleted.
- **Dependencies:** add `react-relay`, `relay-runtime`, `relay-compiler` (+ types). Remove `mongodb`.
- **Scripts:** `npm run relay` runs before `dev`, `build` and `typecheck` (so the husky pre-push check includes it). `scripts/*.mts` migrations that write Mongo directly stay as historical one-offs or are removed.
- **dmbk-graphql-api:** a companion change adds the missing LoRA mutations and queries. Schema changes there now break this app's Relay compile, which is louder and earlier than before.
- **Pages Router:** Relay runs client-side only. There is no SSR prefetch, which matches how pages fetch today.
- **Docs:** `CLAUDE.md` / `README.md` (architecture, env vars, commands).
