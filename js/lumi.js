/* ===================================================
   ECHOES — lumi.js
   The Ghost NPC — modular ambient character

   Sections:
     1. Math helpers
     2. Lumi SVG markup + speech line data (visual language unchanged)
     3. LumiAmbience — shared canvas for fog/smoke/dust/fireflies/aurora
     4. Lumi class
          - lifecycle (mount/destroy)
          - state machine (unchanged states)
          - movement (destination-based roaming)
          - visual transform (squash/stretch + flip)
          - idle micro-behaviors
          - ambient card interaction (glow/sway/pulse)
          - main loop
          - speech bubble (child-anchored)
          - particle bursts (sparkle/tear/zzz/trail)
     5. Easter eggs
     6. Public exports (unchanged surface: lumi, initLumi, SPEECH)
   =================================================== */

import { getLumiGreeting } from './time-theme.js';
import { audioCtrl } from './audio.js';

/* ═══════════════════════════════════════════════════════════
   1. Small math helpers
═══════════════════════════════════════════════════════════ */
const lerp  = (a, b, t) => a + (b - a) * t;
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const rand  = (a, b) => a + Math.random() * (b - a);

/* ═══════════════════════════════════════════════════════════
   2. Lumi SVG markup — redesign synthesis: Reference A's soul
   (glow, eyes-only emotion, drift) grounded in Reference B's
   material (stitched linen texture, warm palette, scalloped
   hem). She reads as something sewn and kept, not rendered.

   Colors live in ghost.css (--lumi-body / --lumi-glow-1 / etc.,
   see base.css + per-theme overrides in themes.css) so she
   recolors with the site's time-of-day themes instead of living
   in her own bubble. Eye ink stays a fixed warm charcoal — it's
   not part of the theme system.

   The silhouette is a Catmull-Rom spline through an intentionally
   asymmetric set of control points (never a mirrored teardrop),
   ending in 3 uneven scalloped drape-points instead of the old
   single smooth tail. The inner dashed line is the one direct
   visual quote from the embroidery reference. `.lumi-fabric`
   wraps ONLY the outer silhouette in the shared #wrinkle
   turbulence filter (already defined once per page, in the
   svg-filters block at the top of <body>) so the outline reads
   as cloth; eyes/stitch/mouth/feet stay outside it and crisp.
═══════════════════════════════════════════════════════════ */
const LUMI_SVG = `
<svg id="lumi-svg" viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="lumiGlow" cx="50%" cy="42%" r="58%">
      <stop offset="0%"   style="stop-color:var(--lumi-glow-1, #FFF3B8); stop-opacity:0.5" />
      <stop offset="100%" style="stop-color:var(--lumi-glow-1, #FFF3B8); stop-opacity:0" />
    </radialGradient>
  </defs>
  <g class="lumi-body">
    <!-- Outer glow halo -->
    <ellipse cx="41" cy="48" rx="34" ry="40" fill="url(#lumiGlow)" class="lumi-halo" />

    <!-- Faint wings of light — Bloom form only, see .lumi--form-bloom -->
    <g class="lumi-wings" aria-hidden="true">
      <path d="M 15 42 Q -4 38 -8 52 Q -2 58 15 54 Z" />
      <path d="M 66 40 Q 85 34 90 48 Q 83 56 66 52 Z" />
    </g>

    <!-- Body: stitched-fabric silhouette, scalloped hem, never symmetrical -->
    <g class="lumi-fabric" filter="url(#wrinkle)">
      <path class="lumi-body-shape"
            d="M 41.00 11.00 C 46.00 10.50, 49.00 9.67, 53.00 12.00 C 57.00 14.33, 62.50 20.00, 65.00 25.00 C 67.50 30.00, 68.17 36.83, 68.00 42.00 C 67.83 47.17, 65.17 52.00, 64.00 56.00 C 62.83 60.00, 63.00 61.67, 61.00 66.00 C 59.00 70.33, 54.83 81.17, 52.00 82.00 C 49.17 82.83, 46.67 70.50, 44.00 71.00 C 41.33 71.50, 38.67 84.67, 36.00 85.00 C 33.33 85.33, 30.50 73.83, 28.00 73.00 C 25.50 72.17, 23.17 81.33, 21.00 80.00 C 18.83 78.67, 16.33 70.00, 15.00 65.00 C 13.67 60.00, 13.17 55.50, 13.00 50.00 C 12.83 44.50, 12.33 37.83, 14.00 32.00 C 15.67 26.17, 18.50 18.50, 23.00 15.00 C 27.50 11.50, 36.00 11.50, 41.00 11.00 Z" />
    </g>

    <!-- Inner stitch line — inset ~10%, dashed, sparse olive -->
    <path class="lumi-stitch" fill="none"
          d="M 40.89 15.00 C 45.39 14.55, 48.09 13.80, 51.69 15.90 C 55.29 18.00, 60.24 23.10, 62.49 27.60 C 64.74 32.10, 65.34 38.25, 65.19 42.90 C 65.04 47.55, 62.64 51.90, 61.59 55.50 C 60.54 59.10, 60.69 60.60, 58.89 64.50 C 57.09 68.40, 53.34 78.15, 50.79 78.90 C 48.24 79.65, 45.99 68.55, 43.59 69.00 C 41.19 69.45, 38.79 81.30, 36.39 81.60 C 33.99 81.90, 31.44 71.55, 29.19 70.80 C 26.94 70.05, 24.84 78.30, 22.89 77.10 C 20.94 75.90, 18.69 68.10, 17.49 63.60 C 16.29 59.10, 15.84 55.05, 15.69 50.10 C 15.54 45.15, 15.09 39.15, 16.59 33.90 C 18.09 28.65, 20.64 21.75, 24.69 18.60 C 28.74 15.45, 36.39 15.45, 40.89 15.00 Z" />

    <!-- Eyes — the entire emotion system lives here. Inner markup is
         swapped by JS (see EYE_STATES / _setEyeState), never deformed
         with per-eye CSS transforms, so every emotion is its own simple
         shape rather than a stretch of the same circle. -->
    <g class="lumi-eyes">
      <g class="lumi-eye lumi-eye--left"><circle cx="33" cy="46" r="2.6" fill="#3A3226"/></g>
      <g class="lumi-eye lumi-eye--right"><circle cx="49" cy="45" r="2.6" fill="#3A3226"/></g>
    </g>

    <!-- Rare mouth — only for a genuinely important memory. No eyebrows, ever. -->
    <path class="lumi-mouth" fill="none" stroke-linecap="round"
          d="M 37 54 Q 41 57 45 53.5" />

    <!-- Tiny tucked feet — letter/reading pose only -->
    <g class="lumi-feet">
      <ellipse cx="33" cy="90" rx="5" ry="3" />
      <ellipse cx="47" cy="91" rx="5" ry="3" />
    </g>
  </g>
</svg>`;

/* Eye-state shapes — simple filled/stroked forms, swapped wholesale rather
   than scaled/skewed. Positions echo the body's own asymmetry (left eye
   sits a touch lower than the right, "curious" widens the set). */
const EYE_STATES = {
  idle:     '<g class="lumi-eye lumi-eye--left"><circle cx="33" cy="46" r="2.6" fill="#3A3226"/></g><g class="lumi-eye lumi-eye--right"><circle cx="49" cy="45" r="2.6" fill="#3A3226"/></g>',
  happy:    '<g class="lumi-eye lumi-eye--left"><circle cx="33" cy="46" r="2.8" fill="#3A3226"/><circle cx="32.1" cy="45.1" r="0.9" fill="rgba(255,248,237,0.85)"/></g><g class="lumi-eye lumi-eye--right"><circle cx="49" cy="45" r="2.8" fill="#3A3226"/><circle cx="48.1" cy="44.1" r="0.9" fill="rgba(255,248,237,0.85)"/></g>',
  curious:  '<g class="lumi-eye lumi-eye--left"><circle cx="30" cy="46" r="2.6" fill="#3A3226"/></g><g class="lumi-eye lumi-eye--right"><circle cx="52" cy="45" r="2.6" fill="#3A3226"/></g>',
  sleepy:   '<g class="lumi-eye lumi-eye--left"><path d="M 30.0 45.7 Q 33.0 48.2 36.0 45.7" fill="none" stroke="#3A3226" stroke-width="1.3" stroke-linecap="round"/></g><g class="lumi-eye lumi-eye--right"><path d="M 46.0 44.7 Q 49.0 47.2 52.0 44.7" fill="none" stroke="#3A3226" stroke-width="1.3" stroke-linecap="round"/></g>',
  laughing: '<g class="lumi-eye lumi-eye--left"><path d="M 30.0 46.8 Q 33.0 43.6 36.0 46.8" fill="none" stroke="#3A3226" stroke-width="1.3" stroke-linecap="round"/></g><g class="lumi-eye lumi-eye--right"><path d="M 46.0 45.8 Q 49.0 42.6 52.0 45.8" fill="none" stroke="#3A3226" stroke-width="1.3" stroke-linecap="round"/></g>',
  awe:      '<g class="lumi-eye lumi-eye--left"><path d="M 33.0 42.6 L 33.9 45.1 L 36.4 46.0 L 33.9 46.9 L 33.0 49.4 L 32.1 46.9 L 29.6 46.0 L 32.1 45.1 Z" fill="#3A3226"/></g><g class="lumi-eye lumi-eye--right"><path d="M 49.0 41.6 L 49.9 44.1 L 52.4 45.0 L 49.9 45.9 L 49.0 48.4 L 48.1 45.9 L 45.6 45.0 L 48.1 44.1 Z" fill="#3A3226"/></g>',
  startled: '<g class="lumi-eye lumi-eye--left"><ellipse cx="33" cy="46" rx="1.7" ry="3.1" fill="#3A3226"/></g><g class="lumi-eye lumi-eye--right"><ellipse cx="49" cy="45" rx="1.7" ry="3.1" fill="#3A3226"/></g>',
};

/* Baseline eye-state per narrative state — applied on every setState(),
   then transiently overridden by mood (see MOOD_EYE_STATE + reactToMood)
   for a few seconds before falling back to this table. */
const STATE_EYE_STATE = {
  idle: 'idle', curious: 'curious', excited: 'laughing', melancholy: 'sleepy',
  watching: 'idle', sleeping: 'sleepy', greeting: 'happy', startled: 'startled',
  guiding: 'curious', guest: 'idle', reading: 'idle',
};

/* Mood → eye-state, for the transient hover/open reaction (see
   reactToMood() and gallery.js's onCardHover). */
const MOOD_EYE_STATE = {
  peaceful: 'idle', hopeful: 'happy', melancholy: 'sleepy',
  dark: 'sleepy', passionate: 'laughing',
};

/* A memory counts as "emotionally significant" (Bloom-worthy, and worth
   leaning toward while roaming) when its mood isn't the neutral default.
   'peaceful' dominates MOOD_POOL in drive.js on purpose as the ordinary
   baseline, so everything else reads as more charged. Easy to swap for a
   real tag/milestone flag later if the data model grows one. */
function isSignificantMemory(memory) {
  return !!memory && memory.mood && memory.mood !== 'peaceful';
}

const SPEECH = {
  empty: [
  "Hmmm... may gusto ka atang ikwento.",
  "Another memory?",
  "Ano kaya nangyari today?",
  "Take your time... andito lang ako.",
  "Ready na ako makinig hehe."
],

happy: [
  "Hahah, cute nito.",
  "Grabe... ang warm ng feeling nito.",
  "Ito yung mga memories na gusto kong balikan.",
  "Parang ang saya dito ah.",
  "Hehe... keep natin 'to."
],

melancholy: [
  "Bitaw... medyo mabigat 'to.",
  "Okay lang... we'll keep it here.",
  "Hindi lahat ng memories masaya... pero importante pa rin sila.",
  "Take your time lang.",
  "Andito lang ako."
],

dark: [
  "I'll keep this safe.",
  "Hindi natin kailangan kalimutan agad.",
  "Kahit mabigat... part pa rin siya ng journey.",
  "Some nights become beautiful pag binalikan natin.",
  "We'll leave a light here."
],

hopeful: [
  "Parang may magandang mangyayari dito.",
  "I like this one hehe.",
  "May little spark dito.",
  "Hold onto this one.",
  "Babalikan natin 'to someday."
],

guest: [
  "Welcome hehe.",
  "Walk slowly lang.",
  "Take your time.",
  "Someone wanted you to see this.",
  "Feel at home."
],

idle: [
  "I'm still here.",
  "No rush hehe.",
  "I'll just stay here.",
  "Enjoy lang.",
  "Tahimik dito no?"
],

writing_slow: [
  "Hmmm... iniisip mo pa.",
  "Take your time.",
  "Every word counts.",
  "I'm listening hehe.",
  "Okay lang kahit mabagal."
],

writing_fast: [
  "Uy hahaha ang bilis.",
  "Ang dami mong gustong sabihin.",
  "Wait lang... catching up ako haha.",
  "Important ba 'to?",
  "Keep going hehe."
],

deleted: [
  "Ay haha.",
  "Changed your mind?",
  "Okay lang.",
  "We'll find the right words.",
  "Try ulit?"
],

return: [
  "Uy, welcome back.",
  "Namiss ka ng place na 'to.",
  "Same place... bagong memories.",
  "Good to see you ulit hehe.",
  "Ready na ulit?"
],

milestone: [
  "100 memories... grabe.",
  "Look how far you've come.",
  "Unti-unti, napuno mo na ang place na 'to.",
  "Thank you for trusting me.",
  "Ang ganda tingnan."
],

reading: [
  "Take your time.",
  "I'll just sit here hehe.",
  "Some letters deserve a slow read.",
  "No rush.",
  "I'll wait."
],

bloom: [
  "Oh...",
  "Grabe... this one.",
  "I felt this one.",
  "This one's special.",
  "Let's keep this close."
]
};

/* ═══════════════════════════════════════════════════════════
   NOTE — personalization seeds still needed (see the blueprint's
   "Open Items Before Build"). Every pool above is deliberately a
   warm, observational *narrator* voice rather than "click here!"
   copy — but it's still generic. Nicknames, an inside joke, or
   whether she should ever say a name directly would let a future
   pass fold those in without changing the voice established here.
═══════════════════════════════════════════════════════════ */

/* Theme keys read off document.body.getAttribute('data-theme').
   Adjust these two strings if time-theme.js emits different literal
   values — everything else keys off these constants. */
const THEME_GOLDEN_HOUR   = 'golden-hour';
const THEME_WITCHING_HOUR = 'witching';

/* ═══════════════════════════════════════════════════════════
   3. LumiAmbience — one lightweight shared canvas for every
   passive effect around Lumi: fog displacement, smoke trail,
   sparse dust, rare fireflies, rare aurora ribbon, plus two
   theme-gated architectural layers (Golden Hour light shafts,
   Witching Hour nebula shimmer).

   Fully decoupled from the Lumi class — it just needs a position
   each frame — so it can be started/stopped/torn down on its own
   and stays cheap: capped particle counts, one canvas element,
   reduced density on mobile, and disabled entirely when the
   person prefers reduced motion.
═══════════════════════════════════════════════════════════ */
class LumiAmbience {
  constructor({ isMobile = false, reducedMotion = false } = {}) {
    this.isMobile      = isMobile;
    this.reducedMotion = reducedMotion;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'lumi-fx-canvas';
    this.ctx = this.canvas.getContext('2d');
    document.body.appendChild(this.canvas);

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.resize();

    this.smoke     = [];
    this.dust      = [];
    this.fireflies = [];
    this.aurora    = null;

    this.maxSmoke     = reducedMotion ? 0 : (isMobile ? 5 : 14);
    this.maxDust      = reducedMotion ? 0 : (isMobile ? 4 : 10);
    this.maxFireflies = (reducedMotion || isMobile) ? 0 : 1;
    this.auroraEnabled = !reducedMotion && !isMobile;

    /* Theme-aware architectural effects — Golden Hour light shafts and
       Witching Hour nebula shimmer. Gated behind the same flag as aurora,
       so mobile / reduced-motion sessions never allocate these arrays,
       never advance the extra clock, and never touch the canvas for them. */
    this.themeFxEnabled = this.auroraEnabled;
    this.theme       = null;
    this._themeClock = 0;

    /* Interactive parallax — a subtle cursor-driven offset applied only to
       the architectural layers above (_drawLightShafts / _drawNebula), never
       to fog/smoke/dust/fireflies. Gated behind the same flag as the theme
       fx themselves: no allocation, no lerp math, nothing touched at all on
       mobile or with reduced motion — the tap-ripple in the Lumi class below
       is the substitute feel on touch devices instead.

       currentParallaxX/Y are lerped toward targetParallaxX/Y every frame so
       the shift settles smoothly rather than snapping to the raw pointer
       position. Targets are read each tick from POINTER (see the standalone
       listener below), a plain cached fraction — never a DOM/style read —
       so this stays allocation-free and cheap in the render loop. */
    this.parallaxEnabled  = this.themeFxEnabled;
    this.currentParallaxX = 0;
    this.currentParallaxY = 0;
    this.targetParallaxX  = 0;
    this.targetParallaxY  = 0;
    this.PARALLAX_MAX_PX  = 7; // "a few pixels" — deliberately subtle

    this.lightShafts = [];
    this.nebulaBlobs = [];
    if (this.themeFxEnabled) {
      const SHAFT_COUNT = 5;
      for (let i = 0; i < SHAFT_COUNT; i++) {
        this.lightShafts.push({
          xFrac:     (i + 0.5) / SHAFT_COUNT + rand(-0.035, 0.035),
          widthFrac: rand(0.05, 0.09),
          phase:     rand(0, Math.PI * 2),
          speed:     rand(0.00004, 0.00008),
          leanPhase: rand(0, Math.PI * 2),
          leanSpeed: rand(0.00003, 0.00006)
        });
      }

      const NEBULA_COUNT = 6;
      for (let i = 0; i < NEBULA_COUNT; i++) {
        this.nebulaBlobs.push({
          xFrac:      rand(0.05, 0.95),
          yFrac:      rand(0.04, 0.6),
          baseRadius: rand(90, 220),
          phase:      rand(0, Math.PI * 2),
          speed:      rand(0.00006, 0.00013),
          warm:       i % 2 === 0 // alternates two nebula hues
        });
      }
    }

    const now = performance.now();
    this._nextFireflyAt = now + rand(18000, 34000);
    this._nextAuroraAt  = now + rand(100000, 200000);

    this._lastX = null;
    this._lastY = null;
    this._lumiX = null;
    this._lumiY = null;
  }

  resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  update(dt, lumiX, lumiY, isMoving) {
    this._lumiX = lumiX;
    this._lumiY = lumiY;
    const now = performance.now();

    /* Theme detection — a single cheap attribute read per tick. Fully
       bypassed on mobile / reduced-motion so those sessions never pay
       for it, and the shafts/nebula arrays stay empty and untouched. */
    if (this.themeFxEnabled) {
      this.theme = document.body.getAttribute('data-theme');
      this._themeClock += dt;
    }

    /* Parallax lerp — target is derived from POINTER (0..1 fractions,
       centered at 0.5), scaled to ±PARALLAX_MAX_PX and inverted so the
       architectural layers drift opposite the cursor, the way a distant
       backdrop would. Settles at ~6%/frame — smooth without ever feeling
       laggy. Skipped completely off the parallaxEnabled gate. */
    if (this.parallaxEnabled) {
      this.targetParallaxX = (POINTER.mx - 0.5) * -2 * this.PARALLAX_MAX_PX;
      this.targetParallaxY = (POINTER.my - 0.5) * -2 * this.PARALLAX_MAX_PX;
      this.currentParallaxX = lerp(this.currentParallaxX, this.targetParallaxX, 0.06);
      this.currentParallaxY = lerp(this.currentParallaxY, this.targetParallaxY, 0.06);
    }

    /* Smoke wisps — spawned along the movement path, drift opposite
       to travel direction and fade. */
    if (isMoving && this.maxSmoke > 0 && this._lastX != null) {
      const dx = lumiX - this._lastX;
      const dy = lumiY - this._lastY;
      const moveDist = Math.hypot(dx, dy);
      if (moveDist > 0.6 && this.smoke.length < this.maxSmoke && Math.random() < 0.3) {
        this.smoke.push({
          x: lumiX - dx * 2, y: lumiY - dy * 2,
          vx: -dx * 0.02 + rand(-0.03, 0.03),
          vy: -dy * 0.02 + rand(-0.03, 0.02) - 0.04,
          size: rand(10, 26),
          life: 1,
          decay: rand(0.007, 0.013)
        });
      }
    }
    this._lastX = lumiX;
    this._lastY = lumiY;

    for (let i = this.smoke.length - 1; i >= 0; i--) {
      const s = this.smoke[i];
      s.x    += s.vx * dt * 0.06;
      s.y    += s.vy * dt * 0.06;
      s.size += dt * 0.01;
      s.life -= s.decay;
      if (s.life <= 0) this.smoke.splice(i, 1);
    }

    /* Sparse dust drifting near Lumi */
    if (this.maxDust > 0 && this.dust.length < this.maxDust && Math.random() < 0.02) {
      const angle = Math.random() * Math.PI * 2;
      const r = rand(40, 130);
      this.dust.push({
        x: lumiX + Math.cos(angle) * r,
        y: lumiY + Math.sin(angle) * r,
        vy: rand(-0.03, -0.01),
        phase: Math.random() * Math.PI * 2,
        size: rand(1, 2.5),
        life: 1,
        decay: rand(0.0018, 0.0038)
      });
    }
    for (let i = this.dust.length - 1; i >= 0; i--) {
      const d = this.dust[i];
      d.phase += dt * 0.002;
      d.x     += Math.sin(d.phase) * 0.15;
      d.y     += d.vy * dt * 0.05;
      d.life  -= d.decay;
      if (d.life <= 0) this.dust.splice(i, 1);
    }

    /* Rare firefly */
    if (this.maxFireflies > 0 && this.fireflies.length < this.maxFireflies && now > this._nextFireflyAt) {
      this._nextFireflyAt = now + rand(20000, 42000);
      this.fireflies.push({
        x: lumiX + rand(-160, 160),
        y: lumiY + rand(-110, 110),
        angle: Math.random() * Math.PI * 2,
        life: 1,
        decay: 0.0016,
        blink: Math.random() * Math.PI * 2
      });
    }
    for (let i = this.fireflies.length - 1; i >= 0; i--) {
      const f = this.fireflies[i];
      f.angle += rand(-0.15, 0.15);
      f.x     += Math.cos(f.angle) * dt * 0.02;
      f.y     += Math.sin(f.angle) * dt * 0.02;
      f.blink += dt * 0.006;
      f.life  -= f.decay;
      if (f.life <= 0) this.fireflies.splice(i, 1);
    }

    /* Rare aurora ribbon */
    if (this.auroraEnabled && !this.aurora && now > this._nextAuroraAt) {
      this._nextAuroraAt = now + rand(130000, 260000);
      this.aurora = { life: 1, t: 0 };
    }
    if (this.aurora) {
      this.aurora.t   += dt;
      this.aurora.life = Math.max(0, 1 - this.aurora.t / 9000);
      if (this.aurora.life <= 0) this.aurora = null;
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this._lumiX == null) return;

    /* Theme-aware architectural backdrop — painted first so fog, smoke,
       dust, fireflies and aurora all layer on top of it. Cleanly skipped
       (no loop, no gradient, no canvas call) when disabled or when the
       active theme is neither Golden Hour nor Witching Hour. */
    if (this.themeFxEnabled) {
      ctx.save();
      if (this.parallaxEnabled) {
        ctx.translate(this.currentParallaxX, this.currentParallaxY);
      }
      if (this.theme === THEME_GOLDEN_HOUR) {
        this._drawLightShafts(ctx);
      } else if (this.theme === THEME_WITCHING_HOUR) {
        this._drawNebula(ctx);
      }
      ctx.restore();
    }

    /* Fog displacement — a soft halo that reads as Lumi gently
       pushing the ambient fog aside as she drifts through it. */
    const halo = ctx.createRadialGradient(this._lumiX, this._lumiY, 0, this._lumiX, this._lumiY, 140);
    halo.addColorStop(0, 'rgba(230,245,225,0.10)');
    halo.addColorStop(1, 'rgba(230,245,225,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(this._lumiX, this._lumiY, 140, 0, Math.PI * 2);
    ctx.fill();

    for (const s of this.smoke) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,220,205,${(0.10 * s.life).toFixed(3)})`;
      ctx.fill();
    }

    for (const d of this.dust) {
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(245,240,225,${(0.35 * d.life).toFixed(3)})`;
      ctx.fill();
    }

    for (const f of this.fireflies) {
      const flicker = 0.5 + Math.sin(f.blink) * 0.5;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(212,165,90,${(0.7 * f.life * flicker).toFixed(3)})`;
      ctx.shadowColor = 'rgba(245,200,122,0.9)';
      ctx.shadowBlur  = 8;
      ctx.fill();
      ctx.shadowBlur  = 0;
    }

    if (this.aurora) {
      const w = this.canvas.width;
      const y = this.canvas.height * 0.18;
      const grad = ctx.createLinearGradient(0, y - 60, w, y + 60);
      grad.addColorStop(0,    'rgba(143,175,142,0)');
      grad.addColorStop(0.3, `rgba(143,175,142,${(0.08 * this.aurora.life).toFixed(3)})`);
      grad.addColorStop(0.6, `rgba(212,165,90,${(0.06 * this.aurora.life).toFixed(3)})`);
      grad.addColorStop(1,    'rgba(143,175,142,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, y - 60, w, 120);
    }
  }

  /* ─────────────────────────────────────────────────
     Golden Hour — slow light-shaft drift.

     A handful of soft, angled volumetric rays spanning down from the
     upper hemisphere. Each shaft is a pre-allocated entry in
     this.lightShafts (built once in the constructor, never resized),
     so this method allocates nothing but the two gradients-per-shaft
     that canvas requires to redraw a moving gradient — the same
     pattern already used by the fog halo and aurora ribbon below.
     Lean angle and alpha both ride a single sine/cosine pair driven
     by this._themeClock, so the rays breathe rather than snap.
  ───────────────────────────────────────────────── */
  _drawLightShafts(ctx) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const t = this._themeClock;
    const shaftH = h * 0.85;

    for (let i = 0; i < this.lightShafts.length; i++) {
      const s = this.lightShafts[i];

      // Lean sways gently between roughly -9deg and +9deg.
      const leanDeg = Math.sin(s.leanPhase + t * s.leanSpeed) * 9;
      // Alpha breathes between ~0.045 and ~0.095 — kept subtle, additive.
      const alpha = 0.045 + (Math.sin(s.phase + t * s.speed) * 0.5 + 0.5) * 0.05;

      const x = s.xFrac * w;
      const shaftW = s.widthFrac * w;

      ctx.save();
      ctx.translate(x, 0);
      ctx.rotate((leanDeg * Math.PI) / 180);

      const grad = ctx.createLinearGradient(0, 0, 0, shaftH);
      grad.addColorStop(0,    `rgba(255,244,214,${alpha.toFixed(3)})`);
      grad.addColorStop(0.55, `rgba(255,230,180,${(alpha * 0.45).toFixed(3)})`);
      grad.addColorStop(1,    'rgba(255,230,180,0)');

      ctx.fillStyle = grad;
      ctx.fillRect(-shaftW / 2, 0, shaftW, shaftH);
      ctx.restore();
    }
  }

  /* ─────────────────────────────────────────────────
     Witching Hour — rich cosmic nebula shimmer.

     A layered, organic particulate cloud drawn as a small set of
     soft radial washes, painted before the star/aurora layer above
     so it reads as depth sitting behind them. Blob positions are
     fixed (pre-allocated in the constructor); only radius and alpha
     fluctuate per frame via a shared sine driven by this._themeClock,
     so nothing here is re-created — just recomputed.
  ───────────────────────────────────────────────── */
  _drawNebula(ctx) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const t = this._themeClock;

    for (let i = 0; i < this.nebulaBlobs.length; i++) {
      const b = this.nebulaBlobs[i];

      const shimmer = Math.sin(b.phase + t * b.speed) * 0.5 + 0.5; // 0..1
      const radius  = b.baseRadius * (0.85 + shimmer * 0.3);
      const alpha   = 0.03 + shimmer * 0.045;
      const x = b.xFrac * w;
      const y = b.yFrac * h;

      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
      if (b.warm) {
        grad.addColorStop(0, `rgba(168,140,205,${alpha.toFixed(3)})`);
        grad.addColorStop(1, 'rgba(168,140,205,0)');
      } else {
        grad.addColorStop(0, `rgba(90,120,190,${alpha.toFixed(3)})`);
        grad.addColorStop(1, 'rgba(90,120,190,0)');
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  destroy() {
    window.removeEventListener('resize', this._onResize);
    this.canvas.remove();
    this.smoke = this.dust = this.fireflies = [];
    this.lightShafts = this.nebulaBlobs = [];
    this.aurora = null;
  }
}

/* ═══════════════════════════════════════════════════════════
   3b. Interactive layer — standalone pointer listener + tap ripple

   Deliberately its own small module-scope section, not folded into
   particles.js (which already owns the dust/organic canvases) and
   not wired through Lumi's own bindEvents(). It has exactly one
   job: track the pointer and expose it two ways —

     1. --mx / --my custom properties written to <body>, using the
        exact percentage-of-box pattern .gate-enter already uses in
        index.html, so any CSS-driven background wash can pick them
        up for free via calc() without any JS of its own.
     2. POINTER, a plain cached {mx, my} fraction (0..1) with no
        DOM/style reads, which LumiAmbience reads every frame above
        to drive the canvas parallax — reading getComputedStyle()
        60x/sec would work but costs a style recalc for no reason
        when the mousemove handler already has the number in hand.

   Bound once, ever (guarded by _parallaxBound) — like the easter-egg
   keydown listener below, it's a page-lifetime listener, not tied to
   Lumi's mount/destroy cycle.

   Skipped ENTIRELY on touch/coarse-pointer devices and whenever the
   person prefers reduced motion — no listener is attached at all in
   either case, not merely a no-op inside one. Coarse-pointer devices
   get a one-shot tap ripple instead (Lumi.spawnTapRipple), reusing
   the existing sparkle visual, anchored to the tap's page position.
═══════════════════════════════════════════════════════════ */
const POINTER = { mx: 0.5, my: 0.5 }; // 0..1 fractions, defaults to center

let _parallaxBound = false;
function bindParallaxPointer() {
  if (_parallaxBound) return;
  _parallaxBound = true;

  const reducedMotion   = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
  if (reducedMotion || isCoarsePointer) return; // no listener at all — nothing to disable later

  document.addEventListener('mousemove', (e) => {
    // Exact pattern already used by .gate-enter in index.html: a percentage
    // of the tracked box, written straight to CSS custom properties. Here
    // the "box" is the viewport itself, tracked on <body>.
    const r  = document.documentElement.getBoundingClientRect();
    const mx = clamp((e.clientX - r.left) / r.width  * 100, 0, 100);
    const my = clamp((e.clientY - r.top)  / r.height * 100, 0, 100);
    document.body.style.setProperty('--mx', mx.toFixed(2) + '%');
    document.body.style.setProperty('--my', my.toFixed(2) + '%');
    POINTER.mx = mx / 100;
    POINTER.my = my / 100;
  }, { passive: true });
}

let _tapRippleBound = false;
function bindTapRippleFallback(lumiInstance) {
  if (_tapRippleBound) return;

  const reducedMotion   = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
  if (reducedMotion || !isCoarsePointer) return; // desktop gets parallax instead, RM gets neither

  _tapRippleBound = true;
  window.addEventListener('touchstart', (e) => {
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    lumiInstance.spawnTapRipple(t.clientX, t.clientY);
  }, { passive: true });
}

/* ═══════════════════════════════════════════════════════════
   4. Lumi Class
═══════════════════════════════════════════════════════════ */
class Lumi {
  constructor() {
    /* ─ DOM refs ─ */
    this.el       = null; // #lumi container — position:fixed, moved via translate3d
    this.formEl   = null; // .lumi-form — three-forms scale layer (Seed/Bloom/Celestial)
    this.visualEl = null; // .lumi-visual — squash/stretch + flip layer

    /* ─ Narrative state machine (unchanged set of states, plus 'reading') ─ */
    this.state = 'idle';
    this._eyeState  = 'idle';
    this._moodEyeTimer = null;

    /* ─ Three forms — Seed (default) / Bloom (significant memory) /
       Celestial (reserved finale moment). See setForm(). ─ */
    this.form = 'seed';
    this._formRevertTimer = null;

    /* ─ Position (viewport px, top-left of the container box) ─ */
    this.x = window.innerWidth - 80;
    this.y = 40;
    this._prevX = this.x;
    this._prevY = this.y;
    this._halfW = 36;
    this._h     = 90;

    /* ─ Continuous drift — she "swims through air" rather than seeking a
       destination and stopping dead. A slowly-lerped wander CENTER (never
       snapped) plus a few layered, out-of-phase sine waves around it. No
       arrival/pause phases and nothing additive from an independent noise
       source riding on top of a separate seek-force, which together were
       the likely source of the old "glitchy" complaint — see the movement
       rewrite notes near _updateMovement(). ─ */
    this._wanderCenter   = { x: this.x, y: this.y };
    this._wanderTarget   = { x: this.x, y: this.y };
    this._forcedTarget   = null; // set by attractToCard() / the return-greeting hurry-over
    this._attracted      = false;
    this._nextWanderPick = 0;
    this._driftT         = Math.random() * Math.PI * 2;
    this._leaningToward  = null; // {x,y} of a significant card currently pulling focus, or null

    /* ─ Squash/stretch + facing ─ */
    this._facing      = -1; // spawns near the right edge, "facing" inward
    this._smoothSpeed = 0;
    this._exploring   = false; // guards the ~20s idle-exploration tier from overlapping itself

    /* ─ Guest / session flags ─ */
    this.isGuest  = false;
    this.isMoving = true;
    this.lastInteraction = Date.now();

    /* ─ Reading / letter-sitting pose is just another value of `state`
       (see setState + #lumi.lumi--reading in ghost.css) — no separate
       flag needed. ─ */

    /* ─ Music-synced glow pulse — fixed-interval, not real audio analysis
       (see .lumi--music-pulse in ghost.css) ─ */
    this._musicSyncOn = false;

    /* ─ Speech cooldowns (unchanged) ─ */
    this.lastReactiveSpeech = 0;
    this.lastAmbientSpeech  = 0;
    this.REACT_SPEECH_INTERVAL   = 3000;
    this.AMBIENT_SPEECH_INTERVAL = 30000;
    this.currentBubble = null;

    /* ─ Mouse tracking (gentle repulsion + startle-on-move) ─ */
    this.mouseX = window.innerWidth / 2;
    this.mouseY = window.innerHeight / 2;

    /* ─ Timers / RAF handles — tracked so destroy() cleans up everything ─ */
    this.raf                = null;
    this._idleWatchInterval = null;
    this._microTimer   = null;
    this._bubbleTimer  = null;
    this._zzzTimer     = null;
    this._zzzEl        = null;
    this._trailDots    = new Set();
    this._lastCardScan = 0;

    /* ─ Environment ─ */
    this.isMobile             = false; // resolved on mount()
    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.ambience = null;

    this.currentPage = this.detectPage();
  }

  detectPage() {
    const path = window.location.pathname;
    if (path.includes('gallery')) return 'gallery';
    if (path.includes('memory'))  return 'memory';
    if (path.includes('create'))  return 'create';
    if (path.includes('share'))   return 'share';
    return 'index';
  }

  /* ─────────────────────────────────────────────────
     Mount / lifecycle
  ───────────────────────────────────────────────── */
  mount(container) {
    if (!container) container = document.body;

    this.el = document.createElement('div');
    this.el.id = 'lumi';
    this.el.setAttribute('aria-label', 'Lumi, the memory keeper');
    this.el.innerHTML = `
      <div class="lumi-aura" aria-hidden="true"></div>
      <div class="lumi-form"><div class="lumi-visual">${LUMI_SVG}</div></div>
    `;
    container.appendChild(this.el);

    // Positioned from frame one via transform — left/top are never used,
    // so there's nothing for the roaming loop to fight with.
    this.el.style.transform = `translate3d(${Math.round(this.x)}px, ${Math.round(this.y)}px, 0)`;

    this.formEl   = this.el.querySelector('.lumi-form');
    this.visualEl = this.el.querySelector('.lumi-visual');
    this._halfW = (this.el.offsetWidth  || 72) / 2;
    this._h     = this.el.offsetHeight || 90;

    this.isMobile = window.matchMedia('(pointer: coarse)').matches;
    if (!this.prefersReducedMotion) {
      this.ambience = new LumiAmbience({ isMobile: this.isMobile, reducedMotion: false });
    }

    this.bindEvents();
    bindParallaxPointer();
    bindTapRippleFallback(this);
    this.setState('idle');

    // Continuous drift starts centered on the spawn point and picks its
    // first real wander target almost immediately — see _updateMovement().
    this._wanderCenter = { x: this.x, y: this.y };
    this._pickNewWanderTarget();

    this._startLoop();
    this.startIdleWatch();
    this._startMusicSyncWatch();

    return this;
  }

  /* Fixed-interval glow pulse while the ambient soundscape is playing —
     deliberately NOT real audio analysis, just a slow steady breathing
     glow so she reads as "moving with the music" without over-engineering
     tempo detection for a procedural ambience track that has no fixed
     beat to detect in the first place. */
  _startMusicSyncWatch() {
    if (this.prefersReducedMotion) return;
    clearInterval(this._musicSyncInterval);
    this._musicSyncInterval = setInterval(() => {
      const playing = !!audioCtrl?.isPlaying;
      if (playing !== this._musicSyncOn) {
        this._musicSyncOn = playing;
        this.el?.classList.toggle('lumi-music-pulse', playing);
      }
    }, 1000);
  }

  bindEvents() {
    document.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      this.lastInteraction = Date.now();

      if (this.state === 'sleeping') {
        this.setState('startled');
        setTimeout(() => this.setState('idle'), 600);
      }
    });

    // Clicks bubble up from the SVG — the only clickable descendant.
    // The #lumi container itself is pointer-events:none (see ghost.css),
    // so empty space around Lumi never blocks clicks on cards beneath it.
    this.el.addEventListener('click', () => {
      this.setState('excited');
      this.speak(this.pickLine(this.isGuest ? 'guest' : 'idle'));
      setTimeout(() => this.setState('idle'), 2000);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.isMoving = false;
      } else {
        this.isMoving = true;
        this.lastInteraction = Date.now();
        this.setState('greeting');
        // She notices, turns, and hurries over — a brief forced target
        // toward wherever the cursor last was (falling back to viewport
        // center), released back to normal wandering shortly after.
        this._forcedTarget = {
          x: clamp(this.mouseX - this._halfW, 60, window.innerWidth  - 60),
          y: clamp(this.mouseY - this._h / 2, 60, window.innerHeight - 60)
        };
        setTimeout(() => {
          this.setState('idle');
          this._forcedTarget = null;
          this._pickNewWanderTarget();
        }, 2000);
      }
    });

    window.addEventListener('resize', () => {
      this._halfW = (this.el.offsetWidth  || this._halfW * 2) / 2;
      this._h     = this.el.offsetHeight || this._h;
      this._wanderTarget.x = clamp(this._wanderTarget.x, 60, window.innerWidth  - 60);
      this._wanderTarget.y = clamp(this._wanderTarget.y, 60, window.innerHeight - 60);
      this._wanderCenter.x = clamp(this._wanderCenter.x, 60, window.innerWidth  - 60);
      this._wanderCenter.y = clamp(this._wanderCenter.y, 60, window.innerHeight - 60);
    });
  }

  /* ─────────────────────────────────────────────────
     State Machine (unchanged states, plus 'reading' for the
     letter-sitting pose) + public method
  ───────────────────────────────────────────────── */
  setState(newState) {
    if (!this.el) return;
    const prev = this.state;
    this.state = newState;

    const states = [
      'lumi--idle','lumi--curious','lumi--excited','lumi--melancholy',
      'lumi--watching','lumi--sleeping','lumi--greeting','lumi--startled',
      'lumi--guiding','lumi--guest','lumi--reading'
    ];
    this.el.classList.remove(...states);
    this.el.classList.add(`lumi--${newState}`);

    // Baseline eye-state follows the narrative state, unless a transient
    // mood reaction (see reactToMood) currently has priority.
    if (!this._moodEyeTimer) {
      this._setEyeState(STATE_EYE_STATE[newState] || 'idle');
    }

    switch (newState) {
      case 'excited':
        this.spawnSparkles();
        break;
      case 'melancholy':
        this.spawnTears();
        break;
      case 'sleeping':
        this.spawnZzz();
        break;
    }

    return prev;
  }

  /* ─────────────────────────────────────────────────
     Eye-state system — the entire emotion system lives here.
     Swaps the .lumi-eyes group's inner markup wholesale rather
     than deforming the existing shape with a CSS transform, so
     every emotion reads as its own distinct simple form.
  ───────────────────────────────────────────────── */
  _setEyeState(name) {
    if (!this.el || this._eyeState === name) return;
    const eyesEl = this.el.querySelector('.lumi-eyes');
    if (!eyesEl || !EYE_STATES[name]) return;
    eyesEl.innerHTML = EYE_STATES[name];
    this._eyeState = name;
  }

  /* Transient mood-driven eye reaction (hover/open a memory) — takes
     priority over the state-baseline mapping for `duration`ms, then
     falls back to whatever STATE_EYE_STATE says for the current state. */
  _reactEyesToMood(mood, duration = 2600) {
    const eyeState = MOOD_EYE_STATE[mood];
    if (!eyeState) return;
    this._setEyeState(eyeState);
    clearTimeout(this._moodEyeTimer);
    this._moodEyeTimer = setTimeout(() => {
      this._moodEyeTimer = null;
      this._setEyeState(STATE_EYE_STATE[this.state] || 'idle');
    }, duration);
  }

  /* ─────────────────────────────────────────────────
     Three forms — Seed (default) / Bloom (significant memory) /
     Celestial (reserved finale moment). Scale lives on .lumi-form,
     a wrapper kept separate from #lumi's translate3d AND from
     .lumi-visual's JS-driven squash/stretch scale, so none of the
     three transforms ever fight each other.
  ───────────────────────────────────────────────── */
  setForm(form, { holdMs } = {}) {
    if (!this.formEl || this.form === form) {
      if (holdMs) this._scheduleFormRevert(holdMs);
      return;
    }
    this.form = form;
    this.formEl.classList.remove('lumi-form--seed', 'lumi-form--bloom', 'lumi-form--celestial');
    this.formEl.classList.add(`lumi-form--${form}`);

    if (form !== 'seed') this._scheduleFormRevert(holdMs || 4000);
    else clearTimeout(this._formRevertTimer);
  }

  _scheduleFormRevert(holdMs) {
    clearTimeout(this._formRevertTimer);
    this._formRevertTimer = setTimeout(() => this.setForm('seed'), holdMs);
  }

  /* Bloom — a few seconds of ~2x scale + faint wings + extra sparkles,
     for an emotionally significant memory (see isSignificantMemory). */
  bloomMoment(holdMs = 4500) {
    this.setForm('bloom', { holdMs });
    this._setEyeState('awe');
    clearTimeout(this._moodEyeTimer);
    this._moodEyeTimer = setTimeout(() => {
      this._moodEyeTimer = null;
      this._setEyeState(STATE_EYE_STATE[this.state] || 'idle');
    }, Math.min(holdMs, 3000));
    this.spawnSparkles();
  }

  /* Celestial — reserved for a finale moment (e.g. a closing/music-video
     beat). Not autonomously triggered anywhere in this file; call it
     directly from whatever page owns that moment. Dissolves to starlight,
     bursts particles, then shrinks back to Seed on its own. */
  celestialMoment(holdMs = 6000) {
    this.setForm('celestial', { holdMs });
    this._setEyeState('awe');
    for (let i = 0; i < 3; i++) {
      setTimeout(() => this.spawnSparkles(), i * 350);
    }
  }

  /* ─────────────────────────────────────────────────
     Movement — continuous layered drift.

     Replaces the old destination + eased-lerp + a separately-added sine
     "wander overlay" + a hard arrive→pause→resume phase cycle. That combo
     is the likely source of the "glitchy/breaks" complaint: a discrete
     phase flip (paused → moving) restarts the ease from a dead stop every
     time, and the wander noise + cursor-repulsion force were both summed
     in on top of the seek step independently, so three unrelated forces
     could compound in the same frame right as she also snapped into a
     brand-new destination. (Worth confirming against whatever the actual
     symptom looked like — teleport, freeze, and stutter would each point
     slightly differently — but this rewrite removes all three suspects
     regardless.)

     Now there's no "arrival" and no paused phase at all: a wander CENTER
     eases toward a wander TARGET at a slow, constant rate that never
     resets to zero, and the rendered position is that center plus two
     out-of-phase sine waves (different frequency on x vs y) layered on
     top — she "swims through air." A new target is picked on a randomized
     timer, not on arrival, so direction changes are always mid-ease
     instead of a fresh start from a standstill. Passing a significant
     memory card (see isSignificantMemory) is weighted into target
     selection and adds a gentle forward lean.
  ───────────────────────────────────────────────── */
  _pickNewWanderTarget() {
    const margin = 80;
    const w = window.innerWidth, h = window.innerHeight;
    const cards = this.isMobile ? [] : Array.from(document.querySelectorAll('.memory-card'));
    const significant = cards.filter(c => isSignificantMemory({ mood: c.dataset.mood }));

    const pool = (significant.length && Math.random() < 0.4) ? significant
               : (cards.length && Math.random() < 0.25)      ? cards
               : null;

    if (pool) {
      const card = pool[Math.floor(Math.random() * pool.length)];
      const r = card.getBoundingClientRect();
      this._wanderTarget = {
        x: clamp(r.left + r.width / 2 - this._halfW, margin, w - margin),
        y: clamp(r.top - this._h * 0.9, margin, h - margin - 90)
      };
      this._leaningToward = (pool === significant) ? this._wanderTarget : null;
    } else {
      this._wanderTarget = {
        x: rand(margin, w - margin),
        y: rand(margin, h - margin - 90) // keep clear of the bottom control pill
      };
      this._leaningToward = null;
    }

    this._nextWanderPick = performance.now() + rand(7000, 14000);
    this._playIdleMicroBehavior();
  }

  _updateMovement(dt) {
    if (!this.el || !this.isMoving) return;
    if (this.state === 'sleeping' || this.state === 'reading') return; // she settles rather than drifts here

    if (!this._forcedTarget && performance.now() > this._nextWanderPick) {
      this._pickNewWanderTarget();
    }
    const target = this._forcedTarget || this._wanderTarget;

    // The wander center eases toward the target at a slow, constant rate —
    // this never resets to zero, so there's nothing to "restart" when the
    // target changes.
    const centerSpeed = (this.state === 'melancholy' ? 0.010 : 0.018) * (this._leaningToward ? 1.35 : 1);
    this._wanderCenter.x = lerp(this._wanderCenter.x, target.x, centerSpeed);
    this._wanderCenter.y = lerp(this._wanderCenter.y, target.y, centerSpeed);

    // Layered sine drift around the center: two frequencies per axis, out
    // of phase with each other and between axes, so the path never falls
    // into an obvious repeating loop.
    this._driftT += dt * 0.0011;
    const swimX = Math.sin(this._driftT * 1.3) * 14 + Math.sin(this._driftT * 0.47 + 1.4) * 6;
    const swimY = Math.cos(this._driftT * 1.05 + 0.6) * 10 + Math.sin(this._driftT * 0.31) * 5;

    let targetX = this._wanderCenter.x + swimX;
    let targetY = this._wanderCenter.y + swimY;

    // Gentle cursor repulsion — desktop only (no persistent pointer on
    // touch). Folded into the eased position below rather than added as
    // an instantaneous per-frame force, so it can't spike the same frame
    // a new target is picked.
    if (!this.isMobile) {
      const cx = this.x + this._halfW, cy = this.y + this._h / 2;
      const rdx = cx - this.mouseX, rdy = cy - this.mouseY;
      const rdist = Math.hypot(rdx, rdy);
      if (rdist < 110 && rdist > 0.01) {
        const force = (110 - rdist) / 110;
        targetX += (rdx / rdist) * force * 26;
        targetY += (rdy / rdist) * force * 20;
      }
    }

    const prevX = this.x, prevY = this.y;
    this.x = lerp(this.x, targetX, 0.05);
    this.y = lerp(this.y, targetY, 0.05);

    this.el.style.transform = `translate3d(${Math.round(this.x)}px, ${Math.round(this.y)}px, 0)`;
    this.el.classList.toggle('lumi-leaning', !!this._leaningToward);

    // Leave a light trail while excited and moving with some speed.
    const stepX = this.x - prevX, stepY = this.y - prevY;
    if (this.state === 'excited' && (Math.abs(stepX) + Math.abs(stepY)) > 1.1) {
      this.spawnTrailDot(this.x + this._halfW, this.y + this._h / 2);
    }
  }

  /* GPU-friendly squash/stretch + horizontal flip. Applied to a wrapper
     element that's separate from the container's translate3d AND separate
     from the SVG's own state-driven float/tilt/spin animations, so none
     of these transforms fight each other. */
  _updateVisualTransform(dt) {
    if (!this.visualEl) return;

    const vx = this.x - this._prevX;
    const vy = this.y - this._prevY;
    this._prevX = this.x;
    this._prevY = this.y;

    const speed = Math.hypot(vx, vy) / Math.max(dt, 1) * 16;
    this._smoothSpeed = lerp(this._smoothSpeed, Math.min(speed, 12), 0.15);

    if (vx > 0.4) this._facing = 1;
    else if (vx < -0.4) this._facing = -1;
    // else: keep last facing — a small deadzone avoids flicker near-idle

    if (this.prefersReducedMotion) {
      this.visualEl.style.transform = `scaleX(${this._facing})`;
      return;
    }

    const stretch = clamp(this._smoothSpeed / 12, 0, 1);
    const scaleX  = this._facing * (1 - stretch * 0.06);
    const scaleY  = 1 + stretch * 0.10;
    this.visualEl.style.transform = `scale(${scaleX.toFixed(3)}, ${scaleY.toFixed(3)})`;
  }

  /* ─────────────────────────────────────────────────
     Weighted idle micro-behaviors — layered on top of the
     'idle' state: float (default) / tilt / shimmer / look
     around / occasional brief sleep. Purely decorative, so
     they're skipped for reduced-motion and only ever fire
     while the narrative state machine is in 'idle'.
  ───────────────────────────────────────────────── */
  _playIdleMicroBehavior() {
    if (this.state !== 'idle' || !this.el || this.prefersReducedMotion) return;

    const bodyEl = this.el.querySelector('.lumi-body');
    const eyesEl = this.el.querySelector('.lumi-eyes');
    if (!bodyEl) return;

    clearTimeout(this._microTimer);
    bodyEl.classList.remove('lumi-micro--tilt', 'lumi-micro--shimmer', 'lumi-micro--sleep-brief');
    eyesEl?.classList.remove('lumi-micro--look');

    const roll = Math.random();
    if (roll < 0.40) return;                          // 40% — just keep floating
    if (roll < 0.60) {                                 // 20% — tilt
      bodyEl.classList.add('lumi-micro--tilt');
      this._microTimer = setTimeout(() => bodyEl.classList.remove('lumi-micro--tilt'), 2300);
    } else if (roll < 0.80) {                          // 20% — shimmer
      bodyEl.classList.add('lumi-micro--shimmer');
      this._microTimer = setTimeout(() => bodyEl.classList.remove('lumi-micro--shimmer'), 1900);
    } else if (roll < 0.95) {                          // 15% — look around
      eyesEl?.classList.add('lumi-micro--look');
      this._microTimer = setTimeout(() => eyesEl?.classList.remove('lumi-micro--look'), 1700);
    } else {                                           // 5% — brief doze
      bodyEl.classList.add('lumi-micro--sleep-brief');
      this.spawnZzz(true);
      this._microTimer = setTimeout(() => bodyEl.classList.remove('lumi-micro--sleep-brief'), 2900);
    }
  }

  /* ─────────────────────────────────────────────────
     Ambient card interaction — illumination, sway, pulse.
     Throttled to ~5x/sec and reads every rect before writing
     any class, so it never interleaves layout reads and
     writes (no forced-reflow thrashing).
  ───────────────────────────────────────────────── */
  _scanNearbyCards() {
    const cards = document.querySelectorAll('.memory-card');
    if (!cards.length) return;

    const cx = this.x + this._halfW, cy = this.y + this._h / 2;
    const GLOW_R = 260, SWAY_R = 220, PULSE_R = 150;

    const measured = [];
    cards.forEach(card => {
      const r = card.getBoundingClientRect();
      const dx = (r.left + r.width / 2) - cx;
      const dy = (r.top  + r.height / 2) - cy;
      measured.push({ card, dist: Math.hypot(dx, dy) });
    });

    const isDrifting = this._smoothSpeed > 1.5;  // replaces the old roamPhase === 'moving'
    const isLingering = this._smoothSpeed < 0.6; // replaces the old roamPhase === 'paused'

    measured.forEach(({ card, dist }) => {
      card.classList.toggle('card-lumi-glow', dist < GLOW_R);

      if (dist < SWAY_R && isDrifting && !card.classList.contains('card-lumi-sway')) {
        card.classList.add('card-lumi-sway');
        setTimeout(() => card.classList.remove('card-lumi-sway'), 900);
      }

      if (dist < PULSE_R && isLingering && !card.classList.contains('card-lumi-pulse')) {
        card.classList.add('card-lumi-pulse');
        setTimeout(() => card.classList.remove('card-lumi-pulse'), 1600);

        // Settling right next to a significant memory while roaming —
        // the autonomous half of "leans/reaches toward" a meaningful card.
        if (isSignificantMemory({ mood: card.dataset.mood }) && this.form === 'seed') {
          this.bloomMoment();
        }
      }
    });
  }

  /* ─────────────────────────────────────────────────
     Main loop — a single rAF drives movement, the visual
     transform, the ambient FX canvas, and throttled card
     scanning, so everything ticks off one clock.
  ───────────────────────────────────────────────── */
  _startLoop() {
    if (this.raf) return; // guard against double-start
    let last = performance.now();

    const tick = (now) => {
      this.raf = requestAnimationFrame(tick);
      if (document.hidden) { last = now; return; }

      const dt = Math.min(now - last, 50);
      last = now;

      this._updateMovement(dt);
      this._updateVisualTransform(dt);

      if (this.ambience) {
        this.ambience.update(dt, this.x + this._halfW, this.y + this._h / 2, this._smoothSpeed > 0.6);
        this.ambience.draw();
      }

      if (now - this._lastCardScan > 200) {
        this._lastCardScan = now;
        this._scanNearbyCards();
      }
    };

    this.raf = requestAnimationFrame(tick);
  }

  // Public alias kept for any external caller that used the old name.
  startMovement() { this._startLoop(); }

  /* ─────────────────────────────────────────────────
     Idle / Sleep Watch
  ───────────────────────────────────────────────── */
  startIdleWatch() {
    if (this._idleWatchInterval) return; // guard against double-start
    this._idleWatchInterval = setInterval(() => {
      const idleMs = Date.now() - this.lastInteraction;
      if (idleMs > 3 * 60 * 1000 && this.state !== 'sleeping') {
        this.setState('sleeping');
        this.speak(this.pickLine('idle'), 4000, 'ambient');
      }
    }, 30 * 1000);

    // A lighter, earlier tier, distinct from the long sleep watch above:
    // after ~20s of nothing happening she doesn't just keep quietly
    // drifting — she notices and goes looking for something herself.
    // Checked more often than the sleep watch so it lands close to the
    // 20s mark rather than up to 30s late.
    if (this._explorationInterval) return;
    this._explorationInterval = setInterval(() => {
      const idleMs = Date.now() - this.lastInteraction;
      const eligible = idleMs > 20 * 1000 && idleMs < 3 * 60 * 1000
        && !this._exploring
        && !['sleeping', 'reading', 'excited', 'startled'].includes(this.state);
      if (eligible) this._exploreOnOwn();
    }, 4000);
  }

  /* She explores on her own: looks around, spins, then drifts toward a
     nearby card (weighted toward a significant one, same as any other
     wander pick) as if she went looking for something to visit — and
     occasionally says something while she's at it. */
  _exploreOnOwn() {
    if (!this.el || this.prefersReducedMotion) return;
    this._exploring = true;

    const bodyEl = this.el.querySelector('.lumi-body');
    const eyesEl = this.el.querySelector('.lumi-eyes');

    eyesEl?.classList.add('lumi-micro--look');
    clearTimeout(this._explorationTimer);
    this._explorationTimer = setTimeout(() => {
      eyesEl?.classList.remove('lumi-micro--look');
      bodyEl?.classList.add('lumi-micro--spin');
      setTimeout(() => bodyEl?.classList.remove('lumi-micro--spin'), 900);

      this._pickNewWanderTarget(); // naturally leans if she lands on a significant card
      if (Math.random() < 0.4) this.speak(this.pickLine('idle'), 3500, 'ambient');

      this._exploring = false;
    }, 1700);
  }

  /* ─────────────────────────────────────────────────
     Card attraction (called by gallery.js on card hover)
  ───────────────────────────────────────────────── */
  attractToCard(cardEl) {
    if (!cardEl || !this.el) return;
    const rect = cardEl.getBoundingClientRect();
    const margin = 40;

    this._forcedTarget = {
      x: clamp(rect.left + rect.width / 2 - this._halfW, margin, window.innerWidth  - margin),
      y: clamp(rect.top - this._h * 0.85, margin, window.innerHeight - margin)
    };
    this._attracted = true;
    this._leaningToward = this._forcedTarget;
  }

  resetBase() {
    this._attracted = false;
    this._forcedTarget = null;
    this._leaningToward = null;
    this._pickNewWanderTarget();
  }

  /* ─────────────────────────────────────────────────
     Speech Bubble — a child of #lumi (see ghost.css), so it
     always tracks Lumi's position with zero coordinate math,
     even while she's actively roaming mid-sentence.
  ───────────────────────────────────────────────── */
  speak(text, duration = 4000, type = 'reactive') {
    if (!text || !this.el) return;

    const now = Date.now();
    if (type === 'ambient') {
      if (now - this.lastAmbientSpeech < this.AMBIENT_SPEECH_INTERVAL) return;
      this.lastAmbientSpeech = now;
    } else {
      if (now - this.lastReactiveSpeech < this.REACT_SPEECH_INTERVAL) return;
      this.lastReactiveSpeech = now;
    }

    this.clearBubble();

    const bubble = document.createElement('div');
    bubble.className = 'speech-bubble bubble--enter';
    bubble.innerHTML = `<p>${text}</p>`;
    this.el.appendChild(bubble);
    this.currentBubble = bubble;

    clearTimeout(this._bubbleTimer);
    this._bubbleTimer = setTimeout(() => {
      if (bubble.parentNode) {
        bubble.classList.remove('bubble--enter');
        bubble.classList.add('bubble--exit');
        setTimeout(() => bubble.remove(), 500);
      }
      if (this.currentBubble === bubble) this.currentBubble = null;
    }, duration);
  }

  clearBubble() {
    if (this.currentBubble) {
      this.currentBubble.remove();
      this.currentBubble = null;
    }
  }

  pickLine(pool) {
    const lines = SPEECH[pool] || SPEECH.idle;
    return lines[Math.floor(Math.random() * lines.length)];
  }

  reactToMood(mood) {
    switch (mood) {
      case 'peaceful':   this.setState('curious');    this.speak(this.pickLine('happy'));      break;
      case 'hopeful':    this.setState('excited');    this.speak(this.pickLine('hopeful'));    break;
      case 'melancholy': this.setState('melancholy'); this.speak(this.pickLine('melancholy')); break;
      case 'dark':       this.setState('melancholy'); this.speak(this.pickLine('dark'));       break;
      case 'passionate': this.setState('excited');    this.speak(this.pickLine('happy'));      break;
      default:            this.setState('curious');    this.speak(this.pickLine('idle'));       break;
    }
    // Finer-grained than the narrative-state routing above alone would
    // give (e.g. "hopeful" reads warmer than "passionate" even though
    // both currently map to the 'excited' state) — see MOOD_EYE_STATE.
    this._reactEyesToMood(mood, 3200);
    if (isSignificantMemory({ mood })) this.bloomMoment();
  }

  /* ─────────────────────────────────────────────────
     Particle bursts. Sparkles / tears / zzz are all children
     of #lumi, positioned in the container's own local space —
     they automatically travel with Lumi for as long as they're
     alive. Trail dots are the one exception: they mark a spot
     Lumi is leaving behind, so they're pinned to the page at
     the moment they're emitted.
  ───────────────────────────────────────────────── */
  /* Star trail/sparkles by default, with rare petal or light-butterfly
     variants — weighted random, not evenly split (see the shape rules
     in ghost.css: .lumi-trail-particle--star/--petal/--butterfly). */
  _pickParticleShapeClass(baseClass) {
    const roll = Math.random();
    const variant = roll < 0.72 ? 'star' : roll < 0.92 ? 'petal' : 'butterfly';
    return `${baseClass} ${baseClass}--${variant}`;
  }

  spawnSparkles() {
    if (!this.el) return;
    const colors = ['rgba(255, 232, 163, 0.9)', 'rgba(255, 243, 184, 0.85)', 'rgba(223, 246, 255, 0.8)'];
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        if (!this.el) return;
        const dot = document.createElement('div');
        dot.className = this._pickParticleShapeClass('lumi-sparkle');
        const angle = (i / 8) * Math.PI * 2;
        const r = rand(46, 72);
        dot.style.cssText = `
          left: 50%; top: 46%;
          transform: translate(-50%, -50%) translate(${(Math.cos(angle) * r).toFixed(1)}px, ${(Math.sin(angle) * r).toFixed(1)}px);
          background: ${colors[i % colors.length]};
          animation-delay: ${i * 80}ms;
        `;
        this.el.appendChild(dot);
        setTimeout(() => dot.remove(), 1500);
      }, i * 60);
    }
  }

  spawnTears() {
    if (!this.el) return;
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        if (!this.el) return;
        const tear = document.createElement('div');
        tear.className = 'lumi-tear';
        tear.style.cssText = `
          left: ${44 + i * 8}%;
          top: 58%;
          animation-delay: ${i * 0.3}s;
        `;
        this.el.appendChild(tear);
        setTimeout(() => tear.remove(), 1500);
      }, i * 400);
    }
  }

  spawnZzz(brief = false) {
    if (!this.el) return;
    const zzz = document.createElement('div');
    zzz.className = 'lumi-zzz';
    zzz.innerHTML = '<span>z</span><span>z</span><span>z</span>';
    zzz.style.cssText = `right: 6px; top: 2px;`;
    this.el.appendChild(zzz);
    this._zzzEl = zzz;

    const removeOnWake = () => {
      if (this.state !== 'sleeping' && zzz.parentNode) {
        zzz.remove();
        if (this._zzzEl === zzz) this._zzzEl = null;
      }
    };

    clearTimeout(this._zzzTimer);
    this._zzzTimer = setTimeout(removeOnWake, brief ? 2600 : 10000);
  }

  spawnTrailDot(x, y) {
    const colors = ['rgba(255, 232, 163, 0.75)', 'rgba(255, 243, 184, 0.7)', 'rgba(223, 246, 255, 0.6)'];
    const dot = document.createElement('div');
    dot.className = this._pickParticleShapeClass('lumi-trail-particle');
    const size = rand(4, 8);
    dot.style.cssText = `
      left: ${x}px; top: ${y}px;
      width: ${size.toFixed(1)}px; height: ${size.toFixed(1)}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      animation-duration: ${rand(0.8, 1.5).toFixed(2)}s;
    `;
    document.body.appendChild(dot);
    this._trailDots.add(dot);
    setTimeout(() => { dot.remove(); this._trailDots.delete(dot); }, 1600);
  }

  /* ─────────────────────────────────────────────────
     Tap ripple — the touch/coarse-pointer equivalent of the desktop
     parallax feel (see bindTapRippleFallback above). Reuses the exact
     .lumi-sparkle visual and color palette from spawnSparkles(), but
     anchored to the tap's own page coordinates rather than Lumi's
     local center — like spawnTrailDot, it's appended straight to
     document.body so it can appear anywhere the person taps, not just
     near Lumi. One-shot: a single simultaneous burst per tap, no
     staggered emission, no looping state to clean up beyond the
     per-dot removal timeout already used elsewhere in this class.
  ───────────────────────────────────────────────── */
  spawnTapRipple(x, y) {
    if (this.prefersReducedMotion) return; // belt-and-suspenders: bindTapRippleFallback already gates this
    const colors = ['rgba(255, 232, 163, 0.9)', 'rgba(255, 243, 184, 0.85)', 'rgba(223, 246, 255, 0.8)'];
    const count = 6;
    for (let i = 0; i < count; i++) {
      const dot = document.createElement('div');
      dot.className = this._pickParticleShapeClass('lumi-sparkle');
      const angle = (i / count) * Math.PI * 2;
      const r = rand(26, 44);
      dot.style.cssText = `
        left: ${x}px; top: ${y}px;
        transform: translate(-50%, -50%) translate(${(Math.cos(angle) * r).toFixed(1)}px, ${(Math.sin(angle) * r).toFixed(1)}px);
        background: ${colors[i % colors.length]};
      `;
      document.body.appendChild(dot);
      setTimeout(() => dot.remove(), 900);
    }
  }

  /* ─────────────────────────────────────────────────
     Destroy — tears down every timer, RAF, canvas and DOM
     node Lumi owns, so repeated mount()/destroy() cycles
     (e.g. SPA-style page transitions) never leak.
  ───────────────────────────────────────────────── */
  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this._idleWatchInterval) clearInterval(this._idleWatchInterval);
    if (this._explorationInterval) clearInterval(this._explorationInterval);
    if (this._musicSyncInterval) clearInterval(this._musicSyncInterval);
    clearTimeout(this._microTimer);
    clearTimeout(this._bubbleTimer);
    clearTimeout(this._zzzTimer);
    clearTimeout(this._formRevertTimer);
    clearTimeout(this._moodEyeTimer);
    clearTimeout(this._explorationTimer);

    this.ambience?.destroy();
    this.ambience = null;

    this._trailDots.forEach(d => d.remove());
    this._trailDots.clear();

    if (this.el) this.el.remove();
    this.el = null;
    this.visualEl = null;
    this.clearBubble();
    this._zzzEl = null;
  }
}

/* ═══════════════════════════════════════════════════════════
   5. Easter eggs (unchanged)
═══════════════════════════════════════════════════════════ */
function watchForEasterEggs(lumi) {
  let typedBuffer = '';
  document.addEventListener('keydown', (e) => {
    typedBuffer += e.key.toLowerCase();
    if (typedBuffer.length > 10) typedBuffer = typedBuffer.slice(-10);

    if (typedBuffer.endsWith('lumi')) {
      lumi.setState('excited');
      lumi.speak("You said my name! ✦");
      for (let i = 0; i < 3; i++) {
        setTimeout(() => lumi.spawnSparkles(), i * 300);
      }
      setTimeout(() => lumi.setState('idle'), 3000);
    }

    if (typedBuffer.endsWith('goodbye')) {
      lumi.setState('melancholy');
      lumi.spawnTears();
      lumi.speak("Goodbye? Don't go...");
      setTimeout(() => lumi.setState('idle'), 5000);
    }
  });
}

/* ═══════════════════════════════════════════════════════════
   6. Public exports — surface unchanged from the original module
═══════════════════════════════════════════════════════════ */
export const lumi = new Lumi();

export function initLumi(options = {}) {
  const {
    container = document.body,
    isGuest = false,
    isReturn = false,
    theme = null
  } = options;

  lumi.isGuest = isGuest;
  lumi.mount(container);

  if (isGuest) {
    lumi.setState('guest');
    setTimeout(() => lumi.speak(lumi.pickLine('guest')), 1500);
  } else if (isReturn) {
    lumi.setState('greeting');
    const greeting = getLumiGreeting(
      theme || document.body.getAttribute('data-theme') || 'afternoon',
      true
    );
    setTimeout(() => lumi.speak(greeting), 1200);
    setTimeout(() => lumi.setState('idle'), 3000);
  } else {
    lumi.setState('greeting');
    const greeting = getLumiGreeting(
      theme || document.body.getAttribute('data-theme') || 'afternoon',
      false
    );
    setTimeout(() => lumi.speak(greeting), 1800);
    setTimeout(() => lumi.setState('idle'), 3500);
  }

  watchForEasterEggs(lumi);

  return lumi;
}

export { SPEECH };