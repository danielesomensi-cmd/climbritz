'use client';

import Link from 'next/link';
import { type ReactNode } from 'react';

// B033 Phase 3 — consistent top-of-page header (D18-13). `top-level` (no back
// arrow — Discover/History/Classify/BLE) vs `nested` (back arrow + parent label
// — /discover/detail). One page-title size for every <h1>. Sticky, blurred,
// safe-area aware.
export interface PageHeaderProps {
  title: ReactNode;
  /** Nested variant: renders a back link above the title. */
  back?: { href: string; label?: string };
  /** Optional controls rendered to the right of the title row. */
  right?: ReactNode;
  /** Extra content below the title row (e.g. a range picker). */
  children?: ReactNode;
  /** Inner container max-width (defaults to max-w-2xl to match most pages). */
  widthClass?: string;
}

export default function PageHeader({
  title,
  back,
  right,
  children,
  widthClass = 'max-w-2xl',
}: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-20 bg-surface-base/95 backdrop-blur border-b border-border-default">
      <div className={`${widthClass} mx-auto px-4 pt-safe pb-3`}>
        {back && (
          <Link
            href={back.href}
            className="inline-flex items-center gap-1 text-sm text-text-tertiary hover:text-text-primary mb-1"
          >
            <span aria-hidden>←</span>
            {back.label ?? 'Back'}
          </Link>
        )}
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold leading-tight">{title}</h1>
          {right}
        </div>
        {children}
      </div>
    </header>
  );
}
