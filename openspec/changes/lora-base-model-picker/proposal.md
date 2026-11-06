# Proposal

## Why

Every LoRA is trained on FLUX.1 dev (`fal-ai/flux-lora-fast-training`) and generated with `fal-ai/flux-lora`. fal.ai now offers newer base models with LoRA training. Some generate in 1–2 s instead of FLUX.1's ~28 steps, and most cost less per image and give better results. Nothing records which model a LoRA or image came from. Once there's a choice, the app needs that record to generate with the right endpoint, and we want to see which models are being used, both for the existing records and for new ones.

## What Changes

- **Base-model picker** in the training settings. It offers FLUX.1 dev (the default, unchanged behavior), Z-Image Turbo, FLUX.2 [klein] 9B, Qwen Image 2512 and Krea 2, each with a one-line note on what it's good at and how long training takes. The steps field follows the chosen model's default.
- **A model catalog** shared by the UI and the server. For each model it holds the fal.ai trainer and generator endpoints, how to build their inputs, where the trained weights are in the result, and the generation settings.
- **Training** submits to the chosen model's trainer, records it on the training through the API (`trainerModel`), and polls, fetches and cancels against that same endpoint. The weights URL is read from the result server-side, so the client no longer parses fal.ai output shapes.
- **Generation** picks the endpoint from the LoRA's recorded `trainerModel` and records it on every image (`generatorModel`). A LoRA whose trainer isn't in the catalog can't be generated with and gets a clear error.
- **Display:** the gallery row and the LoRA page show the base model. Records from before this change show FLUX.1 dev, because the API now reports that for them.
- **Not included:** picking a different generator for an existing LoRA, per-model LoRA-scale presets, captioning (every model is still trained on the trigger word alone), and filtering the gallery by model.

## Capabilities

### New Capabilities

- `lora-base-models`: choosing the base model for a training, using the matching fal.ai endpoints for training, status and generation, recording the model on trainings and images through the API, and showing it.

### Modified Capabilities

(none. `graphql-data-access` already requires every record to go through the API, and that is unchanged.)

## Impact

- **Depends on** dmbk-graphql-api change `lora-model-tracking` (the `trainerModel` / `generatorModel` inputs and fields). That must be deployed, and `npm run schema:pull:api` run, before this ships.
- **Code:** new `src/lib/lora-models.ts`. `src/server/api/features/fal.ts` (`trainLora`, `getTrainingStatus`, `getTrainingResult`, `cancelTraining`, `generateImages`), `src/server/api/lora-api.ts`, `src/components/TrainingSettings.tsx`, `ArenaChannelFetcher.tsx`, `TrainingProgress.tsx`, `types.ts`, `LoraRow.tsx`, `LoraDetail.tsx`.
- **Cost and time:** the newer trainers take longer than the current one. fal's medians for 19–26 Oct 2026 were ~4 min for FLUX.1 fast training, ~11 for Krea 2, ~16 for klein, ~18 for Qwen and ~21 for Z-Image. Per-image generation is faster and cheaper for Z-Image ($0.0085/MP), klein ($0.015/MP) and Krea 2 ($0.01/MP) than FLUX.1 ($0.035/MP). Qwen costs the same and is slower.
- **Docs:** `CLAUDE.md`'s training-flow bullet and `README.md`'s feature overview.
