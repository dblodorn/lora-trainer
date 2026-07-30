# Migrate FAL.ai Storage → DigitalOcean Spaces + CDN

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Move all generated images, LoRA weights, training source images, and training zips from FAL.ai / Are.na to DigitalOcean Spaces with CDN, update DB references, and route all new uploads through DO Spaces going forward.

**Architecture:** Add an S3-compatible storage layer (AWS SDK v3 with S3-compatible endpoint pointing to DO Spaces) as a shared module. New image generations download from FAL.ai → re-upload to DO Spaces → store CDN URL in MongoDB. LoRA training completion mirrors weights to Spaces. Training source images (from Are.na) are downloaded and stored to Spaces for durability. Training zips are also persisted to Spaces. A one-time migration script processes existing DB records the same way. CDN endpoint fronts the Spaces bucket for public reads.

**Tech Stack:** `@aws-sdk/client-s3` (S3-compatible, works with DO Spaces), DO Spaces CDN, MongoDB Atlas, existing `@fal-ai/client` SDK

---

## Current State Analysis

### What's stored where today

| Data | Current URL source | DB field | Needs migration? |
|------|-------------------|----------|-------------------|
| Generated images | FAL.ai CDN URLs | `generated_images.imageUrl` | ✅ Yes |
| LoRA weights | FAL.ai storage URL | `lora_trainings.loraWeightsUrl` | ✅ Yes |
| Training source images | Are.na CDN URLs (`d2w9rnfcy7mm78.cloudfront.net`) | `lora_trainings.imageUrls[]` | ✅ Yes — mirror to Spaces for durability |
| Training zip | FAL.ai storage URL (`fal.storage.upload`) | Not in DB — ephemeral | ✅ Yes — persist zip to Spaces + store URL in DB |

### What stays on FAL (no migration)

- **Nothing** — all artifacts move to DO Spaces.
- The training zip is still *uploaded to FAL storage* during training (FAL needs it as `images_data_url`), but we also persist a copy to Spaces and store that URL in the DB.
- The Are.na CDN URLs for source images remain accessible but we mirror copies to Spaces so we're not dependent on Are.na's CDN.

### DO Spaces configuration (confirmed)

| Setting | Value |
|---------|-------|
| Bucket | `dmbk-io` |
| Region | `sfo2` |
| Endpoint | `https://dmbk-io.sfo2.digitaloceanspaces.com` |
| CDN URL | `https://dmbk-io.sfo2.cdn.digitaloceanspaces.com` |
| Access key | `DO00QKWBT22LMPVD3AKZ` (name: `lora-trainer-spaces`) |
| Secret key | *(in .env.local, not committed)* |
| Existing CDN | Yes — already configured for `dmbk-io` |

### Spaces layout

```
dmbk-io/
└── lora-trainer/
    ├── images/              ← generated images
    │   └── {loraTrainingId}/{imageId}.jpg
    ├── loras/               ← trained LoRA weights (.safetensors)
    │   └── {loraTrainingId}/{loraId}.safetensors
    ├── training-images/     ← source images (from Are.na)
    │   └── {loraTrainingId}/{index}_{filename}.jpg
    └── training-zips/       ← training image zip files
        └── {loraTrainingId}/{loraId}.zip
```

CDN URL pattern: `https://dmbk-io.sfo2.cdn.digitaloceanspaces.com/lora-trainer/...`

---

## Task Plan

### Task 1: Add AWS SDK S3 dependency

**Objective:** Install the S3-compatible SDK for talking to DO Spaces.

**Files:**
- Modify: `package.json`

**Step 1:** Install the package
```bash
cd /root/lora-trainer-repo
npm install @aws-sdk/client-s3
```

**Step 2:** Verify it's in package.json
```bash
grep "aws-sdk" package.json
```

**Step 3: Commit**
```bash
git add package.json package-lock.json
git commit -m "chore: add @aws-sdk/client-s3 for DO Spaces storage"
```

---

### Task 2: Add Spaces env vars and env schema

**Objective:** Add the DO Spaces config to the Zod env schema.

**Files:**
- Modify: `src/server/api/env.ts`

**Step 1:** Add new env keys to the schema

```typescript
// Add to envSchema:
DO_SPACES_ENDPOINT: z.string().optional(),       // "https://dmbk-io.sfo2.digitaloceanspaces.com"
DO_SPACES_REGION: z.string().optional(),          // "sfo2"
DO_SPACES_KEY: z.string().optional(),             // Spaces access key
DO_SPACES_SECRET: z.string().optional(),          // Spaces secret key
DO_SPACES_BUCKET: z.string().optional(),          // "dmbk-io"
DO_SPACES_CDN_URL: z.string().optional(),         // "https://dmbk-io.sfo2.cdn.digitaloceanspaces.com"
```

**Step 2:** Add to the fallback `env` object and add a require function:

```typescript
export interface SpacesConfig {
  endpoint: string;
  region: string;
  key: string;
  secret: string;
  bucket: string;
  cdnUrl: string;
}

export function requireSpacesConfig(): SpacesConfig {
  const cfg: SpacesConfig = {
    endpoint: env.DO_SPACES_ENDPOINT ?? "",
    region: env.DO_SPACES_REGION ?? "",
    key: env.DO_SPACES_KEY ?? "",
    secret: env.DO_SPACES_SECRET ?? "",
    bucket: env.DO_SPACES_BUCKET ?? "",
    cdnUrl: env.DO_SPACES_CDN_URL ?? "",
  };
  const missing = (Object.keys(cfg) as (keyof SpacesConfig)[]).filter((k) => !cfg[k]);
  if (missing.length) {
    throw new Error(
      `DO Spaces not configured. Missing: ${missing.join(", ")}. Set them in .env.local`,
    );
  }
  return cfg;
}
```

**Step 3: Commit**
```bash
git add src/server/api/env.ts
git commit -m "feat: add DO Spaces env schema"
```

---

### Task 3: Create Spaces storage module

**Objective:** Shared module for uploading files to DO Spaces and getting CDN URLs.

**Files:**
- Create: `src/server/api/features/storage.ts`

```typescript
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { requireSpacesConfig } from "../env";

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (_client) return _client;
  const cfg = requireSpacesConfig();
  _client = new S3Client({
    endpoint: cfg.endpoint,
    region: cfg.region,
    credentials: {
      accessKeyId: cfg.key,
      secretAccessKey: cfg.secret,
    },
    forcePathStyle: false,
  });
  return _client;
}

/**
 * Upload a buffer to DO Spaces and return the CDN URL.
 * @param key  - S3 key (e.g. "lora-trainer/images/{loraId}/{imgId}.jpg")
 * @param data - File content
 * @param contentType - MIME type
 */
export async function uploadToSpaces(
  key: string,
  data: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  const cfg = requireSpacesConfig();
  const client = getClient();

  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
      ACL: "public-read",
    }),
  );

  return `${cfg.cdnUrl}/${key}`;
}

/**
 * Download a URL and re-upload to Spaces. Returns the CDN URL.
 */
export async function mirrorUrlToSpaces(
  sourceUrl: string,
  spacesKey: string,
  contentType: string,
): Promise<string> {
  const response = await fetch(sourceUrl, {
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${sourceUrl}: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return uploadToSpaces(spacesKey, buffer, contentType);
}
```

**Commit:**
```bash
git add src/server/api/features/storage.ts
git commit -m "feat: add DO Spaces storage module"
```

---

### Task 4: Update DB schema — add trainingImagesUrl and trainingZipUrl fields

**Objective:** Add new fields to `LoraTrainingDoc` to store Spaces URLs for training images and zip.

**Files:**
- Modify: `src/server/api/db.ts`

**Step 1:** Add fields to `LoraTrainingDoc` interface:

```typescript
export interface LoraTrainingDoc {
  _id: string;
  requestId: string;
  walletAddress: string;
  triggerWord: string;
  steps: number;
  imageUrls: string[];                    // Are.na URLs (original, kept for reference)
  trainingImagesUrl: string | null;       // NEW — Spaces CDN URL to mirrored training images (array stored as folder)
  trainingZipUrl: string | null;          // NEW — Spaces CDN URL to training zip
  loraWeightsUrl: string | null;
  arenaChannelUrl: string | null;
  arenaChannelTitle: string | null;
  status: "pending" | "completed" | "failed";
  createdAt: string;
}
```

**Note:** `imageUrls` stays as-is (Are.na URLs) for backwards compat. The `trainingImagesUrl` is a prefix URL pointing to the Spaces folder — individual images follow the pattern `{trainingImagesUrl}/{index}_{filename}.jpg`. This avoids adding a new array field. Alternatively, we could add `imageUrlsSpaces: string[]` — but the folder approach is simpler and more storage-efficient.

**Actually — simpler approach:** Add `imageUrlsSpaces: string[]` as a parallel array. This is more explicit and queryable:

```typescript
export interface LoraTrainingDoc {
  _id: string;
  requestId: string;
  walletAddress: string;
  triggerWord: string;
  steps: number;
  imageUrls: string[];                    // Are.na URLs (original source)
  imageUrlsSpaces: string[];              // NEW — Spaces CDN URLs (mirrored copies)
  trainingZipUrl: string | null;          // NEW — Spaces CDN URL to training zip
  loraWeightsUrl: string | null;
  arenaChannelUrl: string | null;
  arenaChannelTitle: string | null;
  status: "pending" | "completed" | "failed";
  createdAt: string;
}
```

**Step 2:** No index changes needed — these are just data fields.

**Commit:**
```bash
git add src/server/api/db.ts
git commit -m "feat: add imageUrlsSpaces and trainingZipUrl to LoraTrainingDoc"
```

---

### Task 5: Update image generation to save to Spaces

**Objective:** After FAL.ai returns generated image URLs, download each and re-upload to DO Spaces. Store the CDN URL in MongoDB instead of the FAL URL.

**Files:**
- Modify: `src/server/api/features/generate.ts` (lines ~140-169)

**Step 1:** Import the storage module

```typescript
import { mirrorUrlToSpaces } from "./storage";
```

**Step 2:** Replace the image-save loop (lines ~140-169) with:

```typescript
for (const [index, image] of result.images.entries()) {
  const id = generateId();
  const contentType = image.content_type ?? "image/jpeg";
  const ext = contentType.includes("png") ? "png" : "jpg";
  const spacesKey = `lora-trainer/images/${input.loraTrainingId}/${id}.${ext}`;

  let cdnUrl: string;
  try {
    cdnUrl = await mirrorUrlToSpaces(image.url, spacesKey, contentType);
  } catch (err) {
    console.error(`Failed to mirror image to Spaces, using FAL URL:`, err);
    cdnUrl = image.url; // fallback to FAL URL if Spaces fails
  }

  await db.collection<GeneratedImageDoc>("generated_images").insertOne({
    _id: id,
    loraTrainingId: input.loraTrainingId,
    walletAddress,
    prompt: input.prompt,
    imageUrl: cdnUrl,
    imageWidth: image.width ?? null,
    imageHeight: image.height ?? null,
    seed: result.seed != null ? String(result.seed) : null,
    loraScaleValue: input.loraScale,
    loraScaleName: getLoraScaleLabel(input.loraScale),
    genWidth: input.imageWidth,
    genHeight: input.imageHeight,
    createdAt: now,
  });

  savedImages.push({
    id,
    imageUrl: cdnUrl,
    width: image.width ?? null,
    height: image.height ?? null,
    seed: result.seed != null ? String(result.seed) : null,
    loraScaleValue: input.loraScale,
    loraScaleName: getLoraScaleLabel(input.loraScale),
    genWidth: input.imageWidth,
    genHeight: input.imageHeight,
  });
}
```

**Key design decisions:**
- Graceful fallback: if Spaces upload fails, store the FAL URL rather than losing the image
- Path structure: `lora-trainer/images/{loraTrainingId}/{imageId}.jpg` — grouped by LoRA
- Content type preserved from FAL response

**Commit:**
```bash
git add src/server/api/features/generate.ts
git commit -m "feat: upload generated images to DO Spaces"
```

---

### Task 6: Update LoRA training completion to mirror weights to Spaces

**Objective:** When a LoRA training completes, download the weights from FAL storage and re-upload to Spaces. Store the Spaces CDN URL as `loraWeightsUrl`.

**Files:**
- Modify: `src/server/api/features/lora.ts` (lines ~42-86, `complete` mutation)

**Step 1:** Import the storage module

```typescript
import { mirrorUrlToSpaces } from "./storage";
```

**Step 2:** In the `complete` mutation, after validating ownership and before updating the DB, mirror the weights:

```typescript
// After the status === "completed" early-return check:

// Mirror LoRA weights to DO Spaces
const loraId = existing._id;
const weightsExt = input.loraWeightsUrl.endsWith(".safetensors") ? "safetensors" : "bin";
const spacesKey = `lora-trainer/loras/${loraId}/${loraId}.${weightsExt}`;

let cdnUrl: string;
try {
  cdnUrl = await mirrorUrlToSpaces(input.loraWeightsUrl, spacesKey, "application/octet-stream");
} catch (err) {
  console.error("Failed to mirror LoRA weights to Spaces, using FAL URL:", err);
  cdnUrl = input.loraWeightsUrl; // fallback
}

await db.collection<LoraTrainingDoc>("lora_trainings").updateOne(
  { _id: existing._id },
  {
    $set: {
      loraWeightsUrl: cdnUrl,
      status: "completed",
    },
  },
);
```

**Note:** The `loraWeightsUrl` is used in `generate.ts` line 100 as `loras: [{ path: lora.loraWeightsUrl, ... }]`. FAL.ai needs to fetch this URL, so it must be publicly accessible. DO Spaces CDN URLs are public, so this works.

**Commit:**
```bash
git add src/server/api/features/lora.ts
git commit -m "feat: mirror LoRA weights to DO Spaces on completion"
```

---

### Task 7: Mirror training source images + zip to Spaces during training

**Objective:** When a LoRA training is submitted, mirror the Are.na source images to Spaces and persist the training zip to Spaces. Store the Spaces URLs in the DB.

**Files:**
- Modify: `src/server/api/features/fal.ts` (in `trainLora` mutation, after zip creation ~line 415)
- Modify: `src/server/api/features/lora.ts` (in `createPendingLora`, add new fields)

**Step 1:** In `fal.ts`, after the zip is created and before it's uploaded to FAL, also upload to Spaces:

```typescript
import { uploadToSpaces, mirrorUrlToSpaces } from "./storage";

// ... inside trainLora, after createImageZip:

// Upload zip to FAL storage (for training queue)
const zipBlob = new Blob([new Uint8Array(zipBuffer)], { type: "application/zip" });
const zipUrl = await fal.storage.upload(zipBlob);

// Also persist zip to DO Spaces
let trainingZipUrl: string | null = null;
try {
  const zipSpacesKey = `lora-trainer/training-zips/${loraId}/${loraId}.zip`;
  trainingZipUrl = await uploadToSpaces(zipSpacesKey, zipBuffer, "application/zip");
  console.log(`Training zip mirrored to Spaces: ${trainingZipUrl}`);
} catch (err) {
  console.error("Failed to upload training zip to Spaces:", err);
}

// Mirror training source images to Spaces (async, non-blocking — don't fail training if this fails)
let imageUrlsSpaces: string[] = [];
try {
  const mirrorPromises = input.imageUrls.map((url, index) => {
    const filename = url.split("/").pop()?.split("?")[0] || `image_${index}.jpg`;
    const ext = /\.(jpg|jpeg|png|gif|webp)$/i.test(filename) ? "" : ".jpg";
    const spacesKey = `lora-trainer/training-images/${loraId}/${index + 1}_${filename}${ext}`;
    return mirrorUrlToSpaces(url, spacesKey, "image/jpeg").catch((err) => {
      console.error(`Failed to mirror training image ${index}:`, err);
      return null;
    });
  });
  const results = await Promise.all(mirrorPromises);
  imageUrlsSpaces = results.filter((r): r is string => r !== null);
  console.log(`Mirrored ${imageUrlsSpaces.length}/${input.imageUrls.length} training images to Spaces`);
} catch (err) {
  console.error("Failed to mirror training images to Spaces:", err);
}
```

**Step 2:** Update `createPendingLora` call to pass the new fields:

```typescript
const result = await createPendingLora({
  requestId: request_id,
  walletAddress,
  triggerWord: input.triggerWord,
  steps: input.steps,
  imageUrls: input.imageUrls,
  imageUrlsSpaces,
  trainingZipUrl,
  arenaChannelUrl: input.arenaChannelUrl,
  arenaChannelTitle: input.arenaChannelTitle,
});
```

**Step 3:** Update `createPendingLora` in `lora.ts` to accept and store the new fields:

```typescript
export async function createPendingLora(params: {
  requestId: string;
  walletAddress: string;
  triggerWord: string;
  steps: number;
  imageUrls: string[];
  imageUrlsSpaces?: string[];      // NEW
  trainingZipUrl?: string | null;  // NEW
  arenaChannelUrl?: string;
  arenaChannelTitle?: string;
}): Promise<{ id: string }> {
  const db = await getDb();
  const id = generateId();
  await db.collection<LoraTrainingDoc>("lora_trainings").insertOne({
    _id: id,
    requestId: params.requestId,
    walletAddress: params.walletAddress,
    triggerWord: params.triggerWord,
    steps: params.steps,
    imageUrls: params.imageUrls,
    imageUrlsSpaces: params.imageUrlsSpaces ?? [],     // NEW
    trainingZipUrl: params.trainingZipUrl ?? null,     // NEW
    loraWeightsUrl: null,
    arenaChannelUrl: params.arenaChannelUrl ?? null,
    arenaChannelTitle: params.arenaChannelTitle ?? null,
    status: "pending",
    createdAt: new Date().toISOString(),
  });
  return { id };
}
```

**Step 4:** Update the `getById` and `list` queries in `lora.ts` to return the new fields:

In `getById` return object:
```typescript
imageUrlsSpaces: doc.imageUrlsSpaces ?? [],
trainingZipUrl: doc.trainingZipUrl ?? null,
```

In `list` return `.map()`:
```typescript
imageUrlsSpaces: doc.imageUrlsSpaces ?? [],
trainingZipUrl: doc.trainingZipUrl ?? null,
```

**Design decisions:**
- Training images are mirrored to Spaces for durability — Are.na URLs could change or go offline
- Zip is persisted to Spaces for archival — useful for re-training or debugging
- Both operations have graceful fallback — training succeeds even if Spaces is down
- Source images are mirrored in parallel with `Promise.all` for speed
- `imageUrls` (original Are.na URLs) is kept for reference; `imageUrlsSpaces` is the durable copy

**Commit:**
```bash
git add src/server/api/features/fal.ts src/server/api/features/lora.ts src/server/api/db.ts
git commit -m "feat: mirror training images and zip to DO Spaces"
```

---

### Task 8: Update the `lora.complete` mutation to also mirror training images + zip (for existing pending LoRAs)

**Objective:** If a LoRA was trained before this feature shipped, its `imageUrlsSpaces` and `trainingZipUrl` will be empty. When the `complete` mutation runs, we can backfill them if the source URLs are still available.

**Files:**
- Modify: `src/server/api/features/lora.ts` (in `complete` mutation)

**Step 1:** After mirroring the weights, also check if training images / zip need backfilling:

```typescript
// After weights mirror, before DB update:

// Backfill training images if not yet mirrored
let imageUrlsSpaces: string[] = existing.imageUrlsSpaces ?? [];
if (imageUrlsSpaces.length === 0 && existing.imageUrls.length > 0) {
  try {
    const mirrorPromises = existing.imageUrls.map((url, index) => {
      const filename = url.split("/").pop()?.split("?")[0] || `image_${index}.jpg`;
      const ext = /\.(jpg|jpeg|png|gif|webp)$/i.test(filename) ? "" : ".jpg";
      const spacesKey = `lora-trainer/training-images/${existing._id}/${index + 1}_${filename}${ext}`;
      return mirrorUrlToSpaces(url, spacesKey, "image/jpeg").catch(() => null);
    });
    const results = await Promise.all(mirrorPromises);
    imageUrlsSpaces = results.filter((r): r is string => r !== null);
    console.log(`Backfilled ${imageUrlsSpaces.length} training images to Spaces`);
  } catch (err) {
    console.error("Failed to backfill training images:", err);
  }
}

// Note: training zip cannot be backfilled — it was created in-memory during trainLora
// and never persisted. Only future trainings will have trainingZipUrl.
```

**Step 2:** Update the DB update to include the backfilled fields:

```typescript
await db.collection<LoraTrainingDoc>("lora_trainings").updateOne(
  { _id: existing._id },
  {
    $set: {
      loraWeightsUrl: cdnUrl,
      status: "completed",
      ...(imageUrlsSpaces.length > 0 ? { imageUrlsSpaces } : {}),
    },
  },
);
```

**Commit:**
```bash
git add src/server/api/features/lora.ts
git commit -m "feat: backfill training images on LoRA completion"
```

---

### Task 9: Write the data migration script

**Objective:** One-time script to migrate existing DB records from FAL/Are.na URLs to Spaces CDN URLs. Handles all four asset types: generated images, LoRA weights, training source images, and (where possible) training zips.

**Files:**
- Create: `scripts/migrate-fal-to-spaces.mts`

```typescript
// @ts-nocheck
import { MongoClient } from "mongodb";
import { config } from "dotenv";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

config({ path: ".env.local" });
config();

const ENDPOINT = process.env.DO_SPACES_ENDPOINT!;
const REGION = process.env.DO_SPACES_REGION!;
const KEY = process.env.DO_SPACES_KEY!;
const SECRET = process.env.DO_SPACES_SECRET!;
const BUCKET = process.env.DO_SPACES_BUCKET!;
const CDN_URL = process.env.DO_SPACES_CDN_URL!;

const s3 = new S3Client({
  endpoint: ENDPOINT,
  region: REGION,
  credentials: { accessKeyId: KEY, secretAccessKey: SECRET },
});

async function uploadToSpaces(key: string, data: Buffer, contentType: string): Promise<string> {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: data,
    ContentType: contentType,
    ACL: "public-read",
  }));
  return `${CDN_URL}/${key}`;
}

async function mirrorUrlToSpaces(sourceUrl: string, key: string, contentType: string): Promise<string> {
  const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} for ${sourceUrl}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return uploadToSpaces(key, buffer, contentType);
}

function isFalUrl(url: string): boolean {
  if (!url) return false;
  return /fal\.(ai|run|media)|storage\.googleapis\.com/.test(url);
}

function isAlreadyOnSpaces(url: string): boolean {
  return !!url && url.includes("digitaloceanspaces.com");
}

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db();

  // ── 1. Migrate generated_images.imageUrl ──────────────────────
  console.log("\n=== Migrating generated images ===");
  const images = db.collection("generated_images");
  const imageDocs = await images.find({}).toArray();
  console.log(`Found ${imageDocs.length} generated images`);

  let imgMigrated = 0, imgSkipped = 0, imgFailed = 0;
  for (const doc of imageDocs) {
    if (isAlreadyOnSpaces(doc.imageUrl)) { imgSkipped++; continue; }
    if (!isFalUrl(doc.imageUrl)) { imgSkipped++; continue; }
    try {
      const ext = doc.imageUrl.match(/\.(jpg|jpeg|png|webp)/i)?.[0]?.toLowerCase() ?? ".jpg";
      const key = `lora-trainer/images/${doc.loraTrainingId}/${doc._id}${ext}`;
      const cdnUrl = await mirrorUrlToSpaces(doc.imageUrl, key, "image/jpeg");
      await images.updateOne({ _id: doc._id }, { $set: { imageUrl: cdnUrl } });
      imgMigrated++;
      if (imgMigrated % 10 === 0) console.log(`  ✓ ${imgMigrated} images migrated...`);
    } catch (err) {
      console.error(`  ✗ ${doc._id}: ${err}`);
      imgFailed++;
    }
  }
  console.log(`Images: ${imgMigrated} migrated, ${imgSkipped} skipped, ${imgFailed} failed`);

  // ── 2. Migrate lora_trainings.loraWeightsUrl ──────────────────
  console.log("\n=== Migrating LoRA weights ===");
  const loras = db.collection("lora_trainings");
  const loraDocs = await loras.find({ status: "completed", loraWeightsUrl: { $ne: null } }).toArray();
  console.log(`Found ${loraDocs.length} completed LoRAs`);

  let loraMigrated = 0, loraSkipped = 0, loraFailed = 0;
  for (const doc of loraDocs) {
    if (isAlreadyOnSpaces(doc.loraWeightsUrl)) { loraSkipped++; continue; }
    if (!isFalUrl(doc.loraWeightsUrl)) { loraSkipped++; continue; }
    try {
      const ext = doc.loraWeightsUrl.endsWith(".safetensors") ? ".safetensors" : ".bin";
      const key = `lora-trainer/loras/${doc._id}/${doc._id}${ext}`;
      const cdnUrl = await mirrorUrlToSpaces(doc.loraWeightsUrl, key, "application/octet-stream");
      await loras.updateOne({ _id: doc._id }, { $set: { loraWeightsUrl: cdnUrl } });
      loraMigrated++;
      console.log(`  ✓ ${doc._id}: weights migrated`);
    } catch (err) {
      console.error(`  ✗ ${doc._id}: ${err}`);
      loraFailed++;
    }
  }
  console.log(`LoRAs: ${loraMigrated} migrated, ${loraSkipped} skipped, ${loraFailed} failed`);

  // ── 3. Migrate lora_trainings.imageUrls → imageUrlsSpaces ─────
  console.log("\n=== Migrating training source images ===");
  const allLoraDocs = await loras.find({}).toArray();
  console.log(`Found ${allLoraDocs.length} total LoRA records`);

  let trainImgMigrated = 0, trainImgSkipped = 0, trainImgFailed = 0;
  for (const doc of allLoraDocs) {
    // Skip if already has imageUrlsSpaces
    if (doc.imageUrlsSpaces && doc.imageUrlsSpaces.length > 0) { trainImgSkipped++; continue; }
    if (!doc.imageUrls || doc.imageUrls.length === 0) { trainImgSkipped++; continue; }

    const mirroredUrls: string[] = [];
    for (const [index, url] of doc.imageUrls.entries()) {
      try {
        const filename = url.split("/").pop()?.split("?")[0] || `image_${index}.jpg`;
        const ext = /\.(jpg|jpeg|png|gif|webp)$/i.test(filename) ? "" : ".jpg";
        const key = `lora-trainer/training-images/${doc._id}/${index + 1}_${filename}${ext}`;
        const cdnUrl = await mirrorUrlToSpaces(url, key, "image/jpeg");
        mirroredUrls.push(cdnUrl);
      } catch (err) {
        console.error(`  ✗ ${doc._id} image ${index}: ${err}`);
      }
    }
    if (mirroredUrls.length > 0) {
      await loras.updateOne({ _id: doc._id }, { $set: { imageUrlsSpaces: mirroredUrls } });
      trainImgMigrated += mirroredUrls.length;
      console.log(`  ✓ ${doc._id}: ${mirroredUrls.length}/${doc.imageUrls.length} images mirrored`);
    } else {
      trainImgFailed++;
    }
  }
  console.log(`Training images: ${trainImgMigrated} migrated, ${trainImgSkipped} LoRAs skipped, ${trainImgFailed} failed`);

  // ── 4. Training zips ──────────────────────────────────────────
  console.log("\n=== Training zips ===");
  console.log("Training zips cannot be backfilled — they were created in-memory during");
  console.log("trainLora and never persisted to DB. Only new trainings will have trainingZipUrl.");

  await client.close();
  console.log("\n✅ Migration complete!");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
```

**Step 2:** Add npm script

In `package.json` scripts:
```json
"migrate:fal-to-spaces": "tsx scripts/migrate-fal-to-spaces.mts"
```

**Commit:**
```bash
git add scripts/migrate-fal-to-spaces.mts package.json
git commit -m "feat: add FAL→Spaces migration script"
```

---

### Task 10: Update next.config.ts for CDN image domains

**Objective:** Add the CDN domain to next.config.ts remotePatterns for future-proofing.

**Files:**
- Modify: `next.config.ts`

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  experimental: {
    optimizePackageImports: ["reshaped"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.digitaloceanspaces.com" },
      { protocol: "https", hostname: "d2w9rnfcy7mm78.cloudfront.net" }, // Are.na
      { protocol: "https", hostname: "*.are.na" },
    ],
  },
};

export default nextConfig;
```

**Commit:**
```bash
git add next.config.ts
git commit -m "feat: add DO Spaces CDN to next.config image domains"
```

---

### Task 11: Set Vercel environment variables

**Objective:** Set the DO Spaces env vars on Vercel so the production app can use them.

**Manual / external (via `vercel` CLI or dashboard):**
1. Add the following env vars to the lora-trainer Vercel project (all scopes: Production, Preview, Development):
   - `DO_SPACES_ENDPOINT` = `https://dmbk-io.sfo2.digitaloceanspaces.com`
   - `DO_SPACES_REGION` = `sfo2`
   - `DO_SPACES_KEY` = `DO00QKWBT22LMPVD3AKZ`
   - `DO_SPACES_SECRET` = *(the secret key — not committed, set directly in Vercel)*
   - `DO_SPACES_BUCKET` = `dmbk-io`
   - `DO_SPACES_CDN_URL` = `https://dmbk-io.sfo2.cdn.digitaloceanspaces.com`

2. Also add to local `.env.local` for dev testing

---

### Task 12: Run migration, test, and verify

**Objective:** Execute the migration and verify everything works end-to-end.

**Step 1:** Set up local env
```bash
# Add to .env.local:
DO_SPACES_ENDPOINT=https://dmbk-io.sfo2.digitaloceanspaces.com
DO_SPACES_REGION=sfo2
DO_SPACES_KEY=DO00QKWBT22LMPVD3AKZ
DO_SPACES_SECRET=fk9ruUPg9HVrDwhm8QjiWQAqbwSD8PHiWlN3xrXymg0
DO_SPACES_BUCKET=dmbk-io
DO_SPACES_CDN_URL=https://dmbk-io.sfo2.cdn.digitaloceanspaces.com
```

**Step 2:** Run the migration script
```bash
npm run migrate:fal-to-spaces
```

Expected: existing FAL URLs in `generated_images.imageUrl`, `lora_trainings.loraWeightsUrl`, and Are.na URLs in `lora_trainings.imageUrls` are mirrored to Spaces. DB records updated with `imageUrlsSpaces` arrays.

**Step 3:** Verify a few URLs
```bash
# Pick a generated image URL from the DB and curl it
curl -I "https://dmbk-io.sfo2.cdn.digitaloceanspaces.com/lora-trainer/images/..."
# Should return 200 OK with image content-type
```

**Step 4:** Test new generation flow
- Start dev server: `npm run dev`
- Generate a new image via the UI
- Check that the new image URL in DB is a Spaces CDN URL
- Verify the image displays correctly in the gallery + slideshow

**Step 5:** Test new training flow
- Submit a new LoRA training
- Verify `imageUrlsSpaces` and `trainingZipUrl` are populated in the DB
- Verify the training images and zip are accessible via CDN

**Step 6:** Push and deploy
```bash
git push origin feat/do-spaces-storage
# Open PR, merge, Vercel deploys with new env vars
```

**Step 7:** Verify on production
- Visit the lora-trainer app
- Check existing images load from CDN
- Generate a new image — confirm it loads from Spaces CDN

---

## Summary of files changed

| File | Change |
|------|--------|
| `package.json` | Add `@aws-sdk/client-s3` dep + migration script |
| `src/server/api/env.ts` | Add 6 Spaces env vars + `requireSpacesConfig()` |
| `src/server/api/features/storage.ts` | **NEW** — `uploadToSpaces()`, `mirrorUrlToSpaces()` |
| `src/server/api/db.ts` | Add `imageUrlsSpaces[]` + `trainingZipUrl` to `LoraTrainingDoc` |
| `src/server/api/features/generate.ts` | Mirror generated images to Spaces after FAL response |
| `src/server/api/features/lora.ts` | Mirror weights on complete + backfill training images + return new fields in queries |
| `src/server/api/features/fal.ts` | Mirror training images + zip to Spaces during `trainLora` |
| `scripts/migrate-fal-to-spaces.mts` | **NEW** — one-time migration of existing DB records |
| `next.config.ts` | Add Spaces CDN to image remotePatterns |

## Spaces storage layout

```
dmbk-io/
└── lora-trainer/
    ├── images/              ← generated images (from FAL flux-lora)
    │   └── {loraTrainingId}/{imageId}.jpg
    ├── loras/               ← trained LoRA weights (.safetensors)
    │   └── {loraTrainingId}/{loraId}.safetensors
    ├── training-images/     ← source images (from Are.na)
    │   └── {loraTrainingId}/{index}_{filename}.jpg
    └── training-zips/       ← training image zip files
        └── {loraTrainingId}/{loraId}.zip
```

## Risks & Tradeoffs

1. **FAL.ai image URL lifetime:** FAL.ai generated image URLs may expire. This migration is not just about CDN performance — it's about durability. The sooner we do this, the less risk of broken images.

2. **LoRA weights must be publicly fetchable by FAL.ai:** When generating images, FAL.ai fetches the `loraWeightsUrl`. DO Spaces CDN URLs with `public-read` ACL work for this.

3. **Graceful fallback everywhere:** Both `generate.ts`, `lora.ts`, and `fal.ts` fallback to original URLs if Spaces upload fails — no data loss, no blocked training.

4. **Migration is idempotent:** `isFalUrl()` and `isAlreadyOnSpaces()` checks skip records that have already been migrated. Safe to run multiple times.

5. **Training zip stays on FAL storage too:** The zip is still uploaded to FAL storage (`fal.storage.upload`) because FAL needs it as `images_data_url`. We additionally persist a copy to Spaces for archival.

6. **Training zips cannot be backfilled:** Existing LoRA records don't have the zip — it was created in-memory during training and never stored. Only new trainings going forward will have `trainingZipUrl`.

7. **Are.na images are persistent but not durable:** Are.na CDN URLs work but could theoretically go offline. Mirroring to Spaces ensures we have our own copy. The original `imageUrls` array is kept for reference.

8. **Training image mirroring is blocking but resilient:** The `Promise.all` with individual `.catch()` means one failed image doesn't block the rest. The training continues even if all mirroring fails.

## Open Questions

- None — all Spaces config confirmed (bucket: `dmbk-io`, region: `sfo2`, CDN exists, key created).
