/* ===================================================
   ECHOES — audio.js
   Ambient sound controller — Web Audio API
   Always opt-in. Crossfades between mood-matched tracks.
   =================================================== */

/* ─── Track definitions ─── */
// These are relative paths — place your .mp3 files in /assets/sounds/
// Falls back gracefully if files are missing
const TRACKS = {
  melancholy: [
    'assets/sounds/lofi-piano-rain.mp3',
    'assets/sounds/soft-strings-night.mp3'
  ],
  peaceful: [
    'assets/sounds/ambient-morning-light.mp3',
    'assets/sounds/soft-strings-night.mp3'
  ],
  hopeful: [
    'assets/sounds/ambient-morning-light.mp3'
  ],
  passionate: [
    'assets/sounds/ambient-morning-light.mp3'
  ],
  dark: [
    'assets/sounds/soft-strings-night.mp3'
  ]
};

const VINYL_CRACKLE = 'assets/sounds/vinyl-crackle.mp3';
const DEFAULT_TRACK = 'assets/sounds/ambient-morning-light.mp3';

const FADE_DURATION   = 2.5;   // seconds for crossfade
const MASTER_VOLUME   = 0.28;  // 28% default
const CRACKLE_VOLUME  = 0.06;  // 6% for vinyl crackle layer

/* ─── Audio Controller ─── */
class AudioController {
  constructor() {
    this.ctx          = null;
    this.masterGain   = null;
    this.currentNode  = null;
    this.crackleNode  = null;
    this.isPlaying    = false;
    this.currentTrack = null;
    this.enabled      = false;
    this.initialized  = false;
  }

  /* ─── One-time setup after user gesture ─── */
  async init() {
    if (this.initialized) return;

    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch (err) {
      console.warn('[Audio] Web Audio API not available:', err.message);
    }
  }

  /* ─── Toggle on/off ─── */
  async toggle(btn) {
    if (!this.initialized) await this.init();
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    if (this.isPlaying) {
      await this.fadeOut();
      this.isPlaying = false;
      this.enabled   = false;
      if (btn) btn.classList.remove('is-active');
    } else {
      await this.play(this.currentTrack || DEFAULT_TRACK);
      this.isPlaying = true;
      this.enabled   = true;
      if (btn) btn.classList.add('is-active');
    }
  }

  /* ─── Play a track ─── */
  async play(trackUrl) {
    if (!this.initialized) await this.init();
    if (!this.ctx) return;

    // Fetch and decode
    let buffer;
    try {
      const res = await fetch(trackUrl, { cache: 'force-cache' });
      if (!res.ok) throw new Error('Track not found: ' + trackUrl);
      const arrayBuffer = await res.arrayBuffer();
      buffer = await this.ctx.decodeAudioData(arrayBuffer);
    } catch (err) {
      console.info('[Audio] Track unavailable, using oscillator fallback:', trackUrl);
      buffer = this.createAmbientBuffer();
    }

    // Fade out current
    if (this.currentNode) {
      await this.fadeOut();
    }

    // Create new source
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop   = true;

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0, this.ctx.currentTime);

    source.connect(gainNode);
    gainNode.connect(this.masterGain);

    this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.masterGain.gain.linearRampToValueAtTime(MASTER_VOLUME, this.ctx.currentTime + FADE_DURATION);

    source.start();

    this.currentNode  = source;
    this.currentTrack = trackUrl;
    this.isPlaying    = true;
    this.enabled      = true;

    // Start crackle
    this.startCrackle();

    return source;
  }

  /* ─── Crossfade to another track ─── */
  async crossfadeTo(trackUrl) {
    if (!this.initialized || !this.ctx || trackUrl === this.currentTrack) return;
    if (!this.enabled) return;
    await this.play(trackUrl);
  }

  /* ─── Fade out current ─── */
  fadeOut() {
    return new Promise(resolve => {
      if (!this.masterGain || !this.ctx) { resolve(); return; }
      const now = this.ctx.currentTime;
      this.masterGain.gain.linearRampToValueAtTime(0, now + FADE_DURATION);
      setTimeout(() => {
        if (this.currentNode) {
          try { this.currentNode.stop(); } catch(e) {}
          this.currentNode = null;
        }
        resolve();
      }, FADE_DURATION * 1000);
    });
  }

  /* ─── Vinyl crackle layer ─── */
  async startCrackle() {
    if (this.crackleNode) return;
    if (!this.ctx) return;

    try {
      const res = await fetch(VINYL_CRACKLE, { cache: 'force-cache' });
      if (!res.ok) throw new Error('No crackle file');
      const arrayBuffer = await res.arrayBuffer();
      const buffer = await this.ctx.decodeAudioData(arrayBuffer);

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop   = true;

      const gainNode = this.ctx.createGain();
      gainNode.gain.setValueAtTime(CRACKLE_VOLUME, this.ctx.currentTime);

      source.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      source.start();

      this.crackleNode = source;
    } catch {
      // Crackle is optional — no warning needed
    }
  }

  /* ─── React to dominant mood of visible memories ─── */
  setMoodFromMemories(memories) {
    if (!memories || memories.length === 0) return;

    // Count moods
    const counts = {};
    memories.forEach(m => {
      counts[m.mood] = (counts[m.mood] || 0) + 1;
    });

    // Find dominant
    const dominant = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])[0][0];

    const tracks = TRACKS[dominant] || [DEFAULT_TRACK];
    const track  = tracks[Math.floor(Math.random() * tracks.length)];

    if (this.enabled) {
      this.crossfadeTo(track);
    } else {
      this.currentTrack = track;
    }
  }

  /* ─── Fallback ambient buffer (generated with oscillators) ─── */
  createAmbientBuffer() {
    const duration    = 30;
    const sampleRate  = this.ctx.sampleRate;
    const numSamples  = duration * sampleRate;
    const buffer      = this.ctx.createBuffer(2, numSamples, sampleRate);

    // Fill with gentle pink noise + soft sine waves
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0; // pink noise state

      for (let i = 0; i < numSamples; i++) {
        // Pink noise algorithm
        const white = Math.random() * 2 - 1;
        b0 = 0.99886*b0 + white*0.0555179;
        b1 = 0.99332*b1 + white*0.0750759;
        b2 = 0.96900*b2 + white*0.1538520;
        b3 = 0.86650*b3 + white*0.3104856;
        b4 = 0.55000*b4 + white*0.5329522;
        b5 = -0.7616*b5 - white*0.0168980;
        const pink = (b0+b1+b2+b3+b4+b5+b6+white*0.5362) * 0.11;
        b6 = white * 0.115926;

        // Add a gentle sine drone (A220)
        const drone = Math.sin((i / sampleRate) * 220 * Math.PI * 2) * 0.015;

        // Gentle amplitude envelope (fade in/out at edges)
        const envFade = Math.min(1, Math.min(i, numSamples - i) / (sampleRate * 2));

        data[i] = (pink * 0.04 + drone) * envFade;
      }
    }

    return buffer;
  }

  /* ─── Set volume ─── */
  setVolume(v) {
    if (!this.masterGain || !this.ctx) return;
    this.masterGain.gain.linearRampToValueAtTime(
      Math.max(0, Math.min(1, v)),
      this.ctx.currentTime + 0.3
    );
  }

  /* ─── Play UI click sounds ─── */
  playClick() {
    if (!this.ctx) return;
    const osc  = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(440, this.ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  /* ─── Play key/lock sound for gate entry ─── */
  playKeySound() {
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // A subtle click + resonant tone
    const noise = this.createNoiseBuffer(0.2);
    const ns    = this.ctx.createBufferSource();
    ns.buffer   = noise;
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.15, now);
    nGain.gain.linearRampToValueAtTime(0, now + 0.15);
    ns.connect(nGain);
    nGain.connect(this.ctx.destination);
    ns.start(now);

    // Resonant tone
    const osc  = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.linearRampToValueAtTime(120, now + 0.3);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.4);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  createNoiseBuffer(duration) {
    const samples = Math.ceil(this.ctx.sampleRate * duration);
    const buf     = this.ctx.createBuffer(1, samples, this.ctx.sampleRate);
    const data    = buf.getChannelData(0);
    for (let i = 0; i < samples; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /* ─── Destroy ─── */
  async destroy() {
    await this.fadeOut();
    if (this.crackleNode) {
      try { this.crackleNode.stop(); } catch(e) {}
    }
    if (this.ctx) {
      await this.ctx.close();
    }
  }
}

/* ─── Singleton export ─── */
export const audioCtrl = new AudioController();

/* ─── Wire up the sound button ─── */
export function initAudioBtn(btnSelector = '.btn-sound') {
  const btn = document.querySelector(btnSelector);
  if (!btn) return;

  btn.addEventListener('click', () => {
    audioCtrl.toggle(btn);
    audioCtrl.playClick();
  });

  return btn;
}
