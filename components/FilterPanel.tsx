'use client';

import { useState } from 'react';
import type { SortField } from '@/app/lib/api';
import { GRADES } from '@/app/lib/grades';

export interface Filters {
  gradeMin?: number;
  gradeMax?: number;
  minAscents?: number;
  minQuality?: number;
  sort: SortField;
}

interface FilterPanelProps {
  value: Filters;
  onChange: (next: Filters) => void;
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

const GRIP_TYPES = ['Jug', 'Good Crimp', 'Crimp', 'Sloper', 'Undercling', 'Pinch'];

export default function FilterPanel({ value, onChange }: FilterPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const activeCount =
    (value.gradeMin !== undefined ? 1 : 0) +
    (value.gradeMax !== undefined ? 1 : 0) +
    (value.minAscents !== undefined ? 1 : 0) +
    (value.minQuality !== undefined ? 1 : 0);

  const reset = () =>
    onChange({
      sort: value.sort,
      gradeMin: undefined,
      gradeMax: undefined,
      minAscents: undefined,
      minQuality: undefined,
    });

  return (
    <div data-testid="filter-panel" className="rounded-lg bg-zinc-900 border border-zinc-800">
      <button
        type="button"
        data-testid="filter-toggle"
        onClick={() => setExpanded((x) => !x)}
        className="w-full px-4 py-3 flex items-center justify-between text-left text-white"
      >
        <span className="font-semibold">
          Filters
          {activeCount > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-orange-500 text-white">
              {activeCount}
            </span>
          )}
        </span>
        <span className="text-zinc-400 text-sm">{expanded ? 'Hide' : 'Show'}</span>
      </button>

      {expanded && (
        <div className="p-4 border-t border-zinc-800 space-y-5">
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
                        ? 'bg-orange-500 border-orange-500 text-white'
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
                        ? 'bg-orange-500 border-orange-500 text-white'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                    }`}
                  >
                    {n}★+
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
                        ? 'bg-orange-500 border-orange-500 text-white'
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
      )}
    </div>
  );
}
