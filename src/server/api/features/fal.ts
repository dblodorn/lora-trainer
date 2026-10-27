import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc";
import { requireFalApiKey } from "../env";
import { fal } from "@fal-ai/client";
import archiver from "archiver";
import { PassThrough } from "node:stream";
import crypto from "node:crypto";
import dns from "node:dns";
import net from "node:net";
import { loraScaleSchema, DEFAULT_LORA_SCALE, getLoraScaleLabel } from "@/lib/lora-scale";
import { imageDimensionsSchema } from "@/lib/image-dimensions";
import * as loraApi from "../lora-api";
import { uploadToSpaces, mirrorUrlToSpaces } from "./storage";

// Configure fal client lazily — credentials are validated per-request
function ensureFalConfigured() {
  const key = requireFalApiKey();
  fal.config({ credentials: key });
}

// --- SSRF Protection ---

export const ALLOWED_IMAGE_DOMAINS: readonly string[] = [
  "d2w9rnfcy7mm78.cloudfront.net", // are.na primary CDN
  ".are.na", // all are.na subdomains
] as const;

export function isPrivateIP(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    return (
      parts[0] === 10 || // 10.0.0.0/8
      parts[0] === 127 || // 127.0.0.0/8
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || // 172.16.0.0/12
      (parts[0] === 192 && parts[1] === 168) || // 192.168.0.0/16
      (parts[0] === 169 && parts[1] === 254) || // 169.254.0.0/16 (link-local / cloud metadata)
      parts[0] === 0 || // 0.0.0.0/8
      (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) || // 100.64.0.0/10 (carrier-grade NAT)
      (parts[0] === 198 && parts[1] >= 18 && parts[1] <= 19) // 198.18.0.0/15 (benchmark)
    );
  }

  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    return (
      normalized === "::1" || // loopback
      normalized.startsWith("fe80:") || // link-local
      normalized.startsWith("fc") || // unique local (fc00::/7)
      normalized.startsWith("fd") || // unique local (fc00::/7)
      normalized === "::" || // unspecified
      normalized.startsWith("::ffff:127.") || // IPv4-mapped loopback
      normalized.startsWith("::ffff:10.") || // IPv4-mapped 10.x
      normalized.startsWith("::ffff:192.168.") || // IPv4-mapped 192.168.x
      normalized.startsWith("::ffff:169.254.") // IPv4-mapped link-local
    );
  }

  // Unrecognized IP format — fail closed
  return true;
}

export async function validateImageUrl(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  if (parsed.protocol !== "https:") {
    throw new Error(`Only HTTPS URLs are allowed (got ${parsed.protocol})`);
  }

  if (parsed.username || parsed.password) {
    throw new Error("URLs with credentials are not allowed");
  }

  const hostname = parsed.hostname.toLowerCase();

  const isAllowed = ALLOWED_IMAGE_DOMAINS.some((domain) => {
    if (domain.startsWith(".")) {
      return hostname === domain.slice(1) || hostname.endsWith(domain);
    }
    return hostname === domain;
  });

  if (!isAllowed) {
    throw new Error(
      `Domain "${hostname}" is not in the allowed list for image downloads`,
    );
  }

  let resolved: { address: string; family: number };
  try {
    resolved = await dns.promises.lookup(hostname);
  } catch {
    throw new Error(`Failed to resolve hostname: ${hostname}`);
  }

  if (isPrivateIP(resolved.address)) {
    throw new Error(`Hostname "${hostname}" resolves to a private IP address`);
  }
}

// --- Resource Limits ---
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
export const DOWNLOAD_TIMEOUT_MS = 30_000; // 30 seconds
export const DOWNLOAD_CONCURRENCY = 5;

type DownloadResult = { filename: string; data: Buffer };

// Helper function to download image from URL with streaming size enforcement
export async function downloadImage(url: string): Promise<DownloadResult> {
  // Validate URL safety BEFORE making any network request
  await validateImageUrl(url);

  try {
    console.log(`Attempting to download image from: ${url}`);

    const response = await fetch(url, {
      redirect: "error", // Reject redirects — prevents redirect-based SSRF bypasses
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });

    console.log(`Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type");
    console.log(`Content-Type: ${contentType}`);

    if (!contentType || !contentType.startsWith("image/")) {
      throw new Error(
        `Response is not an image (Content-Type: ${contentType ?? "missing"}). The URL may be invalid or require authentication.`,
      );
    }

    // Early reject via Content-Length (optimization — headers can lie)
    const contentLength = Number(response.headers.get("content-length"));
    if (contentLength > MAX_IMAGE_SIZE) {
      throw new Error(
        `Image exceeds ${MAX_IMAGE_SIZE} byte limit (Content-Length: ${contentLength})`,
      );
    }

    // Streaming size enforcement (authoritative — Content-Length can lie)
    const reader = response.body!.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_IMAGE_SIZE) {
        reader.cancel();
        throw new Error(
          `Image exceeds ${MAX_IMAGE_SIZE} byte limit (streamed ${totalBytes} bytes)`,
        );
      }
      chunks.push(value);
    }

    const buffer = Buffer.concat(chunks);

    console.log(`Downloaded ${buffer.length} bytes`);

    // Reject suspiciously small responses — likely an error page, not a real image
    if (buffer.length < 1024) {
      throw new Error(
        `Downloaded file is too small (${buffer.length} bytes) — likely not a valid image`,
      );
    }

    // Extract filename from URL or create a default one
    const urlPath = new URL(url).pathname;
    const filename = urlPath.split("/").pop() || `image_${Date.now()}.jpg`;

    // Ensure we have a proper image extension
    const hasExtension = /\.(jpg|jpeg|png|gif|webp)$/i.test(filename);
    const finalFilename = hasExtension ? filename : `${filename}.jpg`;

    console.log(`Final filename: ${finalFilename}`);

    return { filename: finalFilename, data: buffer };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`Failed to download image from ${url}:`, errorMessage);
    throw new Error(`Failed to download image from ${url}: ${errorMessage}`);
  }
}

// Download images with limited concurrency using a worker pool pattern
export async function downloadWithConcurrency(
  urls: string[],
  concurrency: number,
): Promise<(DownloadResult | null)[]> {
  const results: (DownloadResult | null)[] = new Array(urls.length).fill(null);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < urls.length) {
      const index = nextIndex++;
      try {
        results[index] = await downloadImage(urls[index]);
      } catch (error) {
        console.error(
          `Failed to download image ${index + 1}/${urls.length}: ${error}`,
        );
        results[index] = null;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, urls.length) }, () => worker()),
  );
  return results;
}

// Helper function to create zip file from image URLs
// Returns { buffer, imageCount } so callers know how many images succeeded
export async function createImageZip(
  imageUrls: string[],
): Promise<{ buffer: Buffer; imageCount: number }> {
  console.log(`Starting to create zip from ${imageUrls.length} image URLs`);

  // Download with concurrency limit
  const downloadResults = await downloadWithConcurrency(
    imageUrls,
    DOWNLOAD_CONCURRENCY,
  );
  const validImages = downloadResults.filter(
    (result): result is DownloadResult => result !== null,
  );

  console.log(
    `Successfully downloaded ${validImages.length} out of ${imageUrls.length} images`,
  );

  if (validImages.length === 0) {
    throw new Error("Failed to download any images");
  }

  // Create archive — use 'store' since images are already compressed
  const archive = archiver("zip", { store: true });
  const chunks: Buffer[] = [];

  const output = new PassThrough();
  output.on("data", (chunk: Buffer) => chunks.push(chunk));
  archive.pipe(output);

  for (const [index, image] of validImages.entries()) {
    const uniqueFilename = `${index + 1}_${image.filename}`;
    console.log(
      `Adding image ${uniqueFilename} to zip (${image.data.length} bytes)`,
    );
    archive.append(image.data, { name: uniqueFilename });
  }

  await archive.finalize();

  const zipBuffer = Buffer.concat(chunks);
  console.log(`Zip buffer generated: ${zipBuffer.length} bytes`);

  return { buffer: zipBuffer, imageCount: validImages.length };
}

/**
 * Copy a training's source images to Spaces. Returns the copies that worked,
 * in source order; failures are logged and skipped.
 */
async function mirrorTrainingImages(loraId: string, imageUrls: string[]): Promise<string[]> {
  const results = await Promise.all(
    imageUrls.map((url, index) => {
      const filename = url.split("/").pop()?.split("?")[0] || `image_${index}.jpg`;
      const ext = /\.(jpg|jpeg|png|gif|webp)$/i.test(filename) ? "" : ".jpg";
      const spacesKey = `lora-trainer/training-images/${loraId}/${index + 1}_${filename}${ext}`;
      return mirrorUrlToSpaces(url, spacesKey, "image/jpeg").catch((err) => {
        console.error(`Failed to mirror training image ${index}:`, err);
        return null;
      });
    }),
  );
  const mirrored = results.filter((r): r is string => r !== null);
  console.log(`Mirrored ${mirrored.length}/${imageUrls.length} training images to Spaces`);
  return mirrored;
}

/** Whether a URL is already one of this app's Spaces copies. */
function isSpacesCopy(url: string): boolean {
  const cdn = process.env.DO_SPACES_CDN_URL?.replace(/\/+$/, "");
  return !!cdn && url.startsWith(`${cdn}/lora-trainer/`);
}

const IMAGES_PER_BATCH = 4;

function generateImageId(): string {
  return crypto.randomBytes(16).toString("hex");
}

export const falRouter = router({
  downloadImageZip: protectedProcedure
    .input(
      z.object({
        imageUrls: z
          .array(
            z
              .string()
              .url()
              .refine((url) => url.startsWith("https://"), {
                message: "Only HTTPS image URLs are allowed",
              }),
          )
          .min(1)
          .max(20),
        triggerWord: z.string().min(1).max(50),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        console.log(
          `Creating downloadable zip file from ${input.imageUrls.length} images...`,
        );

        // Create zip file from images
        const { buffer: zipBuffer, imageCount } = await createImageZip(
          input.imageUrls,
        );

        console.log(`Zip file created (${zipBuffer.length} bytes)`);

        // Convert buffer to base64 for transport
        const base64Zip = zipBuffer.toString("base64");

        // Generate filename with trigger word and timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `lora-training-${input.triggerWord}-${timestamp}.zip`;

        return {
          filename,
          data: base64Zip,
          size: zipBuffer.length,
          imageCount,
        };
      } catch (error) {
        console.error("Zip download error:", error);
        throw new Error(
          `Failed to create zip archive: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        );
      }
    }),

  trainLora: protectedProcedure
    .input(
      z.object({
        imageUrls: z
          .array(
            z
              .string()
              .url()
              .refine((url) => url.startsWith("https://"), {
                message: "Only HTTPS image URLs are allowed",
              }),
          )
          .min(1)
          .max(20),
        triggerWord: z.string().min(1).max(50),
        steps: z.number().min(100).max(2000).default(1000),
        arenaChannelUrl: z.string().url().optional(),
        arenaChannelTitle: z.string().max(200).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // ── Training execution ────────────────────────────────────────
      try {
        ensureFalConfigured();

        console.log(
          `Creating zip file from ${input.imageUrls.length} images...`,
        );

        // Create zip file from images
        const { buffer: zipBuffer } = await createImageZip(input.imageUrls);

        console.log(
          `Zip file created (${zipBuffer.length} bytes), uploading to FAL storage...`,
        );

        // Upload zip file to FAL storage using Blob (better Node.js compat)
        const zipBlob = new Blob([new Uint8Array(zipBuffer)], {
          type: "application/zip",
        });
        const zipUrl = await fal.storage.upload(zipBlob);

        console.log(`Zip uploaded to: ${zipUrl}, submitting to queue...`);

        // Submit to queue instead of blocking with subscribe
        const { request_id } = await fal.queue.submit(
          "fal-ai/flux-lora-fast-training",
          {
            input: {
              images_data_url: zipUrl,
              trigger_word: input.triggerWord,
              steps: input.steps,
            },
          },
        );

        console.log(`Training submitted to queue: ${request_id}`);

        // Record the pending training at the API so it is not lost if the
        // client disconnects. A failure is logged, not raised: the job is
        // already queued and the client can still follow it.
        let loraId: string | null = null;
        try {
          const lora = await loraApi.createTraining(ctx.sessionToken, {
            requestId: request_id,
            triggerWord: input.triggerWord,
            steps: input.steps,
            imageUrls: input.imageUrls,
            // The API takes https only; are.na serves both.
            ...(input.arenaChannelUrl
              ? { arenaChannelUrl: input.arenaChannelUrl.replace(/^http:\/\//, "https://") }
              : {}),
            ...(input.arenaChannelTitle ? { arenaChannelTitle: input.arenaChannelTitle } : {}),
          });
          loraId = lora.id;
          console.log(`Pending lora record created for ${request_id} (id: ${loraId})`);
        } catch (apiError) {
          console.error("Failed to create pending lora record:", apiError);
        }

        // Mirror the zip and source images to DO Spaces, then attach whatever
        // was copied in one call. Best effort: none of it fails the training.
        if (loraId) {
          const assets: { trainingZipUrl?: string; imageUrlsSpaces?: string[] } = {};
          try {
            const zipSpacesKey = `lora-trainer/training-zips/${loraId}/${loraId}.zip`;
            assets.trainingZipUrl = await uploadToSpaces(zipSpacesKey, zipBuffer, "application/zip");
            console.log(`Training zip mirrored to Spaces: ${assets.trainingZipUrl}`);
          } catch (err) {
            console.error("Failed to upload training zip to Spaces:", err);
          }

          const imageUrlsSpaces = await mirrorTrainingImages(loraId, input.imageUrls);
          if (imageUrlsSpaces.length > 0) assets.imageUrlsSpaces = imageUrlsSpaces;

          if (Object.keys(assets).length > 0) {
            try {
              await loraApi.setTrainingAssets(ctx.sessionToken, loraId, assets);
            } catch (err) {
              console.error("Failed to attach the Spaces copies to the training:", err);
            }
          }
        }

        return {
          requestId: request_id,
          zipUrl,
          loraId,
        };
      } catch (error) {
        console.error("LoRA training error:", error);

        const trainingMsg =
          error instanceof Error ? error.message : "Unknown error";
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `LoRA training failed: ${trainingMsg}`,
        });
      }
    }),

  getTrainingStatus: protectedProcedure
    .input(z.object({ requestId: z.string() }))
    .query(async ({ input }) => {
      try {
        ensureFalConfigured();

        const status = await fal.queue.status(
          "fal-ai/flux-lora-fast-training",
          {
            requestId: input.requestId,
            logs: true,
          },
        );

        return {
          status: status.status,
          logs:
            "logs" in status && Array.isArray(status.logs)
              ? (status.logs as { timestamp: string; message: string }[])
              : [],
          ...(status.status === "IN_QUEUE" && {
            queuePosition: status.queue_position,
          }),
        };
      } catch (error) {
        console.error("Training status error:", error);
        throw new Error(
          `Failed to get training status: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        );
      }
    }),

  cancelTraining: protectedProcedure
    .input(z.object({ requestId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        ensureFalConfigured();

        await fal.queue.cancel("fal-ai/flux-lora-fast-training", {
          requestId: input.requestId,
        });

        console.log(`Training cancelled: ${input.requestId}`);

        return { success: true };
      } catch (error) {
        console.error("Cancel training error:", error);
        throw new Error(
          `Failed to cancel training: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        );
      }
    }),

  getTrainingResult: protectedProcedure
    .input(z.object({ requestId: z.string() }))
    .query(async ({ input }) => {
      try {
        ensureFalConfigured();

        const result = await fal.queue.result(
          "fal-ai/flux-lora-fast-training",
          {
            requestId: input.requestId,
          },
        );

        return {
          data: result.data as Record<string, unknown>,
          requestId: result.requestId,
        };
      } catch (error) {
        console.error("Training result error:", error);
        throw new Error(
          `Failed to get training result: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        );
      }
    }),
  /**
   * Store a finished training's weights: mirror them to Spaces (keeping the
   * fal.ai URL if that fails), backfill the source-image copies if training
   * didn't make them, and mark the record completed at the API. The API
   * refuses anyone but the owner and treats a repeat as a no-op.
   */
  completeTraining: protectedProcedure
    .input(
      z.object({
        requestId: z.string().min(1),
        loraWeightsUrl: z.string().url(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const lora = await loraApi.findOwnTrainingByRequestId(ctx.sessionToken, input.requestId);
      if (!lora) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No training record of yours was found for this request ID.",
        });
      }
      if (lora.status === "COMPLETED") {
        return { success: true };
      }

      const weightsExt = input.loraWeightsUrl.endsWith(".safetensors") ? "safetensors" : "bin";
      const spacesKey = `lora-trainer/loras/${lora.id}/${lora.id}.${weightsExt}`;
      let loraWeightsUrl: string;
      try {
        loraWeightsUrl = await mirrorUrlToSpaces(input.loraWeightsUrl, spacesKey, "application/octet-stream");
      } catch (err) {
        console.error("Failed to mirror LoRA weights to Spaces, using FAL URL:", err);
        loraWeightsUrl = input.loraWeightsUrl;
      }

      // The API serves the Spaces copies when there are any, so source URLs
      // that aren't copies mean training never made them.
      let imageUrlsSpaces: string[] = [];
      if (lora.trainingImageUrls.length > 0 && !lora.trainingImageUrls.some(isSpacesCopy)) {
        imageUrlsSpaces = await mirrorTrainingImages(lora.id, lora.trainingImageUrls);
      }

      await loraApi.completeTraining(ctx.sessionToken, lora.id, {
        loraWeightsUrl,
        ...(imageUrlsSpaces.length > 0 ? { imageUrlsSpaces } : {}),
      });
      return { success: true };
    }),

  /**
   * Generate a batch of images with a completed LoRA and record them at the
   * API. The LoRA is checked before fal.ai is called, so nothing is spent on
   * one that is missing, hidden from the viewer or unfinished.
   */
  generateImages: protectedProcedure
    .input(
      z.object({
        /** The raw training id. */
        loraTrainingId: z.string().min(1),
        prompt: z.string().min(1).max(500),
        loraScale: loraScaleSchema.default(DEFAULT_LORA_SCALE),
        imageWidth: imageDimensionsSchema.shape.imageWidth,
        imageHeight: imageDimensionsSchema.shape.imageHeight,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const lora = await loraApi.findTraining(ctx.sessionToken, input.loraTrainingId);
      if (!lora) {
        throw new TRPCError({ code: "NOT_FOUND", message: "LoRA not found." });
      }
      if (lora.status !== "COMPLETED" || !lora.loraWeightsUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This LoRA is not ready for generation. Training must be completed first.",
        });
      }

      const fullPrompt = `${input.prompt} in the style of ${lora.triggerWord}`;

      ensureFalConfigured();

      let result: {
        images: { url: string; width?: number; height?: number; content_type?: string }[];
        seed?: number;
        has_nsfw_concepts?: boolean[];
      };

      try {
        const response = await fal.subscribe("fal-ai/flux-lora", {
          input: {
            prompt: fullPrompt,
            loras: [{ path: lora.loraWeightsUrl, scale: parseFloat(input.loraScale) }],
            image_size: { width: input.imageWidth, height: input.imageHeight },
            num_inference_steps: 28,
            guidance_scale: 3.5,
            num_images: IMAGES_PER_BATCH,
            enable_safety_checker: true,
            output_format: "jpeg",
          },
        });
        result = response.data as typeof result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        console.error("Image generation error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Image generation failed: ${msg}`,
        });
      }

      if (!result.images || result.images.length === 0) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No images were generated. The safety checker may have filtered all results.",
        });
      }

      const seed = result.seed != null ? String(result.seed) : null;
      const loraScaleName = getLoraScaleLabel(input.loraScale);

      // Each image's id is chosen here, before mirroring, because it keys the
      // Spaces copy. The imageUrl stays the fal.ai URL; cdnUrl is the copy.
      const images: loraApi.RecordedImageInput[] = await Promise.all(
        result.images.map(async (image) => {
          const id = generateImageId();
          const contentType = image.content_type ?? "image/jpeg";
          const ext = contentType.includes("png") ? "png" : "jpg";
          const spacesKey = `lora-trainer/images/${lora.id}/${id}.${ext}`;
          let cdnUrl: string | null = null;
          try {
            cdnUrl = await mirrorUrlToSpaces(image.url, spacesKey, contentType);
          } catch (err) {
            console.error("Failed to mirror image to Spaces:", err);
          }
          return {
            id,
            prompt: input.prompt,
            imageUrl: image.url,
            cdnUrl,
            imageWidth: image.width ?? null,
            imageHeight: image.height ?? null,
            seed,
            loraScaleValue: input.loraScale,
            loraScaleName,
            genWidth: input.imageWidth,
            genHeight: input.imageHeight,
          };
        }),
      );

      // fal.ai has already charged for these, so recording gets one retry.
      // If both attempts fail the images are still returned for the viewer to
      // see, and the payload is logged so the record can be replayed by hand.
      let globalIds: string[] | null = null;
      for (let attempt = 1; attempt <= 2 && !globalIds; attempt++) {
        try {
          globalIds = await loraApi.recordImages(ctx.sessionToken, lora.id, images);
        } catch (err) {
          console.error(`Failed to record generated images (attempt ${attempt}/2):`, err);
        }
      }
      if (!globalIds) {
        console.error(
          "[generateImages] Unrecorded images, replay with loraTrainerRecordImages:",
          JSON.stringify({ loraTrainingId: lora.id, images }),
        );
      }

      return {
        images: images.map((img, i) => ({
          id: img.id,
          /** The API's id for the image, or null when it wasn't recorded. */
          globalId: globalIds?.[i] ?? null,
          imageUrl: img.imageUrl,
          cdnUrl: img.cdnUrl,
          width: img.imageWidth,
          height: img.imageHeight,
          seed: img.seed,
          loraScaleValue: img.loraScaleValue,
          loraScaleName: img.loraScaleName,
          genWidth: img.genWidth,
          genHeight: img.genHeight,
        })),
        prompt: input.prompt,
        nsfwFiltered: result.has_nsfw_concepts?.some(Boolean) === true,
        totalGenerated: result.images.length,
        recorded: globalIds !== null,
      };
    }),
});
