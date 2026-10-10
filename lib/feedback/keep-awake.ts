// NATIVE-001 — keep the screen on during a game.
//
// navigator.wakeLock is not guaranteed inside WKWebView, so on native we use
// @capacitor-community/keep-awake. On the web we try the Screen Wake Lock API
// as a best effort. Every call is wrapped: failing to keep the screen awake
// must never break the page.

import { isNativePlatform } from './haptics';

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

let webSentinel: WakeLockSentinelLike | null = null;

export async function keepAwake(): Promise<boolean> {
  try {
    if (await isNativePlatform()) {
      const { KeepAwake } = await import('@capacitor-community/keep-awake');
      await KeepAwake.keepAwake();
      return true;
    }
    const nav = (typeof navigator !== 'undefined' ? navigator : undefined) as
      | (Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinelLike> } })
      | undefined;
    if (nav?.wakeLock) {
      webSentinel = await nav.wakeLock.request('screen');
      return true;
    }
  } catch {
    // Unsupported / denied — the game still works, the screen may dim.
  }
  return false;
}

export async function allowSleep(): Promise<void> {
  try {
    if (await isNativePlatform()) {
      const { KeepAwake } = await import('@capacitor-community/keep-awake');
      await KeepAwake.allowSleep();
      return;
    }
    if (webSentinel) {
      const s = webSentinel;
      webSentinel = null;
      await s.release();
    }
  } catch {
    // Already released — nothing to do.
  }
}
