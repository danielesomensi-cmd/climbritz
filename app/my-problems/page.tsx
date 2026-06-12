'use client';

// A030 — My Problems: the user's saved AI-generated climbs. List view;
// detail (board + BLE + logging + edit) lives at /my-problems/detail?id=.
// Capacitor-safe: query-param routing, SPA nav, AuthGuard-wrapped.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listMyClimbs, type MyClimb } from '@/app/lib/api';
import AuthGuard from '@/components/AuthGuard';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/ui/PageHeader';
import LoadingState from '@/components/ui/LoadingState';
import EmptyState from '@/components/ui/EmptyState';
import GradeDisplay from '@/components/GradeDisplay';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function MyProblemsPage() {
  return (
    <AuthGuard>
      <MyProblemsPageInner />
    </AuthGuard>
  );
}

function MyProblemsPageInner() {
  const [problems, setProblems] = useState<MyClimb[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMyClimbs()
      .then((data) => {
        if (!cancelled) setProblems(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load problems');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-dvh bg-zinc-950 text-white pb-nav">
      <PageHeader
        back={{ href: '/generate', label: 'Create', testid: 'back-link' }}
        title="My Problems"
      />

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {error && (
          <div data-testid="my-problems-error" className="text-center py-12 text-red-400">
            {error}
          </div>
        )}

        {!error && problems === null && (
          <div data-testid="my-problems-loading">
            <LoadingState />
          </div>
        )}

        {problems !== null && problems.length === 0 && (
          <EmptyState
            icon="🤖"
            title="No saved problems yet"
            hint="Generate a problem and tap Save to keep it here."
            action={
              <Link
                href="/generate"
                className="text-orange-400 font-semibold"
                data-testid="empty-create-link"
              >
                Create with AI →
              </Link>
            }
          />
        )}

        {problems !== null &&
          problems.map((p) => (
            <Link
              key={p.uuid}
              href={`/my-problems/detail?id=${p.uuid}`}
              data-testid={`my-problem-card-${p.uuid}`}
              className="flex items-center gap-4 p-4 rounded-card bg-surface-raised border border-border-default hover:border-orange-500/50 hover:bg-zinc-800/60 transition-colors"
            >
              <GradeDisplay grade={p.grade ?? '?'} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="text-white font-semibold truncate">{p.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                  <span>
                    {p.ascent_count} {p.ascent_count === 1 ? 'ascent' : 'ascents'}
                  </span>
                  <span>{formatDate(p.created_at)}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-zinc-400 uppercase tracking-wide">Angle</div>
                <div className="text-white font-semibold">{p.angle}°</div>
              </div>
            </Link>
          ))}
      </main>

      <BottomNav />
    </div>
  );
}
