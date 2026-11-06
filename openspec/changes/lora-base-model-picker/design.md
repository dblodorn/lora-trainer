# Design

## Context

- `features/fal.ts` hardcodes `fal-ai/flux-lora-fast-training` in `trainLora`, `getTrainingStatus`, `cancelTraining` and `getTrainingResult`, and `fal-ai/flux-lora` in `generateImages` (28 steps, guidance 3.5, 4 images, jpeg).
- The client reads the weights straight out of the fal.ai result (`diffusers_lora_file`, falling back to `config_file`) in `ArenaChannelFetcher.tsx` and `TrainingProgress.tsx`.
- The training's request id lives only in `ArenaChannelFetcher` state (nothing is persisted), so the component that holds it can also hold the model.
- The API change `lora-model-tracking` adds `trainerModel` / `generatorModel`: fal endpoint ids, format-checked only, defaulting to the FLUX.1 endpoints on write and read.
- The candidate endpoints' input schemas, checked on fal on 2026-10-28:

| Key | Trainer | Image field | Caption field | Steps (fal) | Weights in result | Generator | Gen settings |
|---|---|---|---|---|---|---|---|
| `flux-1-dev` | `fal-ai/flux-lora-fast-training` | `images_data_url` | `trigger_word` | 1–10000, ex. 1000 | `diffusers_lora_file` | `fal-ai/flux-lora` | 28 steps, guidance 3.5 |
| `z-image-turbo` | `fal-ai/z-image-turbo-trainer-v2` | `image_data_url` | `default_caption` | 10–40000, def. 2000 | `diffusers_lora_file` | `fal-ai/z-image/turbo/lora` | 8 steps (max 8) |
| `flux-2-klein-9b` | `fal-ai/flux-2-klein-9b-base-trainer` | `image_data_url` | `default_caption` | 100–20000, ×100, def. 1000 | `diffusers_lora_file` | `fal-ai/flux-2/klein/9b/lora` | 4 steps (4–8) |
| `qwen-image-2512` | `fal-ai/qwen-image-2512-trainer` | `image_data_url` | `default_caption` | 1–30000, def. 1000 | `diffusers_lora_file` | `fal-ai/qwen-image-2512/lora` | 28 steps, guidance 4 |
| `krea-2` | `fal-ai/krea-2-trainer` | `images_data_url` | `trigger_phrase` | 50–10000, def. 100 | `lora_file` | `fal-ai/krea-2/turbo/lora` | defaults |

  All five generators take `prompt`, `loras: [{ path, scale ≤ 4 }]`, `image_size: { width, height }`, `num_images ≤ 4`, `enable_safety_checker` and `output_format: "jpeg"`, so the shared part of the input stays as it is.

## Goals / Non-Goals

**Goals:**
- One table (`src/lib/lora-models.ts`) is the only place model differences live. Adding a model means adding one entry.
- No change at all for a user who leaves the picker on FLUX.1 dev.

**Non-Goals:**
- Exposing per-model knobs such as learning rate, Krea's resolution or auto-captioning.
- Choosing a generator separately from the trainer.

## Decisions

### 1. A typed catalog keyed by short model keys
`src/lib/lora-models.ts` exports `LORA_MODELS: Record<LoraModelKey, LoraModel>`, `DEFAULT_LORA_MODEL = "flux-1-dev"`, `loraModelKeySchema` (a zod enum) and `modelForTrainer(endpointId): LoraModel | null`. Each entry has `label`, `description`, `trainer`, `generator`, `defaultSteps`, `trainingInput({ zipUrl, triggerWord, steps })`, `weightsUrl(result)` and `generationInput`. The browser and tRPC use the key, and the API stores the endpoint ids (`trainer` / `generator`). The file must stay free of server imports because the picker imports it.
- *Alternative:* send endpoint ids from the browser. Rejected: a key is easier to validate and to rename, and the browser should never pick arbitrary endpoints.

### 2. The trigger word is the caption for every model
Today FLUX.1 fast training gets `trigger_word` and no caption files. The other trainers need a caption source, or the job fails (Krea returns 422). Passing the trigger word as `default_caption` / `trigger_phrase` gives the same "the trigger word is the concept" training the current flow uses. The FLUX.1 entry's input stays byte-for-byte what is sent today.

### 3. Steps stay 100–2000 everywhere; the default is per model
The API allows 100–2000. Every catalog model accepts that range, and klein's multiple-of-100 rule matches the field's step of 100. Defaults: 1000 for FLUX.1, klein and Qwen; 2000 for Z-Image (fal's default). For Krea 2, 500 instead of fal's 100, because 100 is below the field's range and is a fast-preview setting. When the model changes, the picker resets steps to the new default.

### 4. Status, result and cancel take the model key
`getTrainingStatus`, `getTrainingResult` and `cancelTraining` take `{ requestId, model }`, and `ArenaChannelFetcher` keeps the model it submitted with alongside `trainingRequestId`. `getTrainingResult` returns `{ loraWeightsUrl, requestId }` from `model.weightsUrl(result.data)`, so `ArenaChannelFetcher` and `TrainingProgress` stop reading fal output fields.
- *Alternative:* look the model up from the API record by request id on every poll. Rejected: it adds an API call every 2 s, and the record can be missing if `createTraining` failed (that failure is logged, not raised).

### 5. Generation derives everything from the stored trainer
`lora-api.ts` adds `trainerModel` to `LORA_FIELDS`. `generateImages` calls `modelForTrainer(lora.trainerModel)`. When that returns null it raises `BAD_REQUEST` ("This LoRA's base model isn't supported here"). Otherwise it calls `fal.subscribe(model.generator, { input: { ...shared, ...model.generationInput } })` and sends `generatorModel: model.generator` with `recordImages`. The replay log payload includes `generatorModel` too.

### 6. Display through the Relay fragments
`LoraRow_training` and `LoraDetailQuery` select `trainerModel`, and a small helper `loraModelLabel(trainerModel)` returns the catalog label or the raw id. Legacy records need no special case, because the API already resolves them to the FLUX.1 trainer.

## Risks / Trade-offs

- **[The new trainers are slower: ~11–21 min median vs ~4]** → The picker descriptions say so. Polling every 2 s is unchanged, and those polls hit fal.ai, not the API.
- **[LoRA-scale presets were tuned on FLUX.1, and 3.3–4 may be overcooked on the turbo models]** → Kept for now. Revisit after task 5.1's test runs, recorded as a follow-up there if needed.
- **[Trigger-word-only captions suit styles better than subjects]** → Same as today. Auto-captioning is a separate change.
- **[fal changes an input schema]** → Each difference is confined to one catalog entry, and task 5.1 runs every model once end to end.

## Migration Plan

1. dmbk-graphql-api `lora-model-tracking` is deployed and backfilled.
2. `npm run schema:pull:api`, then commit the schema. Relay now compiles with `trainerModel` / `generatorModel`.
3. Ship this change. Rollback: revert. LoRAs trained on non-FLUX models stay recorded correctly but can't be generated with until the change is restored.
