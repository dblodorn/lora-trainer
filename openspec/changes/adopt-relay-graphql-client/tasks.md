# Tasks

## 1. Prerequisite: companion API change

- [x] 1.1 Ship the `dmbk-graphql-api` change `lora-trainer-writes` (design §9: the four `loraTrainer*` mutations, `Viewer.loraTrainerTrainingByRequestId`, `loraTrainerSlideshowImages`). Verify they appear in production introspection at graphql.dmbk.network.
  - Shipped 2026-10-26 (API PR #28, `f3ae958`); all six fields are in production introspection.
- [ ] 1.2 Check that the API writes the same document shapes the app writes today (`LoraTrainingDoc` / `GeneratedImageDoc` in `src/server/api/db.ts`). Verify by creating a training and an image through the API against a local DB and diffing the fields with an existing record.

## 2. Relay setup

- [x] 2.1 Add `react-relay`, `relay-runtime`, `relay-compiler`, `@types/react-relay` and `@types/relay-runtime` with npm. Verify that `npm ls react-relay relay-compiler` resolves.
  - Relay 21 ships its own types, so the two `@types` packages aren't installed (design: Implementation Notes). `npm ls` resolves `react-relay`, `relay-runtime` and `relay-compiler` 21.0.1.
- [x] 2.2 Port dmbk-photo's `scripts/fetch-api-schema.mjs` as `npm run schema:pull:api`, writing `schemas/dmbk-graphql-api.graphql`. Commit the pulled schema and verify it contains the §1.1 fields.
  - Pulled from production on 2026-10-26; contains all six §1.1 fields.
- [x] 2.3 Add `relay.config.json` (src `./src`, persistConfig → `src/server/graphql/persisted-operations.json`, excludes `src/server/**` and `__generated__/**`) and the matching `compiler.relay` in `next.config.ts`. Verify that `npm run build` accepts the config.
  - `npm run build` passes with the config; all pages prerender.
- [x] 2.4 Port `scripts/relay.mjs` (it seeds an empty persisted map) and add `relay` to `dev`, `build` and `typecheck`. Git-ignore `__generated__/` and the persisted map. Verify that `npm run typecheck` runs the compiler on a fresh clone with no map.
  - With `__generated__/` and the map deleted, `npm run typecheck` seeded the map, compiled 17 operations and passed. The husky `pre-push` hook now runs `scripts/relay.mjs` before `tsc`.
- [x] 2.5 Add `src/lib/relay/environment.ts`: a `fetchFn` that posts `{ id, variables }` to `/api/graphql`, refuses non-persisted operations and raises the API's error code. Mount `RelayEnvironmentProvider` in `_app.tsx` next to the tRPC provider. Verify that the app boots with `npm run dev`.
  - `next dev` boots and serves `/api/graphql`. The client bundle carries persisted ids for all 17 operations and no query text.
- [x] 2.6 Add the `ClientOnly` wrapper and a shared feature error boundary (Reshaped `Alert`). Verify that a component that throws inside it shows the alert while the nav still renders.
  - Headless Chrome on 2026-10-26, API URL pointed at a dead host: `/loras` and `/loras/<id>` each showed their own alert ("The dmbk API could not be reached.") with the nav still rendered.
- [x] 2.7 Add `src/lib/relay/ids.ts` (`toTrainingGlobalId`/`fromTrainingGlobalId`, plus the same pair for images) with a comment pointing at the API's Pothos encoding. Verify it round-trips an id taken from a live `loraTrainerTrainings` response.
  - A live `loraTrainerTrainings` id decoded to a 32-hex id and re-encoded to the same global ID; decoding it as an image id is refused.

## 3. GraphQL proxy

- [x] 3.1 Add `src/pages/api/graphql.ts`: POST only, same-origin check, persisted-id lookup with `Object.hasOwn`, the session cookie forwarded as a bearer token when present and absent otherwise, forwarding through `callApi`, `no-store` and a 502 when the API is unreachable. Verify with curl: a cross-origin request gets 403, an unknown id 400, a raw `query` 400 without the API being called, and a signed-out persisted read 200 with owner-only fields null.
  - curl on 2026-10-26: cross-site 403, no `Sec-Fetch-Site`/`Origin` 403, unknown id 400, `"constructor"` 400, raw `query` body 400, GET 405, signed-out gallery and slideshow reads 200 (via `Sec-Fetch-Site` and via `Origin`), and a signed-out `LoraDetailQuery` returns `hidden: null`.
- [ ] 3.2 Verify that a signed-in request reaches the API with both `Authorization` and `x-api-key` (local API request log), and that neither value shows up in the browser's network tab or page source.

## 4. Pages and components to Relay

- [x] 4.1 Gallery (`index.tsx` list area, `LoraGallery`, `LoraRow`): a `loraTrainerTrainings` query with a `LoraRow_training` fragment. Verify that the gallery lists the same trainings as production.
  - The API list matches production's `lora.list` exactly: 15 trainings, same ids, same order. `/loras` renders them in headless Chrome with no exceptions.
- [ ] 4.2 LoRA page (`pages/loras/[id].tsx`, `GeneratedImageGrid`, `ImageCard`): a `node(id:)` query from the raw id, plus `usePaginationFragment` over `images`. Verify that an existing `/loras/<raw id>` link renders, and that a hidden LoRA shows "unavailable" when signed out.
  - Partly checked: signed out, an existing `/loras/<raw id>` renders with its images, and a missing id shows "LoRA unavailable". Still open: a hidden LoRA signed out (needs a hidden id).
- [ ] 4.3 Hide toggles (`LoraHideToggle`, `GeneratedImageHideToggle`) to `loraTrainerSet*Hidden` mutations. Verify that toggling updates every visible list without a reload, and that a non-owner's toggle is refused.
- [ ] 4.4 Hidden lists (`pages/hidden.tsx` + `HiddenLoraGallery`, `pages/hidden-generations.tsx`) to `viewer.loraTrainerTrainings` / `loraTrainerImages` with `visibility: HIDDEN`. Verify they match the old tRPC lists for the signed-in owner.
  - Partly checked: signed out, both pages render "Sign in to see…". Still open: the signed-in comparison.
- [ ] 4.5 Slideshow (`ImageSlideshow`, `SlideshowModal`) to `loraTrainerSlideshowImages`. Verify it plays, and that a hidden image never appears in it.
- [ ] 4.6 Are.na (`ArenaUsername`, `ArenaChannelPicker`, `ArenaChannelFetcher`) to the API's `arena*` queries and mutations. Verify that setting and clearing the Are.na user and loading a channel's images work end to end.
- [x] 4.7 Wrap each page's query component in `ClientOnly`, `Suspense` and the error boundary. Verify that `npm run build` prerenders every page without network errors, and that with the API URL pointed at a dead host each feature shows its error while the shell renders.
  - `npm run build` prerenders every page with no network calls. With the API at a dead host, the gallery and LoRA page show their errors, the proxy answers 502, the nav renders, and the slideshow logs the failure and stays blank.

## 5. FAL procedures persist through the API

- [x] 5.1 Add `src/server/api/lora-api.ts` with the server-side operation strings, their result types and id conversion, all calling `dmbkApi(…, ctx.sessionToken)`. Verify with `npm run typecheck`.
  - `tsc --noEmit` passes.
- [ ] 5.2 `fal.trainLora`: create through the API after `queue.submit`, mirror, then one `loraTrainerSetTrainingAssets`. Log a create failure and still return the request id. Verify that a training submitted locally shows up pending in the API with the zip and mirrored URLs, and that with create forced to fail the request id is still returned.
  - Partly checked 2026-10-26 (local, production API, no Spaces keys): `trainLora` queued request `01a17927-…` and created training `08f8e465…` owned by the viewer, with trigger word, steps, 9 source URLs, channel URL and title. All mirrors failed (no Spaces config), so no assets call was made and the request still returned. Still open: the zip/mirror URLs with Spaces configured, and a forced create failure.
- [ ] 5.3 Move `lora.complete` to `fal.completeTraining` (look up via `viewer.loraTrainerTrainingByRequestId`, mirror the weights, backfill the images, `loraTrainerCompleteTraining`) and switch `TrainingProgress` to it. Verify that completing marks the record completed, that a repeat completion is a no-op, that a non-owner is refused as NOT_FOUND with the record unchanged, and that with Spaces creds removed the record keeps the FAL weights URL.
  - Partly checked 2026-10-26: `fal.completeTraining` marked `08f8e465…` COMPLETED. The weights mirror failed without Spaces config, so the record kept the fal.ai weights URL. Still open: a repeat completion and the non-owner case (the API's own suite covers both at the API).
- [ ] 5.4 Move `generate.images` to `fal.generateImages`: read the LoRA via `node`, check visibility and status before calling FAL, generate each image id before mirroring, then one `loraTrainerRecordImages` (with those ids) with a single retry. On a second failure, return the FAL URLs and log the payload. Switch `GenerateModal` to it and refetch the LoRA's images connection afterwards. Verify that new images appear on the LoRA page without a reload, that a pending or hidden LoRA fails before any FAL call, and that a forced record failure still shows the images and logs the payload.

## 6. Remove direct Mongo access

- [x] 6.1 Delete `src/server/api/db.ts`, the `lora`, `generate`, `slideshow` and `arena` routers and their registration in `src/server/api/index.ts`, and the Mongo keys in `src/server/api/env.ts`. Verify that `grep -rn "mongodb\|getDb" src` returns nothing.
  - `grep -rn "mongodb\|getDb" src` is empty.
- [x] 6.2 Delete `scripts/migrate-fal-to-spaces.mts`, `scripts/backfill-channel-titles.mts` and the `migrate:fal-to-spaces` npm script, then uninstall `mongodb`. Verify that `npm ls mongodb` is empty and `npm run build` passes.
  - `npm ls mongodb` is empty and `npm run build` passes.
- [ ] 6.3 Verify that the app runs end to end with `MONGODB_URI` unset in `.env.local`.

## 7. Verification and docs

- [ ] 7.1 Run `npm run typecheck`, `npx eslint .` and `npm run build`, and confirm all three are clean.
- [ ] 7.2 Do a full manual pass against a local API (`DMBK_GRAPHQL_API_URL=http://localhost:4000/graphql`), signed in and signed out: train a small LoRA, complete it, generate, hide and unhide, check the hidden lists, the slideshow and the Are.na picker. Note the results in the PR.
- [x] 7.3 Update `CLAUDE.md` and `README.md`: the Relay/proxy architecture, the `relay` and `schema:pull:api` commands, removing `MONGODB_URI`, and the proxy's reliance on `DMBK_GRAPHQL_API_KEY`. Verify that neither file still mentions `getDb` or the removed routers.
  - Neither file mentions `getDb`, Mongo or the removed routers.

## 8. Rollout

- [ ] 8.1 Deploy to production and watch the Vercel runtime errors for `/api/graphql` and `/api/trpc` over a day. Verify that no new error classes appear.
- [ ] 8.2 After a week with no rollback, remove `MONGODB_URI` from the Vercel project and revoke this app's Mongo credentials. Verify that production still works afterwards.
