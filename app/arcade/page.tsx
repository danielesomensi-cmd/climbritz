import Link from 'next/link';

// ARCADE-001 — Deadpoint, a 3D deadpoint-timing mini-game, bundled as ONE
// self-contained HTML file in public/arcade/deadpoint.html (vendored from the
// deadpoint repo by scripts/sync-deadpoint.sh; JS + CSS inlined, no remote
// code). It runs in a same-origin iframe so three.js / WebGL stay out of the
// Next.js bundle and the game keeps its own document (fixed canvases, pointer
// handling, localStorage prefix `deadpoint:`).
//
// - `?lang=en` → English UI (the game's default is Italian for climbritz.app/gioco).
// - `?embed=1` → the host owns safe areas + navigation; the game reads neither
//   window.top nor opens links.
// - No BottomNav (it is mounted per page, so simply not rendering it frees the
//   screen) and no AuthGuard (playable signed-out, like /play).
// - Leaving the page unmounts the iframe → the game's audio and rAF loop stop.
// - Safe areas: .pt-safe (top, via --safe-top) on the header, .pb-safe on the
//   page — both unlayered utilities from app/safe-area.css, so the global
//   `* { padding: 0 }` reset can't zero them (see B034 v4 in app/page.tsx).
const DEADPOINT_SRC = '/arcade/deadpoint.html?lang=en&embed=1';

export default function ArcadePage() {
  return (
    <div
      data-testid="arcade-page"
      className="fixed inset-0 flex flex-col overflow-hidden overscroll-none bg-[#0b0d12] pb-safe"
    >
      <header className="shrink-0 pt-safe bg-surface-base/95 border-b border-border-default">
        <div
          className="flex items-center gap-1"
          style={{ paddingLeft: '0.5rem', paddingRight: '1rem', paddingBottom: '0.25rem' }}
        >
          <Link
            href="/"
            data-testid="arcade-back"
            aria-label="Back to Home"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center touch-manipulation select-none text-text-tertiary hover:text-orange-400"
          >
            <span aria-hidden className="text-2xl leading-none">←</span>
          </Link>
          <h1 className="text-page-title font-display">Deadpoint</h1>
        </div>
      </header>
      <iframe
        data-testid="arcade-frame"
        src={DEADPOINT_SRC}
        title="Deadpoint mini-game"
        allow="autoplay; fullscreen"
        allowFullScreen
        className="block w-full flex-1 min-h-0 border-0"
        style={{ border: 0, touchAction: 'none' }}
      />
    </div>
  );
}
