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

// Play closed testing (track "Closed testing - Alpha"). Only members of the
// Google Group can opt in, so Android is a two-step flow: join the group
// (public — anyone with a Google account can join), then opt in.
// Both URLs verified in Play Console → Closed testing → Testers on 2026-10-17
// ("Join on the web" link + testers list = climbritz-testers@googlegroups.com).
export const ANDROID_GROUP_URL = 'https://groups.google.com/g/climbritz-testers';
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

/**
 * Where /get auto-redirects a platform; `null` = stay on the page.
 *
 * Android stays on /get on purpose: the Play opt-in page refuses anyone who is
 * not yet in the tester Google Group, so the page shows the two steps instead.
 */
export function installUrlFor(platform: Platform): string | null {
  switch (platform) {
    case 'ios':
      return IOS_INSTALL_URL;
    default:
      return null;
  }
}
