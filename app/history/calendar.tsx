'use client';

import { useMemo } from 'react';
import type { SessionResponse } from '@/app/lib/api';

interface CalendarProps {
  sessions: SessionResponse[];
  /** Inclusive ISO date string YYYY-MM-DD. */
  dateFrom: string;
  /** Inclusive ISO date string YYYY-MM-DD. */
  dateTo: string;
  /** Fired when a day with sessions is tapped. */
  onDayClick: (isoDate: string) => void;
}

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Mon=0, Tue=1, …, Sun=6 — matches our left-to-right column order. */
function isoWeekday(date: Date): number {
  const js = date.getDay(); // Sun=0, Mon=1, ..., Sat=6
  return (js + 6) % 7;
}

interface DayCell {
  iso: string;
  day: number;
  count: number;
}

interface MonthGrid {
  year: number;
  month: number; // 0-indexed
  /** Cells laid out in 7-column grid order. null = empty spacer. */
  cells: Array<DayCell | null>;
}

function buildMonthGrid(
  year: number,
  month: number,
  countByIso: Map<string, number>,
): MonthGrid {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0); // last day of month
  const cells: Array<DayCell | null> = [];

  // Leading spacers so day 1 aligns with its weekday column.
  const leading = isoWeekday(first);
  for (let i = 0; i < leading; i++) cells.push(null);

  for (let d = 1; d <= last.getDate(); d++) {
    const date = new Date(year, month, d);
    const iso = formatIso(date);
    cells.push({ iso, day: d, count: countByIso.get(iso) ?? 0 });
  }

  return { year, month, cells };
}

/**
 * Hand-rolled month-by-month heatmap. CSS grid, no library.
 *
 * Intensity buckets based on climb count for the day:
 *   0     → empty cell (no border highlight)
 *   1     → light
 *   2-3   → medium
 *   4-6   → strong
 *   7+    → very strong
 *
 * Tap a non-zero day → scrolls to the session card via the parent's
 * onDayClick handler.
 */
export default function HistoryCalendar({
  sessions,
  dateFrom,
  dateTo,
  onDayClick,
}: CalendarProps) {
  const countByIso = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sessions) m.set(s.date, s.total_climbs);
    return m;
  }, [sessions]);

  const months = useMemo(() => {
    const from = parseLocalDate(dateFrom);
    const to = parseLocalDate(dateTo);
    const out: MonthGrid[] = [];
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    while (
      cursor.getFullYear() < to.getFullYear() ||
      (cursor.getFullYear() === to.getFullYear() &&
        cursor.getMonth() <= to.getMonth())
    ) {
      out.push(
        buildMonthGrid(cursor.getFullYear(), cursor.getMonth(), countByIso),
      );
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return out;
  }, [countByIso, dateFrom, dateTo]);

  if (months.length === 0) return null;

  return (
    <div data-testid="history-calendar" className="space-y-6">
      {months.map(({ year, month, cells }) => (
        <div key={`${year}-${month}`} className="space-y-2">
          <div className="text-sm font-semibold text-zinc-300">
            {MONTH_NAMES[month]} {year}
          </div>
          <div className="grid grid-cols-7 gap-1 text-[10px] text-zinc-500">
            {WEEKDAY_LABELS.map((wd, idx) => (
              <div
                key={`${year}-${month}-h-${idx}`}
                className="text-center uppercase tracking-wide"
              >
                {wd}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, idx) => {
              if (!cell) {
                return (
                  <div
                    key={`${year}-${month}-spacer-${idx}`}
                    className="aspect-square"
                  />
                );
              }
              const cls = intensityClass(cell.count);
              const clickable = cell.count > 0;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  data-testid={`calendar-day-${cell.iso}`}
                  data-count={cell.count}
                  onClick={() => (clickable ? onDayClick(cell.iso) : undefined)}
                  disabled={!clickable}
                  className={`aspect-square rounded text-[10px] flex items-center justify-center font-medium ${cls} ${
                    clickable
                      ? 'cursor-pointer hover:ring-1 hover:ring-orange-400'
                      : 'cursor-default'
                  }`}
                  aria-label={
                    clickable
                      ? `${cell.iso} — ${cell.count} climb${cell.count === 1 ? '' : 's'}`
                      : `${cell.iso} — no climbs`
                  }
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// B026: bumped the intensity floor (was 20% / 40% / 70% / 100%) so a single-
// climb day is visible in bright gym light. 4 tiers instead of 5 — count=1
// and count=2-3 collapse into a clearer low/mid/high gradient.
function intensityClass(count: number): string {
  if (count === 0) return 'bg-zinc-900 text-zinc-600';
  if (count === 1) return 'bg-orange-500/35 text-orange-100';
  if (count <= 3) return 'bg-orange-500/60 text-white';
  if (count <= 6) return 'bg-orange-500/80 text-white';
  return 'bg-orange-500 text-white';
}
