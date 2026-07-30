# Gallery Hover Effect + Fullscreen Slideshow — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Restore the hover effect on gallery thumbnails (image switches from `object-fit: cover` to `object-fit: contain`) and add a fullscreen slideshow modal with forward/back navigation, framer-motion animations, and a screened-back white background.

**Architecture:** The hover effect is pure CSS — add a hover state on the thumbnail container that swaps `objectFit` from `cover` to `contain`. The slideshow is a new `SlideshowModal` component using Reshaped's `Modal` (position="full-screen") + framer-motion for slide transitions. The `GeneratedImageGrid` calls an `onImageClick(index)` callback instead of opening the image URL in a new tab. The `loras/[id].tsx` page manages the slideshow state (active + starting index).

**Tech Stack:** Reshaped (Modal, Button, View, Text, Icon), framer-motion, Next.js 16

---

### Task 1: Install framer-motion

**Objective:** Add framer-motion as a dependency.

**Step 1: Install**

```bash
cd /root/lora-trainer-repo && npm install framer-motion
```

**Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add framer-motion dependency"
```

---

### Task 2: Restore hover effect on gallery thumbnails

**Objective:** When hovering a gallery thumbnail, the interior image switches from `object-fit: cover` to `object-fit: contain`. This is the behavior that was lost when the grid was refactored.

**Files:**
- Modify: `src/components/GeneratedImageGrid.tsx`

**Step 1: Add hover state + CSS transition**

Replace the `<Image>` element (currently hardcoded with `objectFit: "cover"`) with a CSS-driven approach using a hover state. Add `useState` for tracking hover on each card. Replace the `Actionable` wrapper with a `div` (we'll handle click via callback in Task 3) and add hover handlers:

```tsx
// Add to imports
import { useState } from "react";

// Inside the map, wrap each card:
const [hoveredId, setHoveredId] = useState<string | null>(null);
```

Replace the `Actionable` + `Image` block with:

```tsx
<div
  key={img.id}
  onMouseEnter={() => setHoveredId(img.id)}
  onMouseLeave={() => setHoveredId(null)}
  style={{ cursor: "pointer" }}
>
  <Card padding={0}>
    <img
      src={img.imageUrl}
      alt={img.prompt}
      style={{
        aspectRatio: "1",
        objectFit: hoveredId === img.id ? "contain" : "cover",
        display: "block",
        width: "100%",
        transition: "object-fit 0.2s ease",
        borderRadius: "var(--rs-radius-medium)",
      }}
    />
    {variant === "page" && (
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
    )}
  </Card>
</div>
```

Note: Using a plain `<img>` instead of Reshaped `<Image>` because Reshaped's Image component doesn't support dynamic `objectFit` changes via style. The `borderRadius` uses the Reshaped radius token for consistency.

**Step 2: Verify type check**

Run: `cd /root/lora-trainer-repo && ./node_modules/.bin/tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/GeneratedImageGrid.tsx
git commit -m "feat: restore hover effect on gallery thumbnails (cover→contain)"
```

---

### Task 3: Add onImageClick callback to GeneratedImageGrid

**Objective:** Instead of opening images in a new tab, clicking a gallery thumbnail opens the slideshow at that image's index.

**Files:**
- Modify: `src/components/GeneratedImageGrid.tsx`
- Modify: `src/pages/loras/[id].tsx`

**Step 1: Add onImageClick prop to GeneratedImageGrid**

Add to `GeneratedImageGridProps`:

```typescript
interface GeneratedImageGridProps {
  images: GeneratedImage[];
  variant?: "modal" | "page";
  onImageClick?: (index: number) => void;
}
```

In the component, destructure `onImageClick` and add it to the click handler on each thumbnail div:

```tsx
onClick={() => onImageClick?.(index)}
```

Where `index` comes from the map: `images.map((img, index) => ...`

For the `variant === "modal"` case, keep the existing behavior (open in new tab) since the modal already has its own grid.

**Step 2: Wire up in loras/[id].tsx**

Add slideshow state to the page:

```typescript
const [slideshowIndex, setSlideshowIndex] = useState<number | null>(null);
```

Pass the callback to GeneratedImageGrid:

```tsx
<GeneratedImageGrid
  images={images}
  variant="page"
  onImageClick={(index) => setSlideshowIndex(index)}
/>
```

**Step 3: Verify type check**

Run: `cd /root/lora-trainer-repo && ./node_modules/.bin/tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/GeneratedImageGrid.tsx src/pages/loras/[id].tsx
git commit -m "feat: add onImageClick callback to gallery grid for slideshow"
```

---

### Task 4: Create SlideshowModal component

**Objective:** A fullscreen modal slideshow with forward/back navigation, framer-motion slide animations, and a screened-back white background.

**Files:**
- Create: `src/components/SlideshowModal.tsx`

**Step 1: Create the component**

```tsx
import { useState, useEffect, useCallback } from "react";
import { View, Text, Button, Modal, Icon } from "reshaped";
import { AnimatePresence, motion } from "framer-motion";

interface SlideshowImage {
  id: string;
  imageUrl: string;
  prompt: string;
  loraScaleName?: string | null;
}

interface SlideshowModalProps {
  active: boolean;
  onClose: () => void;
  images: SlideshowImage[];
  startIndex: number;
}

export default function SlideshowModal({
  active,
  onClose,
  images,
  startIndex,
}: SlideshowModalProps) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);

  // Sync index when modal opens
  useEffect(() => {
    if (active) setCurrentIndex(startIndex);
  }, [active, startIndex]);

  const goBack = useCallback(() => {
    setCurrentIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  const goForward = useCallback(() => {
    setCurrentIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goBack();
      if (e.key === "ArrowRight") goForward();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, goBack, goForward, onClose]);

  if (!active || images.length === 0) return null;

  const current = images[currentIndex];

  return (
    <Modal
      active={active}
      onClose={onClose}
      position="full-screen"
      padding={0}
      blurredOverlay
    >
      <View
        direction="column"
        align="center"
        justify="center"
        gap={4}
        attributes={{
          style: {
            height: "100vh",
            backgroundColor: "rgba(255, 255, 255, 0.9)",
            backdropFilter: "blur(8px)",
          },
        }}
      >
        {/* Image with framer-motion slide transition */}
        <View.Item grow>
          <View height="100%" align="center" justify="center" padding={4}>
            <AnimatePresence mode="wait">
              <motion.img
                key={current.id}
                src={current.imageUrl}
                alt={current.prompt}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                  borderRadius: "8px",
                }}
              />
            </AnimatePresence>
          </View>
        </View.Item>

        {/* Caption + counter */}
        <View
          direction="row"
          align="center"
          justify="center"
          gap={3}
          padding={4}
          attributes={{ style: { position: "absolute", bottom: 0, width: "100%" } }}
        >
          <View gap={1} align="center">
            <Text variant="body-2" color="neutral">
              {current.prompt}
            </Text>
            <View direction="row" align="center" gap={2}>
              <Text variant="caption-1" color="neutral-faded">
                {currentIndex + 1} / {images.length}
              </Text>
              {current.loraScaleName && (
                <Text variant="caption-1" color="neutral-faded">
                  · {current.loraScaleName}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Back button — left side */}
        <View
          attributes={{
            style: { position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)" },
          }}
        >
          <Button
            variant="ghost"
            color="neutral"
            onClick={goBack}
            attributes={{ "aria-label": "Previous image" }}
          >
            <Icon svg={ChevronLeftIcon} />
          </Button>
        </View>

        {/* Forward button — right side */}
        <View
          attributes={{
            style: { position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)" },
          }}
        >
          <Button
            variant="ghost"
            color="neutral"
            onClick={goForward}
            attributes={{ "aria-label": "Next image" }}
          >
            <Icon svg={ChevronRightIcon} />
          </Button>
        </View>

        {/* Close button — top right */}
        <View
          attributes={{
            style: { position: "absolute", right: "16px", top: "16px" },
          }}
        >
          <Button
            variant="ghost"
            color="neutral"
            onClick={onClose}
            attributes={{ "aria-label": "Close slideshow" }}
          >
            <Icon svg={CloseIcon} />
          </Button>
        </View>
      </View>
    </Modal>
  );
}
```

Note on icons: Reshaped has an `Icon` component that accepts `svg` prop. We need to import actual SVG icon components. Check what's available — likely need to use inline SVGs or Reshaped's icon set. Use simple inline SVG paths for chevron-left, chevron-right, and close (X) to keep it simple.

**Revised approach for icons** — use inline SVG to avoid dependency on Reshaped icon imports:

```tsx
// Simple inline SVG icons
const ChevronLeftIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

const ChevronRightIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const CloseIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);
```

Then use them as: `<Icon svg={ChevronLeftIcon} />` or just render the SVG directly inside Button. Actually, simpler: just render the SVG directly in a Button without the Reshaped Icon component:

```tsx
<Button variant="ghost" color="neutral" onClick={goBack}>
  <ChevronLeftIcon />
</Button>
```

**Step 2: Verify type check**

Run: `cd /root/lora-trainer-repo && ./node_modules/.bin/tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/SlideshowModal.tsx
git commit -m "feat: create fullscreen SlideshowModal with framer-motion"
```

---

### Task 5: Wire SlideshowModal into loras/[id].tsx

**Objective:** Render the SlideshowModal in the LoRA detail page, driven by the `slideshowIndex` state.

**Files:**
- Modify: `src/pages/loras/[id].tsx`

**Step 1: Import and render the SlideshowModal**

Add import at the top:

```tsx
import SlideshowModal from "@/components/SlideshowModal";
```

Add the SlideshowModal before the closing `</View>` of the page, after the GenerateModal:

```tsx
{images.length > 0 && (
  <SlideshowModal
    active={slideshowIndex !== null}
    onClose={() => setSlideshowIndex(null)}
    images={images}
    startIndex={slideshowIndex ?? 0}
  />
)}
```

**Step 2: Verify type check**

Run: `cd /root/lora-trainer-repo && ./node_modules/.bin/tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/pages/loras/[id].tsx
git commit -m "feat: wire SlideshowModal into LoRA detail page"
```

---

### Task 6: Verify full build, push, and open PR

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
  --title "feat: gallery hover effect + fullscreen slideshow" \
  --body "..." \
  --base main
```

**Step 4: Report PR URL**
