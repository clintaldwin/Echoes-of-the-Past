/* ===================================================
   ECHOES — time-theme.js
   Detects time of day and applies the matching theme
   =================================================== */

export const THEMES = {
  GOLDEN_HOUR: 'golden-hour',  // 5am – 9am
  AFTERNOON:   'afternoon',    // 9am – 5pm
  DUSK:        'dusk',         // 5pm – 8pm
  EVENING:     'evening',      // 8pm – 12am
  WITCHING:    'witching'      // 12am – 5am
};

export const THEME_LABELS = {
  'golden-hour': '🌅 Golden Hour',
  'afternoon':   '☀️ Afternoon',
  'dusk':        '🌆 Dusk',
  'evening':     '🌙 Evening',
  'witching':    '✦ Witching Hour'
};

/**
 * Returns the theme key for a given hour (0–23)
 */
export function getThemeForHour(hour) {
  if (hour >= 5  && hour < 9)  return THEMES.GOLDEN_HOUR;
  if (hour >= 9  && hour < 17) return THEMES.AFTERNOON;
  if (hour >= 17 && hour < 20) return THEMES.DUSK;
  if (hour >= 20 && hour < 24) return THEMES.EVENING;
  return THEMES.WITCHING; // 0–4
}

/**
 * The actual data-theme swap, plus badge/star side effects — unchanged
 * and instant. Crossfading (below) hides this instant swap behind an
 * overlay rather than trying to slow the swap itself down.
 */
function swapThemeAttribute(theme) {
  const body = document.body;
  body.removeAttribute('data-theme');
  body.setAttribute('data-theme', theme);

  const badge = document.querySelector('.theme-badge');
  if (badge) {
    badge.textContent = THEME_LABELS[theme] || '';
  }

  if (theme === THEMES.WITCHING) {
    generateStars();
  }
}

/* Lazily-created full-viewport overlay used to crossfade between themes.
   Themes are applied via a `data-theme` attribute (and whatever CSS custom
   properties themes.css keys off it), and CSS can't smoothly transition a
   custom-property change — most browsers swap it instantly, no matter what
   transition is declared on it. So rather than transitioning --theme-* vars
   directly, this overlay snapshots the outgoing background (a real,
   animatable `background` value) and fades its own `opacity` — both real,
   animatable CSS properties — up to fully cover the page, swaps the theme
   invisibly underneath, then fades back out to reveal the new one. */
let _themeFadeEl = null;
function getThemeFadeEl() {
  if (_themeFadeEl && document.body.contains(_themeFadeEl)) return _themeFadeEl;
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 9998;
    pointer-events: none;
    opacity: 0;
  `;
  document.body.appendChild(el);
  _themeFadeEl = el;
  return el;
}

const THEME_FADE_MS = 650;

/**
 * Applies the correct theme class to <body>.
 *
 * By default this crossfades smoothly; pass { animate: false } for an
 * instant swap (used for the very first paint, where there's nothing to
 * fade from).
 */
export function applyTheme(theme, { animate = true } = {}) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!animate || reducedMotion) {
    swapThemeAttribute(theme);
    return theme;
  }

  const overlay  = getThemeFadeEl();
  const computed = getComputedStyle(document.body);

  // Snapshot the CURRENT look before anything changes.
  overlay.style.transition = 'none';
  overlay.style.background = computed.backgroundImage && computed.backgroundImage !== 'none'
    ? computed.backgroundImage
    : computed.backgroundColor;
  overlay.style.opacity = '0';
  void overlay.offsetHeight; // force layout so the reset above is registered

  overlay.style.transition = `opacity ${THEME_FADE_MS}ms ease`;
  requestAnimationFrame(() => {
    overlay.style.opacity = '1'; // fade the snapshot IN, hiding the page
  });

  clearTimeout(overlay._fadeTimer);
  overlay._fadeTimer = setTimeout(() => {
    swapThemeAttribute(theme); // instant swap, invisible behind the overlay
    requestAnimationFrame(() => {
      overlay.style.opacity = '0'; // fade back OUT, revealing the new theme
    });
  }, THEME_FADE_MS);

  return theme;
}

/**
 * Detect + apply current theme immediately
 */
export function initTheme() {
  const hour = new Date().getHours();
  const theme = getThemeForHour(hour);
  applyTheme(theme, { animate: false }); // nothing to crossfade from on first paint

  // Check every 30 minutes for theme changes
  setInterval(() => {
    const newHour = new Date().getHours();
    const newTheme = getThemeForHour(newHour);
    if (newTheme !== document.body.getAttribute('data-theme')) {
      applyTheme(newTheme); // crossfades
    }
  }, 30 * 60 * 1000);

  return theme;
}

/**
 * Returns a greeting appropriate for the time of day
 */
export function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5  && hour < 9)  return "Good morning.";
  if (hour >= 9  && hour < 12) return "Good morning.";
  if (hour >= 12 && hour < 17) return "Good afternoon.";
  if (hour >= 17 && hour < 20) return "Good evening.";
  if (hour >= 20 && hour < 24) return "Late night, is it?";
  return "Still awake?";
}

/**
 * Lumi greeting line based on theme
 */
export function getLumiGreeting(theme, isReturn) {
  const greetings = {
    'golden-hour': isReturn
      ? ["The morning remembered you.", "You're back with the light."]
      : ["The light brought you here.", "A new morning. A new memory, maybe."],
    'afternoon':
      isReturn
        ? ["You came back.", "I was waiting for you."]
        : ["Plenty of day left.", "Something worth remembering today?"],
    'dusk':
      isReturn
        ? ["The day almost ended. Then you came back.", "Almost dark. I'm glad you're here."]
        : ["The day is turning.", "Dusk makes everything feel important."],
    'evening':
      isReturn
        ? ["You always come back to this place.", "I kept the light on."]
        : ["Evenings are made for remembering.", "A quiet hour. Good."],
    'witching':
      isReturn
        ? ["Even at this hour, you returned.", "This is the hour when things feel most real."]
        : ["The witching hour. You chose well.", "No one else is awake. Just us."]
  };

  const pool = greetings[theme] || ["Welcome back.", "Hello."];
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Generates stars for witching hour theme
 */
function generateStars() {
  let starsLayer = document.querySelector('.stars-layer');

  if (!starsLayer) {
    starsLayer = document.createElement('div');
    starsLayer.className = 'stars-layer';
    document.body.appendChild(starsLayer);
  }

  starsLayer.innerHTML = '';

  const count = 80;
  for (let i = 0; i < count; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    const size = Math.random() * 2.5 + 0.5;
    star.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      top: ${Math.random() * 100}vh;
      left: ${Math.random() * 100}vw;
      animation-duration: ${Math.random() * 3 + 2}s;
      animation-delay: ${Math.random() * 4}s;
    `;
    starsLayer.appendChild(star);
  }
}

/**
 * Returns a season name based on current month (Northern/Southern flexible)
 * Used for particle type selection
 */
export function getCurrentSeason() {
  const month = new Date().getMonth(); // 0–11
  if (month >= 2  && month <= 4)  return 'spring';
  if (month >= 5  && month <= 7)  return 'summer';
  if (month >= 8  && month <= 10) return 'autumn';
  return 'winter';
}