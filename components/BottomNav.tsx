'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  /** Path prefixes that mark this tab active (defaults to `href`). */
  match?: string[];
}

// B021 (2026-05-19): Coach slot removed pending Coach tier production
// readiness. A-STORE-PROD-001 (2026-07-23) dropped the matching COMING SOON
// pill from the homepage tile — analysis is live — but the nav stays at 4
// slots: /upload is reachable from the Video Analysis tile, and a 5th slot
// is a layout decision, not a release blocker.
// UX-002 / QW8: the 4th tab was labelled "Profile" but /dashboard is the
// video list ("Your videos") — renamed to "Videos" and it now also lights up
// on the video detail + upload screens it leads to.
// Line icons (inline SVG, stroke = currentColor) instead of emoji: they take
// the active/inactive tab colour and look the same on iOS and Android.
function NavIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const ITEMS: NavItem[] = [
  {
    href: '/',
    label: 'Home',
    icon: (
      <NavIcon>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V20h5v-6h4v6h5V9.5" />
      </NavIcon>
    ),
  },
  {
    href: '/discover',
    label: 'Discover',
    icon: (
      <NavIcon>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </NavIcon>
    ),
  },
  {
    href: '/history',
    label: 'History',
    icon: (
      <NavIcon>
        <path d="M4 20V10" />
        <path d="M10 20V4" />
        <path d="M16 20v-7" />
        <path d="M22 20H2" />
      </NavIcon>
    ),
  },
  {
    href: '/dashboard',
    label: 'Videos',
    match: ['/dashboard', '/videos', '/upload'],
    icon: (
      <NavIcon>
        <rect x="2.5" y="6" width="13" height="12" rx="2" />
        <path d="m15.5 10.5 6-3.5v10l-6-3.5" />
      </NavIcon>
    ),
  },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.href === '/') return pathname === '/';
  const prefixes = item.match ?? [item.href];
  return prefixes.some((prefix) => pathname.startsWith(prefix));
}

export default function BottomNav() {
  const pathname = usePathname() ?? '/';

  return (
    <nav
      data-testid="bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-30 pb-safe bg-zinc-950/95 backdrop-blur border-t border-zinc-800"
    >
      <div className="max-w-2xl mx-auto grid grid-cols-4">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={`nav-${item.label.toLowerCase()}`}
              aria-current={active ? 'page' : undefined}
              className={`relative flex min-h-[52px] flex-col items-center justify-center py-2 text-xs touch-manipulation select-none transition-colors ${
                active ? 'text-orange-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {/* Active indicator — a short brand-orange bar on the top edge,
                  so the current tab doesn't rely on colour alone. */}
              {active && (
                <span
                  data-testid="bottom-nav-active-indicator"
                  aria-hidden="true"
                  className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-orange-500"
                />
              )}
              <span className="mb-0.5" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
