# Hide/Unhide LoRA — Restructure Plan

**Goal:** Move the hide toggle from the gallery list to the individual lora detail page, add a `/hidden` route to view all hidden loras.

## Changes

### 1. Revert LoraRow — remove hide button
- Remove `walletAddress`, `hidden`, `isOwner` props
- Remove `Eye`/`EyeOff` icon button
- Remove `trpc` import (hide/unhide mutations)
- Restore to clean state

### 2. Revert LoraGallery — remove owner logic
- Remove `useAccount`, `isAddress`, `isAddressEqual` imports
- Remove `walletAddress`, `hidden`, `isOwner` props from LoraRow usage
- Restore to clean state

### 3. Create `LoraHideToggle.tsx` component
- Accepts `id: string`, `hidden: boolean` props
- Uses `trpc.lora.hide` / `trpc.lora.unhide` mutations
- Renders a ghost Button with Eye/EyeOff icon
- Single-purpose, standalone component

### 4. Update `loras/[id].tsx` — add hide toggle to header
- Import `LoraHideToggle`
- Add `authClient.useSession()` to check if viewer is owner
- Add `useAccount()` from wagmi for wallet comparison
- Use `isAddressEqual` to compare connected wallet with lora's wallet
- If owner, render `LoraHideToggle` in the header right side (next to the Generate button area)

### 5. API — add `listHidden` query to `lora.ts`
- `listHidden: publicProcedure.query` — returns only `{ hidden: true, status: "completed" }` loras
- Same response shape as `list`

### 6. Create `pages/hidden.tsx`
- Same layout as `pages/loras.tsx` (full height, calc width, scroll)
- Uses a new `HiddenLoraGallery` component
- Same styling as the loras gallery page

### 7. Create `components/HiddenLoraGallery.tsx`
- Same as `LoraGallery` but uses `trpc.lora.listHidden.useQuery()`
- No owner checks needed (no hide buttons)

## Files
- Modify: `src/components/LoraRow.tsx` (remove hide button)
- Modify: `src/components/LoraGallery.tsx` (remove owner logic)
- Create: `src/components/LoraHideToggle.tsx` (new component)
- Modify: `src/pages/loras/[id].tsx` (add hide toggle in header)
- Modify: `src/server/api/features/lora.ts` (add listHidden query)
- Create: `src/pages/hidden.tsx` (new route)
- Create: `src/components/HiddenLoraGallery.tsx` (hidden list component)