# Echoes — Setup Guide

Getting Echoes connected to your Google Drive takes about 10 minutes.
Do it once, and the gallery feeds itself forever.

---

## What you need

- A Google account (you already have one)
- Your **MEMORIES LOVEY** folder in Google Drive
- The two values from Steps 1 and 2 below

---

## Step 1 — Get a Google API Key

1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Click **Select a project → New Project** → name it anything (e.g. "Echoes")
3. In the left sidebar: **APIs & Services → Library**
4. Search for **Google Drive API** → click it → click **Enable**
5. Go to **APIs & Services → Credentials**
6. Click **+ Create Credentials → API key**
7. Copy the key — it looks like `AIzaSyB...`

**Restrict the key** (important — prevents abuse):
- Click **Edit API key**
- Under *Application restrictions*: choose **HTTP referrers**
- Add your Netlify URL: `https://your-site.netlify.app/*`  
  *(also add `http://localhost:*` if you test locally)*
- Under *API restrictions*: choose **Restrict key → Google Drive API**
- Click **Save**

---

## Step 2 — Get your Folder ID

1. Open [drive.google.com](https://drive.google.com)
2. Navigate into your **MEMORIES LOVEY** folder
3. Look at the URL — it looks like:
   ```
   https://drive.google.com/drive/folders/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs77M
                                           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                           this long string is your Folder ID
   ```
4. Copy that long string

---

## Step 3 — Share the folder publicly

1. Right-click **MEMORIES LOVEY** → **Share**
2. Under **General access**: change to **Anyone with the link**
3. Make sure it says **Viewer** (read-only)
4. Click **Done**

This lets Echoes read your files without requiring a login on the site.  
The folder isn't indexed by Google — only people with the direct link can see it.

---

## Step 4 — Paste both values into config.js

Open `js/config.js` and replace the placeholders:

```js
export const DRIVE_CONFIG = {
  apiKey:   'AIzaSyB...',                       // ← your API key from Step 1
  folderId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUq...', // ← your folder ID from Step 2
  pollIntervalMs: 2 * 60 * 1000,                // check every 2 minutes
};
```

---

## Step 5 — Deploy to Netlify

1. Push your project to GitHub (if not already)
2. Go to [netlify.com](https://netlify.com) → **Add new site → Import from Git**
3. Select your repo → Netlify auto-detects it's a static site
4. Click **Deploy**
5. Done — visit your `.netlify.app` URL

---

## How it works after setup

| Action | What happens |
|--------|-------------|
| Drop a photo into MEMORIES LOVEY | Appears as a floating card within 2 minutes |
| Drop a video into MEMORIES LOVEY | Appears with a film-strip card, plays full-screen on click |
| Drop an audio file | Appears as a cassette card, plays in the overlay |
| Click the **Sync** button | Checks Drive immediately, pulls any new files |
| Password gate | Enter `09/22/2025` — same shared password for both of you |

---

## Troubleshooting

**"couldn't reach drive" toast appears**  
→ Check that your API key and folder ID in `config.js` are correct  
→ Check that the MEMORIES LOVEY folder is shared as "Anyone with the link"

**Images don't show on cards**  
→ Make sure the folder is set to Viewer access, not restricted  
→ Try opening `https://drive.google.com/thumbnail?id=YOUR_FILE_ID&sz=w400` in a browser — if you see the image, it's working

**Videos show a black box**  
→ Google Drive takes a few minutes to process new video uploads — wait and try again  
→ Make sure the file is `.mp4` or `.mov`

**API key error in the console**  
→ Add your Netlify domain to the API key's HTTP referrer restrictions  
→ Also add `http://localhost:*` if testing locally

---

*That's it. Add files to the folder, watch them float in. ✦*
