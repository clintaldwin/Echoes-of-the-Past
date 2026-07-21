/* ═══════════════════════════════════════════════════════════
   ECHOES — drive.js
   Google Drive integration — reads MEMORIES LOVEY folder,
   maps files to Memory objects, polls for new arrivals.
═══════════════════════════════════════════════════════════ */

import { DRIVE_CONFIG } from './config.js';

/* ─── MIME type → card type ─── */
function detectType(mimeType = '') {
  if (mimeType.startsWith('video/'))  return 'video';
  if (mimeType.startsWith('audio/'))  return 'audio';
  if (mimeType.startsWith('image/'))  return 'photo';
  if (mimeType === 'text/plain' || mimeType === 'application/vnd.google-apps.document') return 'letter';
  return 'photo'; // fallback
}

/* ─── Deterministic mood from file ID (no metadata needed) ─── */
const MOOD_POOL = ['peaceful', 'peaceful', 'hopeful', 'peaceful', 'melancholy', 'passionate', 'hopeful'];
function moodFromId(id = '') {
  const hash = id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return MOOD_POOL[hash % MOOD_POOL.length];
}

/* ─── Pretty date string ─── */
function formatDate(isoStr) {
  if (!isoStr) return '';
  try {
    return new Date(isoStr).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric'
    });
  } catch { return isoStr; }
}

/* ─── URL builders for public Drive files ─── */

// Thumbnail for floating cards (Drive resizes server-side)
function thumbnailUrl(fileId, mimeType) {
  if (mimeType.startsWith('image/') || mimeType.startsWith('video/')) {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w600`;
  }
  return null;
}

// Full-resolution URL for the overlay viewer
function fullUrl(fileId, mimeType) {
  if (mimeType.startsWith('image/')) {
    // Google's CDN serves public Drive images directly
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }
  if (mimeType.startsWith('video/')) {
    // Drive preview iframe with autoplay
    return `https://drive.google.com/file/d/${fileId}/preview?autoplay=1`;
  }
  if (mimeType.startsWith('audio/')) {
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }
  if (mimeType === 'application/vnd.google-apps.document') {
    // Docs aren't a raw file — they need their own export endpoint.
    return `https://docs.google.com/document/d/${fileId}/export?format=txt`;
  }
  if (mimeType === 'text/plain') {
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

/* ─── Drive file → Memory object ─── */
function toMemory(file) {
  const rawName  = file.name || 'untitled';
  const title    = rawName.replace(/\.[^/.]+$/, ''); // strip extension
  const mimeType = file.mimeType || 'image/jpeg';
  const type     = detectType(mimeType);

  return {
    id:        file.id,
    title,
    rawName,
    type,
    mimeType,
    mood:      moodFromId(file.id),
    date:      file.createdTime,
    dateStr:   formatDate(file.createdTime),
    body:      '',
    tags:      [],
    thumbnail: thumbnailUrl(file.id, mimeType),
    fileURL:   fullUrl(file.id, mimeType),
    driveId:   file.id,
  };
}

/* ═══════════════════════════════════════════════════════════
   DriveStore — the main data layer
═══════════════════════════════════════════════════════════ */
class DriveStore {
  constructor(config = DRIVE_CONFIG) {
    this._apiKey      = config.apiKey;
    this._folderId    = config.folderId;
    this._pollMs      = config.pollIntervalMs;
    this._rawFiles    = [];     // raw Drive API response objects
    this._memories    = [];     // mapped Memory objects
    this._pollerTimer = null;
    this._listeners   = [];     // onChange callbacks
    this._loaded      = false;
  }

  /* ── Public: check if config.js has been filled in ── */
  isConfigured() {
    return (
      this._apiKey   !== 'YOUR_GOOGLE_API_KEY_HERE'      && this._apiKey.length   > 10 &&
      this._folderId !== 'YOUR_MEMORIES_LOVEY_FOLDER_ID_HERE' && this._folderId.length > 10
    );
  }

  /* ── Public: load and return all memories ── */
  async getAll() {
    if (!this._loaded) {
      this._rawFiles = await this._fetchFiles();
      this._memories = this._rawFiles.map(toMemory);
      this._loaded   = true;
    }
    return this._memories;
  }

  /* ── Public: get single memory by ID ── */
  async get(id) {
    await this.getAll();
    return this._memories.find(m => m.id === id) || null;
  }

  /* ── Public: build a direct-stream URL for the Drive API v3 media endpoint ──
     Used for native <video>/<audio> playback (bypasses the cross-origin
     preview iframe). Uses the same API key already configured for this
     store — the file must be shared publicly ("Anyone with the link")
     for key-based access to work. Also works for a real text/plain file
     dropped in the folder (a "letter" memory) — alt=media serves any raw
     file, just not native Google Workspace formats (see exportTextUrl). */
  streamUrl(fileId) {
    if (!fileId) return null;
    return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${this._apiKey}`;
  }

  /* ── Public: export a native Google Doc as plain text ──
     alt=media returns an error for Google Workspace formats (Docs,
     Sheets, Slides) since they have no single raw file to serve — they
     need this separate /export endpoint instead. Same API-key auth as
     streamUrl, same "anyone with the link" sharing requirement. */
  exportTextUrl(fileId) {
    if (!fileId) return null;
    return `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text%2Fplain&key=${this._apiKey}`;
  }

  /* ── Public: start polling for new files ── */
  startPolling() {
    if (!this.isConfigured() || !this._pollMs || this._pollerTimer) return;

    this._pollerTimer = setInterval(async () => {
      try {
        const fresh  = await this._fetchFiles();
        const oldIds = new Set(this._rawFiles.map(f => f.id));
        const added  = fresh.filter(f => !oldIds.has(f.id));

        if (added.length > 0) {
          const newMems    = added.map(toMemory);
          this._rawFiles   = fresh;
          this._memories   = [...newMems, ...this._memories];
          this._listeners.forEach(cb => cb(newMems));
        }
      } catch (err) {
        console.warn('[echoes/drive] Poll failed:', err.message);
      }
    }, this._pollMs);
  }

  stopPolling() {
    clearInterval(this._pollerTimer);
    this._pollerTimer = null;
  }

  /* ── Public: register a listener for new memories ── */
  onChange(callback) {
    this._listeners.push(callback);
    return () => { this._listeners = this._listeners.filter(l => l !== callback); };
  }

  /* ── Lightweight session utilities (replaces storage.js stubs) ── */
  isReturnVisit() {
    return localStorage.getItem('echoes_visited') === '1';
  }

  markVisited() {
    const was = this.isReturnVisit();
    localStorage.setItem('echoes_visited', '1');
    localStorage.setItem('echoes_lastSeen', Date.now().toString());
    return was;
  }

  async checkMissedYou() {
    const last = parseInt(localStorage.getItem('echoes_lastSeen') || '0', 10);
    if (!last) return false;
    return (Date.now() - last) > 7 * 24 * 60 * 60 * 1000; // > 7 days
  }

  /* ── Private: call Drive API ── */
  async _fetchFiles() {
    const q      = encodeURIComponent(`'${this._folderId}' in parents and trashed = false`);
    const fields = encodeURIComponent('files(id,name,mimeType,createdTime,size)');
    const url    = [
      'https://www.googleapis.com/drive/v3/files',
      `?q=${q}`,
      `&fields=${fields}`,
      '&orderBy=createdTime%20desc',
      '&pageSize=200',
      `&key=${this._apiKey}`,
    ].join('');

    const res = await fetch(url);

    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        msg = body?.error?.message || msg;
      } catch { /* ignore */ }
      throw new Error(msg);
    }

    const data = await res.json();
    return data.files || [];
  }
}

/* ─── Singleton export ─── */
export const DRIVE = new DriveStore(DRIVE_CONFIG);
