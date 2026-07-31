import { MongoClient, Db } from "mongodb";
import { config } from "dotenv";

// Load env the same way env.ts does
config({ path: ".env.local" });
config();

export interface LoraTrainingDoc {
  _id: string;
  requestId: string;
  walletAddress: string;
  triggerWord: string;
  steps: number;
  imageUrls: string[];
  imageUrlsSpaces: string[];
  trainingZipUrl: string | null;
  loraWeightsUrl: string | null;
  arenaChannelUrl: string | null;
  arenaChannelTitle: string | null;
  hidden: boolean;
  status: "pending" | "completed" | "failed";
  createdAt: string;
}

export interface GeneratedImageDoc {
  _id: string;
  loraTrainingId: string;
  walletAddress: string;
  prompt: string;
  imageUrl: string;
  cdnUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  seed: string | null;
  loraScaleValue: string | null;
  loraScaleName: string | null;
  genWidth: number | null;
  genHeight: number | null;
  createdAt: string;
}

let _client: MongoClient | null = null;
let _db: Db | null = null;
let _indexesEnsured = false;

/**
 * Get the MongoDB database singleton.
 * Collections are created automatically on first insert.
 * Indexes are ensured on first call.
 */
export async function getDb(): Promise<Db> {
  if (_db) return _db;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not configured. Set it in .env to use database features.",
    );
  }

  // Extract db name from URI path (e.g. mongodb+srv://user:pass@host/dbname?params)
  // The MongoDB driver defaults to "test" if not specified, but our data lives in "lora-trainer"
  let dbName = "lora-trainer";
  try {
    const parsed = new URL(uri);
    const pathSegments = parsed.pathname.split("/").filter(Boolean);
    if (pathSegments.length > 0) {
      dbName = pathSegments[0];
    }
  } catch {
    // If URL parsing fails, use default
  }

  _client = new MongoClient(uri);
  await _client.connect();
  _db = _client.db(dbName);

  if (!_indexesEnsured) {
    await ensureIndexes(_db);
    _indexesEnsured = true;
  }

  return _db;
}

async function ensureIndexes(db: Db): Promise<void> {
  // lora_trainings indexes
  const loraCol = db.collection<LoraTrainingDoc>("lora_trainings");
  await loraCol.createIndex({ requestId: 1 }, { unique: true });
  await loraCol.createIndex({ status: 1 });
  await loraCol.createIndex({ createdAt: -1 });

  // generated_images indexes
  const imgCol = db.collection<GeneratedImageDoc>("generated_images");
  await imgCol.createIndex({ loraTrainingId: 1 });
  await imgCol.createIndex({ walletAddress: 1 });
  await imgCol.createIndex({ createdAt: -1 });
}
