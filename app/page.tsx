'use client';

import Link from 'next/link';
import { UserButton } from '@clerk/clerk-react';
import AuthGuard from '@/components/AuthGuard';

interface Tile {
  href: string;
  label: string;
  subtitle: string;
  icon: string;
  locked?: boolean;
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
    href: '/ble-test',
    label: 'Demo LED Light',
    subtitle: 'Test BLE connection',
    icon: '💡',
  },
  {
    href: '/discover',
    label: 'Discover',
    subtitle: 'Search 160k+ climbs',
    icon: '🔍',
  },
  {
    href: '/classify',
    label: 'Classify',
    subtitle: 'Tag hold grip types',
    icon: '🏷️',
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
  {
    href: '/history',
    label: 'History',
    subtitle: 'Sessions, pyramid, trend',
    icon: '📊',
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
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--hero-gradient)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 'max(env(safe-area-inset-top), 48px)',
        paddingLeft: '16px',
        paddingRight: '16px',
        paddingBottom: '32px',
        position: 'relative',
      }}
    >
      {/* B032 — account / sign-out entry point. Clerk's hosted menu owns
          profile management + sign-out (afterSignOutUrl → /sign-in), purely
          client-side. Anchored top-right (safe-area aware) so it never
          crowds the wordmark or the tile grid. */}
      <div
        style={{
          position: 'absolute',
          top: 'max(env(safe-area-inset-top), 16px)',
          right: '16px',
          zIndex: 10,
        }}
      >
        <UserButton afterSignOutUrl="/sign-in" />
      </div>

      {/* Header */}
      <h1
        style={{
          fontSize: 'clamp(40px, 10vw, 72px)',
          fontWeight: 900,
          color: 'var(--brand-orange)',
          textShadow: '0 0 40px rgba(255, 107, 53, 0.6)',
          letterSpacing: '-2px',
          margin: 0,
          textAlign: 'center',
        }}
      >
        CLIMBRITZ
      </h1>
      <p
        style={{
          fontSize: '16px',
          color: '#94a3b8',
          margin: '8px 0 48px',
          textAlign: 'center',
          fontWeight: 500,
        }}
      >
        AI Climbing Companion
      </p>

      {/* Tile Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          width: '100%',
          maxWidth: '420px',
        }}
      >
        {TILES.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '140px',
              padding: '24px 16px',
              borderRadius: '16px',
              background: 'rgba(255, 107, 53, 0.06)',
              border: '1px solid rgba(255, 107, 53, 0.2)',
              textDecoration: 'none',
              transition: 'all 0.2s ease',
              position: 'relative',
            }}
          >
            <span style={{ fontSize: '40px', marginBottom: '12px' }}>{tile.icon}</span>
            <span
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: '#e2e8f0',
                textAlign: 'center',
              }}
            >
              {tile.label}
            </span>
            <span
              style={{
                fontSize: '12px',
                color: '#94a3b8',
                marginTop: '4px',
                textAlign: 'center',
              }}
            >
              {tile.subtitle}
            </span>
            {tile.locked && (
              <span
                data-testid="tile-video-analysis-coming-soon"
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  backgroundColor: 'var(--brand-orange)',
                  color: '#ffffff',
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Coming Soon
              </span>
            )}
          </Link>
        ))}
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
