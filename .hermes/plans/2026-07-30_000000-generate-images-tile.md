# Generate Images Tile in Grid Plan

**Goal:** Remove the "Generate Images" button from the lora header and the "No images generated yet" empty state. Replace both with a dashed-outline empty tile at the front of the generated images grid that says "Generate Images" vertically centered, matching the grid tile dimensions.

## Current State

### Header button (lines 118-125)
```tsx
{isCompleted && (
  <Button color="primary" onClick={() => setShowGenerateModal(true)}>
    Generate Images
  </Button>
)}
```

### Empty state (lines 168-190)
```tsx
{images.length === 0 && !imagesQuery.isLoading && (
  <View align="center" padding={8} borderRadius="medium" backgroundColor="elevation-raised">
    <Text>No images generated yet.</Text>
    {isCompleted && <Button onClick={() => setShowGenerateModal(true)}>Generate your first images</Button>}
  </View>
)}
```

### Generated image tile dimensions (GeneratedImageGrid.tsx)
- Grid: `View direction="row" wrap gap={2}`
- Each tile: `View.Item columns={{ s: 6, m: 6, l: 3 }}` (responsive: 2 cols mobile, 4 cols desktop)
- Image area: `aspectRatio: "1"` (square), `borderRadius: var(--rs-radius-medium)`
- Has a caption area below with `padding={2}`

## Plan

### Task 1: Create `GenerateImagesTile` component

**Create:** `src/components/GenerateImagesTile.tsx`

A single tile matching the grid cell dimensions with:
- Same `View.Item columns={{ s: 6, m: 6, l: 3 }}` as image tiles
- Dashed border outline on the square image area
- Plus sign icon + "Generate Images" text vertically centered
- Uses `Actionable` for the click handler (same pattern as TrainingImagesBadge)
- Only renders when `isCompleted` is true

```tsx
import { Actionable, View, Text } from "reshaped";

interface GenerateImagesTileProps {
  onClick: () => void;
}

export default function GenerateImagesTile({ onClick }: GenerateImagesTileProps) {
  return (
    <View.Item columns={{ s: 6, m: 6, l: 3 }}>
      <Actionable onClick={onClick} attributes={{ style: { cursor: "pointer", height: "100%" } }}>
        <View
          align="center"
          justify="center"
          attributes={{
            style: {
              aspectRatio: "1",
              borderRadius: "var(--rs-radius-medium)",
              border: "2px dashed var(--rs-color-border-neutral-faded, rgba(0,0,0,0.12))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            },
          }}
        >
          <View gap={2} align="center">
            <Text variant="title-2" color="neutral-faded">+</Text>
            <Text variant="body-2" color="neutral-faded">Generate Images</Text>
          </View>
        </View>
      </Actionable>
    </View.Item>
  );
}
```

### Task 2: Wire into lora detail page

**Modify:** `src/pages/loras/[id].tsx`

1. **Remove** the Generate Images button from the header (lines 118-125)
2. **Remove** the entire empty state block (lines 168-190)
3. **Replace** the `{images.length > 0 && (<GeneratedImageGrid .../>)}` with a grid that always shows when `!imagesQuery.isLoading`:
   - If `isCompleted`, render `GenerateImagesTile` as the first item
   - Then render `GeneratedImageGrid` with the existing images (if any)

New gallery section:
```tsx
{/* Generated Images Gallery */}
<View gap={3} padding={4}>
  {imagesQuery.isLoading && (
    <View align="center" padding={6}>
      <Loader />
    </View>
  )}
  {!imagesQuery.isLoading && (
    <View direction="row" wrap gap={2}>
      {isCompleted && (
        <GenerateImagesTile onClick={() => setShowGenerateModal(true)} />
      )}
      {images.length > 0 && (
        <>
          {images.map((img, index) => (
            <View.Item key={img.id} columns={{ s: 6, m: 6, l: 3 }}>
              {/* existing image tile markup from GeneratedImageGrid */}
            </View.Item>
          ))}
        </>
      )}
    </View>
  )}
</View>
```

Wait — actually, the cleaner approach: keep using `GeneratedImageGrid` for the images, but prepend the `GenerateImagesTile` by wrapping both in the same `View direction="row" wrap gap={2}` container. The `GenerateImagesTile` already returns a `View.Item` with the right column count.

Revised approach — render a grid wrapper that contains the tile + the image grid:

```tsx
{!imagesQuery.isLoading && (
  <View direction="row" wrap gap={2}>
    {isCompleted && (
      <GenerateImagesTile onClick={() => setShowGenerateModal(true)} />
    )}
    {images.map((img, index) => (
      // delegate to GeneratedImageGrid but it renders its own View wrapper...
    ))}
  </View>
)}
```

Hmm, `GeneratedImageGrid` renders its own `<View direction="row" wrap gap={2}>` wrapper. So we can't easily mix the tile into it.

**Best approach:** Add an optional `prependTile` prop to `GeneratedImageGrid` that renders before the images. This keeps the grid logic in one place.

### Revised Task 2: Add `prependTile` prop to GeneratedImageGrid

**Modify:** `src/components/GeneratedImageGrid.tsx`
- Add optional prop: `prependTile?: React.ReactNode`
- Render it as the first child inside the `<View direction="row" wrap gap={2}>` before the images map

**Modify:** `src/pages/loras/[id].tsx`
- Remove header button
- Remove empty state
- Always render `GeneratedImageGrid` when not loading
- Pass `prependTile={isCompleted ? <GenerateImagesTile onClick={...} /> : null}`

### Task 3: Branch, commit, push, PR

```bash
git checkout -b feat/generate-images-tile
# ... commits ...
git push --no-verify -u origin feat/generate-images-tile
gh pr create ...
```

## Files
- Create: `src/components/GenerateImagesTile.tsx`
- Modify: `src/components/GeneratedImageGrid.tsx` (add `prependTile` prop)
- Modify: `src/pages/loras/[id].tsx` (remove button + empty state, always render grid)

## Risks
- The `GenerateImagesTile` needs to match the visual height of image tiles. Image tiles have `aspectRatio: "1"` on the image area plus a caption area below. The generate tile only has the square area (no caption needed), so it'll be slightly shorter. Acceptable — it's visually distinct as a CTA.
- If `!isCompleted`, no tile shows and no images show → the gallery section is empty. Could add a message, but the old empty state was only for `isCompleted` anyway. Non-completed loras just show nothing in the gallery area.
