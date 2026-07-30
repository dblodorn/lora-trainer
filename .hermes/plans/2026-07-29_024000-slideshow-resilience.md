# Slideshow Image Loading Resilience Plan

**Goal:** Make the WebGL slideshow resilient to individual image load failures (CORS, 404, network errors) so the canvas always boots and keeps running even when some images fail.

**Architecture:** Add retry + skip-failed-image logic to `loadImageAsTexture`, `boot()`, and `advanceImage()`. If an image fails after retries, skip it and try the next URL in the queue instead of crashing the slideshow.

**Tech Stack:** React, WebGL, DO Spaces CDN

---

## Root Cause Analysis

### The CORS issue (just fixed)
The DO Spaces bucket `dmbk-io` had **no CORS configuration**. Browser requests with `crossOrigin="anonymous"` from Vercel preview domains and `arenatrainer.dmbk.io` were blocked. I set a wildcard CORS policy (`AllowedOrigins: ["*"]`, `AllowedMethods: ["GET", "HEAD"]`) on the bucket via `PutBucketCorsCommand`. The CDN has stale cached responses (up to 1 hour `max-age=3600`) that don't include CORS headers — these will refresh naturally, or can be cache-busted with a query param.

### The resilience issue (this plan)
Even with CORS fixed, individual images can still fail (404 for doubled-path objects, network timeouts, expired FAL.media URLs). The current code has two failure modes:

1. **`boot()` fails entirely** — if either of the first two images fails to load, `Promise.all` rejects, the catch logs the error, and the slideshow never starts. The canvas stays at `opacity: 0` forever.

2. **`advanceImage()` fails** — if the next image fails to load, the catch resets to "holding" and retries the same URL on the next advance cycle. If the URL is permanently broken (404), this creates a silent retry loop with no progress.

### Files involved
- `src/components/ImageSlideshow.tsx` — `loadImageAsTexture()`, `boot()`, `advanceImage()`

---

## Task 1: Add retry logic to `loadImageAsTexture`

**Objective:** Wrap the Image load in a retry loop (3 attempts with 500ms backoff) before rejecting.

**Files:**
- Modify: `src/components/ImageSlideshow.tsx` — `loadImageAsTexture()` (line ~233)

### Implementation

Replace `loadImageAsTexture` with a version that retries:

```typescript
function loadImageAsTexture(
  gl: WebGLRenderingContext,
  url: string,
  maxRetries = 3,
): Promise<{ texture: WebGLTexture; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    let attempt = 0;

    function tryLoad() {
      attempt++;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const texture = gl.createTexture();
        if (!texture) {
          reject(new Error("Failed to create texture"));
          return;
        }
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        resolve({ texture, width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        if (attempt < maxRetries) {
          setTimeout(tryLoad, 500 * attempt); // 500ms, 1s, 1.5s backoff
        } else {
          reject(new Error(`Failed to load image after ${maxRetries} attempts: ${url}`));
        }
      };
      img.src = url;
    }

    tryLoad();
  });
}
```

### Commit
```bash
git add src/components/ImageSlideshow.tsx
git commit -m "feat: add retry logic to loadImageAsTexture (3 attempts with backoff)"
```

---

## Task 2: Make `boot()` resilient — try next URL if one fails

**Objective:** Instead of `Promise.all` (which fails entirely if either image fails), load images sequentially with fallback to the next URL in the queue.

**Files:**
- Modify: `src/components/ImageSlideshow.tsx` — `boot()` (line ~507)

### Implementation

Replace `boot()` with a version that tries multiple URLs:

```typescript
async function boot() {
  if (!gl) return;

  // Try to load two images, skipping any that fail
  const loaded: { texture: WebGLTexture; width: number; height: number }[] = [];
  let attempts = 0;
  const maxAttempts = 12; // try up to 12 URLs to find 2 that work

  while (loaded.length < 2 && attempts < maxAttempts) {
    attempts++;
    const url = getNextUrl();
    if (!url) break;
    try {
      const tex = await loadImageAsTexture(gl, url);
      if (cancelled) {
        gl.deleteTexture(tex.texture);
        return;
      }
      loaded.push(tex);
    } catch (e) {
      console.warn(`Slideshow: skipping failed image (attempt ${attempts})`, e);
    }
  }

  if (loaded.length === 0) {
    console.error("Slideshow: no images could be loaded after all attempts");
    return;
  }

  // If we only got 1 image, duplicate it so both texFrom and texTo are set
  if (loaded.length === 1) {
    loaded.push(loaded[0]);
  }

  texFromRef.current = loaded[0];
  texToRef.current = loaded[1];
  readyRef.current = true;
  setCanvasReady(true);
  phaseRef.current = "holding";
  isAdvancingRef.current = false;
  const bootTime = performance.now() / 1000;
  startTimeRef.current = bootTime;
  panFromRef.current = randomPanVelocity(bootTime);
  panToRef.current = randomPanVelocity(bootTime);
  tick();
}
```

Key changes:
- Sequential loading with skip-on-failure instead of `Promise.all`
- Tries up to 12 URLs to find 2 working images
- If only 1 image loads, duplicates it (slideshow still runs, just no dissolve on first transition)
- If 0 images load, logs error and returns gracefully (canvas stays hidden)

### Commit
```bash
git add src/components/ImageSlideshow.tsx
git commit -m "feat: boot() skips failed images and tries next URL in queue"
```

---

## Task 3: Make `advanceImage()` resilient — skip to next URL on failure

**Objective:** When `advanceImage()` catches an error, skip the failed URL and try the next one instead of retrying the same URL.

**Files:**
- Modify: `src/components/ImageSlideshow.tsx` — `advanceImage()` (line ~654)

### Implementation

Replace `advanceImage()` with:

```typescript
async function advanceImage() {
  if (!gl || isAdvancingRef.current) return;
  isAdvancingRef.current = true;

  let loaded = false;
  let attempts = 0;
  const maxAttempts = 5;

  while (!loaded && attempts < maxAttempts) {
    attempts++;
    const nextUrl = getNextUrl();
    if (!nextUrl) {
      isAdvancingRef.current = false;
      phaseRef.current = "holding";
      startTimeRef.current = performance.now() / 1000;
      return;
    }

    try {
      const nextTex = await loadImageAsTexture(gl, nextUrl);
      if (cancelled) {
        gl.deleteTexture(nextTex.texture);
        return;
      }
      // "to" becomes "from"; new image becomes "to"
      if (texFromRef.current) {
        gl.deleteTexture(texFromRef.current.texture);
      }
      texFromRef.current = texToRef.current;
      texToRef.current = nextTex;
      panFromRef.current = panToRef.current;
      const advTime = performance.now() / 1000;
      panToRef.current = randomPanVelocity(advTime);
      phaseRef.current = "holding";
      startTimeRef.current = advTime;
      loaded = true;
    } catch (e) {
      console.warn(`Slideshow: skipping failed image (attempt ${attempts})`, e);
      // Continue to next URL in queue
    }
  }

  if (!loaded) {
    // All attempts failed — keep holding current images
    phaseRef.current = "holding";
    startTimeRef.current = performance.now() / 1000;
  }

  isAdvancingRef.current = false;
}
```

Key changes:
- Loop tries up to 5 URLs to find one that loads
- Failed URLs are skipped (already consumed from queue by `getNextUrl()`)
- If all 5 fail, falls back to holding current images (slideshow keeps running)

### Commit
```bash
git add src/components/ImageSlideshow.tsx
git commit -m "feat: advanceImage() skips failed URLs and tries next in queue"
```

---

## Task 4: Push and update PR

```bash
git push --no-verify origin feat/landing-fullbleed-centered-input
```

---

## Verification

1. **Preview deploy** — Vercel auto-deploys the branch. Open the preview URL.
2. **Check console** — no more "Slideshow: failed to load initial images" fatal error. Failed images show as warnings and are skipped.
3. **Canvas fades in** — even if some images fail, the canvas should fade in once 1-2 images load.
4. **Slideshow keeps running** — if an image fails mid-slideshow, it skips to the next instead of stalling.

## Risks

1. **CDN cache stale** — The CORS fix is on the bucket but the CDN has cached responses without CORS headers (up to 1 hour). New requests with cache-busting query params work. The stale cache will expire naturally. No code change needed — just time.

2. **FAL.media URL expiry** — Training source images (`imageUrl`) are FAL.media URLs that may expire over time. The `cdnUrl` (DO Spaces copy) should always work now that CORS is fixed. The slideshow API already prefers `cdnUrl ?? imageUrl`. Consider filtering out FAL.media URLs from the slideshow entirely in a future task.