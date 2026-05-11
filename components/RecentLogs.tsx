'use client';

import type { ClimbLogResponse, LogResultType } from '@/app/lib/api';

interface RecentLogsProps {
  logs: ClimbLogResponse[];
  /** Max rows to render. Default 5; the detail page passes ~10. */
  limit?: number;
}

const ICONS: Record<LogResultType, string> = {
  flash: '⚡',
  send: '✓',
  attempt: '•',
};

const LABELS: Record<LogResultType, string> = {
  flash: 'Flash',
  send: 'Send',
  attempt: 'Attempt',
};

const COLORS: Record<LogResultType, string> = {
  flash: 'text-yellow-300',
  send: 'text-green-400',
  attempt: 'text-zinc-300',
};

function formatDate(localDate: string): string {
  // Parse YYYY-MM-DD as a local Date — avoids the off-by-one that
  // `new Date('2026-05-11')` produces (UTC-midnight rendered in local tz).
  const [y, m, d] = localDate.split('-').map(Number);
  if (!y || !m || !d) return localDate;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function RecentLogs({ logs, limit = 10 }: RecentLogsProps) {
  if (logs.length === 0) {
    return (
      <div data-testid="recent-logs" className="space-y-2">
        <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
          History on this climb
        </div>
        <div
          data-testid="recent-logs-empty"
          className="text-sm text-zinc-500 italic"
        >
          No attempts yet. Log your first one above.
        </div>
      </div>
    );
  }

  const visible = logs.slice(0, limit);

  return (
    <div data-testid="recent-logs" className="space-y-2">
      <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
        History on this climb
      </div>
      <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800 bg-zinc-900/60">
        {visible.map((log) => (
          <li
            key={log.id}
            data-testid={`recent-log-${log.id}`}
            className="flex items-center gap-3 px-3 py-2 text-sm"
          >
            <span className={`text-lg leading-none ${COLORS[log.result_type]}`}>
              {ICONS[log.result_type]}
            </span>
            <span className="flex-1 text-zinc-200">
              {LABELS[log.result_type]}
              {log.attempts_count > 1 && (
                <span className="ml-1 text-zinc-500">
                  ×{log.attempts_count}
                </span>
              )}
            </span>
            <span className="text-xs text-zinc-500 tabular-nums">
              {formatDate(log.local_date)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
