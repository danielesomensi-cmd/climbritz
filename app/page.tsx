'use client';

import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';

interface Tile {
  href: string;
  label: string;
  subtitle: string;
  icon: string;
  locked?: boolean;
}

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
    // A019.16: user is signed in by the time they see this tile (page is
    // AuthGuard-wrapped). The 🔒 lock now signals "Coach paid tier" — when
    // Stripe paywall lands, this href flips to /paywall.
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
  {
    href: '/debug',
    label: 'Debug',
    subtitle: 'Network diagnostics',
    icon: '🔧',
  },
];

function HomeContent() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #000 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 'max(env(safe-area-inset-top), 48px)',
        paddingLeft: '16px',
        paddingRight: '16px',
        paddingBottom: '32px',
      }}
    >
      {/* Header */}
      <h1
        style={{
          fontSize: 'clamp(40px, 10vw, 72px)',
          fontWeight: 900,
          color: '#FF6B35',
          textShadow: '0 0 40px rgba(255, 107, 53, 0.6)',
          letterSpacing: '-2px',
          margin: 0,
          textAlign: 'center',
        }}
      >
        KILTER UP
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
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  fontSize: '14px',
                  color: '#94a3b8',
                }}
              >
                🔒
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
