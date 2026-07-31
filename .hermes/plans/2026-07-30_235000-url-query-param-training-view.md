# URL Query Param for Training View Plan

**Goal:** Allow deep-linking into the training view via `?channel=<arena-url>` query param, and clicking "Train" in the nav clears it back to the landing state.

## How it works

### 1. Read channel param on mount & on change
In `ArenaChannelFetcher.tsx`:
- Add `useRouter()` to read `router.query.channel`
- Add a `useEffect` that watches `router.query.channel`:
  - If present and non-empty: set the URL form value via `setValue("url", channelUrl)` and call `setSubmittedUrl(channelUrl)` to trigger the fetch
  - If cleared (undefined): call `handleResetTraining()` to reset everything back to the initial landing state

### 2. Update URL on manual submit
- In `onSubmit()`, after setting `submittedUrl`, also update the URL query param via `router.replace({ query: { channel: url } }, undefined, { shallow: true })`
- This keeps the URL in sync so users can share the link

### 3. "Train" nav item clears the param
- The "Train" nav item already links to `/` — this navigates to the root without the `?channel=` param
- The `useEffect` watching `router.query.channel` fires, sees it's undefined, and calls `handleResetTraining()` to return to the landing state

## No changes needed outside `ArenaChannelFetcher.tsx`

The `handleResetTraining` function already:
- Clears `submittedUrl` → which hides the results view
- Resets the form fields (url, selectedImages, triggerWord, trainingSteps)
- Resets training state (requestId, loraId, phase, error)

## Files
- Modify: `src/components/ArenaChannelFetcher.tsx` (add useRouter + useEffect for channel param)