'use client';

import type { DoneFilter, MovesFilter, ProjectFilter, SortField } from '@/app/lib/api';
import { GRADES } from '@/app/lib/grades';

export interface Filters {
  gradeMin?: number;
  gradeMax?: number;
  minAscents?: number;
  minQuality?: number;
  moves?: MovesFilter;
  /** A022 — when true, show only benchmark climbs at the selected angle.
   *  Benchmark status is angle-specific by DB design (climb_stats keyed by
   *  (climb_uuid, angle)). A simple boolean: "exclude benchmarks" isn't a
   *  real user need, so no tri-state. */
  benchmark?: boolean;
  sort: SortField;
  /** A021.4 — tri-state chip filters surfaced ABOVE this panel on
   *  /discover, not inside it. The panel doesn't render UI for them
   *  (the chips are in the page header) but the Filters object is the
   *  single source of truth — countActiveFilters / search params /
   *  sessionStorage all flow through here. Default 'all'. */
  doneFilter?: DoneFilter;
  projectFilter?: ProjectFilter;
}

interface FilterPanelProps {
  value: Filters;
  onChange: (next: Filters) => void;
  expanded: boolean;
}

const ASCENT_PRESETS: Array<{ label: string; value: number | undefined }> = [
  { label: 'Any', value: undefined },
  { label: '10+', value: 10 },
  { label: '50+', value: 50 },
  { label: '100+', value: 100 },
  { label: '500+', value: 500 },
];

const SORT_OPTIONS: Array<{ label: string; value: SortField }> = [
  { label: 'Popularity', value: 'popularity' },
  { label: 'Stars', value: 'quality' },
  { label: 'Grade ↑', value: 'grade_asc' },
  { label: 'Grade ↓', value: 'grade_desc' },
];

// A019 — move-count buckets. "any" is the default; the others are
// (cyan_holds + 2): le5 = ≤5, 6-7 = 6 or 7, 8-10 = 8 to 10, gt10 = >10.
const MOVES_OPTIONS: Array<{ label: string; value: MovesFilter }> = [
  { label: 'Any', value: 'any' },
  { label: '≤5', value: 'le5' },
  { label: '6–7', value: '6-7' },
  { label: '8–10', value: '8-10' },
  { label: '>10', value: 'gt10' },
];

const GRIP_TYPES = ['Jug', 'Good Crimp', 'Crimp', 'Sloper', 'Undercling', 'Pinch'];

export function countActiveFilters(value: Filters): number {
  return (
    (value.gradeMin !== undefined ? 1 : 0) +
    (value.gradeMax !== undefined ? 1 : 0) +
    (value.minAscents !== undefined ? 1 : 0) +
    (value.minQuality !== undefined ? 1 : 0) +
    (value.moves !== undefined && value.moves !== 'any' ? 1 : 0) +
    (value.benchmark ? 1 : 0) +
    (value.sort !== 'popularity' ? 1 : 0) +
    (value.doneFilter !== undefined && value.doneFilter !== 'all' ? 1 : 0) +
    (value.projectFilter !== undefined && value.projectFilter !== 'all' ? 1 : 0)
  );
}

export default function FilterPanel({ value, onChange, expanded }: FilterPanelProps) {
  const activeCount = countActiveFilters(value);

  const reset = () =>
    onChange({
      sort: 'popularity',
      gradeMin: undefined,
      gradeMax: undefined,
      minAscents: undefined,
      minQuality: undefined,
      moves: 'any',
      benchmark: false,
      doneFilter: 'all',
      projectFilter: 'all',
    });

  if (!expanded) return null;

  return (
    <div
      data-testid="filter-panel"
      className="rounded-lg bg-zinc-900 border border-zinc-800 p-4 space-y-5"
    >
      {/* Benchmarks (A022) — single boolean toggle. Angle-specific:
          shows only climbs benchmarked at the currently selected angle. */}
      <div>
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
          Benchmarks
        </label>
        <button
          type="button"
          data-testid="filter-benchmark"
          aria-pressed={!!value.benchmark}
          onClick={() => onChange({ ...value, benchmark: !value.benchmark })}
          className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
            value.benchmark
              ? 'bg-orange-500/15 border-orange-500 text-orange-200 font-semibold'
              : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'
          }`}
        >
          Benchmarks only
        </button>
      </div>

      {/* Grade range */}
      <div>
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
          Grade range
        </label>
        <div className="grid grid-cols-2 gap-2">
          <select
            data-testid="filter-grade-min"
            value={value.gradeMin ?? ''}
            onChange={(e) =>
              onChange({
                ...value,
                gradeMin: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-2 text-sm text-white"
          >
            <option value="">Min</option>
            {GRADES.map((g) => (
              <option key={g.difficulty} value={g.difficulty}>
                {g.font} / {g.v}
              </option>
            ))}
          </select>
          <select
            data-testid="filter-grade-max"
            value={value.gradeMax ?? ''}
            onChange={(e) =>
              onChange({
                ...value,
                gradeMax: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-2 text-sm text-white"
          >
            <option value="">Max</option>
            {GRADES.map((g) => (
              <option key={g.difficulty} value={g.difficulty}>
                {g.font} / {g.v}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Min ascents */}
      <div>
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
          Min ascents
        </label>
        <div className="flex flex-wrap gap-2">
          {ASCENT_PRESETS.map((p) => {
            const active = value.minAscents === p.value;
            return (
              <button
                key={p.label}
                type="button"
                data-testid={`filter-ascents-${p.label}`}
                onClick={() => onChange({ ...value, minAscents: p.value })}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  active
                    ? 'bg-orange-500/15 border-orange-500 text-orange-200 font-semibold'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Min quality */}
      <div>
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
          Min stars
        </label>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((n) => {
            const active = value.minQuality === n;
            return (
              <button
                key={n}
                type="button"
                data-testid={`filter-quality-${n}`}
                onClick={() =>
                  onChange({ ...value, minQuality: active ? undefined : n })
                }
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  active
                    ? 'bg-orange-500/15 border-orange-500 text-orange-200 font-semibold'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                }`}
              >
                {n}★+
              </button>
            );
          })}
        </div>
      </div>

      {/* Moves (A019) */}
      <div>
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
          Moves
        </label>
        <div className="flex flex-wrap gap-2">
          {MOVES_OPTIONS.map((opt) => {
            const current = value.moves ?? 'any';
            const active = current === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                data-testid={`filter-moves-${opt.value}`}
                onClick={() =>
                  onChange({
                    ...value,
                    moves: opt.value === 'any' ? 'any' : opt.value,
                  })
                }
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  active
                    ? 'bg-orange-500/15 border-orange-500 text-orange-200 font-semibold'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sort */}
      <div>
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
          Sort by
        </label>
        <div className="grid grid-cols-2 gap-2">
          {SORT_OPTIONS.map((o) => {
            const active = value.sort === o.value;
            return (
              <button
                key={o.value}
                type="button"
                data-testid={`filter-sort-${o.value}`}
                onClick={() => onChange({ ...value, sort: o.value })}
                className={`px-3 py-2 rounded text-sm border transition-colors ${
                  active
                    ? 'bg-orange-500/15 border-orange-500 text-orange-200 font-semibold'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grip type (disabled — coming soon) */}
      <div>
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
          Grip type
          <span className="ml-2 text-[0.65rem] font-normal text-orange-400/80 normal-case">
            Coming soon
          </span>
        </label>
        <div className="flex flex-wrap gap-2">
          {GRIP_TYPES.map((g) => (
            <button
              key={g}
              type="button"
              disabled
              data-testid={`filter-grip-${g}`}
              title="Grip type classification is in progress — coming soon"
              className="px-3 py-1.5 rounded-full text-sm border border-zinc-800 bg-zinc-900 text-zinc-600 cursor-not-allowed"
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {activeCount > 0 && (
        <button
          type="button"
          data-testid="filter-reset"
          onClick={reset}
          className="text-sm text-zinc-400 hover:text-orange-400"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
