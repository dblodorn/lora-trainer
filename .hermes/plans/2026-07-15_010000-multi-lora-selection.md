# Multi-LoRA Selection + Generation — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Allow users to select multiple LoRAs from the gallery, write a custom prompt snippet for each, reorder them, preview the final prompt, and generate images that blend all selected LoRAs. Multi-LoRA images live in a separate view, sortable by LoRA used — they do NOT appear on individual LoRA detail pages.

**Architecture:** 
- **Gallery:** Add checkboxes to `LoraRow`. When 2+ are selected, a "Generate" button appears that opens a new `MultiLoraGenerateModal`.
- **Modal:** One text input per selected LoRA (its prompt snippet). Draggable reordering. Live preview of the final prompt (all snippets joined with "in the style of" + trigger words). Passes an array of `{loraId, scale, promptSnippet}` to a new `generate.multiLora` tRPC mutation.
- **Server:** New mutation accepts the array, looks up each LoRA's weights URL + trigger word, builds the final prompt, passes all LoRAs to FAL.ai's `loras` array. Saves images with a junction table for multi-LoRA tagging.
- **DB:** New `generated_image_loras` junction table (image_id + lora_id). Single-LoRA generations also get a row in the junction table so the multi-LoRA view is unified.
- **View:** New page `/multi-lora` showing all multi-LoRA generated images, sortable by LoRA.

**Tech Stack:** tRPC 11, Zod, Kysely, FAL.ai flux-lora (multi-LoRA array), Reshaped (Checkbox, Modal, TextField, View), framer-motion (drag-to-reorder), Next.js 16

---

### Task 1: Create junction table + DB schema

**Objective:** Create `generated_image_loras` junction table and update the DB interface.

**Files:**
- Modify: `src/server/api/db.ts`

**Step 1: Add junction table interface**

```typescript
export interface GeneratedImageLorasTable {
  id: string;
  generated_image_id: string;
  lora_training_id: string;
  created_at: string;
}
```

Add to the `Database` interface:

```typescript
interface Database {
  lora_trainings: LoraTrainingsTable;
  generated_images: GeneratedImagesTable;
  generated_image_loras: GeneratedImageLorasTable;
}
```

**Step 2: Add table creation + index**

Add a new `ensureGeneratedImageLorasTable` function:

```typescript
let _genImageLorasInitialized = false;

export async function ensureGeneratedImageLorasTable(): Promise<void> {
  if (_genImageLorasInitialized) return;
  const db = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS generated_image_loras (
      id TEXT PRIMARY KEY,
      generated_image_id TEXT NOT NULL,
      lora_training_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (generated_image_id) REFERENCES generated_images(id),
      FOREIGN KEY (lora_training_id) REFERENCES lora_trainings(id)
    )
  `.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_gen_img_loras_image ON generated_image_loras(generated_image_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_gen_img_loras_lora ON generated_image_loras(lora_training_id)`.execute(db);
  _genImageLorasInitialized = true;
}
```

**Step 3: Verify type check**

Run: `./node_modules/.bin/tsc --noEmit`

**Step 4: Commit**

```bash
git add src/server/api/db.ts
git commit -m "feat: add generated_image_loras junction table for multi-LoRA tagging"
```

---

### Task 2: Add `generate.multiLora` tRPC mutation

**Objective:** New mutation that accepts an array of LoRA configs, builds the final prompt, passes all LoRAs to FAL.ai, and saves with junction table entries.

**Files:**
- Modify: `src/server/api/features/generate.ts`

**Step 1: Add the mutation**

```typescript
multiLora: protectedProcedure
  .input(
    z.object({
      loras: z.array(z.object({
        loraId: z.string().min(1),
        promptSnippet: z.string().max(500),
      })).min(2).max(5),
      loraScale: loraScaleSchema.default(DEFAULT_LORA_SCALE),
      imageWidth: imageDimensionsSchema.shape.imageWidth,
      imageHeight: imageDimensionsSchema.shape.imageHeight,
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const walletAddress = ctx.session.user.walletAddress;

    // Look up all LoRA records
    await ensureLoraTable();
    const db = getDb();
    const loraIds = input.loras.map(l => l.loraId);
    const loraRecords = await db
      .selectFrom("lora_trainings")
      .select(["id", "trigger_word", "lora_weights_url", "status"])
      .where("id", "in", loraIds)
      .execute();

    // Validate all found + completed
    if (loraRecords.length !== loraIds.length) {
      throw new TRPCError({ code: "NOT_FOUND", message: "One or more LoRAs not found." });
    }
    for (const lora of loraRecords) {
      if (lora.status !== "completed" || !lora.lora_weights_url) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `LoRA ${lora.trigger_word} is not ready.` });
      }
    }

    // Rate limit check (same logic as single)
    await ensureGeneratedImagesTable();
    const exempt = isPaymentExempt(walletAddress);
    if (!exempt) { /* same rate limit check as images mutation */ }

    // Build prompt: each snippet + "in the style of <trigger_word>", joined
    const promptParts = input.loras.map(l => {
      const lora = loraRecords.find(r => r.id === l.loraId)!;
      return `${l.promptSnippet} in the style of ${lora.trigger_word}`;
    });
    const fullPrompt = promptParts.join(", ");

    // Build loras array for FAL.ai
    const scale = parseFloat(input.loraScale);
    const falLoras = input.loras.map(l => {
      const lora = loraRecords.find(r => r.id === l.loraId)!;
      return { path: lora.lora_weights_url!, scale };
    });

    // Call FAL.ai
    ensureFalConfigured();
    let result: { images: {...}[]; seed?: number; has_nsfw_concepts?: boolean[]; };

    try {
      const response = await fal.subscribe("fal-ai/flux-lora", {
        input: {
          prompt: fullPrompt,
          loras: falLoras,
          image_size: { width: input.imageWidth, height: input.imageHeight },
          num_inference_steps: 28,
          guidance_scale: 3.5,
          num_images: IMAGES_PER_BATCH,
          enable_safety_checker: true,
          output_format: "jpeg",
        },
      });
      result = response.data as typeof result;
    } catch (error) { /* same error handling */ }

    // Save images + junction table entries
    await ensureGeneratedImageLorasTable();
    const now = new Date().toISOString();
    const savedImages = [];

    for (const image of result.images) {
      const id = generateId();
      // Save to generated_images with lora_training_id = first LoRA (for backward compat)
      await db.insertInto("generated_images").values({
        id,
        lora_training_id: input.loras[0].loraId, // primary LoRA
        wallet_address: walletAddress,
        prompt: fullPrompt,
        image_url: image.url,
        image_width: image.width ?? null,
        image_height: image.height ?? null,
        seed: result.seed != null ? String(result.seed) : null,
        lora_scale_value: input.loraScale,
        lora_scale_name: getLoraScaleLabel(input.loraScale),
        gen_width: input.imageWidth,
        gen_height: input.imageHeight,
        created_at: now,
      }).execute();

      // Insert junction rows for ALL LoRAs
      for (const lora of input.loras) {
        const junctionId = generateId();
        await db.insertInto("generated_image_loras").values({
          id: junctionId,
          generated_image_id: id,
          lora_training_id: lora.loraId,
          created_at: now,
        }).execute();
      }

      savedImages.push({
        id,
        imageUrl: image.url,
        width: image.width ?? null,
        height: image.height ?? null,
        seed: result.seed != null ? String(result.seed) : null,
        loraScaleValue: input.loraScale,
        loraScaleName: getLoraScaleLabel(input.loraScale),
        genWidth: input.imageWidth,
        genHeight: input.imageHeight,
        loraIds: loraIds,
        loraTriggerWords: loraRecords.map(r => r.trigger_word),
      });
    }

    return {
      images: savedImages,
      prompt: fullPrompt,
      nsfwFiltered: result.has_nsfw_concepts?.some(Boolean) === true,
      totalGenerated: result.images.length,
    };
  }),
```

**Step 2: Add a query for multi-LoRA images**

```typescript
listMultiLora: publicProcedure
  .input(z.object({
    loraId: z.string().optional(),
  }).optional())
  .query(async ({ input }) => {
    await ensureGeneratedImageLorasTable();
    await ensureGeneratedImagesTable();
    const db = getDb();

    let query = db
      .selectFrom("generated_images")
      .innerJoin(
        "generated_image_loras",
        "generated_images.id",
        "generated_image_loras.generated_image_id"
      )
      .innerJoin(
        "lora_trainings",
        "generated_image_loras.lora_training_id",
        "lora_trainings.id"
      )
      .select([
        "generated_images.id as image_id",
        "generated_images.image_url",
        "generated_images.prompt",
        "generated_images.image_width",
        "generated_images.image_height",
        "generated_images.lora_scale_value",
        "generated_images.lora_scale_name",
        "generated_images.gen_width",
        "generated_images.gen_height",
        "generated_images.created_at",
        "lora_trainings.id as lora_id",
        "lora_trainings.trigger_word",
      ]);

    if (input?.loraId) {
      query = query.where("generated_image_loras.lora_training_id", "=", input.loraId);
    }

    const rows = await query.orderBy("generated_images.created_at", "desc").execute();

    // Group by image_id — each image may have multiple LoRA rows
    const imageMap = new Map();
    for (const row of rows) {
      if (!imageMap.has(row.image_id)) {
        imageMap.set(row.image_id, {
          id: row.image_id,
          imageUrl: row.image_url,
          prompt: row.prompt,
          width: row.image_width,
          height: row.image_height,
          loraScaleValue: row.lora_scale_value,
          loraScaleName: row.lora_scale_name,
          genWidth: row.gen_width,
          genHeight: row.gen_height,
          createdAt: row.created_at,
          loras: [],
        });
      }
      imageMap.get(row.image_id).loras.push({
        id: row.lora_id,
        triggerWord: row.trigger_word,
      });
    }

    return Array.from(imageMap.values());
  }),
```

**Step 3: Verify type check**

**Step 4: Commit**

```bash
git add src/server/api/features/generate.ts
git commit -m "feat: add generate.multiLora mutation and listMultiLora query"
```

---

### Task 3: Add checkboxes to LoraRow + selection state in LoraGallery

**Objective:** Add a checkbox to each LoraRow. When 2+ are selected, a "Generate" button appears at the top of the gallery.

**Files:**
- Modify: `src/components/LoraRow.tsx`
- Modify: `src/components/LoraGallery.tsx`

**Step 1: Add checkbox props to LoraRow**

Add to `LoraRowProps`:

```typescript
interface LoraRowProps {
  // ... existing props
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}
```

Add a `Checkbox` from Reshaped at the left of the row (before the thumbnails):

```tsx
{selectable && (
  <Checkbox
    checked={selected ?? false}
    onChange={({ checked }) => onToggleSelect?.()}
  />
)}
```

Only show the checkbox when `selectable` is true (so the existing gallery view is unaffected unless we pass the prop).

**Step 2: Add selection state to LoraGallery**

```typescript
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

const toggleSelect = (id: string) => {
  setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
};

const selectedCount = selectedIds.size;
const showMultiGenerate = selectedCount >= 2;
```

Pass `selectable`, `selected`, and `onToggleSelect` to each `LoraRow`.

**Step 3: Add "Generate" button when 2+ selected**

At the top of the gallery, when `showMultiGenerate`:

```tsx
{showMultiGenerate && (
  <View direction="row" align="center" justify="space-between" padding={2}>
    <Text variant="body-2" color="neutral-faded">
      {selectedCount} LoRAs selected
    </Text>
    <Button color="primary" onClick={() => setShowMultiModal(true)}>
      Generate with {selectedCount} LoRAs
    </Button>
  </View>
)}
```

**Step 4: Commit**

```bash
git add src/components/LoraRow.tsx src/components/LoraGallery.tsx
git commit -m "feat: add multi-LoRA selection checkboxes to gallery"
```

---

### Task 4: Create MultiLoraGenerateModal component

**Objective:** Modal with one text input per selected LoRA, draggable reordering, live prompt preview, and generate button.

**Files:**
- Create: `src/components/MultiLoraGenerateModal.tsx`

**Key features:**
- Props: `active`, `onClose`, `selectedLoras` (array of `{id, triggerWord}`)
- State: array of `{loraId, triggerWord, promptSnippet}` — one per LoRA
- Reordering: framer-motion `Reorder.Group` + `Reorder.Item` for drag-to-reorder
- Live preview: join all snippets as `"snippet1 in the style of trigger1, snippet2 in the style of trigger2, ..."`
- Also include the LoRA weight scale pills (reuse from lora-scale.ts) and image dimension inputs (reuse from image-dimensions.ts)
- Generate button calls `generate.multiLora` mutation

**Step 1: Create the component**

Use framer-motion's `Reorder` component for drag-to-reorder:

```tsx
import { Reorder } from "framer-motion";

// State: array of {loraId, triggerWord, promptSnippet}
const [items, setItems] = useState(
  selectedLoras.map(l => ({ ...l, promptSnippet: "" }))
);

// Preview prompt
const previewPrompt = items
  .map(item => `${item.promptSnippet || "..."} in the style of ${item.triggerWord}`)
  .join(", ");

// Each item is a Reorder.Item with a TextField inside
<Reorder.Group axis="y" values={items} onReorder={setItems}>
  {items.map((item, index) => (
    <Reorder.Item key={item.loraId} value={item}>
      <View direction="row" gap={2} align="center">
        <Text variant="caption-1" color="neutral-faded">⋮⋮</Text>
        <View.Item grow>
          <TextField
            value={item.promptSnippet}
            onChange={({ value }) => updateSnippet(item.loraId, value)}
            placeholder={`Prompt for ${item.triggerWord}...`}
          />
        </View.Item>
        <Badge size="small">{item.triggerWord}</Badge>
      </View>
    </Reorder.Item>
  ))}
</Reorder.Group>
```

**Step 2: Wire up the mutation**

```typescript
const generateMutation = trpc.generate.multiLora.useMutation({
  onSuccess: (data) => {
    // Show generated images in the modal (reuse GeneratedImageGrid)
    setGeneratedImages(data.images);
    utils.generate.listMultiLora.invalidate();
  },
});

const handleGenerate = () => {
  generateMutation.mutate({
    loras: items.map(item => ({
      loraId: item.loraId,
      promptSnippet: item.promptSnippet.trim(),
    })),
    loraScale,
    imageWidth,
    imageHeight,
  });
};
```

**Step 3: Add prompt preview section**

Below the reorder list, show the final prompt:

```tsx
<View padding={3} backgroundColor="elevation-raised" borderRadius="medium">
  <Text variant="caption-1" color="neutral-faded">Final prompt</Text>
  <Text variant="body-2">{previewPrompt}</Text>
</View>
```

**Step 4: Add LoRA weight pills + image dimensions (reuse from existing features)**

**Step 5: Verify type check**

**Step 6: Commit**

```bash
git add src/components/MultiLoraGenerateModal.tsx
git commit -m "feat: create MultiLoraGenerateModal with drag-to-reorder + prompt preview"
```

---

### Task 5: Wire MultiLoraGenerateModal into LoraGallery

**Objective:** Render the modal in the gallery, pass selected LoRA data.

**Files:**
- Modify: `src/components/LoraGallery.tsx`

**Step 1: Add modal state + render**

```typescript
const [showMultiModal, setShowMultiModal] = useState(false);

// Pass selected LoRA data to modal
const selectedLoraData = data?.filter(lora => selectedIds.has(lora.id)) ?? [];
```

```tsx
{showMultiModal && selectedLoraData.length >= 2 && (
  <MultiLoraGenerateModal
    active={showMultiModal}
    onClose={() => setShowMultiModal(false)}
    selectedLoras={selectedLoraData.map(l => ({ id: l.id, triggerWord: l.triggerWord }))}
  />
)}
```

**Step 2: Commit**

```bash
git add src/components/LoraGallery.tsx
git commit -m "feat: wire MultiLoraGenerateModal into LoraGallery"
```

---

### Task 6: Create multi-LoRA view page

**Objective:** New page at `/multi-lora` showing all multi-LoRA generated images, sortable by LoRA.

**Files:**
- Create: `src/pages/multi-lora.tsx`

**Key features:**
- Query: `trpc.generate.listMultiLora.useQuery()`
- Sortable: dropdown/filter to filter by a specific LoRA (`listMultiLora({ loraId })`)
- Gallery grid: reuse `GeneratedImageGrid` but with a custom variant showing multiple LoRA badges
- Each thumbnail shows the prompt + all LoRA trigger words as badges

**Step 1: Create the page**

```tsx
export default function MultiLoraPage() {
  const [filterLoraId, setFilterLoraId] = useState<string | undefined>();
  const { data, isLoading } = trpc.generate.listMultiLora.useQuery(
    filterLoraId ? { loraId: filterLoraId } : undefined
  );

  // Get all LoRAs for the filter dropdown
  const { data: allLoras } = trpc.lora.list.useQuery();

  // Render filter dropdown + GeneratedImageGrid with multi-LoRA data
}
```

**Step 2: Add nav link from the main gallery page**

In `LoraGallery.tsx` or the `loras.tsx` page, add a link to `/multi-lora`.

**Step 3: Commit**

```bash
git add src/pages/multi-lora.tsx
git commit -m "feat: add multi-LoRA gallery view page with LoRA filter"
```

---

### Task 7: Also write junction rows for single-LoRA generations

**Objective:** When a single-LoRA generation happens (existing `generate.images` mutation), also write a row to the `generated_image_loras` junction table so the multi-LoRA view is unified.

**Files:**
- Modify: `src/server/api/features/generate.ts` (the existing `images` mutation)

**Step 1: Add junction insert after the generated_images INSERT**

In the `for` loop that saves images, after the `insertInto("generated_images")`, add:

```typescript
await ensureGeneratedImageLorasTable();
const junctionId = generateId();
await db.insertInto("generated_image_loras").values({
  id: junctionId,
  generated_image_id: id,
  lora_training_id: input.loraTrainingId,
  created_at: now,
}).execute();
```

**Step 2: Commit**

```bash
git add src/server/api/features/generate.ts
git commit -m "feat: also write junction rows for single-LoRA generations"
```

---

### Task 8: Verify, push, open PR

**Step 1: Type check**

```bash
./node_modules/.bin/tsc --noEmit
```

**Step 2: Push**

```bash
git push --no-verify -u origin HEAD
```

**Step 3: Create PR**

```bash
gh pr create --title "feat: multi-LoRA selection + generation" --body "..." --base main
```

---

## Notes

- **FAL.ai multi-LoRA:** The `loras` array in `fal-ai/flux-lora` accepts multiple `{path, scale}` entries — this is natively supported by the model.
- **Junction table:** Both single and multi-LoRA generations get junction rows. The `lora_training_id` on `generated_images` is kept for backward compat (set to the first/primary LoRA for multi-LoRA images).
- **Multi-LoRA images NOT on single-LoRA detail pages:** The `listByLora` query on `loras/[id].tsx` stays unchanged — it queries `generated_images.lora_training_id` directly, which for multi-LoRA images points to the primary LoRA. Multi-LoRA images are only viewed via the `/multi-lora` page.
- **Drag-to-reorder:** Uses framer-motion's `Reorder.Group` / `Reorder.Item` — already installed.
- **Max 5 LoRAs:** FAL.ai likely has a practical limit; we cap at 5 for safety.
