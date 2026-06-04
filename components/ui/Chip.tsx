'use client';

import { type ButtonHTMLAttributes } from 'react';

// B033 Phase 3 — filter / toggle / segmented-option primitive. ONE selected
// style (soft outline) — the single active vocabulary that closes D18-3 — and a
// 44px minimum tap target (the sub-44 Discover/History finding).
export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

export default function Chip({
  selected = false,
  disabled = false,
  className = '',
  children,
  ...rest
}: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      className={[
        'inline-flex items-center justify-center min-h-[44px] px-3 rounded-pill text-sm border transition-colors',
        selected
          ? 'bg-orange-500/15 border-orange-500 text-orange-200 font-semibold'
          : 'bg-surface-overlay border-border-strong text-text-secondary hover:border-zinc-600',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </button>
  );
}
