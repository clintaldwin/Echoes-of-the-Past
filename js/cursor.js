/* ═══════════════════════════════════════════════════════════
   ECHOES — cursor.js
   Custom cursor with smooth lerp, hover states, mobile skip
═══════════════════════════════════════════════════════════ */

export function initCursor() {
  const cursor = document.getElementById('cursor');
  if (!cursor) return;

  // Skip entirely on touch / coarse-pointer devices
  if (window.matchMedia('(pointer: coarse)').matches) {
    cursor.style.display = 'none';
    document.body.style.cursor = 'auto';
    document.querySelectorAll('button, a').forEach(el => el.style.cursor = 'auto');
    return;
  }

  let mouseX = -100, mouseY = -100;
  let curX   = -100, curY   = -100;

  const lerp = (a, b, t) => a + (b - a) * t;

  function tick() {
    curX = lerp(curX, mouseX, 0.18);
    curY = lerp(curY, mouseY, 0.18);
    cursor.style.transform = `translate(${curX}px, ${curY}px) translate(-50%, -50%)`;
    requestAnimationFrame(tick);
  }

  document.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (parseFloat(cursor.style.opacity) === 0 || !cursor.style.opacity) {
      cursor.style.opacity = '1';
    }
  });

  document.addEventListener('mouseleave', () => { cursor.style.opacity = '0'; });
  document.addEventListener('mouseenter', () => { cursor.style.opacity = '1'; });

  // Hover state classes
  const hoverTargets = 'button, a, .memory-card, [role="button"], label, select, .gallery-controls__btn, .mem-overlay__close, .mem-overlay__arrow';

  document.addEventListener('mouseover', e => {
    if (e.target.closest('#lumi')) {
      cursor.className = 'cursor--lumi';
    } else if (e.target.closest(hoverTargets)) {
      cursor.className = 'cursor--hover';
    } else {
      cursor.className = '';
    }
  });

  // Write mode
  document.addEventListener('focusin', e => {
    if (e.target.matches('textarea, input[type="text"], input[type="password"], [contenteditable]')) {
      cursor.className = 'cursor--write';
    }
  });
  document.addEventListener('focusout', () => { cursor.className = ''; });

  requestAnimationFrame(tick);
}
