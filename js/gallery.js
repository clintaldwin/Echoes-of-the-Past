/* ═══════════════════════════════════════════════════════════
   ECHOES — gallery.js
   Floating memory card engine. Store-agnostic: receives a
   store instance via initGallery(). Works with DriveStore.
═══════════════════════════════════════════════════════════ */

import { lumi } from './lumi.js';

/* ─── Constants ─── */
const CARD_ENTER_DURATION = 800;
const BUBBLE_APPEAR_DELAY = 300;
const SAMPLE_SIZE         = 7; // fixed random sample size, replaces old MAX_CARDS_VISIBLE slice

/* ─── State ─── */
const cardPool   = [];
const memoryData = [];   // all loaded Memory objects
let   _store       = null;
let   focusedCard  = null;
let   modalOpen    = false;
let   galleryRAF   = null;
let   onOpenCallback = null;
let   stageEl      = null;
let   lastTimestamp = 0;
let   activePreviewVideo = null; // ensures only one card preview plays at a time

/* ═══════════════════════════════════════════════════════════
   Background Audio — local template + jukebox engine
   Ambient music bed for the gallery. Fully decoupled from the
   overlay's own per-memory player (#overlayAudio) — this owns a
   separate Audio() instance and never touches that element.

   Local-only by design: no Drive fetch/stream in this path (that
   was in the original spec but got dropped — Drive's streamUrl()
   round-trip was adding noticeable latency for background music,
   so this reads straight from local files instead).
═══════════════════════════════════════════════════════════ */

/* ─── Local audio template ───
   Bundled with the app, not pulled from Drive. Shaped like the
   Memory objects used elsewhere (id/type/mood/fileURL) plus an
   `artist` field. This is metadata only — drop the actual MP3s
   into assets/audio/ yourself; nothing here fetches, streams, or
   embeds any audio, it just points a local <audio> element at a
   path you provide. */
const LOCAL_AUDIO_TEMPLATE = [
  { id: 'local-perfect',             type: 'audio', source: 'local', title: 'Perfect',            artist: 'Ed Sheeran', mood: 'hopeful',    fileURL: 'assets/audio/perfect.mp3',             driveId: null },
  { id: 'local-photograph',          type: 'audio', source: 'local', title: 'Photograph',          artist: 'Ed Sheeran', mood: 'melancholy', fileURL: 'assets/audio/photograph.mp3',          driveId: null },
  { id: 'local-supermarket-flowers', type: 'audio', source: 'local', title: 'Supermarket Flowers', artist: 'Ed Sheeran', mood: 'dark',        fileURL: 'assets/audio/supermarket_flowers.mp3', driveId: null },
  { id: 'local-tenerife-sea',        type: 'audio', source: 'local', title: 'Tenerife Sea',        artist: 'Ed Sheeran', mood: 'peaceful',   fileURL: 'assets/audio/tenerife_sea.mp3',        driveId: null },
];

/* ─── Shuffle pool ───
   Local-only right now (see note above), but kept as its own
   function so pool assembly has exactly one seam — nothing in the
   jukebox engine below cares where entries come from. */
function buildBackgroundAudioPool() {
  return [...LOCAL_AUDIO_TEMPLATE];
}

/* ─── Jukebox state ─── */
let backgroundAudioPool = [];
let bgAudioEl           = null;
let bgJukeboxEnabled    = false; // user's Sound-button preference
let bgDucked            = false; // true while a video/audio overlay owns focus
let bgFadeRAF           = null;
let bgLastTrackId       = null;

const BG_TARGET_VOLUME = 0.45; // ambient bed, sits under everything else
const BG_FADE_MS       = 600;

/* ─── Boot ───
   Builds the pool and creates the dedicated background <audio>
   element. Call once, on gallery boot. Does NOT start playback —
   that's driven by setJukeboxEnabled() so it always stays in sync
   with the Sound toggle, including whatever state it boots in. */
export function initBackgroundJukebox() {
  backgroundAudioPool = buildBackgroundAudioPool();

  bgAudioEl = new Audio();
  bgAudioEl.loop   = false;
  bgAudioEl.volume = 0;
  bgAudioEl.addEventListener('ended', () => {
    if (bgJukeboxEnabled) playRandomBackgroundTrack();
  });
}

function pickRandomTrack() {
  if (backgroundAudioPool.length === 0) return null;
  if (backgroundAudioPool.length === 1) return backgroundAudioPool[0];

  let track;
  do {
    track = backgroundAudioPool[Math.floor(Math.random() * backgroundAudioPool.length)];
  } while (track.id === bgLastTrackId); // avoid an immediate repeat
  return track;
}

function playRandomBackgroundTrack() {
  const track = pickRandomTrack();
  if (!track || !bgAudioEl) return;

  bgLastTrackId = track.id;
  bgAudioEl.src = track.fileURL; // local path, served straight from the project folder
  bgAudioEl.currentTime = 0;
  bgAudioEl.play().catch(() => {
    // Autoplay blocked until a user gesture. In practice the Sound
    // button click that triggers setJukeboxEnabled(true) *is* that
    // gesture, so this mostly guards programmatic/auto-resume calls.
  });
}

/* ─── Toggle from the ambient Sound button ─── */
export function setJukeboxEnabled(on) {
  bgJukeboxEnabled = on;
  if (!bgAudioEl) return;

  if (on) {
    if (bgDucked) return; // overlay currently owns focus — stay silent until it releases
    if (!bgAudioEl.src) playRandomBackgroundTrack();
    else bgAudioEl.play().catch(() => {});
    fadeBackgroundVolume(BG_TARGET_VOLUME);
  } else {
    fadeBackgroundVolume(0, () => bgAudioEl?.pause());
  }
}

/* ─── #playlistBtn: instantly abort + shuffle to a fresh track ─── */
export function nextBackgroundTrack() {
  if (!bgAudioEl) return;
  bgAudioEl.pause();            // force-abort — no fade-out, it's an explicit skip
  bgAudioEl.currentTime = 0;
  playRandomBackgroundTrack();
  if (!bgDucked) fadeBackgroundVolume(BG_TARGET_VOLUME); // guards against skipping mid-duck
}

/* ─── Audio focus coordinator hooks ───
   Called from openOverlay() / closeOverlay() (and navigateOverlay())
   in gallery.html. bgDucked is tracked separately from bgJukeboxEnabled
   so the two can't fight each other — e.g. flipping Sound on while a
   video is open shouldn't start the jukebox under it. */
export function duckBackgroundJukebox() {
  if (!bgAudioEl) return;
  bgDucked = true;
  fadeBackgroundVolume(0, () => bgAudioEl?.pause());
}

export function restoreBackgroundJukebox() {
  bgDucked = false;
  if (!bgAudioEl || !bgJukeboxEnabled) return; // only resume if ambient sound is actually on
  bgAudioEl.play().catch(() => {});
  fadeBackgroundVolume(BG_TARGET_VOLUME);
}

function fadeBackgroundVolume(target, onDone) {
  if (!bgAudioEl) return;
  if (bgFadeRAF) cancelAnimationFrame(bgFadeRAF);

  const start     = bgAudioEl.volume;
  const startTime = performance.now();

  function step(now) {
    if (!bgAudioEl) { bgFadeRAF = null; return; }
    const p = Math.min((now - startTime) / BG_FADE_MS, 1);
    bgAudioEl.volume = start + (target - start) * p;
    if (p < 1) {
      bgFadeRAF = requestAnimationFrame(step);
    } else {
      bgFadeRAF = null;
      onDone?.();
    }
  }
  bgFadeRAF = requestAnimationFrame(step);
}

/* ─── Viewport helpers ─── */
const vw = () => window.innerWidth;
const vh = () => window.innerHeight;

/* ═══════════════════════════════════════════════════════════
   Card HTML builders
═══════════════════════════════════════════════════════════ */

function buildCardEl(memory, idx) {
  const el = document.createElement('div');
  el.className = `memory-card memory-card--${memory.type || 'photo'}`;
  el.dataset.id   = memory.id;
  el.dataset.mood = memory.mood || 'peaceful';
  el.dataset.idx  = idx;

  const rot = (Math.random() - 0.5) * 8;
  el.style.setProperty('--card-rot', `${rot}deg`);
  el.style.setProperty('--card-tint', '#FBF5E6');

  el.innerHTML = buildCardHTML(memory);
  return el;
}

function buildCardHTML(memory) {
  const title     = escHtml(memory.title || 'Untitled');
  const date      = memory.dateStr || formatDate(memory.date);
  const moodDot   = `<div class="card-mood card-mood--${memory.mood || 'peaceful'}"></div>`;
  // Use thumbnail for cards, fileURL for full view
  const thumbSrc  = memory.thumbnail || memory.fileURL || '';

  switch (memory.type) {

    case 'photo':
      return `
        <div class="card-inner paper-texture">
          ${moodDot}
          ${thumbSrc
            ? `<img class="card-photo__image" src="${thumbSrc}" alt="${title}" loading="lazy"
                    onerror="this.src='${escHtml(memory.fileURL||'')}';">`
            : `<div class="card-photo__placeholder">📷</div>`}
          <div class="card-photo__tint"></div>
          <div class="card-label">
            <div class="card-label__title">${title}</div>
            <div class="card-label__date text-mono">${date}</div>
          </div>
        </div>`;

    case 'video': {
      // Stream src is loaded lazily on hover (see wireVideoPreview), so we
      // only stash it in data-src for now — src stays empty until needed.
      const streamSrc = _store?.streamUrl ? (_store.streamUrl(memory.driveId) || '') : '';
      return `
        <div class="card-inner">
          ${moodDot}
          <video class="card-video__thumbnail" data-src="${escHtml(streamSrc)}"
                 ${thumbSrc ? `poster="${thumbSrc}"` : ''}
                 muted loop playsinline preload="none"></video>
          <div class="card-video__overlay"></div>
          <div class="card-video__play"></div>
          <div class="card-label" style="position:absolute;bottom:14px;left:16px;right:16px;z-index:3">
            <div class="card-label__title" style="color:#F0E8D5">${title}</div>
            <div class="card-label__date text-mono" style="color:rgba(240,232,213,0.5)">${date}</div>
          </div>
        </div>`;
    }

    case 'audio':
      return `
        <div class="card-inner">
          ${moodDot}
          <div class="card-audio__label text-mono">${title}</div>
          <div class="card-audio__waveform">${buildWaveform()}</div>
          <div class="card-audio__controls">
            <div class="card-audio__play"></div>
            <div class="card-audio__duration text-mono">♪</div>
          </div>
          <div class="card-label__date text-mono" style="margin-top:6px">${date}</div>
        </div>`;

    default: // photo fallback
      return `
        <div class="card-inner paper-texture">
          ${moodDot}
          ${thumbSrc
            ? `<img class="card-photo__image" src="${thumbSrc}" alt="${title}" loading="lazy">`
            : `<div class="card-photo__placeholder">📷</div>`}
          <div class="card-photo__tint"></div>
          <div class="card-label">
            <div class="card-label__title">${title}</div>
            <div class="card-label__date text-mono">${date}</div>
          </div>
        </div>`;
  }
}

function buildWaveform(bars = 20) {
  return Array.from({ length: bars }, (_, i) => {
    const h = 8 + Math.random() * 28;
    return `<div class="card-audio__bar" style="height:${h}px;animation-delay:${i * 0.06}s"></div>`;
  }).join('');
}

/* ═══════════════════════════════════════════════════════════
   Physics
═══════════════════════════════════════════════════════════ */
class CardPhysics {
  constructor(memory, index) {
    this.memory = memory;
    this.el     = null;
    this.index  = index;

    const edge = Math.floor(Math.random() * 4);
    switch (edge) {
      case 0: this.x = Math.random() * vw(); this.y = -300; break;
      case 1: this.x = vw() + 300; this.y = Math.random() * vh(); break;
      case 2: this.x = Math.random() * vw(); this.y = vh() + 300; break;
      default: this.x = -300; this.y = Math.random() * vh(); break;
    }

    this.tx = vw() * 0.1 + Math.random() * vw() * 0.8;
    this.ty = vh() * 0.1 + Math.random() * vh() * 0.8;

    this.phase  = Math.random() * Math.PI * 2;
    this.speed  = 0.15 + Math.random() * 0.3;
    this.depth  = 0.6  + Math.random() * 0.8;
    this.t      = this.phase;

    this.pathCX = this.tx;
    this.pathCY = this.ty;
    this.radX   = 60 + Math.random() * 80;
    this.radY   = 40 + Math.random() * 60;
    this.freqX  = 0.7 + Math.random() * 0.6;
    this.freqY  = 0.9 + Math.random() * 0.5;

    this.isHovered  = false;
    this.isEntering = true;
    this.enterT     = 0;
    this.opacity    = 0;
    this._lastZ     = null;

    if      (this.depth > 1.2)  { this.depthClass = 'memory-card--near'; this.blurAmount = 0;   }
    else if (this.depth > 0.85) { this.depthClass = 'memory-card--mid';  this.blurAmount = 0.5; }
    else                         { this.depthClass = 'memory-card--far';  this.blurAmount = 1.5; }
  }

  update(dt) {
    if (this.isHovered || modalOpen) return;

    if (this.isEntering) {
      this.enterT += dt * 0.001;
      const p     = Math.min(this.enterT / (CARD_ENTER_DURATION * 0.001), 1);
      const eased = 1 - Math.pow(1 - p, 3);
      // dt-normalized step: same 10%-per-16.67ms chase regardless of the
      // actual frame interval, so the entrance looks the same whether
      // frames are landing at a steady 60fps or getting squeezed by
      // everything else drawing on this page.
      const k = 1 - Math.pow(1 - eased * 0.1, dt / 16.6667);
      this.x      = lerp(this.x, this.pathCX, k);
      this.y      = lerp(this.y, this.pathCY, k);
      this.opacity = eased;
      if (p >= 1) this.isEntering = false;
      return;
    }

    this.t += dt * 0.001 * this.speed;
    this.x = this.pathCX + Math.sin(this.t * this.freqX) * this.radX
                         + Math.cos(this.t * 0.4 + this.phase) * this.radX * 0.4;
    this.y = this.pathCY + Math.sin(this.t * this.freqY + 1.2) * this.radY
                         + Math.cos(this.t * 0.6 + this.phase) * this.radY * 0.3;
    this.opacity = Math.min(1, this.opacity + dt * 0.0005);
  }

  // Called exactly once, when this.el is first assigned (see spawnCard).
  // Sets the static blur filter so applyToEl() never has to touch it per-frame.
  initBlur() {
    if (!this.el) return;
    this.el.style.filter = `blur(${this.blurAmount}px)`;
    this._blurApplied = true;
  }

  applyToEl() {
    if (!this.el) return;
    const scale = this.isHovered ? this.depth * 1.05 : this.depth * 0.9 + 0.1;
    // rotate(var(--card-rot)) folded in here — cards.css sets that same
    // rotate() on .memory-card, but an inline style.transform always wins
    // over a stylesheet one, so without this the per-card tilt never showed.
    this.el.style.transform = `translate(${this.x}px, ${this.y}px) scale(${scale}) rotate(var(--card-rot))`;
    this.el.style.opacity   = this.isHovered ? 1 : this.opacity * (0.55 + this.depth * 0.4);

    // zIndex only changes on hover toggle (depth is fixed per card), so
    // skip the write when it hasn't actually changed.
    const z = this.isHovered ? 25 : Math.round(this.depth * 10);
    if (z !== this._lastZ) {
      this.el.style.zIndex = z;
      this._lastZ = z;
    }
  }
}

const lerp = (a, b, t) => a + (b - a) * t;

/* ─── Fisher-Yates shuffle (returns a new array, does not mutate input) ─── */
function shuffleSample(arr, n) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

/* ═══════════════════════════════════════════════════════════
   Gallery Engine
═══════════════════════════════════════════════════════════ */

export async function initGallery(stage, store, callbacks = {}) {
  stageEl         = stage;
  _store          = store;
  onOpenCallback  = callbacks.onOpen || null;

  const emptyEl    = document.querySelector('.gallery-empty');
  const countBadge = document.querySelector('.memory-count');

  let memories = await store.getAll();

  if (memories.length === 0) {
    if (emptyEl) emptyEl.classList.add('is-visible');
    lumi?.setState('guiding');
    return;
  }

  if (emptyEl) emptyEl.classList.remove('is-visible');
  if (countBadge) countBadge.textContent = `${memories.length} ${memories.length === 1 ? 'memory' : 'memories'}`;

  // Spawn a random sample of cards with stagger (Fisher-Yates shuffle)
  shuffleSample(memories, SAMPLE_SIZE).forEach((mem, i) => {
    spawnCard(mem, i * BUBBLE_APPEAR_DELAY);
  });

  startLoop();
  document.addEventListener('keydown', handleKeydown);
  window.addEventListener('resize', handleResize);
}

function spawnCard(memory, delay = 0) {
  const physics = new CardPhysics(memory, cardPool.length);
  const el      = buildCardEl(memory, cardPool.length);

  el.classList.add(physics.depthClass);
  el.style.opacity    = '0';
  el.style.position   = 'absolute';
  el.style.willChange = 'transform, opacity';

  memoryData.push(memory);

  setTimeout(() => {
    if (!stageEl) return;
    stageEl.appendChild(el);
    physics.el = el;
    physics.initBlur(); // apply blur filter exactly once
    cardPool.push(physics);

    // Desktop hover
    el.addEventListener('mouseenter', () => {
      onCardHover(physics, true);
      if (memory.type === 'video') playCardPreview(el);
    });
    el.addEventListener('mouseleave', () => {
      onCardHover(physics, false);
      if (memory.type === 'video') stopCardPreview(el);
    });
    el.addEventListener('click',      () => openMemory(physics));

    // Mobile tap
    let tapStart = 0;
    el.addEventListener('touchstart', () => { tapStart = Date.now(); }, { passive: true });
    el.addEventListener('touchend', e => {
      if (Date.now() - tapStart < 300) {
        e.preventDefault();
        openMemory(physics);
      }
    }, { passive: false });

  }, delay);
}

/* ─── Add new cards live (called by polling) ─── */
export function addMemoryCards(newMemories) {
  const countBadge = document.querySelector('.memory-count');
  const emptyEl    = document.querySelector('.gallery-empty');
  if (emptyEl) emptyEl.classList.remove('is-visible');

  newMemories.forEach((mem, i) => {
    memoryData.unshift(mem);
    spawnCard(mem, i * 400);
  });

  if (countBadge) countBadge.textContent = `${memoryData.length} ${memoryData.length === 1 ? 'memory' : 'memories'}`;
}

function startLoop() {
  const tick = ts => {
    galleryRAF  = requestAnimationFrame(tick);
    const dt    = Math.min(ts - lastTimestamp, 50);
    lastTimestamp = ts;
    for (const card of cardPool) { card.update(dt); card.applyToEl(); }
  };
  galleryRAF = requestAnimationFrame(tick);
}

/* ─── Hover ─── */
function onCardHover(physics, entering) {
    physics.isHovered = entering;

    if (entering) {

        focusedCard = physics;

        physics.el.classList.add('memory-card--hovering');
        physics.el.style.filter = 'none';

        lumi?.setState('curious');
        lumi?.attractToCard?.(physics.el);

        // Roughly one out of three hovers speaks
        if (Math.random() < 0.35) {

            const pools = {
                peaceful: 'happy',
                hopeful: 'hopeful',
                melancholy: 'melancholy',
                dark: 'dark',
                passionate: 'happy'
            };

            const pool = pools[physics.memory.mood] || 'idle';

            lumi?.speak(
                lumi.pickLine(pool),
                2500,
                'reactive'
            );
        }

    } else {

        if (focusedCard === physics)
            focusedCard = null;

        physics.el.classList.remove('memory-card--hovering');
        physics.el.style.filter = `blur(${physics.blurAmount}px)`;

        lumi?.resetBase?.();
        lumi?.setState('idle');
    }
}

/* ─── Card video preview: lazy-load + hover play/pause ───
   Only one card's preview video plays at a time across the whole
   gallery — starting a new one always stops whichever was active. ─── */
function playCardPreview(cardEl) {
  const video = cardEl.querySelector('.card-video__thumbnail');
  if (!video) return;

  if (activePreviewVideo && activePreviewVideo !== video) {
    stopPreviewVideo(activePreviewVideo);
  }

  // Lazy-load the actual stream source on first hover only
  if (!video.src && video.dataset.src) {
    video.src = video.dataset.src;
  }

  video.muted = true; // belt-and-suspenders for autoplay policies
  activePreviewVideo = video;
  video.play().catch(() => { /* ignore fast hover-out races */ });
}

function stopCardPreview(cardEl) {
  const video = cardEl.querySelector('.card-video__thumbnail');
  if (video) stopPreviewVideo(video);
}

function stopPreviewVideo(video) {
  video.pause();
  video.currentTime = 0;
  if (activePreviewVideo === video) activePreviewVideo = null;
}

/* ─── Open memory — calls gallery.html's onOpen handler ─── */
export function openMemory(physics) {
  if (modalOpen) return;
  modalOpen = true;
  lumi?.reactToMood?.(physics.memory.mood);

  // Grab the card's exact on-screen position/size *before* handing off to
  // the overlay, so the overlay can scale-out from this exact spot instead
  // of just fading in centered.
  const originRect = physics.el?.getBoundingClientRect() || null;
  const origin = originRect ? {
    x: originRect.left,
    y: originRect.top,
    width:  originRect.width,
    height: originRect.height,
    centerX: originRect.left + originRect.width  / 2,
    centerY: originRect.top  + originRect.height / 2
  } : null;

  if (onOpenCallback) {
    onOpenCallback(physics.memory, {
      origin,
      onClose: () => { modalOpen = false; lumi?.setState('idle'); }
    });
  } else {
    modalOpen = false; // no handler set, just release lock
  }
}

/* ─── Keyboard ─── */
function handleKeydown(e) {
  if (modalOpen) return;
  if (e.key === 'Enter' && focusedCard) openMemory(focusedCard);
}

/* ─── Resize ─── */
function handleResize() {
  cardPool.forEach(p => {
    p.pathCX = vw() * 0.1 + Math.random() * vw() * 0.8;
    p.pathCY = vh() * 0.1 + Math.random() * vh() * 0.8;
  });
}

/* ─── Destroy ───
   Tears down all currently-rendered cards: stops the animation loop,
   removes each card's DOM node, drops its event listeners (via node
   removal), and clears internal references. Safe to call immediately
   before spawning a fresh batch of cards. Does NOT remove the global
   keydown/resize listeners or null out _store/onOpenCallback/stageEl,
   since those are reused by the following respawn. */
export function destroyGallery({ fullTeardown = false } = {}) {
  if (galleryRAF) {
    cancelAnimationFrame(galleryRAF);
    galleryRAF = null;
  }

  // Remove each card's DOM node and drop references so it can be GC'd.
  for (const physics of cardPool) {
    physics.el?.remove();
    physics.el = null;
  }
  cardPool.length   = 0;
  memoryData.length = 0;
  focusedCard  = null;
  modalOpen    = false;
  lastTimestamp = 0;
  activePreviewVideo = null;

  if (fullTeardown) {
    document.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('resize', handleResize);
    _store         = null;
    onOpenCallback = null;
    stageEl        = null;
  }
}

/* ─── Respawn ───
   Clean destroy-then-respawn workflow: clears the current cards, then
   draws a fresh random sample of SAMPLE_SIZE from the full memory pool
   (re-fetched from the store) and spawns those. Intended for use by the
   Sync button and background poll callback instead of addMemoryCards(). */
export async function respawnRandomSample() {
  if (!_store || !stageEl) return;

  destroyGallery(); // clears current cards, keeps store/stage/callback wiring

  const emptyEl    = document.querySelector('.gallery-empty');
  const countBadge = document.querySelector('.memory-count');

  _store._loaded = false; // force a fresh fetch
  const memories = await _store.getAll();

  if (memories.length === 0) {
    if (emptyEl) emptyEl.classList.add('is-visible');
    if (countBadge) countBadge.textContent = '';
    lumi?.setState('guiding');
    return;
  }

  if (emptyEl) emptyEl.classList.remove('is-visible');
  if (countBadge) countBadge.textContent = `${memories.length} ${memories.length === 1 ? 'memory' : 'memories'}`;

  shuffleSample(memories, SAMPLE_SIZE).forEach((mem, i) => {
    spawnCard(mem, i * BUBBLE_APPEAR_DELAY);
  });

  startLoop();
}

/* ─── Utilities ─── */
export function getAllMemories() { return [...memoryData]; }
export function getMemoryById(id) { return memoryData.find(m => m.id === id) || null; }

function escHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str || ''));
  return d.innerHTML;
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  try {
    return new Date(isoStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  } catch { return isoStr; }
}