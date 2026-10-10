'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PyramidEntry, PyramidResultFilter } from '@/app/lib/api';
import Chip from '@/components/ui/Chip';

interface GradePyramidProps {
  entries: PyramidEntry[];
  resultFilter: PyramidResultFilter;
  onFilterChange: (f: PyramidResultFilter) => void;
}

const FILTER_OPTIONS: Array<{ value: PyramidResultFilter; label: string }> = [
  { value: 'flash', label: 'Flash only' },
  { value: 'send_or_better', label: 'Send or better' },
  { value: 'all', label: 'All' },
];

export default function GradePyramid({
  entries,
  resultFilter,
  onFilterChange,
}: GradePyramidProps) {
  return (
    <div data-testid="grade-pyramid" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
          Grade pyramid
        </h2>
        <div className="flex gap-2" data-testid="pyramid-filter">
          {FILTER_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              data-testid={`pyramid-filter-${opt.value}`}
              selected={resultFilter === opt.value}
              onClick={() => onFilterChange(opt.value)}
              className="text-xs px-3"
            >
              {opt.label}
            </Chip>
          ))}
        </div>
      </div>

      {entries.length === 0 ? (
        <div
          data-testid="pyramid-empty"
          className="text-sm text-zinc-500 italic text-center py-6"
        >
          No data yet for this filter.
        </div>
      ) : (
        // Height follows the number of grade bands (B-CSS-RESET 3/3): a fixed
        // 260px turned 1–2 bands into huge slabs.
        <div className="w-full" style={{ height: Math.max(140, entries.length * 44 + 40) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={entries}
              layout="vertical"
              margin={{ top: 5, right: 16, left: 8, bottom: 5 }}
            >
              <CartesianGrid stroke="#27272a" horizontal={false} />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fill: '#a1a1aa', fontSize: 11 }}
                axisLine={{ stroke: '#3f3f46' }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="grade_band"
                tick={{ fill: '#d4d4d8', fontSize: 11 }}
                axisLine={{ stroke: '#3f3f46' }}
                tickLine={false}
                width={56}
              />
              <Tooltip
                contentStyle={{
                  background: '#18181b',
                  border: '1px solid #3f3f46',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: '#d4d4d8' }}
                itemStyle={{ color: '#fdba74' }}
                cursor={{ fill: '#27272a' }}
              />
              <Bar dataKey="count" fill="#fb923c" radius={[0, 4, 4, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
