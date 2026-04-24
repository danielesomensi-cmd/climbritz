'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { searchClimbs, API_BASE, type ClimbSearchResult, type SortField } from '@/app/lib/api';
import ClimbCard from '@/components/ClimbCard';
import FilterPanel, { type Filters } from '@/components/FilterPanel';
import BottomNav from '@/components/BottomNav';
import { saveFilteredList } from './filtered-list-storage';
import { loadDiscoverFilters, saveDiscoverFilters } from './discover-filters-storage';

const ANGLES = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70];
const DEFAULT_ANGLE = 40;
const SORT_VALUES: SortField[] = ['popularity', 'quality', 'grade_asc', 'grade_desc'];

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
  return {
    gradeMin: params.get('grade_min') ? Number(params.get('grade_min')) : undefined,
    gradeMax: params.get('grade_max') ? Number(params.get('grade_max')) : undefined,
    minAscents: params.get('min_ascents') ? Number(params.get('min_ascents')) : undefined,
    minQuality: params.get('min_quality') ? Number(params.get('min_quality')) : undefined,
    sort: (SORT_VALUES.includes(sort as SortField) ? sort : 'popularity') as SortField,
  };
}

const URL_FILTER_KEYS = ['q', 'angle', 'grade_min', 'grade_max', 'min_ascents', 'min_quality', 'sort'];

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
    filters: { sort: 'popularity' },
  };
}

export default function DiscoverPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <DiscoverPageInner />
    </Suspense>
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync URL params (shareable filter state).
  useEffect(() => {
    const qs = new URLSearchParams();
    if (query) qs.set('q', query);
    qs.set('angle', String(angle));
    if (filters.gradeMin !== undefined) qs.set('grade_min', String(filters.gradeMin));
    if (filters.gradeMax !== undefined) qs.set('grade_max', String(filters.gradeMax));
    if (filters.minAscents !== undefined) qs.set('min_ascents', String(filters.minAscents));
    if (filters.minQuality !== undefined) qs.set('min_quality', String(filters.minQuality));
    if (filters.sort !== 'popularity') qs.set('sort', filters.sort);
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
        sort: filters.sort,
        limit: 30,
      });
      setResults(res);
    } catch (e) {
      const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      setError(`[API_BASE=${API_BASE}] ${msg}`);
      setResults([]);
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
    <div className="min-h-screen bg-zinc-950 text-white pb-24">
      {/* DEBUG banner — remove after fixing Capacitor fetch issue */}
      <div className="bg-yellow-900/80 text-yellow-200 text-xs px-3 py-1.5 font-mono break-all">
        API: {API_BASE}
      </div>

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
                    ? 'bg-orange-500 border-orange-500 text-white font-semibold'
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
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <FilterPanel value={filters} onChange={setFilters} />

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

          {!loading &&
            results.map((c) => <ClimbCard key={`${c.uuid}-${c.angle}`} climb={c} />)}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
