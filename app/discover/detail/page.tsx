'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getClimbDetail, type ClimbDetail } from '@/app/lib/api';
import ClimbBoardView, { ROLE_COLORS } from '@/components/ClimbBoardView';
import ClimbBleControls from '@/components/ClimbBleControls';
import GradeDisplay from '@/components/GradeDisplay';
import StarRating from '@/components/StarRating';
import BottomNav from '@/components/BottomNav';
import { climbToLedCommands } from './climb-to-leds';
import { resolvePosition } from '../filtered-list-storage';

const ROLE_LABELS: Record<string, string> = {
  start: 'Start',
  middle: 'Middle',
  finish: 'Finish',
  foot_only: 'Foot',
};

function formatAscents(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

export default function ClimbDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <ClimbDetailPageInner />
    </Suspense>
  );
}

function ClimbDetailPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const uuid = searchParams?.get('id') ?? '';
  const angleParam = searchParams?.get('angle');
  const angle = angleParam ? Number(angleParam) : undefined;

  const [climb, setClimb] = useState<ClimbDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // A014: Resolve Next/Prev navigation context from the sessionStorage list
  // saved by /discover. Recomputed on every uuid change (nav updates query
  // params, not the mounted component).
  const position = useMemo(() => (uuid ? resolvePosition(uuid) : null), [uuid]);
  const hasNav = position !== null;
  const canPrev = hasNav && position.index > 0;
  const canNext = hasNav && position.index < position.list.climbIds.length - 1;

  // Flipped once the user taps Next/Prev. Stays true for the rest of the
  // session so subsequent neighbour climbs also auto-illuminate when
  // connected. ClimbBleControls debounces the actual BLE write (300ms) and
  // uses climb.uuid as the dedup key.
  const [autoSendOnNav, setAutoSendOnNav] = useState(false);

  const navigateToNeighbour = (delta: -1 | 1) => {
    if (!position) return;
    const targetIndex = position.index + delta;
    if (targetIndex < 0 || targetIndex >= position.list.climbIds.length) return;
    const nextUuid = position.list.climbIds[targetIndex];
    setAutoSendOnNav(true);
    router.push(`/discover/detail?id=${nextUuid}&angle=${position.list.angle}`);
  };

  useEffect(() => {
    if (!uuid) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getClimbDetail(uuid, angle)
      .then((data) => {
        if (!cancelled) setClimb(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load climb');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [uuid, angle]);

  const stats = climb?.stats[0];
  const roleCounts = climb
    ? climb.holds.reduce<Record<string, number>>((acc, h) => {
        acc[h.role] = (acc[h.role] ?? 0) + 1;
        return acc;
      }, {})
    : {};
  const ledCommands = useMemo(
    () => (climb ? climbToLedCommands(climb.holds) : []),
    [climb],
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-24">
      <header className="sticky top-0 z-20 bg-zinc-950/95 backdrop-blur border-b border-zinc-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/discover"
            data-testid="back-link"
            className="text-zinc-400 hover:text-orange-400 text-2xl leading-none"
            aria-label="Back to Discover"
          >
            ←
          </Link>
          <div className="text-sm text-zinc-400">Discover</div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-5">
        {loading && (
          <div data-testid="detail-loading" className="text-center py-12 text-zinc-500">
            Loading climb…
          </div>
        )}

        {error && (
          <div data-testid="detail-error" className="text-center py-12 text-red-400">
            {error}
          </div>
        )}

        {climb && stats && (
          <>
            {/* Title block */}
            <div className="flex items-start gap-4">
              <GradeDisplay grade={stats.grade} size="lg" />
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold truncate" data-testid="climb-name">
                  {climb.name}
                </h1>
                <div className="text-sm text-zinc-400">by {climb.setter}</div>
                <div className="mt-1 flex items-center gap-3 text-sm">
                  <StarRating value={stats.quality_average} size={14} />
                  <span className="text-zinc-400">
                    {formatAscents(stats.ascensionist_count)} ascents
                  </span>
                  <span className="text-zinc-400">{stats.angle}°</span>
                </div>
              </div>
            </div>

            {climb.description && (
              <p className="text-sm text-zinc-300 whitespace-pre-line" data-testid="climb-description">
                {climb.description}
              </p>
            )}

            {/* BLE control bar — connect + illuminate this climb on the board */}
            <ClimbBleControls
              ledCommands={ledCommands}
              climbKey={climb.uuid}
              autoSendOnKeyChange={autoSendOnNav}
            />

            {/* Board visualization */}
            <ClimbBoardView holds={climb.holds} />

            {/* Role legend */}
            <div className="flex flex-wrap gap-3 text-xs">
              {Object.entries(ROLE_LABELS).map(([role, label]) => (
                <div key={role} className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ backgroundColor: ROLE_COLORS[role] }}
                  />
                  <span className="text-zinc-300">
                    {label}
                    {roleCounts[role] ? ` (${roleCounts[role]})` : ''}
                  </span>
                </div>
              ))}
            </div>

            {/* Other angles available */}
            {climb.stats.length > 1 && (
              <div>
                <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
                  Other angles
                </div>
                <div className="flex flex-wrap gap-2" data-testid="other-angles">
                  {climb.stats.slice(1).map((s) => (
                    <Link
                      key={s.angle}
                      href={`/discover/detail?id=${uuid}&angle=${s.angle}`}
                      className="px-3 py-1.5 rounded-full text-sm border border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-orange-500/50 hover:text-orange-400 transition-colors"
                    >
                      {s.angle}° · {s.grade.split('/')[0]}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Actions — "Light up" moved into the ClimbBleControls bar above. */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled
                title="Coming soon"
                className="flex-1 py-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-500 text-sm cursor-not-allowed"
              >
                ❤️ Favorite
              </button>
              <Link
                href="/upload"
                className="flex-1 py-3 rounded-lg bg-orange-500 text-white text-sm font-semibold text-center hover:bg-orange-600 transition-colors"
              >
                🎬 Analyze with Coach
              </Link>
            </div>

            {/* A014: Next/Prev through the saved filtered list. Hidden on
                deep links (no saved list OR current uuid not in it). */}
            {hasNav && (
              <div
                data-testid="list-nav"
                className="flex items-center gap-3 pt-1"
              >
                <button
                  type="button"
                  data-testid="list-nav-prev"
                  onClick={() => navigateToNeighbour(-1)}
                  disabled={!canPrev}
                  className="flex-1 py-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm hover:border-zinc-600 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-zinc-800 disabled:hover:text-zinc-300"
                >
                  ← Prev
                </button>
                <span
                  data-testid="list-nav-position"
                  className="text-xs text-zinc-500 shrink-0 tabular-nums"
                >
                  {position.index + 1} of {position.list.climbIds.length}
                </span>
                <button
                  type="button"
                  data-testid="list-nav-next"
                  onClick={() => navigateToNeighbour(1)}
                  disabled={!canNext}
                  className="flex-1 py-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm hover:border-zinc-600 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-zinc-800 disabled:hover:text-zinc-300"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
