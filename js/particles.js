/* ===================================================
   ECHOES — particles.js
   Three canvas layers: dust motes, leaves/petals, Lumi trail
   =================================================== */

import { getCurrentSeason } from './time-theme.js';

/* ─── Layer 1: Dust Motes ─── */
class DustLayer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.maxCount = 55;
    this.raf = null;
    this.resize();
    this.populate();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  populate() {
    this.particles = [];
    for (let i = 0; i < this.maxCount; i++) {
      this.particles.push(this.createMote(true));
    }
  }

  createMote(randomY = false) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    return {
      x:     Math.random() * w,
      y:     randomY ? Math.random() * h : h + 10,
      size:  Math.random() * 2 + 1,        // 1–3px
      speed: Math.random() * 0.25 + 0.08,   // very slow upward
      sway:  Math.random() * 0.5 - 0.25,    // horizontal sway
      swayFreq: Math.random() * 0.008 + 0.003,
      phase: Math.random() * Math.PI * 2,
      opacity: Math.random() * 0.25 + 0.1,
      oTarget: Math.random() * 0.3 + 0.08,
      oDelta:  (Math.random() > 0.5 ? 1 : -1) * 0.002,
      t: 0
    };
  }

  update() {
    const p = this.particles;
    for (let i = 0; i < p.length; i++) {
      const m = p[i];
      m.t    += 0.016;
      m.y    -= m.speed;
      m.x    += Math.sin(m.t * m.swayFreq * 200 + m.phase) * m.sway;

      // Fade in/out
      m.opacity += m.oDelta;
      if (m.opacity >= m.oTarget + 0.05 || m.opacity <= 0.05) m.oDelta *= -1;

      // Reset if gone off top or sides
      if (m.y < -10 || m.x < -10 || m.x > window.innerWidth + 10) {
        p[i] = this.createMote(false);
      }
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (const m of this.particles) {
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(245, 240, 225, ${m.opacity})`;
      ctx.fill();
    }
  }

  start() {
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      this.update();
      this.draw();
    };
    tick();
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
  }
}

/* ─── Layer 2: Leaves / Petals ─── */
class OrganicLayer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.season = getCurrentSeason();
    this.maxCount = this.season === 'summer' ? 0 : this.season === 'autumn' ? 12 : 7;
    this.raf = null;
    this.resize();
    this.populate();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  populate() {
    this.particles = [];
    for (let i = 0; i < this.maxCount; i++) {
      this.particles.push(this.createLeaf(true));
    }
  }

  getColors() {
    switch (this.season) {
      case 'autumn': return ['rgba(200,120,60,0.5)','rgba(180,80,40,0.5)','rgba(212,165,90,0.5)','rgba(160,100,50,0.5)'];
      case 'spring': return ['rgba(240,180,200,0.45)','rgba(255,200,220,0.4)','rgba(230,160,190,0.45)'];
      case 'winter': return ['rgba(200,220,240,0.4)','rgba(220,235,245,0.35)'];
      default:       return ['rgba(143,175,142,0.45)','rgba(180,210,140,0.4)'];
    }
  }

  createLeaf(randomY = false) {
    const w = window.innerWidth;
    const colors = this.getColors();
    return {
      x:        Math.random() * (w + 100) - 50,
      y:        randomY ? Math.random() * window.innerHeight : -20,
      size:     Math.random() * 7 + 4,
      speedY:   Math.random() * 0.6 + 0.25,
      speedX:   (Math.random() - 0.5) * 0.4,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.04,
      wobble:   Math.random() * 0.02 + 0.005,
      phase:    Math.random() * Math.PI * 2,
      color:    colors[Math.floor(Math.random() * colors.length)],
      t:        0
    };
  }

  drawLeafShape(ctx, x, y, size, rotation) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.beginPath();

    if (this.season === 'spring') {
      // Petal shape
      ctx.ellipse(0, -size * 0.5, size * 0.35, size * 0.6, 0, 0, Math.PI * 2);
    } else if (this.season === 'winter') {
      // Snowflake-ish hexagon
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const r = size * 0.6;
        if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
        else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      }
      ctx.closePath();
    } else {
      // Leaf shape (oval with slight point)
      ctx.moveTo(0, -size);
      ctx.bezierCurveTo(size * 0.6, -size * 0.5, size * 0.6, size * 0.5, 0, size * 0.6);
      ctx.bezierCurveTo(-size * 0.6, size * 0.5, -size * 0.6, -size * 0.5, 0, -size);
    }

    ctx.restore();
  }

  update() {
    for (let i = 0; i < this.particles.length; i++) {
      const l = this.particles[i];
      l.t       += 0.016;
      l.y       += l.speedY;
      l.x       += l.speedX + Math.sin(l.t * 30 * l.wobble + l.phase) * 0.5;
      l.rotation += l.rotSpeed;

      if (l.y > window.innerHeight + 30 || l.x < -80 || l.x > window.innerWidth + 80) {
        this.particles[i] = this.createLeaf(false);
      }
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (const l of this.particles) {
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(l.rotation);

      ctx.beginPath();
      if (this.season === 'spring') {
        ctx.ellipse(0, -l.size * 0.5, l.size * 0.35, l.size * 0.65, 0, 0, Math.PI * 2);
      } else if (this.season === 'winter') {
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const r = l.size * 0.7;
          if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
          else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        }
        ctx.closePath();
      } else {
        ctx.moveTo(0, -l.size);
        ctx.bezierCurveTo(l.size*0.55,-l.size*0.4, l.size*0.55,l.size*0.4, 0,l.size*0.55);
        ctx.bezierCurveTo(-l.size*0.55,l.size*0.4, -l.size*0.55,-l.size*0.4, 0,-l.size);
      }

      ctx.fillStyle = l.color;
      ctx.fill();
      ctx.restore();
    }
  }

  start() {
    if (this.maxCount === 0) return;
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      this.update();
      this.draw();
    };
    tick();
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
  }
}

/* ─── Layer 3: Cursor Custom Trail ─── */
class CursorLayer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.trail = [];
    this.mouse = { x: -999, y: -999 };
    this.raf = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.trail.push({ x: e.clientX, y: e.clientY, life: 1.0, size: 3 });
    });
  }

  resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  update() {
    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].life -= 0.045;
      this.trail[i].size *= 0.97;
      if (this.trail[i].life <= 0) {
        this.trail.splice(i, 1);
      }
    }
    if (this.trail.length > 50) {
      this.trail.splice(0, this.trail.length - 50);
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = 0; i < this.trail.length; i++) {
      const p = this.trail[i];
      const alpha = p.life * 0.25;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(212, 165, 90, ${alpha})`;
      ctx.fill();
    }
  }

  start() {
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      this.update();
      this.draw();
    };
    tick();
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
  }
}

/* ─── Custom DOM Cursor ─── */
function initCursor() {
  let cursor = document.getElementById('cursor');
  if (!cursor) {
    cursor = document.createElement('div');
    cursor.id = 'cursor';
    document.body.appendChild(cursor);
  }

  document.addEventListener('mousemove', (e) => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top  = e.clientY + 'px';
  });

  // Hover states
  document.addEventListener('mouseover', (e) => {
    const t = e.target;
    if (t.closest('#lumi')) {
      cursor.className = 'cursor--lumi';
    } else if (t.closest('.memory-card') || t.closest('button') || t.closest('a')) {
      cursor.className = 'cursor--hover';
    } else if (t.closest('textarea') || t.closest('input[type="text"]')) {
      cursor.className = 'cursor--write';
    } else {
      cursor.className = '';
    }
  });

  return cursor;
}

/* ─── Initialize all particle systems ─── */
export function initParticles() {
  initCursor();

  // Create canvas layers
  const dustCanvas    = createCanvas('dust-canvas',    14);
  const organicCanvas = createCanvas('organic-canvas', 15);
  const cursorCanvas  = createCanvas('cursor-canvas',  9999);

  const dust    = new DustLayer(dustCanvas);
  const organic = new OrganicLayer(organicCanvas);
  const cursorL = new CursorLayer(cursorCanvas);

  // Start all layers
  dust.start();
  organic.start();
  cursorL.start();

  return { dust, organic, cursor: cursorL };
}

function createCanvas(id, zIndex) {
  let canvas = document.getElementById(id);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = id;
    canvas.className = 'particle-canvas';
    canvas.style.zIndex = zIndex;
    canvas.style.pointerEvents = 'none';
    canvas.style.position = 'fixed';
    canvas.style.inset = '0';
    document.body.appendChild(canvas);
  }
  return canvas;
}
