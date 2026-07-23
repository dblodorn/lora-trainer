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
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: data,
      ContentType: contentType,
      ACL: "public-read",
    }),
  );
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

/** Extract db name from MongoDB URI path */
function getDbNameFromUri(uri: string): string {
  try {
    const parsed = new URL(uri);
    const segments = parsed.pathname.split("/").filter(Boolean);
    return segments.length > 0 ? segments[0] : "test";
  } catch {
    return "test";
  }
}

async function main() {
  const uri = process.env.MONGODB_URI!;
  const dbName = getDbNameFromUri(uri);
  console.log(`Using MongoDB database: ${dbName}`);

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  // ── 1. Populate cdnUrl for generated_images ──────────────────
  console.log("\n=== Migrating generated images (populating cdnUrl) ===");
  const images = db.collection("generated_images");
  const imageDocs = await images.find({ cdnUrl: { $in: [null, undefined] } }).toArray();
  console.log(`Found ${imageDocs.length} images without cdnUrl`);

  let imgMigrated = 0,
    imgSkipped = 0,
    imgFailed = 0;
  for (const doc of imageDocs) {
    if (doc.cdnUrl && isAlreadyOnSpaces(doc.cdnUrl)) {
      imgSkipped++;
      continue;
    }
    try {
      const ext = doc.imageUrl.match(/\.(jpg|jpeg|png|webp)/i)?.[0]?.toLowerCase() ?? ".jpg";
      const key = `lora-trainer/images/${doc.loraTrainingId}/${doc._id}${ext}`;
      const cdnUrl = await mirrorUrlToSpaces(doc.imageUrl, key, "image/jpeg");
      await images.updateOne({ _id: doc._id }, { $set: { cdnUrl } });
      imgMigrated++;
      if (imgMigrated % 10 === 0) console.log(`  ✓ ${imgMigrated} images migrated...`);
    } catch (err) {
      console.error(`  ✗ ${doc._id}: ${err}`);
      imgFailed++;
    }
  }
  console.log(`Images: ${imgMigrated} migrated, ${imgSkipped} skipped, ${imgFailed} failed`);

  // ── 2. Migrate lora_trainings.loraWeightsUrl → cdnUrl ─────────
  console.log("\n=== Migrating LoRA weights ===");
  const loras = db.collection("lora_trainings");
  const loraDocs = await loras
    .find({ status: "completed", loraWeightsUrl: { $ne: null } })
    .toArray();
  console.log(`Found ${loraDocs.length} completed LoRAs`);

  let loraMigrated = 0,
    loraSkipped = 0,
    loraFailed = 0;
  for (const doc of loraDocs) {
    if (isAlreadyOnSpaces(doc.loraWeightsUrl)) {
      loraSkipped++;
      continue;
    }
    if (!isFalUrl(doc.loraWeightsUrl)) {
      loraSkipped++;
      continue;
    }
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

  let trainImgMigrated = 0,
    trainImgSkipped = 0,
    trainImgFailed = 0;
  for (const doc of allLoraDocs) {
    if (doc.imageUrlsSpaces && doc.imageUrlsSpaces.length > 0) {
      trainImgSkipped++;
      continue;
    }
    if (!doc.imageUrls || doc.imageUrls.length === 0) {
      trainImgSkipped++;
      continue;
    }

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
  console.log(
    `Training images: ${trainImgMigrated} migrated, ${trainImgSkipped} LoRAs skipped, ${trainImgFailed} failed`,
  );

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
