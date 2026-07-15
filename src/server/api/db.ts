import { Kysely, sql } from "kysely";
import { LibsqlDialect } from "@libsql/kysely-libsql";
import { config } from "dotenv";

// Load env the same way env.ts does
config({ path: ".env.local" });
config();

export interface LoraTrainingsTable {
  id: string;
  request_id: string;
  wallet_address: string;
  trigger_word: string;
  steps: number;
  image_urls: string; // JSON-encoded string[]
  lora_weights_url: string | null;
  arena_channel_url: string | null;
  arena_channel_title: string | null;
  status: "pending" | "completed" | "failed";
  created_at: string;
}

export interface GeneratedImagesTable {
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
  lora_trainings: LoraTrainingsTable;
  generated_images: GeneratedImagesTable;
}

let _db: Kysely<Database> | null = null;
let _initialized = false;

export function getDb(): Kysely<Database> {
  if (!_db) {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) {
      throw new Error(
        "TURSO_DATABASE_URL is not configured. Set it in .env to use database features.",
      );
    }
    _db = new Kysely<Database>({
      dialect: new LibsqlDialect({
        url,
        authToken: process.env.TURSO_AUTH_TOKEN,
      }),
    });
  }
  return _db;
}

export async function ensureLoraTable(): Promise<void> {
  if (_initialized) return;
  const db = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS lora_trainings (
      id TEXT PRIMARY KEY,
      request_id TEXT UNIQUE NOT NULL,
      wallet_address TEXT NOT NULL,
      trigger_word TEXT NOT NULL,
      steps INTEGER NOT NULL,
      image_urls TEXT NOT NULL,
      lora_weights_url TEXT,
      arena_channel_url TEXT,
      arena_channel_title TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    )
  `.execute(db);
  // Add columns for existing tables (no-op if they already exist)
  await sql`ALTER TABLE lora_trainings ADD COLUMN arena_channel_url TEXT`.execute(db).catch(() => {});
  await sql`ALTER TABLE lora_trainings ADD COLUMN arena_channel_title TEXT`.execute(db).catch(() => {});
  await sql`CREATE INDEX IF NOT EXISTS idx_lora_trainings_created_at ON lora_trainings(created_at)`.execute(
    db,
  );
  await sql`CREATE INDEX IF NOT EXISTS idx_lora_trainings_status ON lora_trainings(status)`.execute(
    db,
  );
  _initialized = true;
}

let _genImagesInitialized = false;

export async function ensureGeneratedImagesTable(): Promise<void> {
  if (_genImagesInitialized) return;
  const db = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS generated_images (
      id TEXT PRIMARY KEY,
      lora_training_id TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      prompt TEXT NOT NULL,
      image_url TEXT NOT NULL,
      image_width INTEGER,
      image_height INTEGER,
      seed TEXT,
      created_at TEXT NOT NULL
    )
  `.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_gen_images_lora ON generated_images(lora_training_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_gen_images_wallet ON generated_images(wallet_address)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_gen_images_created ON generated_images(created_at)`.execute(db);
  await sql`ALTER TABLE generated_images ADD COLUMN lora_scale_value TEXT`.execute(db).catch(() => {});
  await sql`ALTER TABLE generated_images ADD COLUMN lora_scale_name TEXT`.execute(db).catch(() => {});
  await sql`ALTER TABLE generated_images ADD COLUMN gen_width INTEGER`.execute(db).catch(() => {});
  await sql`ALTER TABLE generated_images ADD COLUMN gen_height INTEGER`.execute(db).catch(() => {});
  _genImagesInitialized = true;
}
