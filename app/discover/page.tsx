'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  searchClimbs,
  API_BASE,
  type ClimbSearchResult,
  type DoneFilter,
  type MovesFilter,
  type ProjectFilter,
  type SortField,
} from '@/app/lib/api';
import ClimbCard from '@/components/ClimbCard';
import FilterPanel, { countActiveFilters, type Filters } from '@/components/FilterPanel';
import BottomNav from '@/components/BottomNav';
import AuthGuard from '@/components/AuthGuard';
import { saveFilteredList } from './filtered-list-storage';
import { loadDiscoverFilters, saveDiscoverFilters } from './discover-filters-storage';

const ANGLES = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70];
const DEFAULT_ANGLE = 40;

// A021.4 — chip row used twice (Done + Project). Each chip has the
// same tri-state vocabulary; only labels and testids vary. Inline as a
// helper since it's local to this page.
const CHIP_OPTIONS: Array<{ value: 'all' | 'only' | 'exclude'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'only', label: 'Only' },
  { value: 'exclude', label: 'Exclude' },
];

interface ChipRowProps {
  label: string;
  testidPrefix: string;
  value: 'all' | 'only' | 'exclude';
  onChange: (value: 'all' | 'only' | 'exclude') => void;
}

function ChipRow({ label, testidPrefix, value, onChange }: ChipRowProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide shrink-0 w-16">
        {label}
      </span>
      <div className="flex gap-1 flex-1">
        {CHIP_OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              data-testid={`${testidPrefix}-${opt.value}`}
              onClick={() => onChange(opt.value)}
              aria-pressed={active}
              className={`flex-1 px-2 py-1.5 rounded-full text-xs border transition-colors ${
                active
                  ? 'bg-orange-500/15 border-orange-500 text-orange-200 font-semibold'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-600'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
const SORT_VALUES: SortField[] = ['popularity', 'quality', 'grade_asc', 'grade_desc'];
const MOVES_VALUES: MovesFilter[] = ['any', 'le5', '6-7', '8-10', 'gt10'];
const DONE_VALUES: DoneFilter[] = ['all', 'only', 'exclude'];
const PROJECT_VALUES: ProjectFilter[] = ['all', 'only', 'exclude'];

function parseInitialQuery(params: URLSearchParams): string {
  return params.get('q') ?? '';
}

function parseInitialAngle(params: URLSearchParams): number {
  const raw = params.get('angle');
  const n = raw ? Number(raw) : DEFAULT_ANGLE;
  return ANGLES.includes(n) ? n : DEFAULT_ANGLE;
}

function parseInitialFilters(params: URLSearchParams): Filters {
  const sort = params.get('sort');
  const moves = params.get('moves');
  const doneFilter = params.get('done_filter');
  const projectFilter = params.get('project_filter');
  return {
    gradeMin: params.get('grade_min') ? Number(params.get('grade_min')) : undefined,
    gradeMax: params.get('grade_max') ? Number(params.get('grade_max')) : undefined,
    minAscents: params.get('min_ascents') ? Number(params.get('min_ascents')) : undefined,
    minQuality: params.get('min_quality') ? Number(params.get('min_quality')) : undefined,
    moves: (MOVES_VALUES.includes(moves as MovesFilter) ? moves : 'any') as MovesFilter,
    sort: (SORT_VALUES.includes(sort as SortField) ? sort : 'popularity') as SortField,
    doneFilter: (DONE_VALUES.includes(doneFilter as DoneFilter)
      ? doneFilter
      : 'all') as DoneFilter,
    projectFilter: (PROJECT_VALUES.includes(projectFilter as ProjectFilter)
      ? projectFilter
      : 'all') as ProjectFilter,
  };
}

const URL_FILTER_KEYS = [
  'q',
  'angle',
  'grade_min',
  'grade_max',
  'min_ascents',
  'min_quality',
  'moves',
  'sort',
  'done_filter',
  'project_filter',
];

// Initial state resolution: URL params take priority (deep-link intent),
// then sessionStorage (returning from detail), then hardcoded defaults.
function resolveInitialState(
  params: URLSearchParams,
): { query: string; angle: number; filters: Filters } {
  const hasUrlParam = URL_FILTER_KEYS.some((k) => params.has(k));
  if (hasUrlParam) {
    return {
      query: parseInitialQuery(params),
      angle: parseInitialAngle(params),
      filters: parseInitialFilters(params),
    };
  }
  const stored = loadDiscoverFilters();
  if (stored) {
    return { query: stored.query, angle: stored.angle, filters: stored.filters };
  }
  return {
    query: '',
    angle: DEFAULT_ANGLE,
    filters: {
      sort: 'popularity',
      moves: 'any',
      doneFilter: 'all',
      projectFilter: 'all',
    },
  };
}

export default function DiscoverPage() {
  return (
    <AuthGuard>
      <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
        <DiscoverPageInner />
      </Suspense>
    </AuthGuard>
  );
}

function DiscoverPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [initialState] = useState(() =>
    resolveInitialState(new URLSearchParams(searchParams?.toString() ?? '')),
  );
  const [query, setQuery] = useState(initialState.query);
  const [angle, setAngle] = useState(initialState.angle);
  const [filters, setFilters] = useState<Filters>(initialState.filters);

  const [results, setResults] = useState<ClimbSearchResult[]>([]);
  // B020: total matches across all filters, ignoring the 500-result cap.
  // When > results.length we surface an overflow banner.
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  const activeFilterCount = countActiveFilters(filters);

  // Sync URL params (shareable filter state).
  useEffect(() => {
    const qs = new URLSearchParams();
    if (query) qs.set('q', query);
    qs.set('angle', String(angle));
    if (filters.gradeMin !== undefined) qs.set('grade_min', String(filters.gradeMin));
    if (filters.gradeMax !== undefined) qs.set('grade_max', String(filters.gradeMax));
    if (filters.minAscents !== undefined) qs.set('min_ascents', String(filters.minAscents));
    if (filters.minQuality !== undefined) qs.set('min_quality', String(filters.minQuality));
    if (filters.moves && filters.moves !== 'any') qs.set('moves', filters.moves);
    if (filters.sort !== 'popularity') qs.set('sort', filters.sort);
    if (filters.doneFilter && filters.doneFilter !== 'all') {
      qs.set('done_filter', filters.doneFilter);
    }
    if (filters.projectFilter && filters.projectFilter !== 'all') {
      qs.set('project_filter', filters.projectFilter);
    }
    router.replace(`/discover?${qs.toString()}`, { scroll: false });
  }, [query, angle, filters, router]);

  // B017.3: persist filter UI state across navigation to /discover/detail
  // and back. Fires synchronously on every change (no debounce — setItem
  // is cheap). Mirrors filtered-list-storage's 24h TTL semantics.
  useEffect(() => {
    saveDiscoverFilters({ query, angle, filters });
  }, [query, angle, filters]);

  // Debounced search. B012: query is now optional — when it's empty we
  // still fetch using the active filters (browse-by-filter mode).
  // B020: backend defaults to limit=500 (hard cap) and returns
  // {climbs, total_count}. We render all climbs and show an overflow
  // banner when total_count > climbs.length.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const trimmed = query.trim();
      const res = await searchClimbs({
        q: trimmed || undefined,
        angle,
        grade_min: filters.gradeMin,
        grade_max: filters.gradeMax,
        min_ascents: filters.minAscents,
        min_quality: filters.minQuality,
        moves: filters.moves,
        sort: filters.sort,
        done_filter: filters.doneFilter,
        project_filter: filters.projectFilter,
      });
      setResults(res.climbs);
      setTotalCount(res.total_count);
    } catch (e) {
      const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      setError(`[API_BASE=${API_BASE}] ${msg}`);
      setResults([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [query, angle, filters]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(runSearch, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [runSearch]);

  // A014: persist the current result list so /discover/detail can offer
  // Next/Prev navigation without re-fetching the filter. Overwritten every
  // time a fresh result set arrives — a filter change naturally invalidates
  // the previous list (uuids drop out → detail page hides Next/Prev).
  useEffect(() => {
    if (loading) return;
    if (results.length === 0) return;
    saveFilteredList({
      climbIds: results.map((c) => c.uuid),
      angle,
      timestamp: Date.now(),
    });
  }, [results, angle, loading]);

  const emptyState = useMemo(() => {
    if (loading) return null;
    if (results.length === 0) return 'No climbs match these filters. Try widening them.';
    return null;
  }, [loading, results.length]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-nav">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-zinc-950/95 backdrop-blur border-b border-zinc-800">
        <div className="max-w-2xl mx-auto px-4 pt-safe pb-3 space-y-3">
          <h1 className="text-2xl font-bold">Discover</h1>

          {/* Angle selector */}
          <div className="flex gap-1 overflow-x-auto pb-1" data-testid="angle-selector">
            {ANGLES.map((a) => (
              <button
                key={a}
                type="button"
                data-testid={`angle-${a}`}
                onClick={() => setAngle(a)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  angle === a
                    ? 'bg-orange-500/15 border-orange-500 text-orange-200 font-semibold'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-600'
                }`}
              >
                {a}°
              </button>
            ))}
          </div>

          {/* Search input */}
          <input
            type="text"
            data-testid="search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search climbs by name…"
            className="w-full px-4 py-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
          />

          {/* A021.4 — tri-state chip filters above the Filters button.
              Each row is "label : [All] [Only] [Exclude]". Active
              non-All values contribute to the Filters badge count. */}
          <div data-testid="chip-filters" className="space-y-2">
            <ChipRow
              label="Done"
              testidPrefix="chip-done"
              value={filters.doneFilter ?? 'all'}
              onChange={(v) => setFilters({ ...filters, doneFilter: v as DoneFilter })}
            />
            <ChipRow
              label="Project"
              testidPrefix="chip-project"
              value={filters.projectFilter ?? 'all'}
              onChange={(v) =>
                setFilters({ ...filters, projectFilter: v as ProjectFilter })
              }
            />
          </div>

          {/* Prominent Filters button (B017 follow-up) */}
          <button
            type="button"
            data-testid="filter-toggle"
            aria-expanded={isFilterPanelOpen}
            aria-controls="discover-filter-panel"
            onClick={() => setIsFilterPanelOpen((x) => !x)}
            className={`w-full min-h-[56px] px-4 py-4 rounded-xl flex items-center justify-between transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
              activeFilterCount > 0
                ? 'bg-orange-500 text-white'
                : 'bg-zinc-800 text-white'
            } ${isFilterPanelOpen ? '' : 'shadow-lg'}`}
          >
            <span className="flex items-center gap-3 text-base font-semibold">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5"
              >
                <line x1="4" y1="6" x2="14" y2="6" />
                <line x1="18" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="8" y2="12" />
                <line x1="12" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="16" y2="18" />
                <line x1="20" y1="18" x2="20" y2="18" />
                <circle cx="16" cy="6" r="2" />
                <circle cx="10" cy="12" r="2" />
                <circle cx="18" cy="18" r="2" />
              </svg>
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span
                  data-testid="filter-count-badge"
                  className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-white/25 text-sm font-bold"
                >
                  {activeFilterCount}
                </span>
              )}
            </span>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`w-5 h-5 transition-transform ${isFilterPanelOpen ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <div id="discover-filter-panel">
          <FilterPanel value={filters} onChange={setFilters} expanded={isFilterPanelOpen} />
        </div>

        {/* Results */}
        <div data-testid="results-list" className="space-y-2">
          {loading && (
            <div className="text-center py-8 text-zinc-500 text-sm" data-testid="results-loading">
              Searching…
            </div>
          )}

          {error && (
            <div className="py-4 px-3 bg-red-950 border border-red-700 rounded-lg text-red-300 text-xs font-mono break-all" data-testid="results-error">
              {error}
            </div>
          )}

          {emptyState && !error && (
            <div className="text-center py-12 text-zinc-500 text-sm" data-testid="results-empty">
              {emptyState}
            </div>
          )}

          {/* B020: overflow banner when results are capped below total match count. */}
          {!loading && !error && totalCount > results.length && (
            <div
              data-testid="results-overflow-banner"
              className="px-4 py-3 rounded-lg bg-orange-500/10 border border-orange-500/40 text-orange-200 text-sm"
            >
              Showing the first {results.length} of {totalCount} results. Narrow the filters to be more precise.
            </div>
          )}

          {!loading &&
            results.map((c) => <ClimbCard key={`${c.uuid}-${c.angle}`} climb={c} />)}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
