import { z } from "zod";

/**
 * The base models a LoRA can be trained on — single source of truth shared
 * between the tRPC procedures and the training settings UI. Every difference
 * between models lives in its entry here. The browser and tRPC use the key;
 * the API stores the endpoint ids (`trainer` / `generator`).
 *
 * Keep this file free of server imports: the picker imports it.
 */

export const LORA_MODEL_KEYS = [
  "flux-1-dev",
  "z-image-turbo",
  "flux-2-klein-9b",
  "qwen-image-2512",
  "krea-2",
] as const;

export type LoraModelKey = (typeof LORA_MODEL_KEYS)[number];

/** Zod schema for the model key — used in the tRPC inputs and the form */
export const loraModelKeySchema = z.enum(LORA_MODEL_KEYS);

export const DEFAULT_LORA_MODEL: LoraModelKey = "flux-1-dev";

export interface LoraModel {
  key: LoraModelKey;
  label: string;
  /** One line for the picker: what it's good at and how long training takes. */
  description: string;
  /** fal.ai trainer endpoint id, recorded as the training's `trainerModel`. */
  trainer: string;
  /** fal.ai generator endpoint id, recorded as each image's `generatorModel`. */
  generator: string;
  /** Steps the picker resets to, within the API's 100–2000. */
  defaultSteps: number;
  /** fal's median training time, shown while a trainer that sends no logs runs. */
  typicalTrainingMinutes: number;
  /** The trainer's input. The trigger word is the caption for every model. */
  trainingInput(args: { zipUrl: string; triggerWord: string; steps: number }): Record<string, unknown>;
  /** The trained weights' URL in the trainer's result, or null when it isn't there. */
  weightsUrl(result: unknown): string | null;
  /** Merged over the shared generation input (prompt, loras, size, count, format). */
  generationInput: Record<string, unknown>;
}

/** `result[field].url`, when it is a string. */
function fileUrl(result: unknown, field: string): string | null {
  if (typeof result !== "object" || result === null) return null;
  const file = (result as Record<string, unknown>)[field];
  if (typeof file !== "object" || file === null) return null;
  const url = (file as Record<string, unknown>).url;
  return typeof url === "string" ? url : null;
}

export const LORA_MODELS: Record<LoraModelKey, LoraModel> = {
  "flux-1-dev": {
    key: "flux-1-dev",
    label: "FLUX.1 dev",
    description: "The original. Reliable all-rounder, slowest to generate. Trains in ~4 min.",
    trainer: "fal-ai/flux-lora-fast-training",
    generator: "fal-ai/flux-lora",
    defaultSteps: 1000,
    typicalTrainingMinutes: 4,
    trainingInput: ({ zipUrl, triggerWord, steps }) => ({
      images_data_url: zipUrl,
      trigger_word: triggerWord,
      steps,
    }),
    // Older results kept the weights under config_file when diffusers_lora_file was missing.
    weightsUrl: (result) => fileUrl(result, "diffusers_lora_file") ?? fileUrl(result, "config_file"),
    generationInput: { num_inference_steps: 28, guidance_scale: 3.5 },
  },
  "z-image-turbo": {
    key: "z-image-turbo",
    label: "Z-Image Turbo",
    description: "Photoreal and very fast to generate, cheapest per image. Trains in ~21 min.",
    trainer: "fal-ai/z-image-turbo-trainer-v2",
    generator: "fal-ai/z-image/turbo/lora",
    defaultSteps: 2000,
    typicalTrainingMinutes: 21,
    trainingInput: ({ zipUrl, triggerWord, steps }) => ({
      image_data_url: zipUrl,
      default_caption: triggerWord,
      steps,
    }),
    weightsUrl: (result) => fileUrl(result, "diffusers_lora_file"),
    generationInput: { num_inference_steps: 8 },
  },
  "flux-2-klein-9b": {
    key: "flux-2-klein-9b",
    label: "FLUX.2 [klein] 9B",
    description: "Newer FLUX, sharper detail, generates in a few steps. Trains in ~16 min.",
    trainer: "fal-ai/flux-2-klein-9b-base-trainer",
    generator: "fal-ai/flux-2/klein/9b/lora",
    defaultSteps: 1000,
    typicalTrainingMinutes: 16,
    trainingInput: ({ zipUrl, triggerWord, steps }) => ({
      image_data_url: zipUrl,
      default_caption: triggerWord,
      steps,
    }),
    weightsUrl: (result) => fileUrl(result, "diffusers_lora_file"),
    generationInput: { num_inference_steps: 4 },
  },
  "qwen-image-2512": {
    key: "qwen-image-2512",
    label: "Qwen Image 2512",
    description: "Strong at text and layout, slow and pricier to generate. Trains in ~18 min.",
    trainer: "fal-ai/qwen-image-2512-trainer",
    generator: "fal-ai/qwen-image-2512/lora",
    defaultSteps: 1000,
    typicalTrainingMinutes: 18,
    trainingInput: ({ zipUrl, triggerWord, steps }) => ({
      image_data_url: zipUrl,
      default_caption: triggerWord,
      steps,
    }),
    weightsUrl: (result) => fileUrl(result, "diffusers_lora_file"),
    generationInput: { num_inference_steps: 28, guidance_scale: 4 },
  },
  "krea-2": {
    key: "krea-2",
    label: "Krea 2",
    description: "Aesthetic, painterly styles, fast and cheap to generate. Trains in ~11 min.",
    trainer: "fal-ai/krea-2-trainer",
    generator: "fal-ai/krea-2/turbo/lora",
    // fal's default of 100 is a fast-preview setting below the API's minimum.
    defaultSteps: 500,
    typicalTrainingMinutes: 11,
    trainingInput: ({ zipUrl, triggerWord, steps }) => ({
      images_data_url: zipUrl,
      trigger_phrase: triggerWord,
      steps,
    }),
    weightsUrl: (result) => fileUrl(result, "lora_file"),
    generationInput: {},
  },
};

/** The catalog entry whose trainer is this endpoint id, or null when there isn't one. */
export function modelForTrainer(trainer: string): LoraModel | null {
  return Object.values(LORA_MODELS).find((m) => m.trainer === trainer) ?? null;
}

/** The catalog label for a trainer endpoint id, or the id itself when it isn't in the catalog. */
export function loraModelLabel(trainer: string): string {
  return modelForTrainer(trainer)?.label ?? trainer;
}
