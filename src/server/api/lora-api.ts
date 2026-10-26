import { dmbkApi } from "./dmbk-api";
import { fromTrainingGlobalId, toTrainingGlobalId } from "@/lib/relay/ids";

/*
 * The LoRA records, read and written through the dmbk API from the fal.ai
 * procedures. Every call passes the viewer's session token, so the API applies
 * its ownership and visibility rules to them; this app keeps none of its own.
 *
 * These are trusted server-side calls, kept as strings rather than compiled by
 * Relay: compiling them would put them in the browser proxy's allowlist.
 *
 * Ids cross this boundary raw (32 hex), as the procedures and Spaces keys use
 * them, and are converted to and from the API's global IDs here.
 */

export type LoraStatus = "COMPLETED" | "PENDING" | "FAILED";

export interface LoraRecord {
  /** The raw id. */
  id: string;
  status: LoraStatus;
  triggerWord: string;
  loraWeightsUrl: string | null;
  /** Spaces mirrors when the training has them, otherwise the originals. */
  trainingImageUrls: string[];
}

const LORA_FIELDS = "id status triggerWord loraWeightsUrl trainingImageUrls";

type RawLora = Omit<LoraRecord, "id"> & { id: string };
const toRecord = (lora: RawLora): LoraRecord => ({ ...lora, id: fromTrainingGlobalId(lora.id) });

export async function createTraining(
  token: string,
  input: {
    requestId: string;
    triggerWord: string;
    steps: number;
    imageUrls: string[];
    arenaChannelUrl?: string;
    arenaChannelTitle?: string;
  },
): Promise<LoraRecord> {
  const data = await dmbkApi<{ loraTrainerCreateTraining: { loraTraining: RawLora } }>(
    `mutation ($input: LoraTrainerCreateTrainingInput!) {
      loraTrainerCreateTraining(input: $input) { loraTraining { ${LORA_FIELDS} } }
    }`,
    { input },
    token,
  );
  return toRecord(data.loraTrainerCreateTraining.loraTraining);
}

/** Attach the Spaces copies of the zip and source images. Omitted fields are left as they are. */
export async function setTrainingAssets(
  token: string,
  id: string,
  assets: { trainingZipUrl?: string; imageUrlsSpaces?: string[] },
): Promise<void> {
  await dmbkApi(
    `mutation ($input: LoraTrainerSetTrainingAssetsInput!) {
      loraTrainerSetTrainingAssets(input: $input) { loraTraining { id } }
    }`,
    { input: { id: toTrainingGlobalId(id), ...assets } },
    token,
  );
}

/** The viewer's own training for a fal.ai request id, at any status, or null. */
export async function findOwnTrainingByRequestId(token: string, requestId: string): Promise<LoraRecord | null> {
  const data = await dmbkApi<{ viewer: { loraTrainerTrainingByRequestId: RawLora | null } | null }>(
    `query ($requestId: String!) {
      viewer { loraTrainerTrainingByRequestId(requestId: $requestId) { ${LORA_FIELDS} } }
    }`,
    { requestId },
    token,
  );
  const lora = data.viewer?.loraTrainerTrainingByRequestId;
  return lora ? toRecord(lora) : null;
}

/**
 * Mark a training completed. Completing one that is already completed is a
 * no-op at the API, which keeps the first weights URL.
 */
export async function completeTraining(
  token: string,
  id: string,
  input: { loraWeightsUrl: string; imageUrlsSpaces?: string[] },
): Promise<LoraRecord> {
  const data = await dmbkApi<{ loraTrainerCompleteTraining: { loraTraining: RawLora } }>(
    `mutation ($input: LoraTrainerCompleteTrainingInput!) {
      loraTrainerCompleteTraining(input: $input) { loraTraining { ${LORA_FIELDS} } }
    }`,
    { input: { id: toTrainingGlobalId(id), ...input } },
    token,
  );
  return toRecord(data.loraTrainerCompleteTraining.loraTraining);
}

/** A training as this viewer can see it, or null when it is missing or hidden from them. */
export async function findTraining(token: string, id: string): Promise<LoraRecord | null> {
  const data = await dmbkApi<{ node: (RawLora & { __typename: string }) | null }>(
    `query ($id: ID!) { node(id: $id) { __typename ... on LoraTraining { ${LORA_FIELDS} } } }`,
    { id: toTrainingGlobalId(id) },
    token,
  );
  return data.node?.__typename === "LoraTraining" ? toRecord(data.node) : null;
}

export interface RecordedImageInput {
  /** The raw id, chosen here: it keys the image's Spaces copy. */
  id: string;
  prompt: string;
  imageUrl: string;
  cdnUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  seed: string | null;
  loraScaleValue: string;
  loraScaleName: string;
  genWidth: number;
  genHeight: number;
}

/** Record a batch of generated images, all or nothing. Returns their global IDs, in input order. */
export async function recordImages(token: string, loraId: string, images: RecordedImageInput[]): Promise<string[]> {
  const data = await dmbkApi<{ loraTrainerRecordImages: { generatedImages: { id: string }[] } }>(
    `mutation ($input: LoraTrainerRecordImagesInput!) {
      loraTrainerRecordImages(input: $input) { generatedImages { id } }
    }`,
    { input: { loraTrainingId: toTrainingGlobalId(loraId), images } },
    token,
  );
  return data.loraTrainerRecordImages.generatedImages.map((img) => img.id);
}
