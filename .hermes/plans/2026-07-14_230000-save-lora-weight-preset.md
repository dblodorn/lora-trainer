# Save & Display LoRA Weight Preset — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Persist the LoRA weight preset (both the scale value and its label name) when generating images, and render a small Badge next to the timestamp in the gallery thumbnail cards.

**Architecture:** Add two new columns (`lora_scale_value` and `lora_scale_name`) to the `generated_images` table via ALTER TABLE migrations. The tRPC `generate.images` mutation saves the selected preset, and `listByLora` returns the new fields. The `GeneratedImageGrid` component renders a Reshaped `Badge` (size="small") showing the preset name to the right of the timestamp. The `GenerateModal` also passes the preset label in its inline results so the modal grid shows the badge too.

**Tech Stack:** Kysely (Turso/libsql), tRPC 11, Zod, Reshaped Badge component, Next.js 16

---

### Task 1: Add `lora_scale_value` and `lora_scale_name` columns to the DB

**Objective:** Add two new nullable columns to `generated_images` for the scale value and preset label.

**Files:**
- Modify: `src/server/api/db.ts` (GeneratedImagesTable interface + ensureGeneratedImagesTable function)

**Step 1: Update the GeneratedImagesTable interface**

In `src/server/api/db.ts`, add two fields to the `GeneratedImagesTable` interface (after `seed`, before `created_at`):

```typescript
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
  created_at: string;
}
```

**Step 2: Add ALTER TABLE migrations**

In the `ensureGeneratedImagesTable` function, after the CREATE TABLE and existing CREATE INDEX statements (before `_genImagesInitialized = true`), add:

```typescript
await sql`ALTER TABLE generated_images ADD COLUMN lora_scale_value TEXT`.execute(db).catch(() => {});
await sql`ALTER TABLE generated_images ADD COLUMN lora_scale_name TEXT`.execute(db).catch(() => {});
```

These are no-op if the columns already exist (existing pattern used for lora_trainings).

**Step 3: Verify type check**

Run: `cd /root/lora-trainer-repo && ./node_modules/.bin/tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/server/api/db.ts
git commit -m "feat: add lora_scale_value and lora_scale_name columns to generated_images"
```

---

### Task 2: Add preset label lookup helper to shared module

**Objective:** Add a helper to `src/lib/lora-scale.ts` that looks up a preset label by its value, so the server can save the label name alongside the numeric scale value.

**Files:**
- Modify: `src/lib/lora-scale.ts`

**Step 1: Add lookup helper**

Append to the end of `src/lib/lora-scale.ts`:

```typescript
/** Look up the preset label for a given scale value */
export function getLoraScaleLabel(value: LoraScale): string {
  return LORA_SCALE_PRESETS.find((p) => p.value === value)?.label ?? value;
}
```

**Step 2: Verify type check**

Run: `cd /root/lora-trainer-repo && ./node_modules/.bin/tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/lora-scale.ts
git commit -m "feat: add getLoraScaleLabel helper to shared lora-scale module"
```

---

### Task 3: Save preset in generate.images mutation

**Objective:** When generating images, save the `loraScale` value and its corresponding label name to the database.

**Files:**
- Modify: `src/server/api/features/generate.ts` (the images mutation — INSERT loop and the return value)

**Step 1: Import the label helper**

At the top of `src/server/api/features/generate.ts`, update the existing import from `@/lib/lora-scale`:

```typescript
import { loraScaleSchema, DEFAULT_LORA_SCALE, getLoraScaleLabel } from "@/lib/lora-scale";
```

**Step 2: Save scale value + name in the INSERT**

In the `images` mutation, in the `for` loop that inserts each image into the DB (around line 138), add the two new columns to the `.values()` call:

Change:
```typescript
.values({
  id,
  lora_training_id: input.loraTrainingId,
  wallet_address: walletAddress,
  prompt: input.prompt,
  image_url: image.url,
  image_width: image.width ?? null,
  image_height: image.height ?? null,
  seed: result.seed != null ? String(result.seed) : null,
  created_at: now,
})
```

To:
```typescript
.values({
  id,
  lora_training_id: input.loraTrainingId,
  wallet_address: walletAddress,
  prompt: input.prompt,
  image_url: image.url,
  image_width: image.width ?? null,
  image_height: image.height ?? null,
  seed: result.seed != null ? String(result.seed) : null,
  lora_scale_value: input.loraScale,
  lora_scale_name: getLoraScaleLabel(input.loraScale),
  created_at: now,
})
```

**Step 3: Add scale fields to the return value**

In the `savedImages` array push, add the two new fields:

Change:
```typescript
savedImages.push({
  id,
  imageUrl: image.url,
  width: image.width ?? null,
  height: image.height ?? null,
  seed: result.seed != null ? String(result.seed) : null,
});
```

To:
```typescript
savedImages.push({
  id,
  imageUrl: image.url,
  width: image.width ?? null,
  height: image.height ?? null,
  seed: result.seed != null ? String(result.seed) : null,
  loraScaleValue: input.loraScale,
  loraScaleName: getLoraScaleLabel(input.loraScale),
});
```

**Step 4: Verify type check**

Run: `cd /root/lora-trainer-repo && ./node_modules/.bin/tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/server/api/features/generate.ts
git commit -m "feat: save lora scale value and preset name when generating images"
```

---

### Task 4: Return scale fields in listByLora query

**Objective:** Include the two new columns in the `listByLora` query so the gallery can display the badge.

**Files:**
- Modify: `src/server/api/features/generate.ts` (the listByLora query)

**Step 1: Add columns to the SELECT**

In the `listByLora` query, add `"lora_scale_value"` and `"lora_scale_name"` to the `.select()` array:

Change:
```typescript
.select([
  "id",
  "wallet_address",
  "prompt",
  "image_url",
  "image_width",
  "image_height",
  "seed",
  "created_at",
])
```

To:
```typescript
.select([
  "id",
  "wallet_address",
  "prompt",
  "image_url",
  "image_width",
  "image_height",
  "seed",
  "lora_scale_value",
  "lora_scale_name",
  "created_at",
])
```

**Step 2: Add fields to the return mapping**

In the `rows.map()` return, add the two new fields:

Change:
```typescript
return rows.map((row) => ({
  id: row.id,
  walletAddress: row.wallet_address,
  prompt: row.prompt,
  imageUrl: row.image_url,
  width: row.image_width,
  height: row.image_height,
  seed: row.seed,
  createdAt: row.created_at,
}));
```

To:
```typescript
return rows.map((row) => ({
  id: row.id,
  walletAddress: row.wallet_address,
  prompt: row.prompt,
  imageUrl: row.image_url,
  width: row.image_width,
  height: row.image_height,
  seed: row.seed,
  loraScaleValue: row.lora_scale_value,
  loraScaleName: row.lora_scale_name,
  createdAt: row.created_at,
}));
```

**Step 3: Verify type check**

Run: `cd /root/lora-trainer-repo && ./node_modules/.bin/tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/server/api/features/generate.ts
git commit -m "feat: return lora scale fields in listByLora query"
```

---

### Task 5: Render Badge in GeneratedImageGrid

**Objective:** Show a Reshaped `Badge` (size="small") with the preset name to the right of the timestamp in gallery thumbnail cards.

**Files:**
- Modify: `src/components/GeneratedImageGrid.tsx`

**Step 1: Add Badge import and extend the interface**

Add `Badge` to the reshaped imports:

```typescript
import { View, Text, Card, Image, Actionable, Badge } from "reshaped";
```

Extend the `GeneratedImage` interface:

```typescript
interface GeneratedImage {
  id: string;
  imageUrl: string;
  prompt: string;
  createdAt: string;
  width?: number | null;
  height?: number | null;
  loraScaleName?: string | null;
}
```

**Step 2: Render the Badge next to the timestamp**

In the `variant === "page"` section (the card body), change:

```tsx
<View padding={2} gap={1}>
  <Text variant="caption-1" maxLines={2}>
    {img.prompt}
  </Text>
  <View direction="row" align="center" gap={2}>
    <Text variant="caption-1" color="neutral-faded">
      {formatDate(img.createdAt)}
    </Text>
    {img.loraScaleName && (
      <Badge size="small" color="primary" variant="faded">
        {img.loraScaleName}
      </Badge>
    )}
  </View>
</View>
```

Note: The timestamp and badge sit in a `View direction="row"` so the badge appears to the right of the timestamp.

**Step 3: Verify type check**

Run: `cd /root/lora-trainer-repo && ./node_modules/.bin/tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/GeneratedImageGrid.tsx
git commit -m "feat: render LoRA weight preset badge in gallery thumbnails"
```

---

### Task 6: Pass scale name from GenerateModal to inline results

**Objective:** When the GenerateModal shows generated images inline (before the gallery refresh), include the preset name so the badge renders in the modal grid too.

**Files:**
- Modify: `src/components/GenerateModal.tsx`

**Step 1: Import getLoraScaleLabel**

Update the import from `@/lib/lora-scale`:

```typescript
import {
  LORA_SCALE_PRESETS,
  DEFAULT_LORA_SCALE,
  LORA_SCALE_VALUES,
  getLoraScaleLabel,
  type LoraScale,
} from "@/lib/lora-scale";
```

**Step 2: Add loraScaleName to inline generated images**

In the `generateMutation.onSuccess` callback, add `loraScaleName` to the mapped images:

Change:
```typescript
setGeneratedImages(
  data.images.map((img) => ({
    id: img.id,
    imageUrl: img.imageUrl,
    prompt: data.prompt,
    createdAt: now,
  })),
);
```

To:
```typescript
const scaleName = getLoraScaleLabel(loraScale);
setGeneratedImages(
  data.images.map((img) => ({
    id: img.id,
    imageUrl: img.imageUrl,
    prompt: data.prompt,
    createdAt: now,
    loraScaleName: scaleName,
  })),
);
```

Note: `loraScale` is the current state value at the time of the onSuccess callback. Since the mutation is async, the user could theoretically change the pill between submitting and receiving results. To be safe, use `data.loraScaleName` from the server response instead (added in Task 3). So the actual code should be:

```typescript
setGeneratedImages(
  data.images.map((img) => ({
    id: img.id,
    imageUrl: img.imageUrl,
    prompt: data.prompt,
    createdAt: now,
    loraScaleName: img.loraScaleName ?? null,
  })),
);
```

**Step 3: Verify type check**

Run: `cd /root/lora-trainer-repo && ./node_modules/.bin/tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/GenerateModal.tsx
git commit -m "feat: pass lora scale name to inline modal results"
```

---

### Task 7: Verify full build and push PR

**Step 1: Run full type check**

```bash
cd /root/lora-trainer-repo && ./node_modules/.bin/tsc --noEmit
```
Expected: No errors

**Step 2: Push branch**

```bash
git push -u origin HEAD
```

**Step 3: Create PR**

```bash
gh pr create \
  --title "feat: save and display LoRA weight preset in gallery" \
  --body "..." \
  --base main
```

**Step 4: Report PR URL**
