'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ApiError,
  getPyramid,
  getSessions,
  getTrend,
  type PyramidEntry,
  type PyramidResultFilter,
  type SessionResponse,
  type TrendEntry,
} from '@/app/lib/api';
import AuthGuard from '@/components/AuthGuard';
import BottomNav from '@/components/BottomNav';
import HistoryCalendar from './calendar';
import SessionsList from './sessions-list';
import GradePyramid from './grade-pyramid';
import TrendChart from './trend-chart';

const RANGE_PRESETS: Array<{ value: number | 'all'; label: string }> = [
  { value: 7, label: '7d' },
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
  { value: 365, label: '1y' },
  { value: 'all', label: 'All' },
];

const DEFAULT_RANGE: number | 'all' = 90;

function formatIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function resolveDateRange(range: number | 'all'): {
  from: string | undefined;
  to: string;
} {
  const today = new Date();
  const to = formatIso(today);
  if (range === 'all') return { from: undefined, to };
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - range + 1);
  return { from: formatIso(fromDate), to };
}

export default function HistoryPage() {
  return (
    <AuthGuard>
      <HistoryInner />
    </AuthGuard>
  );
}

function HistoryInner() {
  const [range, setRange] = useState<number | 'all'>(DEFAULT_RANGE);
  const dateRange = useMemo(() => resolveDateRange(range), [range]);

  const [sessions, setSessions] = useState<SessionResponse[]>([]);
  const [pyramid, setPyramid] = useState<PyramidEntry[]>([]);
  const [trend, setTrend] = useState<TrendEntry[]>([]);
  const [pyramidFilter, setPyramidFilter] = useState<PyramidResultFilter>(
    'send_or_better',
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      getSessions(dateRange.from, dateRange.to),
      getPyramid(dateRange.from, dateRange.to, pyramidFilter),
      getTrend(dateRange.from, dateRange.to),
    ])
      .then(([s, p, t]) => {
        if (cancelled) return;
        setSessions(s);
        setPyramid(p);
        setTrend(t);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof ApiError ? e.message : 'Failed to load history');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dateRange.from, dateRange.to, pyramidFilter]);

  // Calendar → session-card scroll. Each session card registers itself
  // here on mount via the ref-callback prop.
  const sessionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const registerSessionRef = useCallback(
    (iso: string, el: HTMLDivElement | null) => {
      if (el) sessionRefs.current.set(iso, el);
      else sessionRefs.current.delete(iso);
    },
    [],
  );
  const scrollToSession = useCallback((iso: string) => {
    const el = sessionRefs.current.get(iso);
    if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' });
  }, []);

  // Top-of-page stat counters derived from already-fetched data.
  const stats = useMemo(() => {
    const sessionsCount = sessions.length;
    let sends = 0;
    let flashes = 0;
    for (const s of sessions) {
      sends += s.sends;
      flashes += s.flashes;
    }
    // Peak = the last grade_band in the pyramid array (backend sorts
    // by grade label, so the last entry is the hardest one with logs).
    const peak = pyramid.length > 0 ? pyramid[pyramid.length - 1].grade_band : null;
    return { sessionsCount, sends, flashes, peak };
  }, [sessions, pyramid]);

  return (
    <div className="min-h-dvh bg-zinc-950 text-white pb-nav">
      <header className="sticky top-0 z-20 bg-zinc-950/95 backdrop-blur border-b border-zinc-800">
        <div className="max-w-2xl mx-auto px-4 pt-safe pb-3 space-y-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              data-testid="back-link"
              className="text-zinc-400 hover:text-orange-400 text-2xl leading-none"
              aria-label="Back to home"
            >
              ←
            </Link>
            <h1 className="text-xl font-bold">History</h1>
          </div>

          {/* Date range picker — preset buttons */}
          <div className="flex gap-1" data-testid="range-picker">
            {RANGE_PRESETS.map((p) => {
              const active = range === p.value;
              return (
                <button
                  key={String(p.value)}
                  type="button"
                  data-testid={`range-${p.value}`}
                  onClick={() => setRange(p.value)}
                  aria-pressed={active}
                  className={`flex-1 py-2 rounded-full text-xs border transition-colors ${
                    active
                      ? 'bg-orange-500 border-orange-500 text-white font-semibold'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-6">
        {/* Top stats strip */}
        <section
          data-testid="history-stats"
          className="grid grid-cols-4 gap-2"
        >
          <StatCard label="Sessions" value={stats.sessionsCount} />
          <StatCard label="Flashes" value={stats.flashes} icon="⚡" />
          <StatCard label="Sends" value={stats.sends} icon="✓" />
          <StatCard label="Peak" value={stats.peak ?? '—'} />
        </section>

        {error && (
          <div
            data-testid="history-error"
            role="alert"
            className="p-3 rounded-lg bg-red-900/40 border border-red-700 text-sm text-red-300"
          >
            {error}
          </div>
        )}

        {loading ? (
          <div
            data-testid="history-loading"
            className="text-center py-12 text-zinc-500"
          >
            Loading…
          </div>
        ) : (
          <>
            <section>
              <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-3">
                Activity
              </h2>
              <HistoryCalendar
                sessions={sessions}
                dateFrom={dateRange.from ?? sessions[sessions.length - 1]?.date ?? formatIso(new Date())}
                dateTo={dateRange.to}
                onDayClick={scrollToSession}
              />
            </section>

            <section>
              <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-3">
                Sessions
              </h2>
              <SessionsList
                sessions={sessions}
                registerSessionRef={registerSessionRef}
              />
            </section>

            <section>
              <GradePyramid
                entries={pyramid}
                resultFilter={pyramidFilter}
                onFilterChange={setPyramidFilter}
              />
            </section>

            <section>
              <TrendChart entries={trend} />
            </section>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number | string;
  icon?: string;
}

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-3 text-center">
      <div className="text-xl font-bold text-white tabular-nums">
        {icon && <span className="mr-1">{icon}</span>}
        {value}
      </div>
      <div className="text-[10px] text-zinc-500 uppercase tracking-wide mt-0.5">
        {label}
      </div>
    </div>
  );
}
