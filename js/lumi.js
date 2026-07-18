/* ===================================================
   ECHOES — lumi.js
   The Ghost NPC — movement, states, speech bubbles
   =================================================== */

import { getLumiGreeting, initTheme } from './time-theme.js';

/* ─── Lumi SVG markup ─── */
const LUMI_SVG = `
<svg id="lumi-svg" viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="lumiGlow" cx="50%" cy="45%" r="55%">
      <stop offset="0%"   stop-color="rgba(212,165,90,0.4)" />
      <stop offset="100%" stop-color="rgba(212,165,90,0)" />
    </radialGradient>
    <radialGradient id="lumiBody" cx="45%" cy="38%" r="60%">
      <stop offset="0%"   stop-color="rgba(175,210,174,0.75)" />
      <stop offset="100%" stop-color="rgba(120,165,118,0.55)" />
    </radialGradient>
    <filter id="lumiBlur" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="1.5" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>
  <g class="lumi-body">
    <!-- Outer glow halo -->
    <ellipse cx="40" cy="50" rx="32" ry="38" fill="url(#lumiGlow)" class="lumi-halo" />
    <!-- Body: teardrop shape -->
    <path d="M18 45 Q18 18 40 16 Q62 18 62 45 Q62 68 50 80 Q45 88 40 92 Q35 88 30 80 Q18 68 18 45 Z"
          fill="url(#lumiBody)" />
    <!-- Inner amber core glow -->
    <ellipse cx="40" cy="42" rx="13" ry="16" fill="rgba(212,165,90,0.28)" />
    <!-- Subtle highlight -->
    <ellipse cx="32" cy="33" rx="7" ry="9" fill="rgba(255,255,255,0.18)" />
    <!-- Eyes group -->
    <g class="lumi-eyes">
      <circle class="lumi-eye lumi-eye--left"  cx="33" cy="42" r="3.5" fill="rgba(44,36,22,0.75)" />
      <circle class="lumi-eye lumi-eye--right" cx="47" cy="42" r="3.5" fill="rgba(44,36,22,0.75)" />
      <!-- Eye shine -->
      <circle cx="34.2" cy="41" r="1.2" fill="rgba(255,255,255,0.7)" />
      <circle cx="48.2" cy="41" r="1.2" fill="rgba(255,255,255,0.7)" />
    </g>
    <!-- Wispy tail extension -->
    <path d="M32 82 Q30 92 40 96 Q50 92 48 82" fill="rgba(143,175,142,0.3)" />
  </g>
</svg>`;

/* ─── Speech Lines by Context ─── */
const SPEECH = {
  empty: [
    "This place is waiting for you...",
    "Fill me with your stories?",
    "Something happened today, didn't it.",
    "There's a memory waiting to be kept.",
    "What would you like to remember?"
  ],
  happy: [
    "I felt this one.",
    "You were glowing here.",
    "This one makes me float a little higher.",
    "Something warm in this.",
    "Hold onto this one."
  ],
  melancholy: [
    "I'll keep this safe.",
    "It's okay to feel this.",
    "Even the heavy ones deserve to be kept.",
    "I'm still here.",
    "Not everything has to make sense."
  ],
  dark: [
    "I won't let this one fade.",
    "The dark ones matter too.",
    "I'm here with you in this.",
    "You trusted me with this."
  ],
  hopeful: [
    "Something about this one shines.",
    "You believed in something here.",
    "I like this one very much.",
    "Hold this close."
  ],
  guest: [
    "You found this place.",
    "They wanted you to see this.",
    "Tread gently.",
    "You're welcome here.",
    "These are real, you know."
  ],
  idle: [
    "I'm still here.",
    "Take your time.",
    "No rush.",
    "I'm listening.",
    "This place remembers you."
  ],
  writing_slow: [
    "Getting it all out?",
    "I'm listening.",
    "Take as long as you need.",
    "Every word matters.",
    "Don't stop on my account."
  ],
  writing_fast: [
    "Getting it all out?",
    "The words are coming.",
    "I'm catching up.",
    "Something important, is it."
  ],
  deleted: [
    "Oh.",
    "Changed your mind?",
    "It's okay. Try again.",
    "I won't judge.",
    "The right words will come."
  ],
  return: [
    "You're back.",
    "I kept this place for you.",
    "I was hoping you'd come back.",
    "Same place. New day."
  ],
  milestone: [
    "100 memories. I've been watching every one.",
    "Look at everything you've kept.",
    "This place is alive because of you.",
    "100. You've been remembering well."
  ]
};

/* ─── Lumi Class ─── */
class Lumi {
  constructor() {
    this.el = null;
    this.state = 'idle';
    this.x = window.innerWidth - 80;
    this.y = 40;
    this.baseX = window.innerWidth - 80;
    this.baseY = 40;
    this.t = Math.random() * Math.PI * 2; // phase offset for variety
    this.isGuest = false;
    this.isMoving = true;
    this.lastInteraction = Date.now();
    this.speechCooldown = 0;
    this.SPEECH_MIN_INTERVAL = 30000; // 30s minimum between bubbles
    this.currentBubble = null;
    this.trailParticles = [];
    this.lastX = this.x;
    this.lastY = this.y;
    this.mouseX = window.innerWidth / 2;
    this.mouseY = window.innerHeight / 2;
    this.raf = null;
    this.idleTimer = null;
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

  /* ─── Mount into DOM ─── */
  mount(container) {
    if (!container) {
      container = document.body;
    }

    this.el = document.createElement('div');
    this.el.id = 'lumi';
    this.el.innerHTML = LUMI_SVG;
    this.el.setAttribute('aria-label', 'Lumi, the memory keeper');
    container.appendChild(this.el);

    this.el.style.cssText = `
      position: fixed;
      top: ${this.y}px;
      left: ${this.x}px;
      width: 72px;
      height: 90px;
      z-index: 30;
      pointer-events: all;
    `;

    this.bindEvents();
    this.setState('idle');
    this.startMovement();
    this.startIdleWatch();

    return this;
  }

  /* ─── Bind Events ─── */
  bindEvents() {
    // Mouse tracking for cursor repulsion
    document.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      this.lastInteraction = Date.now();

      // Startled on sudden movement
      if (this.state === 'sleeping') {
        this.setState('startled');
        setTimeout(() => this.setState('idle'), 600);
      }
    });

    // Click on Lumi
    this.el.addEventListener('click', () => {
      this.setState('excited');
      this.speak(this.pickLine(this.isGuest ? 'guest' : 'idle'));
      setTimeout(() => this.setState('idle'), 2000);
    });

    // Window blur/focus
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.isMoving = false;
      } else {
        this.isMoving = true;
        this.lastInteraction = Date.now();
        this.setState('greeting');
        setTimeout(() => this.setState('idle'), 2000);
      }
    });

    // Resize
    window.addEventListener('resize', () => {
      this.baseX = window.innerWidth - 80;
      this.x = this.baseX;
    });
  }

  /* ─── State Machine ─── */
  setState(newState) {
    if (!this.el) return;
    const prev = this.state;
    this.state = newState;

    // Remove all state classes
    const states = [
      'lumi--idle','lumi--curious','lumi--excited','lumi--melancholy',
      'lumi--watching','lumi--sleeping','lumi--greeting','lumi--startled',
      'lumi--guiding','lumi--guest'
    ];
    this.el.classList.remove(...states);
    this.el.classList.add(`lumi--${newState}`);

    // Handle state-specific effects
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

  /* ─── Movement System ─── */
  startMovement() {
    const move = () => {
      this.raf = requestAnimationFrame(move);
      if (!this.isMoving || !this.el) return;

      this.t += 0.006;

      // Compute target position from sin/cos compound motion
      const targetX = this.baseX + Math.sin(this.t * 1.3) * 70 + Math.cos(this.t * 0.7) * 35;
      const targetY = this.baseY + Math.sin(this.t * 0.9) * 45 + Math.cos(this.t * 1.1) * 25;

      // Cursor repulsion (within 120px radius)
      const lumiCenterX = this.x + 36;
      const lumiCenterY = this.y + 45;
      const dx = lumiCenterX - this.mouseX;
      const dy = lumiCenterY - this.mouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let repelX = 0, repelY = 0;
      if (dist < 120 && dist > 0) {
        const force = (120 - dist) / 120;
        repelX = (dx / dist) * force * 40;
        repelY = (dy / dist) * force * 30;
      }

      // Smooth lerp toward target + repulsion
      const speed = this.state === 'melancholy' ? 0.04 : 0.06;
      this.x += ((targetX + repelX) - this.x) * speed;
      this.y += ((targetY + repelY) - this.y) * speed;

      // Apply position
      this.el.style.left = `${Math.round(this.x)}px`;
      this.el.style.top  = `${Math.round(this.y)}px`;

      // Spawn trail particles if moving fast enough
      const velX = Math.abs(this.x - this.lastX);
      const velY = Math.abs(this.y - this.lastY);
      if (velX + velY > 1.2 && this.state === 'excited') {
        this.spawnTrailDot(this.x + 36, this.y + 45);
      }

      this.lastX = this.x;
      this.lastY = this.y;
    };

    move();
  }

  /* ─── Idle / Sleep Watch ─── */
  startIdleWatch() {
    setInterval(() => {
      const idleMs = Date.now() - this.lastInteraction;
      if (idleMs > 3 * 60 * 1000 && this.state !== 'sleeping') {
        this.setState('sleeping');
        this.speak(this.pickLine('idle'));
      }
    }, 30 * 1000);
  }

  /* ─── Attract to a card ─── */
  attractToCard(cardEl) {
    if (!cardEl) return;
    const rect = cardEl.getBoundingClientRect();
    const cardCX = rect.left + rect.width  / 2;
    const cardCY = rect.top  + rect.height / 2;

    const angle = Math.atan2(cardCY - (this.y + 45), cardCX - (this.x + 36));
    const dist  = Math.sqrt(
      Math.pow(cardCX - (this.x + 36), 2) +
      Math.pow(cardCY - (this.y + 45), 2)
    );

    if (dist < 200) {
      this.baseX = cardCX - 36 + Math.cos(angle + Math.PI / 2) * 100;
      this.baseY = cardCY - 45 + Math.sin(angle + Math.PI / 2) * 80;
    }
  }

  resetBase() {
    this.baseX = window.innerWidth - 80;
    this.baseY = 40;
  }

  /* ─── Speech Bubble ─── */
  speak(text, duration = 4000) {
    if (!text) return;

    const now = Date.now();
    if (now - this.speechCooldown < this.SPEECH_MIN_INTERVAL) return;
    this.speechCooldown = now;

    // Remove existing bubble
    this.clearBubble();

    const bubble = document.createElement('div');
    bubble.className = 'speech-bubble bubble--enter';
    bubble.innerHTML = `<p>${text}</p>`;

    // Position near Lumi (above and slightly left)
    bubble.style.cssText = `
      left: ${Math.max(8, this.x - 120)}px;
      top:  ${Math.max(8, this.y - 80)}px;
    `;

    document.body.appendChild(bubble);
    this.currentBubble = bubble;

    // Auto-dismiss
    setTimeout(() => {
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

  /* ─── Pick a line from a pool ─── */
  pickLine(pool) {
    const lines = SPEECH[pool] || SPEECH.idle;
    return lines[Math.floor(Math.random() * lines.length)];
  }

  /* ─── React to memory mood ─── */
  reactToMood(mood) {
    switch (mood) {
      case 'peaceful': this.setState('curious');    this.speak(this.pickLine('happy'));     break;
      case 'hopeful':  this.setState('excited');    this.speak(this.pickLine('hopeful'));   break;
      case 'melancholy':this.setState('melancholy');this.speak(this.pickLine('melancholy'));break;
      case 'dark':     this.setState('melancholy'); this.speak(this.pickLine('dark'));      break;
      case 'passionate':this.setState('excited');   this.speak(this.pickLine('happy'));     break;
      default:         this.setState('curious');    this.speak(this.pickLine('idle'));      break;
    }
  }

  /* ─── Particle Effects ─── */
  spawnSparkles() {
    const colors = ['rgba(212,165,90,0.8)','rgba(143,175,142,0.8)','rgba(245,200,122,0.9)'];
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        const dot = document.createElement('div');
        dot.className = 'lumi-sparkle';
        const angle = (i / 8) * Math.PI * 2;
        const r = 50 + Math.random() * 30;
        dot.style.cssText = `
          left: ${this.x + 36 + Math.cos(angle) * r}px;
          top:  ${this.y + 45 + Math.sin(angle) * r}px;
          background: ${colors[i % colors.length]};
          animation-delay: ${i * 80}ms;
        `;
        document.body.appendChild(dot);
        setTimeout(() => dot.remove(), 1500);
      }, i * 60);
    }
  }

  spawnTears() {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const tear = document.createElement('div');
        tear.className = 'lumi-tear';
        tear.style.cssText = `
          left: ${this.x + 28 + i * 8}px;
          top:  ${this.y + 55}px;
          animation-delay: ${i * 0.3}s;
        `;
        document.body.appendChild(tear);
        setTimeout(() => tear.remove(), 1500);
      }, i * 400);
    }
  }

  spawnZzz() {
    const zzz = document.createElement('div');
    zzz.className = 'lumi-zzz';
    zzz.innerHTML = '<span>z</span><span>z</span><span>z</span>';
    zzz.style.cssText = `
      left: ${this.x + 55}px;
      top:  ${this.y + 10}px;
    `;
    document.body.appendChild(zzz);

    this._zzzEl = zzz;

    const removeOnWake = () => {
      if (this.state !== 'sleeping' && zzz.parentNode) {
        zzz.remove();
        this._zzzEl = null;
      }
    };

    setTimeout(removeOnWake, 10000);
  }

  spawnTrailDot(x, y) {
    const colors = ['rgba(212,165,90,0.7)', 'rgba(143,175,142,0.7)', 'rgba(245,200,122,0.6)'];
    const dot = document.createElement('div');
    dot.className = 'lumi-trail-particle';
    const size = 4 + Math.random() * 4;
    dot.style.cssText = `
      left: ${x}px; top: ${y}px;
      width: ${size}px; height: ${size}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      animation-duration: ${0.8 + Math.random() * 0.7}s;
    `;
    document.body.appendChild(dot);
    setTimeout(() => dot.remove(), 1600);
  }

  /* ─── Destroy ─── */
  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this.el) this.el.remove();
    this.clearBubble();
  }
}

/* ─── Easter eggs ─── */
function watchForEasterEggs(lumi) {
  // "lumi" typed anywhere → she spins and laughs
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

/* ─── Singleton export ─── */
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
