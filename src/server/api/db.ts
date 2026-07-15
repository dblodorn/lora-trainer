import { MongoClient, Db } from "mongodb";
import { config } from "dotenv";

// Load env the same way env.ts does
config({ path: ".env.local" });
config();

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

  _client = new MongoClient(uri);
  await _client.connect();
  _db = _client.db();

  if (!_indexesEnsured) {
    await ensureIndexes(_db);
    _indexesEnsured = true;
  }

  return _db;
}

async function ensureIndexes(db: Db): Promise<void> {
  // lora_trainings indexes
  const loraCol = db.collection("lora_trainings");
  await loraCol.createIndex({ requestId: 1 }, { unique: true });
  await loraCol.createIndex({ status: 1 });
  await loraCol.createIndex({ createdAt: -1 });

  // generated_images indexes
  const imgCol = db.collection("generated_images");
  await imgCol.createIndex({ loraTrainingId: 1 });
  await imgCol.createIndex({ walletAddress: 1 });
  await imgCol.createIndex({ createdAt: -1 });
}
