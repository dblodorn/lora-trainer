# Design

## Context

- The app has 9 pages/components using tRPC hooks for API-owned data: `lora.list/listHidden/getById/hide/unhide`, `generate.listByLora/listHiddenImages/hideImage/unhideImage`, `slideshow.randomImages` and the five `arena.*` procedures. The FAL procedures are `fal.*`, `generate.images` and `lora.complete`. They are called from the training flow (`index.tsx`, `TrainingProgress`) and `GenerateModal`.
- Mongo is written in four places: `fal.trainLora` (create the pending record, then two `$set`s for the zip and mirrored images), `lora.complete` (weights, status, backfilled mirrors) and `generate.images` (one insert per image). The other Mongo calls are reads or hide toggles.
- Server-side API access already exists. `callApi` in `src/server/auth/session.ts` sends `x-api-key` and the bearer token, `dmbkApi` maps API error codes to tRPC ones, and `protectedProcedure` carries `ctx.sessionToken`.
- dmbk-photo already runs this pattern in the App Router: `scripts/relay.mjs`, `relay.config.json` with `persistConfig`, `compiler.relay` in `next.config.ts`, a same-origin proxy route and a `fetchFn` that sends `{ id, variables }`. This app is Pages Router, and only admins hold sessions (`resolveViewer`).
- The API identifies trainings and images by Relay global IDs. Today's URLs (`/loras/[id]`) and Spaces keys use the raw Mongo `_id`.

## Goals / Non-Goals

**Goals:**
- One Relay environment for all API reads and writes in the browser, with a normalized store so a hide toggle updates every list that shows the record.
- The FAL procedures keep their current inputs and outputs, so the training and generation UI changes as little as possible.
- Ship in an order where each deploy can be reverted on its own.

**Non-Goals:**
- Server-side rendering or prefetching of Relay queries. Pages stay client-fetched.
- Moving FAL calls or Spaces mirroring into the API.
- Changing who may sign in. That stays admins-only, set in `resolveViewer`.
- Typing the server-side API calls with the Relay compiler (see Decision 6).

## Decisions

### 1. Proxy at `src/pages/api/graphql.ts`, forwarding anonymous requests too
This is a port of dmbk-photo's route (same-origin check via `Sec-Fetch-Site`/`Origin`, `Object.hasOwn` lookup in the persisted map, `no-store`) with one difference. When there is no session cookie, the operation is forwarded without `Authorization` instead of being refused, because the gallery, LoRA pages and slideshow are public. The API's own rules then return owner-only fields as null. Forwarding still goes through `callApi`, so the key is added in one place.
- *Alternative:* the browser calls the API directly for public reads. Rejected because the API key would have to be public, which the API's `api-access` spec forbids (keys are server-side only), and there would be two network paths to maintain.
- *Alternative:* a second, unauthenticated proxy. Rejected because the persisted allowlist already limits what can be run, so one route is enough.

### 2. Persisted operations only, git-ignored and rebuilt
The persisted map lives at `src/server/graphql/persisted-operations.json` (SHA256), seeded by a `scripts/relay.mjs` copy. `relay` runs before `dev`, `build` and `typecheck`, so the husky pre-push hook compiles it too. Vercel builds produce the map that the proxy imports, so the route and the client always come from one build. `relay.config.json` excludes `src/server/**` and `__generated__/**`.

### 3. Idiomatic Relay in components: queries at page roots, fragments below
Each page has one `useLazyLoadQuery` and its components read fragments: `LoraRow_training`, `ImageCard_image` and so on. Image lists use `usePaginationFragment` over `LoraTraining.images`. Hide/unhide use `useMutation`, and their payloads return the node with `hidden` so the store updates in place. Leaving a record in or out of a filtered list follows the dmbk-photo rule: it stays in an unfiltered list and leaves a filtered one.
- *Alternative:* dmbk-photo's `fetchQuery` into local state. Rejected because that loses the shared store, which is the main reason to adopt Relay here, and its screens are a smaller admin tool.

### 4. Client-only rendering boundary
Pages Router prerenders pages with no data function, so a `useLazyLoadQuery` would run during the build against a relative URL. Each page renders its query component only after mount (a small `ClientOnly` wrapper), with a loader shown before then. Every query component sits under a `<Suspense>` and an error boundary, which is how the spec's "degrade per feature" requirement is met: one failed query shows that feature's error state and the shell stays up.

### 5. FAL procedures persist through API mutations, using the viewer's token
The procedures call `dmbkApi(mutation, vars, ctx.sessionToken)`, so the API sees the viewer and applies ownership itself. The app-side `isOwner` checks go away. The mapping:
- `fal.trainLora` → `loraTrainerCreateTraining` right after `queue.submit`. Then it mirrors to Spaces, and then calls one `loraTrainerSetTrainingAssets` (zip URL, mirrored image URLs). This replaces the two `$set`s with one call, so a failed mirror means that call simply isn't made. If create fails, the error is logged and the request id is still returned, as today.
- `lora.complete` moves to `fal.completeTraining`, since its job is mirroring the weights. It reads the training via `viewer.loraTrainerTrainingByRequestId` (the client only has the request id after a reload), mirrors the weights and backfills the images, then calls `loraTrainerCompleteTraining`. The lookup only sees the viewer's own trainings, so another account's request id reads as missing and is refused as NOT_FOUND before anything is written. The API's ownership check on `loraTrainerCompleteTraining` stays as the backstop, and the API owns the "already completed is a no-op" rule.
- `generate.images` moves to `fal.generateImages`. It reads the LoRA via `node(id:)`. A null result (missing, or hidden from this viewer) means NOT_FOUND, and a non-completed status means BAD_REQUEST, both before FAL is called. After FAL returns, it generates each image's id (32 hex, as today), mirrors to `images/{loraId}/{id}.{ext}`, and then calls `loraTrainerRecordImages` once with every image and its id. The API checks the id's format and that it's unused. The response shape keeps today's fields and adds each image's global `id`.

After a FAL procedure writes, the client invalidates the affected Relay data by refetching (`fetchPolicy: "network-only"`) the LoRA page query or its images connection. It doesn't hand-write store updates from tRPC results, because the refetch costs one request and can't drift from the API's view.

### 6. Server-side operations stay as typed string constants
The handful of server-side queries and mutations live in `src/server/api/lora-api.ts` as template strings with hand-written result types, next to `dmbkApi`. These are trusted calls that don't go through the proxy. Running them through the Relay compiler would put them in the browser allowlist, which they shouldn't be in.
- *Alternative:* graphql-codegen for server strings. Deferred, since it's a second compiler for about 6 operations.

### 7. Keep raw ids in URLs and convert at the edges
`/loras/[id]` keeps the raw `_id`, so shared links keep working. A `toTrainingGlobalId` / `fromTrainingGlobalId` pair (base64 `LoraTraining:<id>`, matching the API's Pothos encoding, as dmbk-photo's `photo-id.ts` does) converts in pages and in `lora-api.ts`. Spaces keys keep using the raw id.

### 8. tRPC and react-query stay, trimmed
`_app.tsx` mounts both providers. The tRPC router keeps only `fal`. `db.ts`, `lora.ts`, `generate.ts`, `slideshow.ts`, `arena.ts`, the `mongodb` dependency and the Mongo branch of `env.ts` are deleted. The two Mongo scripts in `scripts/` (`migrate-fal-to-spaces.mts`, `backfill-channel-titles.mts`) were one-off runs that are already finished, so they're deleted too. The `migrate:fal-to-spaces` npm script goes with them.

### 9. Companion API change defines the missing schema
This change depends on the API change `lora-trainer-writes` (`dmbk-graphql-api/openspec/changes/lora-trainer-writes/`), which is the authority for names and shapes:
- **Mutations:** `loraTrainerCreateTraining`, `loraTrainerSetTrainingAssets`, `loraTrainerCompleteTraining`, `loraTrainerRecordImages`. All need a signed-in viewer and enforce ownership. Mirror URLs must be under the Spaces CDN's `lora-trainer/` prefix.
- **Queries:** `Viewer.loraTrainerTrainingByRequestId(requestId)` and `loraTrainerSlideshowImages(count)`, which returns `{ url }` items, visible records only.
- **Already there:** the hidden lists are `viewer.loraTrainerTrainings(visibility: HIDDEN)` and `viewer.loraTrainerImages(visibility: HIDDEN)`.
- This app compiles against whatever ships, via `schema:pull:api`.

## Risks / Trade-offs

- **The API is now on every page's critical path, including writes after expensive FAL calls.** If `loraTrainerRecordImages` fails after FAL has charged for generation, the images are lost to the gallery. → Retry the record call once. On a second failure, still return the FAL URLs to the client (which shows them) and log the payload, so the record can be replayed by hand.
- **Training record creation can fail with no record to complete later.** This is today's behavior too. → `fal.completeTraining` refuses with a clear "no record for this request" error. Recovery is a manual create, which stays a rare case.
- **Schema drift breaks the build.** → This is intended: `relay` runs in `typecheck` and pre-push. `schema:pull:api` is run on purpose and the result is committed, so a deploy never picks up an unreviewed schema.
- **The proxy is one more server hop for public reads**, and the Vercel function cold start adds latency to the gallery. → This is acceptable for an admin-led app. The proxy returns `no-store`, and CDN caching of public reads can come later.
- **Raw ↔ global id conversion is duplicated knowledge of Pothos' encoding.** → It's kept in one module with a comment pointing at the API, as dmbk-photo does.
- **Client-only rendering means a loader on first paint for every page.** → This is the same as today's tRPC behavior, so nothing gets worse.

## Migration Plan

1. **API:** ship the companion change. It's additive, so the current app is unaffected.
2. **This app, one PR:** Relay setup, proxy, the page and component rewrites, the FAL procedures switched to the API, Mongo removed. Before merging, verify locally against a local API (`DMBK_GRAPHQL_API_URL=http://localhost:4000/graphql`): train a small LoRA, complete it, generate, hide/unhide, the hidden lists and the slideshow, signed in and signed out.
3. **Deploy.** Rollback is a Vercel redeploy of the previous build. The data is safe because both versions write the same document shapes to the same collections, the old one directly and the new one through the API.
4. **After a week with no rollback:** remove `MONGODB_URI` from the Vercel project and the Mongo credentials scoped to this app.

## Implementation Notes

Where the implementation departs from the decisions above:

- **Two imperative fetches (Decision 3).** The background slideshow (`ImageSlideshow`) and the Are.na channel loader (`useArenaChannelImages`) use `fetchQuery` rather than `useLazyLoadQuery`. The slideshow refills its own queue as it plays and must stay blank, not throw, on failure. The channel loader follows up to five Are.na pages to collect 100 images. Neither renders store records (Are.na images aren't nodes), so the shared store gains nothing from a suspending query. They still go through the same environment and proxy.
- **Image grids take plain props.** `GeneratedImageGrid` and `SlideshowModal` are shared with `GenerateModal`'s results, which come from tRPC and aren't in the store. So the list components (`LoraImages`, `HiddenGenerations`) read the image fields in their pagination fragments and pass objects down. Hide toggles still update the store, and `@deleteEdge` drops a toggled image from the filtered connection it was shown in.
- **Owner detection.** The API has no `isOwner` field. `hidden` is owner-only (null for anyone else), so a non-null `hidden` means the viewer owns the record.
- **Viewer refetches.** `Viewer` has no global ID, so mutation payloads that return `viewer` can't update other queries' viewer records in place. `ArenaUsername` refetches after a change, and the channel picker uses `store-and-network`. The gallery and hidden lists also use `store-and-network`, so a hide toggled on a LoRA page shows there when they're next visited.
- **Hidden LoRA list.** `viewer.loraTrainerTrainings(visibility: HIDDEN)` returns every status. The page filters to completed ones, as the old list did.
- **`@types/react-relay` / `@types/relay-runtime` aren't installed.** Relay 21 ships its own types (as in dmbk-photo), and the DefinitelyTyped packages lag behind at 18.x/20.x.
- **Non-string `id` fields are aliased.** Relay's store keys records by any field named `id` and fails on a non-string. `ArenaImage.id` is an Int, so it's read as `blockId`. The same applies to `Viewer.id` (a String, but not a global ID) and the Are.na types' ids if a query ever needs them.
- **`arenaChannelUrl` is upgraded to https** before `loraTrainerCreateTraining`, since the API takes https only and the channel form accepts `http://are.na/...`.

## Open Questions

- Whether the proxy should send `cache-control` with a short `s-maxage` for anonymous public reads. That's a tuning choice that doesn't change behavior and can be measured after launch.
