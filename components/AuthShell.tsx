'use client';

import type { ReactNode } from 'react';

// B033 Phase 2.6 — branded shell for the Clerk auth pages. /sign-in is the very
// first screen a new tester sees (no anonymous mode), and the bare Clerk widget
// rendered with default Clerk styling — unbranded form on a dark page. This adds
// the wordmark above the widget and a dark, brand-orange Clerk `appearance`.
//
// `variables` only (no @clerk/themes dependency): colorBackground/colorText push
// the widget dark; colorPrimary is the brand; colorTextOnPrimaryBackground is the
// near-black text on the orange primary button, matching the 2.2 AA-contrast fix.
export const clerkAppearance = {
  variables: {
    colorPrimary: '#ff6b35',
    colorBackground: '#18181b',          // surface-raised (card sits above the zinc-950 page)
    colorText: '#fafafa',                // text-primary
    colorTextSecondary: '#a1a1aa',       // text-tertiary
    colorInputBackground: '#27272a',     // surface-overlay
    colorInputText: '#fafafa',
    colorTextOnPrimaryBackground: '#09090b', // near-black on orange (D18-8 contrast)
    borderRadius: '12px',                // radius-card
  },
};

export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center pt-safe pb-4 px-4">
      <div className="mb-6 text-center">
        <h1
          className="font-display font-black"
          style={{
            fontSize: 'clamp(32px, 9vw, 56px)',
            color: 'var(--brand-orange)',
            textShadow: '0 0 40px rgba(255, 107, 53, 0.5)',
            letterSpacing: '-1.5px',
            margin: 0,
          }}
        >
          CLIMBRITZ
        </h1>
        <p className="text-sm text-zinc-400 mt-1">AI Climbing Companion</p>
      </div>
      {children}
    </div>
  );
}
