# Custom Image Dimensions — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Allow users to set custom image width and height in the Generate Images modal, with min 250, max 1080, default 1024×1024. Store the requested dimensions in the database alongside the generated image.

**Architecture:** Add `imageWidth` and `imageHeight` to the tRPC mutation input (Zod-validated integers, 250–1080). Pass them to the FAL.ai `flux-lora` call as a `{width, height}` object instead of the current `"square_hd"` string preset. Add two new nullable columns (`gen_width`, `gen_height`) to store the requested dimensions — distinct from the existing `image_width`/`image_height` which store the actual returned dimensions from FAL.ai. Add two Reshaped `NumberField` inputs to the GenerateModal UI.

**Tech Stack:** Zod, tRPC 11, Kysely (Turso/libsql), Reshaped NumberField, FAL.ai flux-lora

---

### Shared constants

Min: 250, Max: 1080, Default: 1024 (both width and height)

---

### Task 1: Add shared image dimension constants + Zod schema

**Objective:** Create a shared module for image dimension constants and Zod validation, mirroring the lora-scale pattern.

**Files:**
- Create: `src/lib/image-dimensions.ts`

**Step 1: Create the shared module**

```typescript
import { z } from "zod";

/** Image dimension constraints */
export const IMAGE_DIMENSION_MIN = 250;
export const IMAGE_DIMENSION_MAX = 1080;
export const DEFAULT_IMAGE_WIDTH = 1024;
export const DEFAULT_IMAGE_HEIGHT = 1024;

/** Zod schema for a single dimension (width or height) */
export const imageDimensionSchema = z
  .number()
  .int()
  .min(IMAGE_DIMENSION_MIN)
  .max(IMAGE_DIMENSION_MAX);

/** Zod schema for the image dimensions input */
export const imageDimensionsSchema = z.object({
  imageWidth: imageDimensionSchema.default(DEFAULT_IMAGE_WIDTH),
  imageHeight: imageDimensionSchema.default(DEFAULT_IMAGE_HEIGHT),
});
```

**Step 2: Verify type check**

Run: `cd /root/lora-trainer-repo && ./node_modules/.bin/tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/image-dimensions.ts
git commit -m "feat: add shared image dimension constants and Zod schema"
```

---

### Task 2: Add `gen_width` and `gen_height` columns to the DB

**Objective:** Add two new nullable columns to store the user-requested dimensions (not the actual returned dimensions, which are already in `image_width`/`image_height`).

**Files:**
- Modify: `src/server/api/db.ts` (GeneratedImagesTable interface + ensureGeneratedImagesTable function)

**Step 1: Update the interface**

Add `gen_width` and `gen_height` to `GeneratedImagesTable` (nullable integers, after `lora_scale_name`):

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
  gen_width: number | null;
  gen_height: number | null;
  created_at: string;
}
```

**Step 2: Add ALTER TABLE migrations**

In `ensureGeneratedImagesTable`, after the existing ALTER TABLE for lora_scale columns:

```typescript
await sql`ALTER TABLE generated_images ADD COLUMN gen_width INTEGER`.execute(db).catch(() => {});
await sql`ALTER TABLE generated_images ADD COLUMN gen_height INTEGER`.execute(db).catch(() => {});
```

**Step 3: Verify type check**

Run: `cd /root/lora-trainer-repo && ./node_modules/.bin/tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/server/api/db.ts
git commit -m "feat: add gen_width and gen_height nullable columns to generated_images"
```

---

### Task 3: Add dimension inputs to tRPC mutation + pass to FAL.ai

**Objective:** Accept `imageWidth` and `imageHeight` in the mutation input, pass them to the FAL.ai call as a `{width, height}` object, and save them to the DB.

**Files:**
- Modify: `src/server/api/features/generate.ts`

**Step 1: Import the shared schema**

Add import at the top:

```typescript
import { imageDimensionsSchema, DEFAULT_IMAGE_WIDTH, DEFAULT_IMAGE_HEIGHT } from "@/lib/image-dimensions";
```

**Step 2: Add to mutation input**

Change the Zod input object from:

```typescript
z.object({
  loraTrainingId: z.string().min(1),
  prompt: z.string().min(1).max(500),
  loraScale: loraScaleSchema.default(DEFAULT_LORA_SCALE),
})
```

To:

```typescript
z.object({
  loraTrainingId: z.string().min(1),
  prompt: z.string().min(1).max(500),
  loraScale: loraScaleSchema.default(DEFAULT_LORA_SCALE),
  imageWidth: imageDimensionsSchema.shape.imageWidth,
  imageHeight: imageDimensionsSchema.shape.imageHeight,
})
```

Note: We spread the individual fields from the schema so the defaults are applied at the top level.

**Step 3: Pass custom dimensions to FAL.ai**

Replace the `image_size: "square_hd"` in the fal.subscribe call with:

```typescript
image_size: { width: input.imageWidth, height: input.imageHeight },
```

**Step 4: Save requested dimensions in the INSERT**

Add to the `.values()` call:

```typescript
gen_width: input.imageWidth,
gen_height: input.imageHeight,
```

**Step 5: Add to the return value**

Add to the `savedImages` type and push:

```typescript
// In the type:
genWidth: number;
genHeight: number;

// In the push:
genWidth: input.imageWidth,
genHeight: input.imageHeight,
```

**Step 6: Verify type check**

Run: `cd /root/lora-trainer-repo && ./node_modules/.bin/tsc --noEmit`
Expected: No errors

**Step 7: Commit**

```bash
git add src/server/api/features/generate.ts
git commit -m "feat: accept custom image dimensions in generate.images mutation"
```

---

### Task 4: Return dimensions in listByLora query

**Objective:** Include `gen_width` and `gen_height` in the listByLora query results.

**Files:**
- Modify: `src/server/api/features/generate.ts`

**Step 1: Add columns to SELECT**

Add `"gen_width"` and `"gen_height"` to the `.select()` array.

**Step 2: Add to the return mapping**

Add to the `rows.map()` return:

```typescript
genWidth: row.gen_width,
genHeight: row.gen_height,
```

**Step 3: Verify type check**

Run: `cd /root/lora-trainer-repo && ./node_modules/.bin/tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/server/api/features/generate.ts
git commit -m "feat: return gen dimensions in listByLora query"
```

---

### Task 5: Add dimension inputs to GenerateModal UI

**Objective:** Add two Reshaped `NumberField` inputs for width and height to the GenerateModal, with min 250, max 1080, step 1, default 1024.

**Files:**
- Modify: `src/components/GenerateModal.tsx`

**Step 1: Import NumberField and shared constants**

Add `NumberField` to the Reshaped import:

```typescript
import { View, Text, Button, Modal, TextField, Alert, Loader, ToggleButton, ToggleButtonGroup, NumberField } from "reshaped";
```

Add shared constants import:

```typescript
import {
  IMAGE_DIMENSION_MIN,
  IMAGE_DIMENSION_MAX,
  DEFAULT_IMAGE_WIDTH,
  DEFAULT_IMAGE_HEIGHT,
} from "@/lib/image-dimensions";
```

**Step 2: Add state for dimensions**

After the `loraScale` state:

```typescript
const [imageWidth, setImageWidth] = useState<number>(DEFAULT_IMAGE_WIDTH);
const [imageHeight, setImageHeight] = useState<number>(DEFAULT_IMAGE_HEIGHT);
```

**Step 3: Reset dimensions when modal opens**

In the `useEffect` reset block, add:

```typescript
setImageWidth(DEFAULT_IMAGE_WIDTH);
setImageHeight(DEFAULT_IMAGE_HEIGHT);
```

**Step 4: Pass dimensions to mutation calls**

In both `handleGenerate` and `handleGenerateAgain`, add to the `mutate` call:

```typescript
imageWidth,
imageHeight,
```

**Step 5: Add NumberField inputs to the UI**

Add a new `View` block between the LoRA weight pills and the character count row. Two NumberFields side by side:

```tsx
<View gap={1}>
  <Text variant="caption-1" color="neutral-faded">
    Image dimensions
  </Text>
  <View direction="row" gap={3}>
    <View.Item grow>
      <NumberField
        name="imageWidth"
        label="Width"
        value={imageWidth}
        onChange={({ value }) => setImageWidth(value ?? DEFAULT_IMAGE_WIDTH)}
        min={IMAGE_DIMENSION_MIN}
        max={IMAGE_DIMENSION_MAX}
        step={1}
        increaseAriaLabel="Increase width"
        decreaseAriaLabel="Decrease width"
        disabled={isGenerating}
      />
    </View.Item>
    <View.Item grow>
      <NumberField
        name="imageHeight"
        label="Height"
        value={imageHeight}
        onChange={({ value }) => setImageHeight(value ?? DEFAULT_IMAGE_HEIGHT)}
        min={IMAGE_DIMENSION_MIN}
        max={IMAGE_DIMENSION_MAX}
        step={1}
        increaseAriaLabel="Increase height"
        decreaseAriaLabel="Decrease height"
        disabled={isGenerating}
      />
    </View.Item>
  </View>
  <Text variant="caption-1" color="neutral-faded">
    {IMAGE_DIMENSION_MIN}–{IMAGE_DIMENSION_MAX}px · default {DEFAULT_IMAGE_WIDTH}×{DEFAULT_IMAGE_HEIGHT}
  </Text>
</View>
```

**Step 6: Verify type check**

Run: `cd /root/lora-trainer-repo && ./node_modules/.bin/tsc --noEmit`
Expected: No errors

**Step 7: Commit**

```bash
git add src/components/GenerateModal.tsx
git commit -m "feat: add image dimension NumberField inputs to GenerateModal"
```

---

### Task 6: Verify, push, and open PR

**Step 1: Run type check**

```bash
cd /root/lora-trainer-repo && ./node_modules/.bin/tsc --noEmit
```

**Step 2: Push branch**

```bash
git push --no-verify -u origin HEAD
```

**Step 3: Create PR**

```bash
gh pr create \
  --title "feat: custom image dimensions in generate modal" \
  --body "..." \
  --base main
```

**Step 4: Report PR URL**
