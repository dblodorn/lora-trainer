import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/utils/trpc";

// ---------------------------------------------------------------------------
// GLSL Shaders (inlined as template literals)
// ---------------------------------------------------------------------------

const VERTEX_SHADER = `
attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  // Map from clip-space [-1,1] to UV [0,1]
  // Y is already correct because we set UNPACK_FLIP_Y_WEBGL
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

varying vec2 vUv;

uniform sampler2D uTexFrom;
uniform sampler2D uTexTo;
uniform float uProgress;      // 0 = show "from", 1 = show "to"
uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uTexFromSize;
uniform vec2 uTexToSize;
uniform vec2 uPanFrom;        // slow pan offset for "from" image
uniform vec2 uPanTo;          // slow pan offset for "to" image
uniform vec4 uTransitionSeed; // per-transition random: x=noiseScale, y=drift, z=softness, w=spatial offset

// ---- Simplex-style 2D noise (hash-based, no texture lookup) ----

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187,   // (3.0-sqrt(3.0))/6.0
    0.366025403784439,   //  0.5*(sqrt(3.0)-1.0)
   -0.577350269189626,   // -1.0 + 2.0 * C.x
    0.024390243902439    //  1.0 / 41.0
  );

  // First corner
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);

  // Other corners
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;

  // Permutations
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                            + i.x + vec3(0.0, i1.x, 1.0));

  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
                           dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;

  // Gradients
  vec3 x  = 2.0 * fract(p * C.www) - 1.0;
  vec3 h  = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;

  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;

  return 130.0 * dot(m, g);
}

// Fractal Brownian Motion for richer noise
float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * snoise(p);
    p *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// ---- Cover-fit UV (like CSS object-fit: cover) ----

vec2 coverUv(vec2 uv, vec2 texSize, vec2 canvasSize) {
  float texAspect = texSize.x / texSize.y;
  float canvasAspect = canvasSize.x / canvasSize.y;

  vec2 scale;
  if (canvasAspect > texAspect) {
    // Canvas is wider: scale to match width, crop top/bottom
    scale = vec2(1.0, texAspect / canvasAspect);
  } else {
    // Canvas is taller: scale to match height, crop left/right
    scale = vec2(canvasAspect / texAspect, 1.0);
  }

  return (uv - 0.5) * scale + 0.5;
}

void main() {
  vec2 uvFrom = coverUv(vUv, uTexFromSize, uResolution) + uPanFrom;
  vec2 uvTo   = coverUv(vUv, uTexToSize,   uResolution) + uPanTo;

  vec4 fromColor = texture2D(uTexFrom, uvFrom);
  vec4 toColor   = texture2D(uTexTo,   uvTo);

  // Check if UVs are in bounds (for cover-fit edge clamping)
  float fromInBounds = step(0.0, uvFrom.x) * step(uvFrom.x, 1.0)
                     * step(0.0, uvFrom.y) * step(uvFrom.y, 1.0);
  float toInBounds   = step(0.0, uvTo.x) * step(uvTo.x, 1.0)
                     * step(0.0, uvTo.y) * step(uvTo.y, 1.0);

  fromColor *= fromInBounds;
  toColor   *= toInBounds;

  // Pixelation: quantize UVs to create chunky pixels
  float pixelSize = 10.0
    + 5.0 * sin(uTime * 0.17)
    + 3.0 * sin(uTime * 0.31 + 2.0)
    + 2.0 * sin(uTime * 0.53 + 4.7);
  vec2 pixelUv = floor(vUv * uResolution / pixelSize) * pixelSize / uResolution;

  // Re-compute cover UVs from pixelated coordinates
  vec2 pxUvFrom = coverUv(pixelUv, uTexFromSize, uResolution) + uPanFrom;
  vec2 pxUvTo   = coverUv(pixelUv, uTexToSize,   uResolution) + uPanTo;

  vec4 pxFrom = texture2D(uTexFrom, pxUvFrom);
  vec4 pxTo   = texture2D(uTexTo,   pxUvTo);

  float pxFromBounds = step(0.0, pxUvFrom.x) * step(pxUvFrom.x, 1.0)
                     * step(0.0, pxUvFrom.y) * step(pxUvFrom.y, 1.0);
  float pxToBounds   = step(0.0, pxUvTo.x) * step(pxUvTo.x, 1.0)
                     * step(0.0, pxUvTo.y) * step(pxUvTo.y, 1.0);
  pxFrom *= pxFromBounds;
  pxTo   *= pxToBounds;

  // Blend pixelated with smooth for a fuzzy / soft-pixel look
  vec4 blendFrom = mix(fromColor, pxFrom, 0.65);
  vec4 blendTo   = mix(toColor,   pxTo,   0.65);

  // Perlin noise dissolve — parameters vary per transition via uTransitionSeed
  float noiseScale = 2.0 + uTransitionSeed.x * 4.0;       // range [2, 6]
  float drift = 0.008 + uTransitionSeed.y * 0.02;          // range [0.008, 0.028]
  float softness = 0.08 + uTransitionSeed.z * 0.22;        // range [0.08, 0.30]
  vec2 spatialOffset = vec2(uTransitionSeed.w * 100.0,
                            fract(uTransitionSeed.w * 73.17) * 100.0);
  float n = fbm(pixelUv * noiseScale + spatialOffset + uTime * drift);
  // Remap noise from [-1,1] to [0,1]
  n = n * 0.5 + 0.5;

  float dissolve = smoothstep(uProgress - softness, uProgress + softness, n);
  vec4 color = mix(blendFrom, blendTo, dissolve);

  // Convert to monochrome
  float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));

  // Contrast S-curve: push darks darker, lights lighter
  gray = gray * gray * (3.0 - 2.0 * gray); // smoothstep-style S-curve
  gray = gray * gray * (3.0 - 2.0 * gray); // apply twice for stronger contrast

  // Lift into bright range
  gray = pow(gray, 0.5);
  gray = mix(gray, 1.0, 0.2);

  // Duotone: map luminance between shadow and highlight colors
  //   Shadow:    primary green      #1A9E3F -> (0.102, 0.620, 0.247)
  //   Highlight: golden yellow      #D9A528 -> (0.851, 0.647, 0.157)
  vec3 shadowTone    = vec3(0.102, 0.620, 0.247);
  vec3 highlightTone = vec3(0.851, 0.647, 0.157);
  vec3 duotone = mix(shadowTone, highlightTone, gray);

  // Subtle noise grain overlay for analog texture
  float grain = snoise(vUv * 300.0 + uTime * 0.3) * 0.025;
  duotone += grain;

  gl_FragColor = vec4(duotone, 1.0);
}
`;

// ---------------------------------------------------------------------------
// WebGL helpers
// ---------------------------------------------------------------------------

function createShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  vs: WebGLShader,
  fs: WebGLShader,
): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function loadImageAsTexture(
  gl: WebGLRenderingContext,
  url: string,
): Promise<{ texture: WebGLTexture; width: number; height: number }> {
  return new Promise((resolve, reject) => {
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
      // Flip Y so images aren't upside-down (WebGL origin is bottom-left)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      resolve({ texture, width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HOLD_DURATION = 8; // seconds to hold each image
const TRANSITION_DURATION = 5; // seconds for dissolve
const QUEUE_REFETCH_THRESHOLD = 3;
const BATCH_SIZE = 10;

// ---------------------------------------------------------------------------
// Pan (Ken Burns) helpers
// ---------------------------------------------------------------------------

interface PanState {
  vx: number; // UV-units per second
  vy: number;
  startTime: number; // performance.now() / 1000
}

/** Pick a random direction and speed for the slow-pan effect. */
function randomPanVelocity(now: number): PanState {
  const angle = Math.random() * Math.PI * 2;
  const speed = 0.003 + Math.random() * 0.003; // 0.003–0.006 UV/s
  return {
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    startTime: now,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ImageSlideshow() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [svgContent, setSvgContent] = useState<string>("");

  // Load trainer.svg as inline SVG
  useEffect(() => {
    fetch("/trainer.svg")
      .then((res) => res.text())
      .then((text) => {
        // Extract the <svg> element, strip XML declaration / DOCTYPE
        const svgMatch = text.match(/<svg[\s\S]*<\/svg>/);
        if (svgMatch) {
          // Make it responsive and recolor
          let svg = svgMatch[0];
          svg = svg.replace(/width="[^"]*"/, 'width="65vw"');
          svg = svg.replace(/height="[^"]*"/, 'height="auto"');
          // Ensure the SVG itself is a block element for proper flex centering
          svg = svg.replace("<svg ", '<svg style="display:block" ');
          svg = svg.replace(/fill="#000000"/, 'fill="#0024cc"');
          setSvgContent(svg);
        }
      })
      .catch((err) => console.error("Failed to load trainer.svg", err));
  }, []);

  // Image URL queue
  const queueRef = useRef<string[]>([]);
  const currentIndexRef = useRef(0);
  const isFetchingRef = useRef(false);

  // WebGL state kept in refs so the animation loop can access them
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const uniformsRef = useRef<Record<string, WebGLUniformLocation | null>>({});
  const texFromRef = useRef<{
    texture: WebGLTexture;
    width: number;
    height: number;
  } | null>(null);
  const texToRef = useRef<{
    texture: WebGLTexture;
    width: number;
    height: number;
  } | null>(null);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const readyRef = useRef(false);
  // Per-image pan (Ken Burns) velocity state
  const panFromRef = useRef<PanState>({ vx: 0, vy: 0, startTime: 0 });
  const panToRef = useRef<PanState>({ vx: 0, vy: 0, startTime: 0 });
  // Per-transition random seed (4 values in [0,1]) for dissolve variation
  const transitionSeedRef = useRef<[number, number, number, number]>([
    Math.random(), Math.random(), Math.random(), Math.random(),
  ]);
  // State machine: "holding" | "transitioning" | "waiting"
  // "waiting" = transition hit 1.0, loading next image, clamp progress at 1
  const phaseRef = useRef<"holding" | "transitioning" | "waiting">("holding");
  const isAdvancingRef = useRef(false);

  // tRPC
  const utils = trpc.useUtils();
  const { data: initialData } = trpc.slideshow.randomImages.useQuery(
    { count: BATCH_SIZE },
    { refetchOnWindowFocus: false, staleTime: Infinity },
  );

  // Fetch more images lazily
  const fetchMore = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const result = await utils.slideshow.randomImages.fetch({
        count: BATCH_SIZE,
      });
      if (result.urls.length > 0) {
        queueRef.current.push(...result.urls);
      }
    } catch (e) {
      console.error("Slideshow: failed to fetch more images", e);
    } finally {
      isFetchingRef.current = false;
    }
  }, [utils]);

  // Seed queue from initial data
  useEffect(() => {
    if (initialData?.urls && initialData.urls.length > 0) {
      queueRef.current = [...initialData.urls];
    }
  }, [initialData]);

  // Get the next image URL from the queue, wrapping around
  const getNextUrl = useCallback((): string | null => {
    const queue = queueRef.current;
    if (queue.length === 0) return null;
    const idx = currentIndexRef.current % queue.length;
    currentIndexRef.current = idx + 1;

    // Trigger refetch when running low
    const remaining = queue.length - currentIndexRef.current;
    if (remaining <= QUEUE_REFETCH_THRESHOLD) {
      fetchMore();
    }

    return queue[idx];
  }, [fetchMore]);

  // ---------------------------------------------------------------------------
  // WebGL initialisation + animation loop
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
    });
    if (!gl) {
      console.warn("WebGL not available");
      return;
    }
    glRef.current = gl;

    // Set clear color to accent green so canvas matches before textures load
    gl.clearColor(0.102, 0.620, 0.247, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    // Canvas is now green — safe to reveal (matches the container background)
    setCanvasReady(true);

    // Compile shaders
    const vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = createProgram(gl, vs, fs);
    if (!program) return;
    programRef.current = program;
    gl.useProgram(program);

    // Fullscreen quad geometry
    const positions = new Float32Array([
      -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
    ]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const aPosition = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    // Cache uniform locations
    const names = [
      "uTexFrom",
      "uTexTo",
      "uProgress",
      "uTime",
      "uResolution",
      "uTexFromSize",
      "uTexToSize",
      "uPanFrom",
      "uPanTo",
      "uTransitionSeed",
    ];
    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    for (const name of names) {
      uniforms[name] = gl.getUniformLocation(program, name);
    }
    uniformsRef.current = uniforms;

    // Bind texture units
    gl.uniform1i(uniforms.uTexFrom, 0);
    gl.uniform1i(uniforms.uTexTo, 1);

    // Cleanup
    return () => {
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buffer);
      if (texFromRef.current) gl.deleteTexture(texFromRef.current.texture);
      if (texToRef.current) gl.deleteTexture(texToRef.current.texture);
      cancelAnimationFrame(animFrameRef.current);
      glRef.current = null;
      programRef.current = null;
      readyRef.current = false;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Canvas resize
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        // Render at reduced resolution for a fuzzy / pixelated look
        const dpr = 0.5;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        const gl = glRef.current;
        if (gl) {
          gl.viewport(0, 0, canvas.width, canvas.height);
          const u = uniformsRef.current;
          if (u.uResolution) {
            gl.uniform2f(u.uResolution, canvas.width, canvas.height);
          }
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ---------------------------------------------------------------------------
  // Animation loop — starts once initial data arrives
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!initialData?.urls || initialData.urls.length < 2) return;

    const gl = glRef.current;
    if (!gl || !programRef.current) return;

    let cancelled = false;

    async function boot() {
      if (!gl) return;
      // Load first two images
      const url1 = getNextUrl();
      const url2 = getNextUrl();
      if (!url1 || !url2) return;

      try {
        const [t1, t2] = await Promise.all([
          loadImageAsTexture(gl, url1),
          loadImageAsTexture(gl, url2),
        ]);
        if (cancelled) {
          gl.deleteTexture(t1.texture);
          gl.deleteTexture(t2.texture);
          return;
        }
        texFromRef.current = t1;
        texToRef.current = t2;
        readyRef.current = true;
        phaseRef.current = "holding";
        isAdvancingRef.current = false;
        const bootTime = performance.now() / 1000;
        startTimeRef.current = bootTime;
        panFromRef.current = randomPanVelocity(bootTime);
        panToRef.current = randomPanVelocity(bootTime);
        tick();
      } catch (e) {
        console.error("Slideshow: failed to load initial images", e);
      }
    }

    function tick() {
      if (cancelled || !gl) return;
      animFrameRef.current = requestAnimationFrame(tick);

      if (!readyRef.current || !texFromRef.current || !texToRef.current) return;

      const now = performance.now() / 1000;
      const elapsed = now - startTimeRef.current;
      const phase = phaseRef.current;

      let progress: number;

      if (phase === "holding") {
        progress = 0;
        // After hold duration, begin transitioning
        if (elapsed >= HOLD_DURATION) {
          phaseRef.current = "transitioning";
          startTimeRef.current = now; // reset for transition timing
          // Fresh random seed so each transition looks different
          transitionSeedRef.current = [
            Math.random(), Math.random(), Math.random(), Math.random(),
          ];
        }
      } else if (phase === "transitioning") {
        progress = elapsed / TRANSITION_DURATION;
        progress = Math.min(progress, 1);
        // Ease in-out quintic — very gentle start and end
        progress =
          progress < 0.5
            ? 16 * progress * progress * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 5) / 2;

        // Transition complete — start loading next image
        if (elapsed >= TRANSITION_DURATION) {
          phaseRef.current = "waiting";
          progress = 1;
          advanceImage();
        }
      } else {
        // "waiting" — clamp at 1.0 until next image is ready
        progress = 1;
      }

      const u = uniformsRef.current;
      gl.useProgram(programRef.current);

      // Bind textures
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texFromRef.current.texture);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, texToRef.current.texture);

      // Set uniforms
      if (u.uProgress) gl.uniform1f(u.uProgress, progress);
      if (u.uTime) gl.uniform1f(u.uTime, now);
      if (u.uTexFromSize) {
        gl.uniform2f(
          u.uTexFromSize,
          texFromRef.current.width,
          texFromRef.current.height,
        );
      }
      if (u.uTexToSize) {
        gl.uniform2f(
          u.uTexToSize,
          texToRef.current.width,
          texToRef.current.height,
        );
      }

      // Compute and upload per-image pan offsets
      const pf = panFromRef.current;
      const pt = panToRef.current;
      if (u.uPanFrom) {
        const dt = now - pf.startTime;
        gl.uniform2f(u.uPanFrom, pf.vx * dt, pf.vy * dt);
      }
      if (u.uPanTo) {
        const dt = now - pt.startTime;
        gl.uniform2f(u.uPanTo, pt.vx * dt, pt.vy * dt);
      }

      // Upload per-transition random seed
      if (u.uTransitionSeed) {
        const s = transitionSeedRef.current;
        gl.uniform4f(u.uTransitionSeed, s[0], s[1], s[2], s[3]);
      }

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    async function advanceImage() {
      if (!gl || isAdvancingRef.current) return;
      isAdvancingRef.current = true;

      const nextUrl = getNextUrl();
      if (!nextUrl) {
        isAdvancingRef.current = false;
        // Nothing to advance to — go back to holding the current "to" image
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
        // Carry "to" pan state forward as the new "from" pan
        panFromRef.current = panToRef.current;
        const advTime = performance.now() / 1000;
        panToRef.current = randomPanVelocity(advTime);
        // Begin a new hold phase
        phaseRef.current = "holding";
        startTimeRef.current = advTime;
      } catch (e) {
        console.error("Slideshow: failed to load next image", e);
        // On error, just restart holding with current images
        phaseRef.current = "holding";
        startTimeRef.current = performance.now() / 1000;
      } finally {
        isAdvancingRef.current = false;
      }
    }

    boot();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [initialData, getNextUrl]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        backgroundColor: "var(--color-accent, #1A9E3F)",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          opacity: canvasReady ? 1 : 0,
        }}
      />
      {svgContent && (
        <div
          dangerouslySetInnerHTML={{ __html: svgContent }}
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
