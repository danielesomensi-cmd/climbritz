'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import PageHeader from '@/components/ui/PageHeader';
import Chip from '@/components/ui/Chip';
import Card from '@/components/ui/Card';
import LoadingState from '@/components/ui/LoadingState';
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
      {/* B026: no back arrow — /history is a top-level BottomNav route. */}
      <PageHeader title="History">
        <div className="flex gap-1 mt-3" data-testid="range-picker">
          {RANGE_PRESETS.map((p) => (
            <Chip
              key={String(p.value)}
              data-testid={`range-${p.value}`}
              selected={range === p.value}
              onClick={() => setRange(p.value)}
              className="flex-1 px-1"
            >
              {p.label}
            </Chip>
          ))}
        </div>
      </PageHeader>

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
          <div data-testid="history-loading">
            <LoadingState />
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
  // B026: dim zero-value tiles so the stats strip celebrates wins instead of
  // visually flagging gaps. Non-zero stays full-saturation.
  const isZero = typeof value === 'number' && value === 0;
  return (
    <Card
      data-testid={`stat-card-${label.toLowerCase()}`}
      className={`px-2 py-3 text-center ${isZero ? 'opacity-50' : ''}`}
    >
      <div
        className={`text-xl font-bold tabular-nums ${
          isZero ? 'text-zinc-500' : 'text-white'
        }`}
      >
        {icon && <span className="mr-1">{icon}</span>}
        {value}
      </div>
      <div className="text-[10px] text-zinc-500 uppercase tracking-wide mt-0.5">
        {label}
      </div>
    </Card>
  );
}
