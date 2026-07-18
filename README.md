# 🕯️ ECHOES — A Living Memory Gallery

> *"Some places only exist when you remember them."*

A personal online diary & memory gallery. Float through your memories. Keep them forever. Share them with a secret link.

---

## ✦ What This Is

Echoes is a beautifully atmospheric personal memory gallery where:

- **Memories float** — each entry drifts slowly across an infinite canvas
- **Lumi watches** — a ghost NPC reacts to your memories, greets you, and keeps your world alive
- **Time changes everything** — the gallery shifts appearance based on the hour (golden hour, dusk, witching hour...)
- **Sharing feels like a gift** — give someone a secret soul link and they enter your world as a welcomed guest

---

## ✦ Stack

| Layer    | Tool                          | Why |
|----------|-------------------------------|-----|
| Frontend | Vanilla HTML5 / CSS3 / JS ES6 | No framework needed — full control |
| Data     | Firebase Firestore            | Text memories, tags, metadata |
| Files    | Firebase Storage              | Photos, audio, video |
| Code     | GitHub                        | Version control, history |
| Hosting  | Netlify                       | Free, auto-deploys on git push |

---

## ✦ Quick Start (Demo Mode)

No setup needed! Just open `index.html` in a browser:

```bash
# Option 1: Python server
python3 -m http.server 8080
# then visit http://localhost:8080

# Option 2: VS Code Live Server
# Install "Live Server" extension, right-click index.html → Open with Live Server
```

In Demo Mode, memories save to your browser's `localStorage`. Everything works — you just can't share across devices without Firebase.

---

## ✦ Full Setup (Firebase + GitHub + Netlify)

### Step 1 — Firebase

1. Go to [firebase.google.com](https://firebase.google.com) → Create a free project
2. Enable **Firestore Database** (Start in test mode)
3. Enable **Firebase Storage** (Start in test mode)
4. Go to Project Settings → Web app → copy your config
5. In your project folder:
   ```bash
   cp js/firebase-config.template.js js/firebase-config.js
   ```
6. Open `js/firebase-config.js` and paste your keys

> ⚠️ `firebase-config.js` is in `.gitignore` — it will never be pushed to GitHub.

**Firestore Security Rules** (paste in Firebase Console → Firestore → Rules):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /memories/{id} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /settings/{doc} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

### Step 2 — GitHub

```bash
git init
git add .
git commit -m "initial commit — Echoes"
git remote add origin https://github.com/YOUR_USERNAME/echoes.git
git push -u origin main
```

After this: every `git push` auto-updates your live site.

### Step 3 — Netlify

1. [netlify.com](https://netlify.com) → Add new site → Import from GitHub
2. Select your `echoes` repo
3. Build settings:
   - Build command: *(leave empty)*
   - Publish directory: `/`
4. Deploy!

Your site is live at `something.netlify.app`.

---

## ✦ File Structure

```
echoes/
├── index.html          ← Entry Gate
├── gallery.html        ← The Memory World
├── create.html         ← Write a Memory
├── share.html          ← Generate Secret Link
│
├── css/
│   ├── base.css        ← Design tokens, resets, cursor, grain
│   ├── animations.css  ← All keyframes
│   ├── gallery.css     ← Floating card layout, controls
│   ├── cards.css       ← 5 card types (photo, journal, audio, doodle, video)
│   ├── ghost.css       ← Lumi states, speech bubbles
│   └── themes.css      ← Time-of-day theme overrides
│
├── js/
│   ├── firebase.js          ← Firebase init (graceful fallback)
│   ├── firebase-config.js   ← YOUR KEYS (gitignored)
│   ├── lumi.js              ← Ghost NPC brain
│   ├── gallery.js           ← Floating card engine
│   ├── audio.js             ← Ambient sound system
│   ├── particles.js         ← 3-layer particle system
│   ├── storage.js           ← CRUD (Firebase or localStorage)
│   ├── secret-link.js       ← Share key system
│   └── time-theme.js        ← Time detection & theme application
│
└── assets/
    ├── sounds/             ← Place your .mp3 audio files here
    └── textures/           ← Optional texture images
```

---

## ✦ Adding Sound Files

Place these `.mp3` files in `assets/sounds/` for the ambient audio system:

| Filename                      | Mood              |
|-------------------------------|-------------------|
| `lofi-piano-rain.mp3`         | melancholy        |
| `ambient-morning-light.mp3`   | peaceful, hopeful |
| `soft-strings-night.mp3`      | dark, evening     |
| `vinyl-crackle.mp3`           | all (subtle layer)|

> Find royalty-free ambient music at: [freemusicarchive.org](https://freemusicarchive.org), [pixabay.com/music](https://pixabay.com/music), or [zapsplat.com](https://zapsplat.com)

Sound won't break if files are missing — the system generates a soft ambient fallback.

---

## ✦ Time Themes

Echoes detects the local time and adjusts its appearance:

| Time          | Theme         | Feel |
|---------------|---------------|------|
| 5am – 9am     | Golden Hour   | Warm amber haze |
| 9am – 5pm     | Afternoon     | Clean sage greens |
| 5pm – 8pm     | Dusk          | Purple-amber fog |
| 8pm – 12am    | Evening       | Dark, luminous |
| 12am – 5am    | Witching Hour | Near-black, stars, glowing |

---

## ✦ Secret Link System

1. Go to `share.html`
2. Optionally add a password
3. Click **Generate secret link**
4. Share the link — visitors can view, never edit

Link format: `yoursite.netlify.app/gallery.html?soul=xK7mP2`

---

## ✦ Easter Eggs

- Type **`lumi`** anywhere on the page — she spins and responds
- Type **`goodbye`** — she'll cry (tear particle effect)
- Add your **100th memory** — the whole gallery flashes gold
- Come back after **30+ days away** — she missed you

---

## ✦ Phase 2 Ideas

- Memory Constellations (connect related memories with glowing lines)
- Fog of Time (old memories blur, restored by visiting)
- Lumi's Journal (she's been writing her own observations)
- Seasonal skins (particles change by real-world month)
- Export as PDF scrapbook

---

*Built with love, fog, and the quiet of 2am.*

*— Echoes ✦*
