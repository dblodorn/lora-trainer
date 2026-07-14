import { z } from "zod";

/**
 * LoRA weight scale presets — single source of truth shared between
 * the tRPC API schema and the GenerateModal UI.
 */

/** Valid scale string values */
export const LORA_SCALE_VALUES = ["1.5", "2", "2.5", "3.3", "4"] as const;

/** Inferred TypeScript type for a single scale value */
export type LoraScale = (typeof LORA_SCALE_VALUES)[number];

/** Zod schema for the loraScale input — used in the tRPC mutation */
export const loraScaleSchema = z.enum(LORA_SCALE_VALUES);

/** The default scale value */
export const DEFAULT_LORA_SCALE: LoraScale = "1.5";

/** Preset labels + values for UI rendering */
export const LORA_SCALE_PRESETS: readonly { label: string; value: LoraScale }[] = [
  { label: "chill", value: "1.5" },
  { label: "spicy", value: "2" },
  { label: "crunchy", value: "2.5" },
  { label: "fried", value: "3.3" },
  { label: "dead", value: "4" },
];
