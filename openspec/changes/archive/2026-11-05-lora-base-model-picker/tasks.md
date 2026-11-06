# Tasks

## 1. Preflight

- [x] 1.1 Confirm that dmbk-graphql-api `lora-model-tracking` is deployed and backfilled, then run `npm run schema:pull:api` and commit `schemas/dmbk-graphql-api.graphql`. Verify that the schema file contains `trainerModel: String!` on `LoraTraining`, `generatorModel: String!` on `GeneratedImage`, and both mutation inputs, and that `npm run typecheck` passes.

## 2. Catalog

- [x] 2.1 Add `src/lib/lora-models.ts` per design §1–3: five entries with the endpoints, input builders, weights extractors, generation settings and default steps from the design's table, plus `DEFAULT_LORA_MODEL`, `loraModelKeySchema`, `modelForTrainer` and `loraModelLabel`. Verify with `npm run typecheck` and `npm run lint`, and check that the FLUX.1 entry's `trainingInput` and `generationInput` produce exactly the objects `fal.ts` sends today.

## 3. Server

- [x] 3.1 `trainLora` takes `model` (default `flux-1-dev`), submits `model.trainingInput(...)` to `model.trainer`, and sends `trainerModel: model.trainer` to `loraApi.createTraining`. Verify with `npm run typecheck`. An unknown key is refused by zod before any download.
- [x] 3.2 `getTrainingStatus`, `cancelTraining` and `getTrainingResult` take `{ requestId, model }` and use `model.trainer`. `getTrainingResult` returns `{ loraWeightsUrl, requestId }` (design §4). Verify with `npm run typecheck`.
- [x] 3.3 `lora-api.ts`: add `trainerModel` to `LORA_FIELDS` / `LoraRecord`, `trainerModel` to `createTraining`'s input, and `generatorModel` to `recordImages`. `generateImages` resolves the model with `modelForTrainer` (`BAD_REQUEST` when it's unknown), calls its generator with its settings, and records `generatorModel` (also in the replay log). Verify with `npm run typecheck`.

## 4. UI

- [x] 4.1 Add `model` to `formSchema` / `FormData` (default `flux-1-dev`), and add a model `Select` with each option's description to `TrainingSettings.tsx`. Changing the model resets `trainingSteps` to that model's default. Verify in `npm run dev` that the picker lists five models, starts on FLUX.1 dev, and moves steps to 2000 when Z-Image is picked.
- [x] 4.2 `ArenaChannelFetcher.tsx` sends `model` with `trainLora`, keeps it alongside `trainingRequestId`, and passes it to status, result and cancel. It completes with `trainingResult.data.loraWeightsUrl`. `TrainingProgress.tsx` takes the URL instead of the raw result. Verify with `npm run typecheck` and `npm run lint` (React Compiler rules: no state set in effects).
- [x] 4.3 Select `trainerModel` in `LoraRow_training` and `LoraDetailQuery` and show `loraModelLabel(...)` as a badge. Verify in `npm run dev` that existing LoRAs show "FLUX.1 dev".

## 5. End to end

- [x] 5.1 Against a local run (production API, so records are real; hide them afterwards), train a small Are.na set once per model at that model's default steps, then generate one batch with each result. Before starting, estimate the total with fal's pricing. Verify per model that the job runs on the expected trainer, the LoRA completes, the batch renders, and through GraphiQL that `trainerModel` / `generatorModel` hold the expected endpoints. Record the training times and any LoRA-scale issue here.
  - Krea 2 (2026-11-05): trained and completed (weights read from `lora_file`), 5 batches generated and recorded. The trainer sends no logs, so the progress popover now shows an elapsed timer and the model's typical time instead. Keep these Krea records: don't hide or delete them. The other models were tried by the user in production after #35 merged.
- [x] 5.2 Verify that FLUX.1 dev with default settings sends the same fal.ai inputs as before: log the `trainLora` and `generateImages` inputs once and compare them with `main`.
  - Checked by comparing the code with the previous `fal.ts`: the FLUX.1 entry builds the same `{ images_data_url, trigger_word, steps }` training input and the same generation input (28 steps, guidance 3.5, same field order), not by logging a run.

## 6. Docs

- [x] 6.1 Update `CLAUDE.md` (the training-flow bullet names the catalog instead of the FLUX endpoints) and `README.md` (the picker and its models). Verify that neither still says training always uses `fal-ai/flux-lora-fast-training`.
