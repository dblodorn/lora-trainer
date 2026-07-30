# Training View Layout Redesign Plan

**Goal:** Restyle the training view (shown after entering a channel URL) to match the lora detail page patterns — smaller channel name heading, vertical divider between grid and sidebar.

## Current State

```
Results layout (ArenaChannelFetcher.tsx):
  View direction="row" gap={2} padding={2}
    View.Item columns={l:9}
      ArenaChannelResults
        title-1 channel slug heading
        image grid (3 cols)
    View.Item columns={l:3}
      Sidebar (training settings)
```

## Changes

### 1. ArenaChannelResults — smaller heading
- Change channel slug from `title-1` to `body-1` with `weight="bold"`
- Keep the "X images" subtitle as `body-2`

### 2. ArenaChannelFetcher — add vertical rule between grid and sidebar
- Replace the single `direction="row"` View with three items in a row:
  - Left: `View.Item columns={l:9}` — existing image grid (no change)
  - Center: a 1px vertical rule
  - Right: `View.Item columns={l:3}` — existing sidebar (no change)

### Files
- Modify: `src/components/ArenaChannelResults.tsx` (heading size)
- Modify: `src/components/ArenaChannelFetcher.tsx` (vertical divider)
