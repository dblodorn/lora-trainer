# Training View Header + Sidebar Plan

## Changes

### 1. ArenaChannelResults.tsx — header redesign
- Add the are.na logo (30x30, from `/are-na-logo.png`) next to the channel title in a flex row
- Change the subtitle from "X images" to "X / Y images selected" using the `selectedImages` prop (already passed in)

### 2. Sidebar.tsx — always show training UI
- Remove the `selectedImages.length === 0` check that shows "No images selected yet"
- Remove the "X images selected" text
- Always render `TrainingSettings` inside `AuthGuard`
- Always render `StatusAlerts`

No change to training logic — just remove the conditional empty-state rendering.

## Files
- Modify: `src/components/ArenaChannelResults.tsx` (header logo + selection count)
- Modify: `src/components/Sidebar.tsx` (always render training UI)