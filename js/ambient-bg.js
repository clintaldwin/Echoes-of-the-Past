/**
 * ambient-bg.js
 * ---------------------------------------------------------------------------
 * A single full-viewport <canvas> that renders an ambient, theme-reactive
 * background system:
 *
 *   data-theme="golden-hour"    → soft volumetric god rays, tilting + breathing
 *   data-theme="witching-hour"  → layered cosmic nebula (amethyst / twilight blue)
 *   anything else (default)     → slow rolling ambient fog
 *
 * Interaction:
 *   - Mouse parallax: background drifts opposite the cursor (lerped, so it
 *     trails gently rather than snapping) for a 3D "window" depth effect.
 *   - Tap/click ripples: soft anti-aliased rings in the active theme's
 *     palette, expanding and fading; color-matched per theme.
 *
 * Performance:
 *   - devicePixelRatio capped, element counts capped and pooled (no
 *     per-frame allocation of scene objects — only gradients, which the
 *     Canvas 2D API requires be rebuilt when their stops change).
 *   - Rendering pauses fully when the tab is hidden, and idles to zero
 *     redraw cost once settled when the user prefers reduced motion.
 *   - `prefers-reduced-motion: reduce` disables parallax and continuous
 *     motion outright; ripples become a single opacity-only pulse with
 *     no expansion or drift.
 *
 * Usage:
 *   import { initAmbientBackground } from './js/ambient-bg.js';
 *   const ambient = initAmbientBackground();
 *   // later, if needed:
 *   ambient.setTheme('witching-hour');
 *   ambient.destroy();
 * ---------------------------------------------------------------------------
 */

const DEFAULTS = {
  canvasId: 'ambient-bg-canvas',
  container: null,        // defaults to document.body
  targetTheme: null,      // defaults to reading document.body.dataset.theme
  maxDPR: 2,
  maxRipples: 6,
  parallaxStrength: 26,   // px of max shift at full mouse travel, X axis
  parallaxEase: 0.06,     // lerp factor per frame (lower = dreamier trail)
  themeCrossfadeMs: 1400,
};

/* ---------------------------------------------------------------------------
 * Theme palettes
 * -------------------------------------------------------------------------*/
const PALETTES = {
  'golden-hour': {
    kind: 'rays',
    rayCount: 7,
    colorCore: [255, 214, 150],   // warm amber-gold
    ripple: [214, 168, 96],       // golden amber
  },
  'witching-hour': {
    kind: 'nebula',
    blobCount: 6,
    colors: [
      [126, 78, 178],  // amethyst violet
      [66, 88, 158],   // twilight blue
      [92, 58, 132],   // deep violet
      [58, 74, 138],   // indigo blue
    ],
    ripple: [150, 110, 220],      // cosmic violet
    rippleAlt: [80, 200, 220],    // cosmic cyan (two-tone ring)
  },
  default: {
    kind: 'fog',
    driftCount: 4,
    color: [214, 214, 202],       // pale rolling mist
    ripple: [143, 175, 142],      // site's sage-green accent
  },
};

function paletteFor(name) {
  return PALETTES[name] || PALETTES.default;
}

const lerp = (a, b, t) => a + (b - a) * t;
const rand = (min, max) => min + Math.random() * (max - min);

/* ---------------------------------------------------------------------------
 * Main entry point
 * -------------------------------------------------------------------------*/
export function initAmbientBackground(userOptions = {}) {
  const opts = { ...DEFAULTS, ...userOptions };
  const root = opts.container || document.body;

  const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduceMotion = reduceMotionQuery.matches;

  // Rough low-power heuristic — trims element counts on constrained devices.
  const lowPower =
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
    (navigator.deviceMemory && navigator.deviceMemory <= 4);
  const countFactor = lowPower ? 0.7 : 1;

  /* ---- canvas setup -------------------------------------------------- */
  let canvas = document.getElementById(opts.canvasId);
  const ownsCanvas = !canvas;
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = opts.canvasId;
    canvas.className = 'ambient-bg-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    root.insertBefore(canvas, root.firstChild);
  }
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });

  let width = 0;
  let height = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, opts.maxDPR);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();

  let resizePending = false;
  function onResize() {
    if (resizePending) return;
    resizePending = true;
    requestAnimationFrame(() => {
      resize(); // ratio-based scene geometry re-maps itself automatically
      resizePending = false;
    });
  }
  window.addEventListener('resize', onResize, { passive: true });

  /* ---- pointer parallax ------------------------------------------------ */
  let mouseTX = 0, mouseTY = 0; // target, normalized -1..1
  let mouseX = 0, mouseY = 0;   // eased current

  function onPointerMove(e) {
    if (reduceMotion) return;
    mouseTX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseTY = (e.clientY / window.innerHeight) * 2 - 1;
  }
  window.addEventListener('pointermove', onPointerMove, { passive: true });

  /* ---- ripples: fixed-size pool, reused in place (no per-click GC) ---- */
  const ripples = Array.from({ length: opts.maxRipples }, () => ({
    active: false, x: 0, y: 0, radius: 0, maxRadius: 0, alpha: 0, born: 0,
  }));
  let rippleCursor = 0;

  function spawnRipple(x, y) {
    const r = ripples[rippleCursor];
    rippleCursor = (rippleCursor + 1) % ripples.length;
    r.active = true;
    r.x = x;
    r.y = y;
    r.radius = reduceMotion ? 52 : 0; // reduced motion: appear in place, no expansion
    r.maxRadius = rand(140, 220);
    r.alpha = reduceMotion ? 0.4 : 0.5;
    r.born = performance.now();
  }

  function onClick(e) {
    spawnRipple(e.clientX, e.clientY);
  }
  window.addEventListener('click', onClick, { passive: true });

  /* ---- theme state + crossfade ----------------------------------------- */
  function readTheme() {
    return document.body?.dataset?.theme || 'default';
  }

  let currentThemeName = opts.targetTheme || readTheme();
  let currentPalette = paletteFor(currentThemeName);
  let prevPalette = null;
  let themeBlend = 1;      // 1 = fully settled on currentPalette
  let themeBlendStart = 0;

  function setTheme(name) {
    const next = paletteFor(name);
    if (next === currentPalette) {
      currentThemeName = name;
      return;
    }
    prevPalette = currentPalette;
    currentPalette = next;
    currentThemeName = name;
    themeBlend = 0;
    themeBlendStart = performance.now();
    rebuildScene();
  }

  // Reacts automatically to whatever drives day/night themes on this site
  // (time-of-day cycle, manual toggle, etc.) — no extra wiring needed.
  const themeObserver = new MutationObserver(() => setTheme(readTheme()));
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });

  /* ---- scene elements: built once per theme switch, mutated in place --- */
  let rays = [];
  let blobs = [];
  let wisps = [];

  function buildRays(count) {
    return Array.from({ length: count }, (_, i) => ({
      xRatio: (i + 0.5) / count + rand(-0.04, 0.04),
      tiltPhase: rand(0, Math.PI * 2),
      tiltSpeed: rand(0.06, 0.12),
      tiltAmp: rand(4, 11),
      breathePhase: rand(0, Math.PI * 2),
      breatheSpeed: rand(0.15, 0.3),
      widthRatio: rand(0.05, 0.11),
      depth: rand(0.4, 1),
    }));
  }

  function buildBlobs(count, colors) {
    return Array.from({ length: count }, (_, i) => ({
      color: colors[i % colors.length],
      xRatio: rand(0.1, 0.9),
      yRatio: rand(0.1, 0.9),
      radiusRatio: rand(0.22, 0.42),
      driftPhaseX: rand(0, Math.PI * 2),
      driftPhaseY: rand(0, Math.PI * 2),
      driftSpeed: rand(0.03, 0.07),
      driftAmpRatio: rand(0.03, 0.07),
      depth: rand(0.3, 1),
    }));
  }

  function buildWisps(count) {
    return Array.from({ length: count }, () => ({
      yRatio: rand(0.15, 0.85),
      xRatio: rand(-0.2, 1.2),
      speed: rand(0.004, 0.01),
      radiusRatio: rand(0.25, 0.45),
      depth: rand(0.3, 0.9),
      alpha: rand(0.35, 0.7),
    }));
  }

  function rebuildScene() {
    if (currentPalette.kind === 'rays') {
      rays = buildRays(Math.max(3, Math.round(currentPalette.rayCount * countFactor)));
    } else if (currentPalette.kind === 'nebula') {
      blobs = buildBlobs(Math.max(3, Math.round(currentPalette.blobCount * countFactor)), currentPalette.colors);
    } else {
      wisps = buildWisps(Math.max(2, Math.round(currentPalette.driftCount * countFactor)));
    }
  }
  rebuildScene();

  /* ---- per-theme renderers ---------------------------------------------- */
  function drawRays(palette, t, parX, parY, alphaMul) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const [cr, cg, cb] = palette.colorCore;

    for (const r of rays) {
      const tiltDeg = Math.sin(t * r.tiltSpeed + r.tiltPhase) * r.tiltAmp;
      const breathe = 0.55 + 0.45 * Math.sin(t * r.breatheSpeed + r.breathePhase);
      const originX = r.xRatio * width + parX * r.depth;
      const originY = -height * 0.15 + parY * r.depth * 0.4;
      const rayW = width * r.widthRatio;
      const rayH = height * 1.5;

      ctx.save();
      ctx.translate(originX, originY);
      ctx.rotate((tiltDeg * Math.PI) / 180);
      ctx.filter = `blur(${18 + 10 * (1 - r.depth)}px)`;

      const grad = ctx.createLinearGradient(0, 0, 0, rayH);
      grad.addColorStop(0, `rgba(${cr},${cg},${cb},${0.16 * breathe * alphaMul})`);
      grad.addColorStop(0.35, `rgba(${cr},${cg},${cb},${0.09 * breathe * alphaMul})`);
      grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-rayW * 0.5, 0);
      ctx.lineTo(rayW * 0.5, 0);
      ctx.lineTo(rayW * 1.3, rayH);
      ctx.lineTo(-rayW * 1.3, rayH);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawNebula(palette, t, parX, parY, alphaMul) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const b of blobs) {
      const dx = Math.sin(t * b.driftSpeed + b.driftPhaseX) * b.driftAmpRatio * width;
      const dy = Math.cos(t * b.driftSpeed * 0.8 + b.driftPhaseY) * b.driftAmpRatio * height;
      const cx = b.xRatio * width + dx + parX * b.depth;
      const cy = b.yRatio * height + dy + parY * b.depth;
      const radius = b.radiusRatio * Math.max(width, height);
      const [cr, cg, cb] = b.color;

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, `rgba(${cr},${cg},${cb},${0.22 * alphaMul})`);
      grad.addColorStop(0.5, `rgba(${cr},${cg},${cb},${0.1 * alphaMul})`);
      grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFog(palette, t, parX, parY, alphaMul) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const [cr, cg, cb] = palette.color;

    for (const w of wisps) {
      const drift = ((t * w.speed) % 1.4) - 0.2;
      const cx = (w.xRatio + drift) * width + parX * w.depth;
      const cy = w.yRatio * height + parY * w.depth * 0.3;
      const radius = w.radiusRatio * Math.max(width, height);

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, `rgba(${cr},${cg},${cb},${0.05 * w.alpha * alphaMul})`);
      grad.addColorStop(0.6, `rgba(${cr},${cg},${cb},${0.02 * w.alpha * alphaMul})`);
      grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPalette(palette, t, parX, parY, alphaMul) {
    if (palette.kind === 'rays') drawRays(palette, t, parX, parY, alphaMul);
    else if (palette.kind === 'nebula') drawNebula(palette, t, parX, parY, alphaMul);
    else drawFog(palette, t, parX, parY, alphaMul);
  }

  function drawRipples(now) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const r of ripples) {
      if (!r.active) continue;
      const ageSec = (now - r.born) / 1000;

      if (!reduceMotion) {
        // Decelerating growth (approaches maxRadius, never overshoots) +
        // linear fade — reads as "slowing down and elegantly fading".
        r.radius = lerp(r.radius, r.maxRadius, 0.06);
        r.alpha = Math.max(0, 0.5 - ageSec * 0.55);
      } else {
        // Reduced motion: no expansion, no drift — opacity-only pulse.
        r.alpha = Math.max(0, 0.4 - ageSec * 1.1);
      }

      if (r.alpha <= 0.003) {
        r.active = false;
        continue;
      }

      const [cr, cg, cb] = currentPalette.ripple;
      const innerR = Math.max(r.radius - 26, 0);
      const grad = ctx.createRadialGradient(r.x, r.y, innerR, r.x, r.y, r.radius);
      grad.addColorStop(0, `rgba(${cr},${cg},${cb},0)`);

      if (currentPalette.rippleAlt) {
        const [ar, ag, ab] = currentPalette.rippleAlt;
        grad.addColorStop(0.55, `rgba(${cr},${cg},${cb},${0.26 * r.alpha})`);
        grad.addColorStop(0.85, `rgba(${ar},${ag},${ab},${0.22 * r.alpha})`);
      } else {
        grad.addColorStop(0.75, `rgba(${cr},${cg},${cb},${0.28 * r.alpha})`);
      }
      grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ---- main loop --------------------------------------------------------- */
  let rafId = null;
  let lastTime = performance.now();

  function frame(now) {
    rafId = requestAnimationFrame(frame);

    lastTime = now;

    const anyRippleActive = ripples.some(r => r.active);
    const settled = reduceMotion && !anyRippleActive && themeBlend >= 1;
    if (settled) return; // fully idle under reduced motion: skip the redraw entirely

    if (!reduceMotion) {
      mouseX = lerp(mouseX, mouseTX, opts.parallaxEase);
      mouseY = lerp(mouseY, mouseTY, opts.parallaxEase);
    }
    const parX = -mouseX * opts.parallaxStrength;
    const parY = -mouseY * opts.parallaxStrength * 0.6;

    ctx.clearRect(0, 0, width, height);
    const t = now / 1000;

    if (themeBlend < 1 && prevPalette) {
      themeBlend = Math.min(1, (now - themeBlendStart) / opts.themeCrossfadeMs);
      drawPalette(prevPalette, t, parX, parY, 1 - themeBlend);
      drawPalette(currentPalette, t, parX, parY, themeBlend);
      if (themeBlend >= 1) prevPalette = null;
    } else {
      drawPalette(currentPalette, t, parX, parY, 1);
    }

    drawRipples(now);
  }
  rafId = requestAnimationFrame(frame);

  /* ---- pause entirely while tab is hidden -------------------------------- */
  function onVisibility() {
    if (document.hidden) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    } else if (!rafId) {
      lastTime = performance.now();
      rafId = requestAnimationFrame(frame);
    }
  }
  document.addEventListener('visibilitychange', onVisibility);

  /* ---- live-react if the OS-level reduced-motion setting changes -------- */
  function onReduceMotionChange(e) {
    reduceMotion = e.matches;
  }
  if (reduceMotionQuery.addEventListener) {
    reduceMotionQuery.addEventListener('change', onReduceMotionChange);
  } else {
    reduceMotionQuery.addListener(onReduceMotionChange); // Safari < 14 fallback
  }

  /* ---- teardown ----------------------------------------------------------- */
  function destroy() {
    if (rafId) cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('click', onClick);
    document.removeEventListener('visibilitychange', onVisibility);
    themeObserver.disconnect();
    if (reduceMotionQuery.removeEventListener) {
      reduceMotionQuery.removeEventListener('change', onReduceMotionChange);
    } else {
      reduceMotionQuery.removeListener(onReduceMotionChange);
    }
    if (ownsCanvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }

  return { destroy, setTheme, ripple: spawnRipple };
}
