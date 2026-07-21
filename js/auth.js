/* ═══════════════════════════════════════════════════════════
   ECHOES — auth.js
   SHA-256 password gate. No accounts — just one shared
   password between two people.
═══════════════════════════════════════════════════════════ */

const AUTH_KEY    = 'echoes_authenticated';
const STORED_HASH = '5f52d64e00375bd167a4bd892793cd97114bd91fde395e26934a1c9aece7d89c';
// ^ SHA-256 of "09/22/2025"

async function sha256(str) {
  const encoded = new TextEncoder().encode(str);
  const buf     = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function isAuthenticated() {
  return localStorage.getItem(AUTH_KEY) === '1';
}

export async function authenticate(password) {
  const hash = await sha256(password.trim());
  if (hash === STORED_HASH) {
    localStorage.setItem(AUTH_KEY, '1');
    return true;
  }
  return false;
}

export function logout() {
  localStorage.removeItem(AUTH_KEY);
}

export function requireAuth(redirectTo = 'index.html') {
  if (!isAuthenticated()) {
    window.location.replace(redirectTo);
    return false;
  }
  return true;
}
