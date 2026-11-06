# lora-base-models Specification

## Purpose
Lets a user choose which fal.ai base model a LoRA is trained on. It also ensures that training, status checks and generation all use that model's endpoints, and that the model is recorded on every training and generated image.

## Requirements

### Requirement: Choose a base model
The training settings SHALL offer a fixed list of base models: FLUX.1 dev, Z-Image Turbo, FLUX.2 [klein] 9B, Qwen Image 2512 and Krea 2. FLUX.1 dev SHALL be selected by default. Each option SHALL show a short description. Choosing a model SHALL set the steps field to that model's default. The server SHALL refuse a training request naming a model not on the list, without calling fal.ai.

#### Scenario: Default
- **WHEN** a user opens the training settings without touching the picker and trains
- **THEN** the training is submitted to `fal-ai/flux-lora-fast-training` exactly as before this change

#### Scenario: Unknown model
- **WHEN** a training request names a model key that isn't in the catalog
- **THEN** it is refused as a bad request and nothing is uploaded or submitted

### Requirement: Train on the chosen model
Submitting a training SHALL send the images to the chosen model's fal.ai trainer, with the trigger word as the training caption, and SHALL record that trainer's endpoint id as the training's `trainerModel` through the API. Status polling, cancelling and fetching the result SHALL use the same trainer endpoint. Completion SHALL take the trained weights' URL from the result in whatever form that trainer returns it.

#### Scenario: Train on Z-Image Turbo
- **WHEN** a user picks Z-Image Turbo and trains
- **THEN** the job is queued on `fal-ai/z-image-turbo-trainer-v2`, the progress view follows it, and the completed LoRA's `trainerModel` reads `fal-ai/z-image-turbo-trainer-v2`

#### Scenario: Weights in a different result field
- **WHEN** a Krea 2 training completes and its result holds the weights under `lora_file`
- **THEN** the LoRA is completed with that weights URL

### Requirement: Generate with the LoRA's own family
Generating images SHALL use the generator endpoint that belongs to the LoRA's `trainerModel`, with that model's generation settings. The generator's endpoint id SHALL be recorded as `generatorModel` on every image in the batch. A LoRA whose `trainerModel` is not in the catalog SHALL be refused before fal.ai is called.

#### Scenario: Legacy LoRA
- **WHEN** a user generates with a LoRA trained before this change
- **THEN** the images come from `fal-ai/flux-lora` with the same settings as before, and each image's `generatorModel` reads `fal-ai/flux-lora`

#### Scenario: New-model LoRA
- **WHEN** a user generates with a completed FLUX.2 [klein] 9B LoRA
- **THEN** the images come from `fal-ai/flux-2/klein/9b/lora` and each image's `generatorModel` reads that endpoint

#### Scenario: Unknown trainer
- **WHEN** the LoRA's `trainerModel` is an endpoint the catalog doesn't know
- **THEN** generation is refused with a message saying the model isn't supported, and nothing is charged

### Requirement: Show the base model
The gallery row and the LoRA page SHALL show each LoRA's base model by its catalog label. A `trainerModel` that isn't in the catalog SHALL be shown as the raw endpoint id.

#### Scenario: Mixed gallery
- **WHEN** the gallery lists one LoRA trained before this change and one trained on Krea 2
- **THEN** the first shows "FLUX.1 dev" and the second "Krea 2"
