// A032 — the one shareable install entry point.
//
// INVITE_URL is what the in-app QR (Settings → Invite a friend) encodes. It
// never changes: when the app goes public on the stores only the two install
// targets below move, so no app update and no new QR are needed.
//
// The install targets are web-side only (/get). In-app copy must stay
// store-neutral (App Store Guideline 2.2) — never render these URLs or any
// "beta" / "TestFlight" / "testing" wording inside the app.

export const INVITE_URL = 'https://climbritz.app/get';

export const IOS_INSTALL_URL = 'https://testflight.apple.com/join/m61nAQ53';

// Play closed-testing opt-in. No opt-in URL or Google Group is documented in
// the repo (docs/, PROJECT_STATUS.md, ROADMAP_ACTIVE.md, android/), so this is
// the standard Play pattern for package `app.climbritz` — confirm it against
// Play Console → Testing → Closed testing → "Join on the web".
export const ANDROID_INSTALL_URL = 'https://play.google.com/apps/testing/app.climbritz';

export type Platform = 'ios' | 'android' | 'other';

/**
 * Classify a device from its user agent.
 *
 * iPadOS 13+ Safari sends a desktop "Macintosh" UA; a Mac has no multi-touch
 * screen, so `maxTouchPoints > 1` is what tells the iPad apart.
 */
export function detectPlatform(ua: string, maxTouchPoints = 0): Platform {
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Macintosh/.test(ua) && maxTouchPoints > 1) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

/** Install page for a platform; `null` when there is nothing to redirect to. */
export function installUrlFor(platform: Platform): string | null {
  switch (platform) {
    case 'ios':
      return IOS_INSTALL_URL;
    case 'android':
      return ANDROID_INSTALL_URL;
    default:
      return null;
  }
}
