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
  locked?: boolean;
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
    label: 'Create with AI',
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
    // B021 (2026-05-19): Coach tier not production-ready (prompt tuning
    // incomplete, no Stripe paywall). `locked: true` now renders a
    // COMING SOON pill instead of the 🔒 lock so testers don't expect
    // working analysis. Tile stays clickable → /upload remains URL-
    // reachable for power users / debugging.
    href: '/upload',
    label: 'Video Analysis',
    subtitle: 'AI technique coaching',
    icon: '🎬',
    locked: true,
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
    <div className="relative min-h-screen flex flex-col items-center px-4 pb-8 pt-[calc(var(--safe-top)_+_2.5rem)] bg-[image:var(--hero-gradient)]">
      {/* B032 — account / sign-out entry point. Clerk's hosted menu owns
          profile management + sign-out (afterSignOutUrl → /sign-in), purely
          client-side. Anchored top-right (safe-area aware). */}
      <div className="absolute right-4 top-[calc(var(--safe-top)_+_0.75rem)] z-10">
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
              {tile.locked && (
                <span
                  data-testid="tile-video-analysis-coming-soon"
                  className="absolute right-2 top-2 inline-block px-2 py-0.5 rounded-pill bg-orange-500 text-zinc-950 text-[10px] font-bold uppercase tracking-wider"
                >
                  Coming Soon
                </span>
              )}
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
