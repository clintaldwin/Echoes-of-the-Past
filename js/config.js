/* ═══════════════════════════════════════════════════════════
   ECHOES — config.js
   ─────────────────────────────────────────────────────────
   This is the ONLY file you need to edit.
   See SETUP.md for step-by-step instructions.
═══════════════════════════════════════════════════════════ */

export const DRIVE_CONFIG = {

  // ① Google Cloud Console → APIs & Services → Credentials → Create API Key
  //   Restrict it: Application restriction = HTTP referrers → your Netlify domain
  //   API restriction = Google Drive API only
  apiKey: 'AIzaSyAcHw2dVerFFiOGJeRajgaGOBAhDG3pwus',

  // ② Open your "MEMORIES LOVEY" folder in Google Drive
  //   Copy the long string from the URL after /folders/
  //   Example: drive.google.com/drive/folders/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs
  //                                            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  folderId: '1CjNDirbdvMA-HHryH_4DiRYEfk7jVqSS',

  // How often to silently check for new memories (milliseconds)
  // Default: every 2 minutes. Set to 0 to disable polling.
  pollIntervalMs: 2 * 60 * 1000,

};
