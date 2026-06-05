'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

// B034 — make the top safe-area inset actually clear the Dynamic Island on the
// native iOS WebView.
//
// Background: B032 padded the homepage hero with calc(env(safe-area-inset-top)
// + 2.5rem) and added viewport-fit=cover. Both are present in the bundled
// native index.html (verified), yet the iOS build still clipped the title
// behind the Dynamic Island. Root cause is NOT a missing viewport meta — it's
// that the Capacitor iOS WKWebView resolves env(safe-area-inset-top) to 0 in
// this configuration, so only the 2.5rem fallback applied (~40px < ~59px island).
//
// Rather than blindly hardcode padding on all iOS (which would over-pad
// notchless devices), this probes at runtime whether env() resolves. We measure
// the rendered height of a fixed element sized to env(safe-area-inset-top):
//   - env works  → height > 0 → leave --safe-top = env(...) (accurate per device).
//   - env broken → height ~0 → override --safe-top with a Dynamic-Island-safe
//                  59px so the hero clears the island.
// Scoped to native iOS only; web and Android are never touched.
export default function IosSafeArea() {
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'ios' || !Capacitor.isNativePlatform()) {
      return;
    }

    const probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;top:0;left:0;width:1px;height:env(safe-area-inset-top);' +
      'visibility:hidden;pointer-events:none;';
    document.body.appendChild(probe);
    const measured = probe.getBoundingClientRect().height;
    probe.remove();

    const root = document.documentElement;
    root.classList.add('ios-native');
    // Expose the measurement for field debugging (invisible; inspect in Safari
    // Web Inspector → <html data-safe-top="…">).
    root.dataset.safeTop = String(Math.round(measured));

    if (measured < 1) {
      // env(safe-area-inset-top) is broken on this WebView → apply a fallback
      // sized for the Dynamic Island. Slightly over-pads pre-island devices,
      // but never clips — and current TestFlight hardware is island-class.
      root.style.setProperty('--safe-top', '59px');
    }
  }, []);

  return null;
}
