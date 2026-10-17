'use client';

// A032 — climbritz.app/get: the one link (and the in-app QR target) that
// sends a friend to the right install page.
//
// - Public: no AuthGuard (like /privacy). Static route, no dynamic segment,
//   no next/image — Capacitor static-export safe.
// - On mount: iPhone/iPad → TestFlight. Android and desktop stay here: Play's
//   opt-in refuses non-members of the tester Google Group, so Android gets
//   the two steps (join group → opt in) on the page.
// - Never redirects inside the native app: the route ships in the static
//   bundle too and must not yank the WebView off to an install page.
// - The buttons are plain <a> links pre-rendered into the HTML, so the page
//   works before (or without) JS.
// - This page is web-only, so the TestFlight wording is fine here. In-app
//   copy stays store-neutral (Guideline 2.2) — see Settings → Invite a friend.

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import AuthShell from '@/components/AuthShell';
import { PRESSABLE_CLASSES } from '@/components/ui/pressable';
import {
  ANDROID_GROUP_URL,
  ANDROID_INSTALL_URL,
  IOS_INSTALL_URL,
  detectPlatform,
  installUrlFor,
} from '@/lib/installLinks';

// Primary-button look (components/ui/Button, size lg) for an <a>.
const LINK_BUTTON_CLASSES = [
  'inline-flex w-full items-center justify-center gap-2 rounded-card font-semibold',
  PRESSABLE_CLASSES,
  'bg-orange-500 hover:bg-orange-400 text-zinc-950',
  'min-h-[56px] px-6 text-base',
].join(' ');

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export default function GetPage() {
  useEffect(() => {
    if (isNative()) return;
    const url = installUrlFor(
      detectPlatform(navigator.userAgent, navigator.maxTouchPoints),
    );
    if (url) window.location.replace(url);
  }, []);

  return (
    <AuthShell>
      <div data-testid="get-page" className="flex w-full max-w-sm flex-col">
        <a
          href={IOS_INSTALL_URL}
          data-testid="get-ios-link"
          className={LINK_BUTTON_CLASSES}
        >
          Get it on iPhone
        </a>
        <p className="mt-2 text-center text-sm text-text-tertiary">
          Install the free TestFlight app first, then tap Accept → Install.
        </p>
        <p className="mt-8 text-center text-sm font-semibold text-text-secondary">
          On Android — two quick steps
        </p>
        <a
          href={ANDROID_GROUP_URL}
          data-testid="get-android-group-link"
          className={`${LINK_BUTTON_CLASSES} mt-2`}
        >
          1 · Join the tester group
        </a>
        <p className="mt-2 text-center text-sm text-text-tertiary">
          Sign in with your Google account and tap Join group.
        </p>
        <a
          href={ANDROID_INSTALL_URL}
          data-testid="get-android-link"
          className={`${LINK_BUTTON_CLASSES} mt-4`}
        >
          2 · Get it on Android
        </a>
        <p className="mt-2 text-center text-sm text-text-tertiary">
          Tap Become a tester, then Download it on Google Play.
        </p>
      </div>
    </AuthShell>
  );
}
