# Landing View: Full-Bleed Canvas + Centered Input

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Make the landing view's WebGL canvas full-bleed (edge-to-edge) with the are.na channel URL input centered vertically, constrained to a max-width of 680px.

**Architecture:** The canvas slideshow becomes an absolute-positioned full-bleed background. The `ChannelUrlForm` is overlaid on top, vertically centered with a max-width container. When channel data loads, the view switches to the existing results layout (grid + sidebar) unchanged.

**Tech Stack:** React, Reshaped UI (View/TextField/Button), Next.js Pages Router, inline styles + Reshaped props.

---

## Current State Analysis

### Layout tree (idle / landing state)

```
index.tsx
  View height=100vh overflow=hidden direction=column
    View flex=1 overflow=hidden
      ArenaChannelFetcher
        View width=100% height=100% padding=2 direction=column
          View position=sticky insetTop=0 zIndex=10 backgroundColor=page  ← ChannelUrlForm
            ChannelUrlForm (TextField + Fetch button in a row)
          View flex=1  ← ImageSlideshow (WebGL canvas)
```

### Problems with current layout
1. `padding=2` on the outer container creates a gap around the canvas — not full-bleed
2. `ChannelUrlForm` is in a sticky bar at the top — not vertically centered
3. No max-width constraint on the form

### Files involved
- `src/pages/index.tsx` — landing page entry, renders `ArenaChannelFetcher`
- `src/components/ArenaChannelFetcher.tsx` — main orchestrator, controls layout
- `src/components/ChannelUrlForm.tsx` — the URL input form
- `src/components/ImageSlideshow.tsx` — WebGL canvas slideshow (no changes needed to the canvas itself)

---

## Task 1: Create feature branch

**Objective:** Branch off `main` for the landing view redesign.

```bash
cd /root/lora-trainer-repo
git checkout main
git pull origin main
git checkout -b feat/landing-fullbleed-centered-input
```

**Verification:** `git branch --show-current` shows `feat/landing-fullbleed-centered-input`.

---

## Task 2: Restructure ArenaChannelFetcher idle layout

**Objective:** In `ArenaChannelFetcher.tsx`, restructure the idle/landing state so the `ImageSlideshow` canvas is full-bleed (absolute, no padding) and the `ChannelUrlForm` is overlaid on top, vertically centered with a max-width of 680px.

**Files:**
- Modify: `src/components/ArenaChannelFetcher.tsx` (lines ~296-331, the return block)

### Step 1: Restructure the return JSX

The current idle-state layout is:
```tsx
<View width="100%" height="100%" padding={2} direction="column"
  attributes={{ style: { display: "flex", flexDirection: "column" } }}>
  <View position="sticky" insetTop={0} ... backgroundColor="page" paddingBottom={2}>
    <ChannelUrlForm ... />
  </View>
  {!data && !isLoading && !error && (
    <View attributes={{ style: { flex: "1 1 0%", ... } }}>
      <ImageSlideshow />
    </View>
  )}
  {data && ( ...results layout... )}
</View>
```

Replace it with:

```tsx
<View
  width="100%"
  height="100%"
  direction="column"
  attributes={{ style: { display: "flex", flexDirection: "column", position: "relative" } }}
>
  {/* Full-bleed canvas background — only shown in idle state */}
  {!data && !isLoading && !error && (
    <View
      attributes={{
        style: {
          position: "absolute",
          inset: 0,
          overflow: "hidden",
        },
      }}
    >
      <ImageSlideshow />
    </View>
  )}

  {/* Centered input overlay — only shown in idle state */}
  {!data && !isLoading && !error && (
    <View
      attributes={{
        style: {
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
          pointerEvents: "none", // let canvas receive events where the form doesn't cover
        },
      }}
    >
      <View
        width="100%"
        attributes={{
          style: {
            maxWidth: "680px",
            padding: "0 16px",
            pointerEvents: "auto", // re-enable form interaction
          },
        }}
      >
        <ChannelUrlForm
          control={control}
          onSubmit={handleSubmit(onSubmit)}
          isLoading={isLoading}
        />
      </View>
    </View>
  )}

  {/* Error state */}
  {error && (
    <View padding={4} attributes={{ style: { flex: "1 1 0%" } }}>
      <Alert color="critical">Error: {error.message}</Alert>
    </View>
  )}

  {/* Results state — unchanged layout */}
  {data && (
    <View
      direction={{ s: "column", l: "row" }}
      gap={2}
      padding={2}
      attributes={{
        style: { flex: "1 1 0%", minHeight: 0, overflow: "hidden" },
      }}
    >
      <View.Item
        columns={{ s: 12, l: 9 }}
        attributes={{ style: { height: "100%", overflow: "hidden" } }}
      >
        <View
          className="scrollbar-hidden"
          padding={1}
          attributes={{
            style: { height: "100%", overflowY: "auto" },
          }}
        >
          <ArenaChannelResults ... />
        </View>
      </View.Item>
      <View.Item
        columns={{ s: 12, l: 3 }}
        attributes={{ style: { height: "100%", overflowY: "auto" } }}
      >
        <Sidebar ... />
      </View.Item>
    </View>
  )}
</View>
```

Key changes:
- Removed `padding={2}` from the outer container → canvas goes edge-to-edge
- `ImageSlideshow` is now `position: absolute; inset: 0` → full-bleed background
- `ChannelUrlForm` wrapper is `position: absolute; inset: 0; display: flex; alignItems: center; justifyContent: center` → vertically + horizontally centered overlay
- Inner form container has `maxWidth: 680px` and `padding: 0 16px` for mobile gutters
- `pointerEvents: none` on the overlay container, `pointerEvents: auto` on the form itself → clicks pass through to the canvas where the form doesn't cover
- Results state gets `padding={2}` moved inside the data branch so only the idle state is full-bleed
- The old sticky bar is removed

### Step 2: Verify build

```bash
cd /root/lora-trainer-repo && npm run build 2>&1 | tail -20
```

Expected: Build succeeds with no errors.

### Step 3: Visual check

Deploy a preview and verify:
- Canvas fills the entire viewport (no gaps)
- Text input is vertically centered
- Text input container doesn't exceed 680px on wide screens
- Fetch button works
- After fetching, results grid + sidebar layout is unchanged

### Step 4: Commit

```bash
git add src/components/ArenaChannelFetcher.tsx
git commit -m "feat: full-bleed canvas background with centered 680px input on landing"
```

---

## Task 3: Clean up ChannelUrlForm styling

**Objective:** Ensure the `ChannelUrlForm` looks good as a centered overlay element. The form already uses `View direction="row" gap={2}` with a growing text field and submit button — this works inside a 680px container.

**Files:**
- Modify: `src/components/ChannelUrlForm.tsx` (only if visual tweaks are needed)

### Step 1: Review the form as-is

The current form is:
```tsx
<View as="form" width="100%" ...>
  <View direction="row" gap={2}>
    <View.Item grow>
      <Controller ... TextField ... />
    </View.Item>
    <Button type="submit" color="primary" loading={isLoading}>Fetch Images</Button>
  </View>
</View>
```

This should work well inside a 680px container. No changes needed unless visual review reveals issues. If the form needs a backdrop for readability over the canvas, add a semi-transparent background:

```tsx
<View as="form" width="100%" borderRadius="large" ...>
  // Optionally add a backdrop:
  // attributes={{ style: { backdropFilter: "blur(8px)", backgroundColor: "rgba(0,0,0,0.3)" } }}
```

Only add a backdrop if the text is hard to read over the canvas. Decide during visual review.

### Step 2: Commit (if changed)

```bash
git add src/components/ChannelUrlForm.tsx
git commit -m "style: adjust channel url form for centered overlay display"
```

---

## Task 4: Push and open PR

**Objective:** Push the branch and open a pull request against `main`.

### Step 1: Push

```bash
git push -u origin feat/landing-fullbleed-centered-input
```

### Step 2: Open PR

```bash
gh pr create \
  --base main \
  --head feat/landing-fullbleed-centered-input \
  --title "feat: full-bleed canvas + centered 680px input on landing view" \
  --body "## Changes
- WebGL canvas slideshow is now full-bleed (absolute, edge-to-edge, no padding)
- are.na channel URL input is vertically + horizontally centered as an overlay
- Input container constrained to max-width 680px
- Results layout (grid + sidebar) unchanged — padding moves to data branch only
- pointerEvents: none on overlay, auto on form → canvas remains interactive outside the form

## Visual
Before: sticky form bar at top, canvas below with padding gap
After: full-bleed canvas background, centered form overlay"
```

**Verification:** PR URL is returned and opens successfully.

---

## Risks / Tradeoffs

1. **Form readability over canvas** — The duotone WebGL canvas changes brightness as images transition. If the text input is hard to read, add a semi-transparent backdrop or blur. Decided during visual review in Task 3.

2. **pointerEvents layering** — The overlay container has `pointerEvents: none` so clicks pass through to the canvas except where the form is. If this causes issues with form interaction, remove `pointerEvents: none` from the overlay (the form still works either way since it has `pointerEvents: auto`).

3. **Results state padding** — Moved `padding={2}` from the outer container into the `data` branch. If the results state looks cramped, add more padding there. Low risk since the value didn't change.

4. **`isLoading` state** — While loading (fetching channel images), neither the canvas nor the form shows. Consider showing a loading state or keeping the canvas visible during load. Current behavior: the `{!data && !isLoading && !error}` guard hides both during load. If this feels abrupt, remove `!isLoading` from the canvas condition.
