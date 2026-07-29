import { MongoClient } from "mongodb";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

interface LoraTrainingDoc {
  _id: string;
  arenaChannelUrl: string | null;
  arenaChannelTitle: string | null;
}

async function fetchChannelTitle(slug: string): Promise<string> {
  const res = await fetch(`https://api.are.na/v2/channels/${slug}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.title || slug;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI not set");
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("lora-trainer");

  // Find all loras with "Unknown Channel" or null title but non-null URL
  const loras = await db
    .collection<LoraTrainingDoc>("lora_trainings")
    .find({
      arenaChannelUrl: { $ne: null },
      $or: [
        { arenaChannelTitle: "Unknown Channel" },
        { arenaChannelTitle: null },
        { arenaChannelTitle: { $exists: false } },
      ],
    })
    .toArray();

  console.log(`Found ${loras.length} loras to backfill`);

  // Collect unique slugs → lora IDs
  const slugMap = new Map<string, string[]>();
  for (const lora of loras) {
    if (!lora.arenaChannelUrl) continue;
    const slug = lora.arenaChannelUrl.split("/").pop()!;
    if (!slugMap.has(slug)) slugMap.set(slug, []);
    slugMap.get(slug)!.push(lora._id);
  }

  console.log(`Fetching titles for ${slugMap.size} unique channels\n`);

  for (const [slug, loraIds] of slugMap) {
    try {
      const title = await fetchChannelTitle(slug);
      console.log(`  "${slug}" -> "${title}" (${loraIds.length} loras)`);

      await db.collection("lora_trainings").updateMany(
        { _id: { $in: loraIds } },
        { $set: { arenaChannelTitle: title } },
      );
    } catch (e) {
      console.error(`  Failed to fetch title for "${slug}":`, e);
    }

    // Rate limit: be nice to the are.na API
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("\nBackfill complete!");
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
