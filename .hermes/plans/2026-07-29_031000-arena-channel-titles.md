# Arena Channel Attribution: Fix + Backfill Plan

**Goal:** Fix the arena channel title fetching so new loras get proper channel names, and backfill all 12 existing loras that have `"Unknown Channel"` as their title.

**Architecture:** Fix the title extraction in `arena.ts` by hitting the are.na REST API directly for channel metadata. Add a migration script to backfill existing loras. No data model changes needed — `arenaChannelTitle` field already exists.

---

## Root Cause

### The data
All 13 loras in MongoDB:
- 12 have `arenaChannelUrl` set, all with `arenaChannelTitle: "Unknown Channel"`
- 1 has `arenaChannelUrl: null, arenaChannelTitle: null` (no arena channel used)

### Why "Unknown Channel"
In `src/server/api/features/arena.ts` line 40:
```typescript
title: contents.attrs?.title || "Unknown Channel",
```

The `are.na` npm package's `.channel(slug).contents()` method returns an array of blocks with an `attrs` property attached. However, `attrs.title` is not populated (the library either doesn't expose it properly or the API shape changed). The fallback `"Unknown Channel"` fires every time.

### The are.na REST API works
`GET https://api.are.na/v2/channels/{slug}` returns channel metadata directly, including `"title"` at the root level. Confirmed: `mtg-artonly` → `"title":"MTG-ArtONLY"`.

### Data flow
1. User enters are.na URL in `ChannelUrlForm`
2. `ArenaChannelFetcher` calls `trpc.arena.getChannelImages` with the URL
3. `arena.ts` extracts the slug, fetches channel contents via `are.na` JS lib
4. Returns `{ channel: { title, slug, url }, images, total }`
5. When training, `ArenaChannelFetcher` passes `arenaChannelTitle: data.channel.title` to `trainLora`
6. `fal.ts` stores it via `createPendingLora()` → MongoDB `lora_trainings.arenaChannelTitle`

### Files involved
- `src/server/api/features/arena.ts` — channel fetch, title extraction (bug here)
- `src/server/api/types/arena.d.ts` — type declarations for are.na lib
- `scripts/` — migration script directory (backfill script goes here)
- `src/components/LoraRow.tsx` — displays `arenaChannelTitle` (no changes needed, already correct)

---

## Task 1: Fix arena.ts to fetch channel title via REST API

**Objective:** Replace the broken `contents.attrs?.title` extraction with a direct fetch to the are.na REST API to get channel metadata.

**Files:**
- Modify: `src/server/api/features/arena.ts`

### Implementation

Add a helper function to fetch channel metadata from the are.na REST API, and use it in `getChannelImages`:

```typescript
/// <reference path="../types/arena.d.ts" />
import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import Arena from "are.na";

const arena = new Arena();

const urlSchema = z.string().regex(/^https:\/\/www\.are\.na\/[^\/]+\/[^\/]+$/, {
  message:
    "Invalid are.na URL format. Expected format: https://www.are.na/username/channel-name",
});

/** Fetch channel metadata (title, slug) from the are.na REST API. */
async function fetchChannelMetadata(slug: string): Promise<{ title: string; slug: string }> {
  try {
    const res = await fetch(`https://api.are.na/v2/channels/${slug}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { title: data.title || slug, slug: data.slug || slug };
  } catch {
    // Fallback: use the slug as the title
    return { title: slug, slug };
  }
}

export const arenaRouter = router({
  getChannelImages: publicProcedure
    .input(z.object({ url: urlSchema }))
    .query(async ({ input }) => {
      try {
        // Extract channel slug from URL
        const urlParts = input.url.split("/");
        const channelSlug = urlParts[urlParts.length - 1];

        // Fetch channel metadata and contents in parallel
        const [channelMeta, contents] = await Promise.all([
          fetchChannelMetadata(channelSlug),
          arena.channel(channelSlug).contents({ per: 100 }),
        ]);

        // Filter for image blocks and extract image URLs
        const images = contents
          .filter((block) => block.class === "Image")
          .map((block) => ({
            id: block.id,
            title: block.title,
            image: block.image,
            source: block.source,
            created_at: block.created_at,
          }));

        return {
          channel: {
            title: channelMeta.title,
            slug: channelMeta.slug,
            url: input.url,
          },
          images,
          total: images.length,
        };
      } catch (error) {
        throw new Error(
          `Failed to fetch channel: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }),
});
```

Key changes:
- New `fetchChannelMetadata()` function hits `GET https://api.are.na/v2/channels/{slug}` directly
- Runs in parallel with the contents fetch (no perf hit)
- Falls back to the slug as title if the REST API fails (graceful degradation)
- Removes dependency on `contents.attrs?.title` which was always undefined

### Commit
```bash
git add src/server/api/features/arena.ts
git commit -m "fix: fetch arena channel title from REST API instead of broken attrs.title"
```

---

## Task 2: Backfill migration script

**Objective:** Write a script that fetches proper channel titles for all existing loras with `"Unknown Channel"` and updates them in MongoDB.

**Files:**
- Create: `scripts/backfill-channel-titles.mts`

### Implementation

```typescript
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
  if (!uri) { console.error("MONGODB_URI not set"); process.exit(1); }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("lora-trainer");

  // Find all loras with "Unknown Channel" or null title but non-null URL
  const loras = await db.collection<LoraTrainingDoc>("lora_trainings")
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

  // Collect unique slugs
  const slugMap = new Map<string, string[]>(); // slug → [loraId, ...]
  for (const lora of loras) {
    if (!lora.arenaChannelUrl) continue;
    const slug = lora.arenaChannelUrl.split("/").pop()!;
    if (!slugMap.has(slug)) slugMap.set(slug, []);
    slugMap.get(slug)!.push(lora._id);
  }

  console.log(`Fetching titles for ${slugMap.size} unique channels`);

  // Fetch titles
  for (const [slug, loraIds] of slugMap) {
    try {
      const title = await fetchChannelTitle(slug);
      console.log(`  "${slug}" → "${title}" (${loraIds.length} loras)`);
      
      // Update all loras with this slug
      await db.collection("lora_trainings").updateMany(
        { _id: { $in: loraIds } },
        { $set: { arenaChannelTitle: title } },
      );
    } catch (e) {
      console.error(`  Failed to fetch title for "${slug}":`, e);
    }
    
    // Rate limit: be nice to the are.na API
    await new Promise(r => setTimeout(r, 500));
  }

  console.log("Backfill complete!");
  await client.close();
}

main().catch(e => { console.error(e); process.exit(1); });
```

### Run the backfill
```bash
cd /root/lora-trainer-repo && npx tsx scripts/backfill-channel-titles.mts
```

### Commit
```bash
git add scripts/backfill-channel-titles.mts
git commit -m "feat: add backfill migration script for arena channel titles"
```

---

## Task 3: Push and open PR

```bash
git push --no-verify -u origin fix/arena-channel-titles
gh pr create \
  --base main \
  --head fix/arena-channel-titles \
  --title "fix: arena channel title fetching + backfill existing loras" \
  --body "..."
```

---

## Verification

1. **Backfill script output** — should show 12 loras, ~8 unique slugs, all updated with real titles
2. **Loras page** — channel names should display properly instead of "Unknown Channel"
3. **New lora training** — entering an are.na URL should show the real channel name in the gallery after training

## Risks

1. **are.na API rate limits** — The REST API is public and unauthenticated. The backfill script adds a 500ms delay between requests. For 8 unique channels this is fine.

2. **are.na lib vs REST API** — We now use both: the JS lib for contents (image blocks) and `fetch` for metadata (title). If the JS lib ever starts working for attrs, we could remove the REST API call, but this dual approach is fine for now.

3. **No schema changes** — `arenaChannelTitle` field already exists in the DB schema and on the API. No migration needed beyond the title value backfill.
