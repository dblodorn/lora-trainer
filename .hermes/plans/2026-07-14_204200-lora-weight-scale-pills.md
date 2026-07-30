# LoRA Weight Scale Pills — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add pill-style LoRA weight/scale selector buttons to the Generate Images modal so users can control the strength of the LoRA effect when generating images.

**Architecture:** The GenerateModal component currently sends only `loraTrainingId` and `prompt` to the `generate.images` tRPC mutation. The server hardcodes `scale: 1.5` in the FAL.ai call. We'll add a `loraScale` field to the mutation input, pass it through to the FAL.ai `loras[].scale` parameter, and render 5 pill buttons (using Reshaped's `ToggleButtonGroup`) in the modal for the user to pick from.

**Tech Stack:** Next.js 16, Reshaped 3.9.0 (`ToggleButtonGroup`, `ToggleButton`, `Modal`), tRPC 11, Zod, `@fal-ai/client`

---

## Scale Presets

| Label  | Scale |
|--------|-------|
| chill  | 1.5   |
| spicy  | 2.0   |
| crunchy| 2.5   |
| fried  | 3.3   |
| dead   | 4.0   |

**Default:** `chill` (1.5) — matches the current hardcoded value.

---

### Task 1: Add `loraScale` to the tRPC mutation input schema

**Objective:** Accept an optional `loraScale` number in the `generate.images` mutation, validated to the 5 allowed values.

**Files:**
- Modify: `src/server/api/features/generate.ts` (lines 26-29, input schema; line 100, `loras` array)

**Step 1: Update the Zod input schema**

In `src/server/api/features/generate.ts`, change the `images` procedure input from:

```typescript
z.object({
  loraTrainingId: z.string().min(1),
  prompt: z.string().min(1).max(500),
}),
```

to:

```typescript
z.object({
  loraTrainingId: z.string().min(1),
  prompt: z.string().min(1).max(500),
  loraScale: z.enum(["1.5", "2", "2.5", "3.3", "4"]).default("1.5"),
}),
```

**Step 2: Use the scale value in the FAL.ai call**

On line 100, change:

```typescript
loras: [{ path: lora.lora_weights_url, scale: 1.5 }],
```

to:

```typescript
loras: [{ path: lora.lora_weights_url, scale: parseFloat(input.loraScale) }],
```

**Step 3: Verify build compiles**

Run: `cd /root/lora-trainer-repo && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors related to generate.ts

**Step 4: Commit**

```bash
git add src/server/api/features/generate.ts
git commit -m "feat: add loraScale to generate.images mutation input"
```

---

### Task 2: Add pill buttons UI to GenerateModal

**Objective:** Render 5 pill-style toggle buttons in the GenerateModal using Reshaped's `ToggleButtonGroup` + `ToggleButton`, defaulting to "chill" (1.5). Pass the selected scale value through to the mutation.

**Files:**
- Modify: `src/components/GenerateModal.tsx`

**Step 1: Add imports and scale preset constant**

Add to the imports at the top of the file:

```typescript
import { ToggleButton, ToggleButtonGroup } from "reshaped";
```

Add a constant below the imports (before the component):

```typescript
const LORA_SCALE_PRESETS = [
  { label: "chill", value: "1.5" },
  { label: "spicy", value: "2" },
  { label: "crunchy", value: "2.5" },
  { label: "fried", value: "3.3" },
  { label: "dead", value: "4" },
] as const;
```

**Step 2: Add state for selected scale**

Inside the component, below the existing `useState` calls (after line 25), add:

```typescript
const [loraScale, setLoraScale] = useState<string>("1.5");
```

**Step 3: Add `loraScale` to both mutation calls**

In `handleGenerate` (line 72-76), change:

```typescript
generateMutation.mutate({
  loraTrainingId: loraId,
  prompt: prompt.trim(),
});
```

to:

```typescript
generateMutation.mutate({
  loraTrainingId: loraId,
  prompt: prompt.trim(),
  loraScale,
});
```

In `handleGenerateAgain` (line 82-85), make the same change:

```typescript
generateMutation.mutate({
  loraTrainingId: loraId,
  prompt: prompt.trim(),
  loraScale,
});
```

**Step 4: Reset scale to default when modal opens**

In the `useEffect` that resets state on open (line 56-61), add:

```typescript
setLoraScale("1.5");
```

So the effect becomes:

```typescript
useEffect(() => {
  if (active) {
    setGeneratedImages([]);
    setNsfwWarning(false);
    setLoraScale("1.5");
    generateMutation.reset();
  }
}, [active]);
```

**Step 5: Add the ToggleButtonGroup UI**

Insert a new block between the prompt TextField (after line 110) and the character count row (line 112). Place it as a `View` with a label and the pill group:

```tsx
<View gap={1}>
  <Text variant="caption-1" color="neutral-faded">
    LoRA weight
  </Text>
  <ToggleButtonGroup
    value={[loraScale]}
    selectionMode="single"
    onChange={({ value }) => {
      if (value[0]) setLoraScale(value[0]);
    }}
  >
    {LORA_SCALE_PRESETS.map((preset) => (
      <ToggleButton
        key={preset.value}
        value={preset.value}
        variant="outline"
      >
        {preset.label}
      </ToggleButton>
    ))}
  </ToggleButtonGroup>
</View>
```

**Step 6: Increase modal size**

On line 94, the `Modal` component currently has no `size` prop. Add `size="640px"` to give the modal more width for the pill buttons row:

```tsx
<Modal active={active} onClose={onClose} position="center" padding={6} size="640px">
```

**Step 7: Verify build compiles**

Run: `cd /root/lora-trainer-repo && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

**Step 8: Commit**

```bash
git add src/components/GenerateModal.tsx
git commit -m "feat: add LoRA weight scale pill buttons to GenerateModal"
```

---

### Task 3: Verify end-to-end and push

**Objective:** Make sure the full build works and push the branch.

**Step 1: Run the full Next.js build**

```bash
cd /root/lora-trainer-repo && npx next build 2>&1 | tail -20
```

Expected: Build succeeds (may have warnings, but no errors)

**Step 2: Push to remote**

```bash
git push origin main
```

**Step 3: Report back with a summary of changes**
