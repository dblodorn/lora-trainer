# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Next.js 16 **Pages Router** app (not App Router) that trains FLUX LoRAs on FAL.ai from Are.na images and generates images with them. Live at arenatrainer.dmbk.io; pushes to `main` deploy to production on Vercel. `README.md` has the feature overview, env vars and the auth flow. This file only adds what README doesn't cover.

## Commands

Use **npm** (there is a `package-lock.json`).

- `npm run dev`: dev server on :3000. Google sign-in only works on `http://localhost:3000` or `http://localhost` (`npx next dev -p 80`). Other ports and Vercel preview URLs aren't authorized origins.
- `npm run relay`: the Relay compiler. `dev`, `build` and `typecheck` run it first. It writes `__generated__/` beside each file and the proxy's allowlist `src/server/graphql/persisted-operations.json`, both git-ignored.
- `npm run schema:pull:api`: refresh `schemas/dmbk-graphql-api.graphql` (checked in) from the API. Run it on purpose when the API changes, then commit it; the compiler validates against this copy.
- `npm run typecheck`: `relay` then `tsc --noEmit`. The `pre-push` husky hook runs both and blocks the push if either fails.
- `npm run build`
- `npm run lint`: `eslint .`, with `eslint-config-next`'s flat configs imported directly in `eslint.config.mjs` (going through `FlatCompat` crashes ESLint 9). It includes the React Compiler rules, so reset state during render or with a `key`, not by setting it in an effect.
- There is no test runner. The files in `src/server/api/features/__tests__/` are empty placeholders.

## Architecture

- **Relay for all API data.** Trainings, generated images, hiding, the slideshow and Are.na are Relay queries, fragments and mutations in the components (`src/lib/relay/environment.ts`, mounted in `_app.tsx`). The browser posts `{ id, variables }` to `src/pages/api/graphql.ts`, which accepts only same-origin POSTs for ids in the persisted map, and forwards with the session cookie as a bearer (none when signed out) and the API key, via `callApi`. Query components render under `FeatureBoundary` (client-only, Suspense, error alert), because pages are prerendered with no data. The slideshow and the Are.na channel loader use `fetchQuery` imperatively. URLs keep raw training ids; `src/lib/relay/ids.ts` converts to and from the API's global IDs. Owner-only fields (`hidden`) are null for anyone else, which is how the UI decides who sees the hide toggles.
- **tRPC only for fal.ai** (`src/server/api/index.ts`, the `fal` router, mounted at `src/pages/api/trpc/[trpc].ts`, client `src/utils/trpc.ts`). Its procedures save results through the API as the viewer (`src/server/api/lora-api.ts`, server-side strings, deliberately not compiled by Relay so they stay out of the browser allowlist).
- **Auth is remote.** There are no users in this app. `createContext` resolves the viewer on every request by calling the dmbk GraphQL API (`viewer { id email name isAdmin }`) with the token from the HTTP-only `lora_trainer_session` cookie (`src/server/auth/session.ts`). Nothing is cached. `protectedProcedure` (`src/server/api/trpc.ts`) requires a viewer. Ownership and visibility are the API's rules; this app applies none of its own. The browser side (`src/lib/session.ts`) only talks to `/api/session`.
- **`DMBK_GRAPHQL_API_URL` defaults to production** (`https://graphql.dmbk.network/graphql`), and a local run reads and writes production records unless you override it. `dmbkApi` (`src/server/api/dmbk-api.ts`) is the server-side caller, mapping the API's error codes to tRPC ones. Schema changes in `../dmbk-graphql-api` break the Relay compile once the schema copy is pulled.
- **Env handling is lazy on purpose.** `src/server/api/env.ts` parses every key as optional. Procedures call `requireFalApiKey()` or `requireSpacesConfig()` at the point they need them, so a missing key breaks only that feature, not the whole router. Keep new integrations on this pattern. `src/env.ts` (strict schema) is not imported anywhere.
- **No database.** The `lora_trainings` / `generated_images` collections belong to the API (dmbk-graphql-api's `lora-trainer-records` spec). Don't add a direct connection back.
- **Training flow** (`features/fal.ts`): download the Are.na images (SSRF-guarded by `validateImageUrl`/`isPrivateIP`, with concurrency and size limits), zip them, upload the zip to FAL storage, then `fal.queue.submit("fal-ai/flux-lora-fast-training")` and `loraTrainerCreateTraining` (a failure there is logged; the request id is still returned). The client polls `getTrainingStatus`/`getTrainingResult`, and `fal.completeTraining` mirrors and stores the weights. `fal.generateImages` checks the LoRA through the API before calling fal.ai, picks each image's id before mirroring, and records the batch with one retry; if both attempts fail it still returns the images and logs the payload for a manual replay.
- **Spaces mirroring is best-effort** (`features/storage.ts`: `uploadToSpaces`, `mirrorUrlToSpaces`). Training images, the zip, the weights and generated images are copied to DigitalOcean Spaces. If a mirror fails, the error is logged and the original FAL URL is kept (`cdnUrl` null). Don't make the request fail on a mirror error. When you add a remote image host, also add it to `images.remotePatterns` in `next.config.ts`.
- **UI**: Reshaped components with the custom `lora-trainer` theme (`src/themes/lora-trainer/`, `reshaped.config.js`). PostCSS custom media is in `media.css`.
- `.hermes/plans/` holds dated design notes from earlier feature work. They're useful history, but the code is authoritative.
