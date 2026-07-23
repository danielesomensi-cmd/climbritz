'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { UserButton } from '@clerk/clerk-react';
import AuthGuard from '@/components/AuthGuard';

interface Tile {
  href: string;
  label: string;
  subtitle: string;
  icon: string;
  // A027: `external` tiles open a non-route URL (mailto:) via a plain <a> the
  // OS/WebView delegates to the system handler — NOT SPA navigation.
  external?: boolean;
}

// A027 — Contact tile. No backend: tapping opens the native mail composer via
// mailto:. The body carries a version/build footer (filled from @capacitor/app
// on native; omitted on web) so Daniele can tell which build feedback came from.
const CONTACT_EMAIL = 'daniele.somensi@gmail.com';
const CONTACT_SUBJECT = 'Climbritz feedback';
const CONTACT_TILE_HREF = 'contact:feedback'; // sentinel (React key only; the
// rendered href is the runtime-built mailto in HomeContent).

function buildMailto(versionLabel: string | null): string {
  // Two blank lines for the user to type above an optional provenance footer.
  const body = versionLabel ? `\n\n---\nClimbritz ${versionLabel}` : '\n\n';
  return (
    `mailto:${CONTACT_EMAIL}` +
    `?subject=${encodeURIComponent(CONTACT_SUBJECT)}` +
    `&body=${encodeURIComponent(body)}`
  );
}

// A021 follow-up: Debug is a developer-only diagnostic. It stays at
// /debug as a direct URL for emergency network checks, but the homepage
// tile is hidden in production / mobile builds so end users see only
// the 5 product tiles.
const IS_PRODUCTION_BUILD =
  process.env.NEXT_PUBLIC_MOBILE === 'true' ||
  process.env.NODE_ENV === 'production';

const TILES: Tile[] = [
  {
    // A026: AI problem generator (remix). New top section — the most
    // "AI" thing a free user can do: pick filters → generate → light up.
    href: '/generate',
    label: 'AI Create',
    subtitle: 'Generate a problem',
    icon: '✨',
  },
  {
    // B033: Discover is the hero — the core find → light → climb loop, and the
    // differentiator vs Climbdex (board light-up). Promoted to top-left.
    href: '/discover',
    label: 'Discover',
    subtitle: 'Search & light up climbs',
    icon: '🔍',
  },
  {
    href: '/history',
    label: 'History',
    subtitle: 'Sessions, pyramid, trend',
    icon: '📊',
  },
  {
    // A027: one-tap feedback → native mail composer (mailto, no backend).
    href: CONTACT_TILE_HREF,
    label: 'Contact',
    subtitle: 'Send feedback',
    icon: '✉️',
    external: true,
  },
  {
    href: '/classify',
    label: 'Classify',
    subtitle: 'Tag hold grip types',
    icon: '🏷️',
  },
  {
    // B033: demoted from top-left — it's a BLE connection test, not the core
    // loop.
    href: '/ble-test',
    label: 'Demo LED Light',
    subtitle: 'Test BLE connection',
    icon: '💡',
  },
  {
    // A-STORE-PROD-001 Phase 2: the COMING SOON pill is gone and the tile is
    // a normal entry point. Coach L1 analysis has been live for a while, so
    // the pill was factually wrong — and a placeholder in a shipping build is
    // an App Store Guideline 2.1 rejection trigger. (History: B021 added the
    // pill in May 2026 while the Coach tier was still being tuned.)
    href: '/upload',
    label: 'Video Analysis',
    subtitle: 'AI technique coaching',
    icon: '🎬',
  },
  ...(IS_PRODUCTION_BUILD
    ? []
    : [
        {
          href: '/debug',
          label: 'Debug',
          subtitle: 'Network diagnostics',
          icon: '🔧',
        },
      ]),
];

function HomeContent() {
  // A027 — default to the web/no-version mailto; upgrade to a version-stamped
  // one on native once @capacitor/app resolves. Dynamic import keeps Capacitor
  // off the module graph for web/jest (web stays on the fallback href).
  const [mailtoHref, setMailtoHref] = useState(() => buildMailto(null));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;
        const { App } = await import('@capacitor/app');
        const info = await App.getInfo();
        if (!cancelled) {
          setMailtoHref(buildMailto(`v${info.version} (build ${info.build})`));
        }
      } catch {
        // No @capacitor/app (web) or getInfo failed → keep the footer-less href.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    // B033 Phase 4 (D18-12): ported off inline styles to Tailwind classes +
    // design tokens. Hero gradient is the named --hero-gradient token (2.1).
    // B034 v4 — paddingTop is an INLINE style, NOT a Tailwind `pt-[...]` utility.
    // globals.css has an UNLAYERED `* { padding: 0 }` reset; Tailwind utilities
    // live in `@layer utilities`, and unlayered rules beat layered ones in the
    // CSS cascade — so the pt utility computed to 0 and the wordmark sat behind
    // the Dynamic Island regardless of --safe-top's value (the real reason B032
    // / B034 v1–v3 never fixed it). An inline style outranks the reset.
    <div
      className="relative min-h-screen flex flex-col items-center px-4 pb-8 bg-[image:var(--hero-gradient)]"
      style={{ paddingTop: 'calc(var(--safe-top) + 2.5rem)' }}
    >
      {/* B032 — account / sign-out entry point. Clerk's hosted menu owns
          profile management + sign-out (afterSignOutUrl → /sign-in), purely
          client-side. Anchored top-right (safe-area aware). */}
      {/* A-STORE-PROD-001 Phase 2 — the gear sits NEXT TO the avatar, not
          inside its menu: App Review needs to reach account deletion in one
          tap from the main screen, and a link inside a popover is the kind of
          thing a reviewer reports as missing. */}
      <div className="absolute right-4 top-[calc(var(--safe-top)_+_0.75rem)] z-10 flex items-center gap-3">
        <Link
          href="/settings"
          aria-label="Settings"
          data-testid="home-settings-link"
          className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-zinc-400 hover:bg-orange-500/10 hover:text-orange-400 transition-colors"
        >
          <span aria-hidden>⚙️</span>
        </Link>
        <UserButton afterSignOutUrl="/sign-in" />
      </div>

      {/* Wordmark */}
      <h1 className="font-display text-display m-0 text-center tracking-[-2px] text-[color:var(--brand-orange)] [text-shadow:0_0_40px_rgba(255,107,53,0.6)]">
        CLIMBRITZ
      </h1>
      <p className="mt-2 mb-12 text-center text-base font-medium text-zinc-400">
        AI Climbing Companion
      </p>

      {/* Tile Grid */}
      <div className="grid grid-cols-2 gap-4 w-full max-w-[420px]">
        {TILES.map((tile, i) => {
          // Odd tile count leaves a gap in the 2-col grid — let the last tile
          // span both columns so the grid reads as deliberate, not orphaned.
          const fullWidth = i === TILES.length - 1 && TILES.length % 2 === 1;
          const className = `relative flex flex-col items-center justify-center min-h-[140px] px-4 py-6 rounded-card bg-orange-500/[0.06] border border-orange-500/20 hover:bg-orange-500/10 hover:border-orange-500/40 transition-colors ${
            fullWidth ? 'col-span-2' : ''
          }`;
          const inner = (
            <>
              <span className="text-[40px] mb-3">{tile.icon}</span>
              <span className="text-[15px] font-bold text-center text-zinc-200">
                {tile.label}
              </span>
              <span className="mt-1 text-xs text-center text-zinc-400">
                {tile.subtitle}
              </span>
            </>
          );

          // A027: external (mailto) tiles render a plain <a> so the OS handles
          // the scheme; internal tiles stay SPA <Link>s.
          if (tile.external) {
            return (
              <a
                key={tile.href}
                href={mailtoHref}
                data-testid="tile-contact"
                className={className}
              >
                {inner}
              </a>
            );
          }
          return (
            <Link key={tile.href} href={tile.href} className={className}>
              {inner}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <AuthGuard>
      <HomeContent />
    </AuthGuard>
  );
}
