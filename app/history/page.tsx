'use client';

import { useEffect, useMemo, useState } from 'react';
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
import CoachComment from './coach-comment';
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

  // Top-of-page stat counters derived from already-fetched data — no extra
  // endpoint. A024: added `climbs` (total volume in range), summed from the
  // sessions payload.
  const stats = useMemo(() => {
    const sessionsCount = sessions.length;
    let climbs = 0;
    let sends = 0;
    let flashes = 0;
    for (const s of sessions) {
      climbs += s.total_climbs;
      // B033: SENDS is "send-or-better" — a flash IS a send. The backend
      // session payload splits them (s.sends = plain sends, s.flashes =
      // flashes), so the top SENDS card sums both. FLASHES below stays the
      // flash-only subset. (Per-session badges + the pyramid are unchanged.)
      sends += s.sends + s.flashes;
      flashes += s.flashes;
    }
    // Peak = the last grade_band in the pyramid array (backend sorts
    // by grade label, so the last entry is the hardest one with logs).
    const peak = pyramid.length > 0 ? pyramid[pyramid.length - 1].grade_band : null;
    return { sessionsCount, climbs, sends, flashes, peak };
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
        {/* A025 — on-tap AI progress comment (free, ephemeral). Lives in the
            slot A024 reserved: under the range picker, above the stats. */}
        <CoachComment dateFrom={dateRange.from} dateTo={dateRange.to} />

        {/* A024 stats header (B033 uniform polish) — a 2+3 grid of
            equal-size, equally-treated tiles, all derived from the
            already-fetched sessions + pyramid payloads. Climbs carries a
            subtle orange accent as the headline volume metric but is the same
            size as the rest. */}
        <section data-testid="history-stats" className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Climbs" value={stats.climbs} icon="🧗" accent />
            <StatTile label="Sessions" value={stats.sessionsCount} icon="📅" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StatTile label="Sends" value={stats.sends} icon="✓" />
            <StatTile label="Flashes" value={stats.flashes} icon="⚡" />
            <StatTile label="Peak" value={stats.peak ?? '—'} icon="🏆" />
          </div>
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
                Sessions
              </h2>
              <SessionsList sessions={sessions} />
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

interface StatTileProps {
  label: string;
  value: number | string;
  icon?: string;
  /** Subtle orange accent for the headline volume metric. Same size as the
   *  rest — accent is colour only, not dimensions. */
  accent?: boolean;
}

// B033: uniform stat tile. Every card is the same size + treatment (fixed
// min-height, centered icon-over-number-over-label, identical type scale) so
// the 2+3 grid reads as one cohesive block rather than a hero + leftovers.
function StatTile({ label, value, icon, accent = false }: StatTileProps) {
  // B026: dim zero-value tiles so the stats block celebrates wins instead of
  // visually flagging gaps. Non-zero stays full-saturation.
  const isZero = typeof value === 'number' && value === 0;
  return (
    <Card
      data-testid={`stat-card-${label.toLowerCase()}`}
      className={[
        'flex flex-col items-center justify-center text-center min-h-[88px] px-2 py-3',
        accent ? 'bg-orange-500/[0.08] border-orange-500/30' : '',
        isZero ? 'opacity-50' : '',
      ].join(' ')}
    >
      {icon && <span className="text-lg leading-none mb-1.5">{icon}</span>}
      <span
        className={[
          'text-2xl font-bold tabular-nums leading-none',
          isZero
            ? 'text-zinc-500'
            : accent
              ? 'text-[color:var(--brand-orange)]'
              : 'text-white',
        ].join(' ')}
      >
        {value}
      </span>
      <span className="text-[10px] text-zinc-500 uppercase tracking-wide mt-1.5">
        {label}
      </span>
    </Card>
  );
}
