'use client';

import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TrendEntry } from '@/app/lib/api';

interface TrendChartProps {
  entries: TrendEntry[];
}

type Series = 'flash' | 'send' | 'attempt';

const SERIES_META: Record<Series, { label: string; color: string; key: keyof TrendEntry }> = {
  flash:   { label: 'Flash',   color: '#fde047', key: 'flash_count' },
  send:    { label: 'Send',    color: '#4ade80', key: 'send_count' },
  attempt: { label: 'Attempt', color: '#a1a1aa', key: 'attempt_count' },
};

function shortWeek(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Three-line trend chart. Each line is independently toggleable —
 *  matches the brief's "Filter toggle: Flash / Send / Attempt (lines
 *  stackable)". */
export default function TrendChart({ entries }: TrendChartProps) {
  const [visible, setVisible] = useState<Record<Series, boolean>>({
    flash: true,
    send: true,
    attempt: false, // attempts are noisier — default off
  });

  const toggle = (s: Series) =>
    setVisible((v) => ({ ...v, [s]: !v[s] }));

  return (
    <div data-testid="trend-chart" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
          Send-rate trend
        </h2>
        <div className="flex gap-1" data-testid="trend-filter">
          {(Object.keys(SERIES_META) as Series[]).map((s) => {
            const meta = SERIES_META[s];
            const active = visible[s];
            return (
              <button
                key={s}
                type="button"
                data-testid={`trend-toggle-${s}`}
                onClick={() => toggle(s)}
                aria-pressed={active}
                className={`px-2 py-1 rounded-full text-xs border transition-colors ${
                  active
                    ? 'border-current'
                    : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'
                }`}
                style={active ? { color: meta.color, background: `${meta.color}1a` } : undefined}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {entries.length === 0 ? (
        <div
          data-testid="trend-empty"
          className="text-sm text-zinc-500 italic text-center py-6"
        >
          No weekly activity yet.
        </div>
      ) : (
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={entries}
              margin={{ top: 5, right: 16, left: -8, bottom: 5 }}
            >
              <CartesianGrid stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="week_start"
                tickFormatter={shortWeek}
                tick={{ fill: '#a1a1aa', fontSize: 11 }}
                axisLine={{ stroke: '#3f3f46' }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: '#a1a1aa', fontSize: 11 }}
                axisLine={{ stroke: '#3f3f46' }}
                tickLine={false}
                width={32}
              />
              <Tooltip
                labelFormatter={(label) =>
                  typeof label === 'string'
                    ? `Week of ${shortWeek(label)}`
                    : ''
                }
                contentStyle={{
                  background: '#18181b',
                  border: '1px solid #3f3f46',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: '#d4d4d8' }}
                itemStyle={{ color: '#fdba74' }}
              />
              {(Object.keys(SERIES_META) as Series[])
                .filter((s) => visible[s])
                .map((s) => {
                  const meta = SERIES_META[s];
                  return (
                    <Line
                      key={s}
                      type="monotone"
                      dataKey={meta.key as string}
                      stroke={meta.color}
                      strokeWidth={2}
                      dot={{ r: 3, fill: meta.color }}
                      activeDot={{ r: 5 }}
                      name={meta.label}
                      isAnimationActive={false}
                    />
                  );
                })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
