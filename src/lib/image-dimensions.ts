import { z } from "zod";

/**
 * Image dimension constraints — single source of truth shared between
 * the tRPC API schema and the GenerateModal UI.
 */

/** Image dimension constraints */
export const IMAGE_DIMENSION_MIN = 250;
export const IMAGE_DIMENSION_MAX = 1080;
export const DEFAULT_IMAGE_WIDTH = 1024;
export const DEFAULT_IMAGE_HEIGHT = 1024;

/** Zod schema for a single dimension (width or height) */
export const imageDimensionSchema = z
  .number()
  .int()
  .min(IMAGE_DIMENSION_MIN)
  .max(IMAGE_DIMENSION_MAX);

/** Zod schema for the image dimensions input */
export const imageDimensionsSchema = z.object({
  imageWidth: imageDimensionSchema.default(DEFAULT_IMAGE_WIDTH),
  imageHeight: imageDimensionSchema.default(DEFAULT_IMAGE_HEIGHT),
});
