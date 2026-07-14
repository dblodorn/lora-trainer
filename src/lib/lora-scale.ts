import { z } from "zod";

/**
 * LoRA weight scale presets — single source of truth shared between
 * the tRPC API schema and the GenerateModal UI.
 */

export const LORA_SCALE_PRESETS = [
  { label: "chill", value: "1.5" },
  { label: "spicy", value: "2" },
  { label: "crunchy", value: "2.5" },
  { label: "fried", value: "3.3" },
  { label: "dead", value: "4" },
] as const;

/** Zod schema for the loraScale input — used in the tRPC mutation */
export const loraScaleSchema = z.enum(
  LORA_SCALE_PRESETS.map((p) => p.value) as [string, ...string[]],
);

/** Inferred TypeScript type from the Zod schema */
export type LoraScale = z.infer<typeof loraScaleSchema>;

/** The default scale value */
export const DEFAULT_LORA_SCALE: LoraScale = "1.5";

/** Valid scale values as a readonly tuple (for runtime checks) */
export const LORA_SCALE_VALUES = LORA_SCALE_PRESETS.map(
  (p) => p.value,
) as readonly [LoraScale, ...LoraScale[]];
