'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

// Dynamic-Island-safe floor for the top inset on native iOS. The current
// island-class hardware reports a ~59px safe-area-inset-top; 16 Pro is ~62px
// (covered by the max() below when env() actually resolves). 59px never clips
// on island devices and, layered under the hero's extra +2.5rem, leaves the
// wordmark well clear of the island.
const IOS_TOP_FLOOR_PX = 62; // covers Dynamic Island (~59) + iPhone 16 Pro (~62)

// B034 (hardened) — guarantee the top safe-area inset clears the Dynamic Island
// on the native iOS WebView.
//
// History:
//  - B032 padded the hero with calc(env(safe-area-inset-top) + 2.5rem) +
//    viewport-fit=cover. Both present in the bundled native index.html, yet the
//    iOS build still clipped the title behind the island.
//  - B034 v1 probed whether env() resolved and ONLY overrode --safe-top with a
//    59px fallback when the probe measured < 1px ("env reads exactly 0").
//    Shipped in iOS build 8/9 — and STILL clipped on device.
//
// Root cause of the v1 miss: the Capacitor WKWebView does not necessarily
// resolve env(safe-area-inset-top) to *exactly* 0. It can return a small,
// island-insufficient value (e.g. a legacy ~20px status-bar height or a
// subpixel), which is >= 1 — so the v1 "< 1" branch never fired and left an
// inset far smaller than the ~59px island. Result: only ~40px of padding (the
// 2.5rem base) under a ~59px island → clipped.
//
// Hardened fix: stop trusting env() to be either correct OR exactly 0. On
// native iOS, ALWAYS pin --safe-top to max(env(safe-area-inset-top), 59px) so:
//   - env broken (0 / too small) → floored at 59px (clears the island).
//   - env correct & larger (e.g. 62px on 16 Pro) → honoured, no under-pad.
// The only cost is over-padding notch-less iOS (iPhone SE → 59px instead of
// ~20px) — purely cosmetic, never a clip, and current TestFlight hardware is
// island-class. Web and Android are never touched (early return).
export default function IosSafeArea() {
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'ios' || !Capacitor.isNativePlatform()) {
      return;
    }

    const root = document.documentElement;
    root.classList.add('ios-native');

    // Measure what env() actually resolves to, purely for field debugging
    // (invisible; inspect in Safari Web Inspector → <html data-safe-top="…">).
    // The applied value below does NOT depend on this — it's diagnostics only.
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;top:0;left:0;width:1px;height:env(safe-area-inset-top);' +
      'visibility:hidden;pointer-events:none;';
    document.body.appendChild(probe);
    const measured = probe.getBoundingClientRect().height;
    probe.remove();
    root.dataset.safeTop = String(Math.round(measured));

    // Unconditionally floor the inset on native iOS. max() keeps the real
    // per-device inset when env() works and is larger; otherwise guarantees a
    // Dynamic-Island-safe minimum regardless of how the WebView mis-reports env.
    // B034 v3 — resolve to a PLAIN px value in JS; never leave env() inside the
    // applied custom property. v1/hardened set --safe-top to a string CONTAINING
    // env() (e.g. `max(env(safe-area-inset-top,0px), 59px)`). Some iOS WebKit
    // builds fail to evaluate env() when it's referenced indirectly through a
    // custom property inside calc() — so `calc(var(--safe-top) + 2.5rem)` became
    // invalid → padding-top dropped to 0 → the hero stayed clipped behind the
    // island even after the "hardened" fix. Computing the max() here against the
    // already-measured probe value yields a pure number, which calc() can never
    // fail to resolve.
    const applied = Math.max(Math.round(measured), IOS_TOP_FLOOR_PX);
    root.style.setProperty('--safe-top', `${applied}px`);
  }, []);

  return null;
}
