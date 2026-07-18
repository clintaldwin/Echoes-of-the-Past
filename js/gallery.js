/* ═══════════════════════════════════════════════════════════
   ECHOES — gallery.js
   Floating memory card engine. Store-agnostic: receives a
   store instance via initGallery(). Works with DriveStore.
═══════════════════════════════════════════════════════════ */

import { lumi } from './lumi.js';

/* ─── Constants ─── */
const CARD_ENTER_DURATION = 800;
const BUBBLE_APPEAR_DELAY = 300;
const MAX_CARDS_VISIBLE   = window.innerWidth < 768 ? 6 : 14;

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

    case 'video':
      return `
        <div class="card-inner">
          ${moodDot}
          ${thumbSrc
            ? `<img class="card-video__thumbnail" src="${thumbSrc}" alt="${title}" loading="lazy">`
            : `<div style="background:#1a1a14;width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:40px;border-radius:inherit">🎞️</div>`}
          <div class="card-video__overlay"></div>
          <div class="card-video__play"></div>
          <div class="card-label" style="position:absolute;bottom:14px;left:16px;right:16px;z-index:3">
            <div class="card-label__title" style="color:#F0E8D5">${title}</div>
            <div class="card-label__date text-mono" style="color:rgba(240,232,213,0.5)">${date}</div>
          </div>
        </div>`;

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
      this.x      = lerp(this.x, this.pathCX, eased * 0.1);
      this.y      = lerp(this.y, this.pathCY, eased * 0.1);
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

  applyToEl() {
    if (!this.el) return;
    const scale = this.isHovered ? this.depth * 1.05 : this.depth * 0.9 + 0.1;
    this.el.style.transform = `translate(${this.x}px, ${this.y}px) scale(${scale})`;
    this.el.style.opacity   = this.isHovered ? 1 : this.opacity * (0.55 + this.depth * 0.4);
    this.el.style.filter    = this.isHovered ? 'none' : `blur(${this.blurAmount}px)`;
    this.el.style.zIndex    = this.isHovered ? 25 : Math.round(this.depth * 10);
  }
}

const lerp = (a, b, t) => a + (b - a) * t;

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

  // Spawn visible cards with stagger
  memories.slice(0, MAX_CARDS_VISIBLE).forEach((mem, i) => {
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
    cardPool.push(physics);

    // Desktop hover
    el.addEventListener('mouseenter', () => onCardHover(physics, true));
    el.addEventListener('mouseleave', () => onCardHover(physics, false));
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
    lumi?.setState('curious');
    lumi?.attractToCard?.(physics.el);
  } else {
    if (focusedCard === physics) focusedCard = null;
    physics.el.classList.remove('memory-card--hovering');
    lumi?.resetBase?.();
    lumi?.setState('idle');
  }
}

/* ─── Open memory — calls gallery.html's onOpen handler ─── */
export function openMemory(physics) {
  if (modalOpen) return;
  modalOpen = true;
  lumi?.reactToMood?.(physics.memory.mood);
  if (onOpenCallback) {
    onOpenCallback(physics.memory, {
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

/* ─── Destroy ─── */
export function destroyGallery() {
  if (galleryRAF) cancelAnimationFrame(galleryRAF);
  document.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('resize', handleResize);
  cardPool.length   = 0;
  memoryData.length = 0;
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
