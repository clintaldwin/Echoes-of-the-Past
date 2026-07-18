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
 * Applies the correct theme class to <body>
 */
export function applyTheme(theme) {
  const body = document.body;

  // Remove any existing theme
  body.removeAttribute('data-theme');

  // Apply new theme
  body.setAttribute('data-theme', theme);

  // Update theme badge if present
  const badge = document.querySelector('.theme-badge');
  if (badge) {
    badge.textContent = THEME_LABELS[theme] || '';
  }

  // Witching hour: generate stars
  if (theme === THEMES.WITCHING) {
    generateStars();
  }

  return theme;
}

/**
 * Detect + apply current theme immediately
 */
export function initTheme() {
  const hour = new Date().getHours();
  const theme = getThemeForHour(hour);
  applyTheme(theme);

  // Check every 30 minutes for theme changes
  setInterval(() => {
    const newHour = new Date().getHours();
    const newTheme = getThemeForHour(newHour);
    if (newTheme !== document.body.getAttribute('data-theme')) {
      applyTheme(newTheme);
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
