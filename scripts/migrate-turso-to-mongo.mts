// @ts-nocheck
/**
 * Turso → MongoDB data migration script
 *
 * Prerequisites:
 *   - TURSO_DATABASE_URL and TURSO_AUTH_TOKEN set in .env or .env.local
 *   - MONGODB_URI set in .env or .env.local
 *   - Run: npm run migrate:turso-to-mongo
 *
 * This script reads all rows from Turso (lora_trainings + generated_images),
 * transforms snake_case → camelCase, un-JSON-encodes image_urls, and upserts
 * them into MongoDB collections (matched by _id), so re-running it is safe
 * and never deletes documents already in MongoDB.
 */

import { Kysely, sql } from "kysely";
import { LibsqlDialect } from "@libsql/kysely-libsql";
import { MongoClient } from "mongodb";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

interface LoraRow {
  id: string;
  request_id: string;
  wallet_address: string;
  trigger_word: string;
  steps: number;
  image_urls: string;
  lora_weights_url: string | null;
  arena_channel_url: string | null;
  arena_channel_title: string | null;
  status: string;
  created_at: string;
}

interface GeneratedImageRow {
  id: string;
  lora_training_id: string;
  wallet_address: string;
  prompt: string;
  image_url: string;
  image_width: number | null;
  image_height: number | null;
  seed: string | null;
  lora_scale_value: string | null;
  lora_scale_name: string | null;
  gen_width: number | null;
  gen_height: number | null;
  created_at: string;
}

interface Database {
  lora_trainings: LoraRow;
  generated_images: GeneratedImageRow;
}

async function migrate() {
  // ── Source: Turso ──────────────────────────────────────────────
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoUrl) {
    throw new Error("TURSO_DATABASE_URL is not set. Set it in .env.local to run the migration.");
  }

  console.log("Connecting to Turso...");
  const tursoDb = new Kysely<Database>({
    dialect: new LibsqlDialect({
      url: tursoUrl,
      authToken: tursoToken,
    }),
  });

  // ── Destination: MongoDB ───────────────────────────────────────
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is not set. Set it in .env.local to run the migration.");
  }

  console.log("Connecting to MongoDB...");
  const mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  const mongoDb = mongoClient.db();

  // ── Migrate lora_trainings ─────────────────────────────────────
  console.log("Fetching lora_trainings from Turso...");
  const loraRows = await tursoDb.selectFrom("lora_trainings").selectAll().execute();
  console.log(`  Found ${loraRows.length} rows`);
  let loraUpsertedCount = 0;

  if (loraRows.length > 0) {
    const loraDocs = [];
    for (const row of loraRows) {
      let imageUrls: string[];
      try {
        imageUrls = JSON.parse(row.image_urls) as string[];
      } catch {
        console.warn(`  ⚠️  Skipping lora_trainings row ${row.id}: malformed image_urls JSON`);
        continue;
      }
      loraDocs.push({
        _id: row.id,
        requestId: row.request_id,
        walletAddress: row.wallet_address,
        triggerWord: row.trigger_word,
        steps: row.steps,
        imageUrls,
        loraWeightsUrl: row.lora_weights_url,
        arenaChannelUrl: row.arena_channel_url,
        arenaChannelTitle: row.arena_channel_title,
        status: row.status,
        createdAt: row.created_at,
      });
    }

    // Upsert by _id so re-running the script never deletes documents
    // already written to MongoDB (e.g. by the app after cutover).
    if (loraDocs.length > 0) {
      await mongoDb.collection("lora_trainings").bulkWrite(
        loraDocs.map((doc) => ({
          replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true },
        })),
      );
    }
    loraUpsertedCount = loraDocs.length;
    console.log(`  ✅ Upserted ${loraDocs.length} lora_trainings`);
  }

  // ── Migrate generated_images ───────────────────────────────────
  console.log("Fetching generated_images from Turso...");
  const imgRows = await tursoDb.selectFrom("generated_images").selectAll().execute();
  console.log(`  Found ${imgRows.length} rows`);

  if (imgRows.length > 0) {
    const imgDocs = imgRows.map((row) => ({
      _id: row.id,
      loraTrainingId: row.lora_training_id,
      walletAddress: row.wallet_address,
      prompt: row.prompt,
      imageUrl: row.image_url,
      imageWidth: row.image_width,
      imageHeight: row.image_height,
      seed: row.seed,
      loraScaleValue: row.lora_scale_value,
      loraScaleName: row.lora_scale_name,
      genWidth: row.gen_width,
      genHeight: row.gen_height,
      createdAt: row.created_at,
    }));

    // Upsert by _id so re-running the script never deletes documents
    // already written to MongoDB (e.g. by the app after cutover).
    await mongoDb.collection("generated_images").bulkWrite(
      imgDocs.map((doc) => ({
        replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true },
      })),
    );
    console.log(`  ✅ Upserted ${imgDocs.length} generated_images`);
  }

  // ── Create indexes ────────────────────────────────────────────
  console.log("Creating indexes...");
  const loraCol = mongoDb.collection("lora_trainings");
  await loraCol.createIndex({ requestId: 1 }, { unique: true });
  await loraCol.createIndex({ status: 1 });
  await loraCol.createIndex({ createdAt: -1 });

  const imgCol = mongoDb.collection("generated_images");
  await imgCol.createIndex({ loraTrainingId: 1 });
  await imgCol.createIndex({ walletAddress: 1 });
  await imgCol.createIndex({ createdAt: -1 });
  console.log("  ✅ Indexes created");

  // ── Cleanup ────────────────────────────────────────────────────
  console.log("\n✅ Migration complete!");
  console.log(`   lora_trainings: ${loraUpsertedCount} documents`);
  console.log(`   generated_images: ${imgRows.length} documents`);

  await mongoClient.close();
  await tursoDb.destroy();
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
