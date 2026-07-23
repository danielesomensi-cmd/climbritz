'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** If set, this tab is active when the path starts with this prefix. */
  match?: string;
}

// B021 (2026-05-19): Coach slot removed pending Coach tier production
// readiness. A-STORE-PROD-001 (2026-07-23) dropped the matching COMING SOON
// pill from the homepage tile — analysis is live — but the nav stays at 4
// slots: /upload is reachable from the Video Analysis tile, and a 5th slot
// is a layout decision, not a release blocker.
const ITEMS: NavItem[] = [
  { href: '/', label: 'Home', icon: '🏠', match: '/' },
  { href: '/discover', label: 'Discover', icon: '🔍', match: '/discover' },
  { href: '/history', label: 'History', icon: '📊', match: '/history' },
  { href: '/dashboard', label: 'Profile', icon: '👤', match: '/dashboard' },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.href === '/') return pathname === '/';
  const prefix = item.match ?? item.href;
  return pathname.startsWith(prefix);
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
              className={`flex flex-col items-center justify-center py-2 text-xs transition-colors ${
                active ? 'text-orange-400' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span className="text-lg leading-none mb-0.5" aria-hidden="true">
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
