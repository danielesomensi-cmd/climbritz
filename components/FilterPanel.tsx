'use client';

import type { DoneFilter, MovesFilter, ProjectFilter, SortField } from '@/app/lib/api';
import { GRADES } from '@/app/lib/grades';
import Chip from '@/components/ui/Chip';
import Card from '@/components/ui/Card';

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
  /** A029 — when true, show only climbs with the setter's "no matching"
   *  rule (climbs.is_nomatch, audit D019). Same boolean idiom as
   *  benchmark: "exclude no-matching climbs" isn't a real user need. */
  nomatch?: boolean;
  /** A030 — when true, show ONLY the user's saved generated problems
   *  (my_problems=only). Off (default) = include: BoardLib results plus
   *  mine prepended with the MY badge. */
  myProblems?: boolean;
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
    (value.nomatch ? 1 : 0) +
    (value.myProblems ? 1 : 0) +
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
      nomatch: false,
      myProblems: false,
      doneFilter: 'all',
      projectFilter: 'all',
    });

  if (!expanded) return null;

  return (
    <Card
      data-testid="filter-panel"
      className="p-4 space-y-5"
    >
      {/* Benchmarks (A022) — single boolean toggle. Angle-specific:
          shows only climbs benchmarked at the currently selected angle. */}
      <div>
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
          Benchmarks
        </label>
        <Chip
          data-testid="filter-benchmark"
          selected={!!value.benchmark}
          onClick={() => onChange({ ...value, benchmark: !value.benchmark })}
        >
          Benchmarks only
        </Chip>
      </div>

      {/* Matching (A029) — single boolean toggle on climbs.is_nomatch.
          Climb-level setter rule, not angle-specific. */}
      <div>
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
          Matching
        </label>
        <Chip
          data-testid="filter-nomatch"
          selected={!!value.nomatch}
          onClick={() => onChange({ ...value, nomatch: !value.nomatch })}
        >
          No matching only
        </Chip>
      </div>

      {/* My Problems (A030) — off (default) = BoardLib + mine prepended
          with the MY badge; on = only the user's saved problems. */}
      <div>
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
          My Problems
        </label>
        <Chip
          data-testid="filter-my-problems"
          selected={!!value.myProblems}
          onClick={() => onChange({ ...value, myProblems: !value.myProblems })}
        >
          My problems only
        </Chip>
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
          {ASCENT_PRESETS.map((p) => (
            <Chip
              key={p.label}
              data-testid={`filter-ascents-${p.label}`}
              selected={value.minAscents === p.value}
              onClick={() => onChange({ ...value, minAscents: p.value })}
            >
              {p.label}
            </Chip>
          ))}
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
              <Chip
                key={n}
                data-testid={`filter-quality-${n}`}
                selected={active}
                onClick={() => onChange({ ...value, minQuality: active ? undefined : n })}
              >
                {n}★+
              </Chip>
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
            return (
              <Chip
                key={opt.value}
                data-testid={`filter-moves-${opt.value}`}
                selected={current === opt.value}
                onClick={() =>
                  onChange({ ...value, moves: opt.value === 'any' ? 'any' : opt.value })
                }
              >
                {opt.label}
              </Chip>
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
          {SORT_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              data-testid={`filter-sort-${o.value}`}
              selected={value.sort === o.value}
              onClick={() => onChange({ ...value, sort: o.value })}
            >
              {o.label}
            </Chip>
          ))}
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
            <Chip
              key={g}
              disabled
              data-testid={`filter-grip-${g}`}
              title="Grip type classification is in progress — coming soon"
            >
              {g}
            </Chip>
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
    </Card>
  );
}
