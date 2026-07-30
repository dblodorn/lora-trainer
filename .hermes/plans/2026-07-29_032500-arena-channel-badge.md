# Arena Channel Badge Component Plan

**Goal:** Create a reusable `ArenaChannelBadge` component that displays the are.na channel name in a Reshaped Badge with the are.na logo beside it, linking to the channel URL.

**Architecture:** New standalone component using Reshaped `Badge` + `Link` + `NextImage`. Logo is a static asset in `/public`. Component drops into `LoraRow.tsx` replacing the current plain-text link.

**Tech Stack:** React, Reshaped UI (Badge), Next.js Image, TypeScript

---

## Task 1: Save the are.na logo to public/

**Objective:** The are.na apple-touch-icon (180×180 PNG) is already downloaded to `public/are-na-logo.png`.

**Verification:** `file public/are-na-logo.png` shows `PNG image data, 180 x 180`.

No commit needed for this alone — included with the component commit.

---

## Task 2: Create `ArenaChannelBadge` component

**Objective:** Build a self-contained badge component that shows the are.na logo + channel title, linking to the channel URL.

**Files:**
- Create: `src/components/ArenaChannelBadge.tsx`

### Props
```typescript
interface ArenaChannelBadgeProps {
  title: string;
  url: string;
  size?: "small" | "medium";
}
```

### Implementation
```tsx
import { Badge, Link } from "reshaped";
import NextImage from "next/image";

interface ArenaChannelBadgeProps {
  title: string;
  url: string;
  size?: "small" | "medium";
}

export default function ArenaChannelBadge({
  title,
  url,
  size = "small",
}: ArenaChannelBadgeProps) {
  return (
    <Link
      href={url}
      attributes={{ target: "_blank", rel: "noopener noreferrer" }}
    >
      <Badge size={size} color="neutral" variant="faded">
        <View direction="row" gap={1} align="center" attributes={{ style: { display: "inline-flex", alignItems: "center" } }}>
          <NextImage
            src="/are-na-logo.png"
            alt="are.na"
            width={12}
            height={12}
            style={{ borderRadius: 2 }}
          />
          {title}
        </View>
      </Badge>
    </Link>
  );
}
```

Key decisions:
- `Badge` with `color="neutral" variant="faded"` — subtle, doesn't compete with the primary color used elsewhere
- Logo at 12×12px — small enough to sit inline with text in a small badge
- Whole badge is a link (wrapping `Link` around `Badge`)
- `NextImage` for optimized delivery
- No external dependency — logo is a local static asset

### Commit
```bash
git add src/components/ArenaChannelBadge.tsx public/are-na-logo.png
git commit -m "feat: add ArenaChannelBadge component with are.na logo"
```

---

## Task 3: Wire into LoraRow

**Objective:** Replace the current plain-text channel link in `LoraRow.tsx` with the new badge component.

**Files:**
- Modify: `src/components/LoraRow.tsx` (lines 103-112)

### Current code
```tsx
{arenaChannelUrl && (
  <Link href={arenaChannelUrl} attributes={{ target: "_blank", rel: "noopener noreferrer" }}>
    <Text variant="caption-1" color="neutral-faded">
      {arenaChannelTitle || "Are.na channel"}
    </Text>
  </Link>
)}
```

### New code
```tsx
{arenaChannelUrl && arenaChannelTitle && (
  <ArenaChannelBadge
    title={arenaChannelTitle}
    url={arenaChannelUrl}
  />
)}
```

### Changes
- Remove `Link` and `Text` imports if no longer used elsewhere in the file (check first — `Link` is used for the download URL, so keep it)
- Add `import ArenaChannelBadge from "./ArenaChannelBadge"`
- Only show badge when both `arenaChannelUrl` and `arenaChannelTitle` are present (skip "Unknown Channel" cases unless we want to show them — user can decide)

### Commit
```bash
git add src/components/LoraRow.tsx
git commit -m "feat: use ArenaChannelBadge in LoraRow for channel attribution"
```

---

## Task 4: Push and open PR

```bash
git push --no-verify -u origin feat/arena-channel-badge
gh pr create --base main --head feat/arena-channel-badge \
  --title "feat: ArenaChannelBadge component with are.na logo" \
  --body "..."
```

---

## Risks / Notes

1. **Logo appearance** — The are.na apple-touch-icon is 180×180 with their logo. At 12×12 it may lose detail. If it looks bad, we can use an SVG version instead (could create one from the logo shape). The backup PNG from the user's URL is 250×149 (wider, with text) — less suitable for a tiny inline icon.

2. **"Unknown Channel" loras** — One lora (`superhedge`) still has "Unknown Channel" title. The badge will only render when both `url` and `title` are truthy. If we want to show it even for unknown channels, we can change the guard condition.

3. **NextImage config** — `next.config` needs to allow `localhost` or the relative `/are-na-logo.png` path. Since it's a local static asset in `/public`, no `remotePatterns` config is needed.
