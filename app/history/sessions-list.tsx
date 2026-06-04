'use client';

import Link from 'next/link';
import { forwardRef } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import type {
  LogResultType,
  SessionClimb,
  SessionResponse,
} from '@/app/lib/api';

interface SessionsListProps {
  sessions: SessionResponse[];
  /** Hook the parent can use to scroll a specific day's card into view
   *  when the calendar is tapped. Map iso → DOM element. */
  registerSessionRef?: (isoDate: string, el: HTMLDivElement | null) => void;
}

const ICONS: Record<LogResultType, string> = {
  flash: '⚡',
  send: '✓',
  attempt: '•',
};

const ICON_COLOR: Record<LogResultType, string> = {
  flash: 'text-yellow-300',
  send: 'text-green-400',
  attempt: 'text-zinc-400',
};

function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function SessionsList({
  sessions,
  registerSessionRef,
}: SessionsListProps) {
  if (sessions.length === 0) {
    return (
      <div data-testid="sessions-empty">
        <EmptyState icon="🧗" title="No sessions in this range yet." />
      </div>
    );
  }

  return (
    <div data-testid="sessions-list" className="space-y-3">
      {sessions.map((s) => (
        <SessionCard
          key={s.date}
          session={s}
          ref={
            registerSessionRef
              ? (el) => registerSessionRef(s.date, el)
              : undefined
          }
        />
      ))}
    </div>
  );
}

interface SessionCardProps {
  session: SessionResponse;
}

const SessionCard = forwardRef<HTMLDivElement, SessionCardProps>(
  function SessionCardImpl({ session }, ref) {
    return (
      <div
        ref={ref}
        data-testid={`session-card-${session.date}`}
        className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 space-y-2"
      >
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-zinc-200">
            {formatDay(session.date)}
          </div>
          <div className="text-xs text-zinc-500 tabular-nums">
            {session.total_climbs} climb{session.total_climbs === 1 ? '' : 's'}
            {session.flashes > 0 && (
              <span className="ml-2 text-yellow-300">
                ⚡{session.flashes}
              </span>
            )}
            {session.sends > 0 && (
              <span className="ml-2 text-green-400">✓{session.sends}</span>
            )}
            {session.attempts > 0 && (
              <span className="ml-2 text-zinc-400">•{session.attempts}</span>
            )}
          </div>
        </div>
        <ul className="divide-y divide-zinc-800">
          {session.climbs.map((c) => (
            <SessionClimbRow key={c.log_id} climb={c} />
          ))}
        </ul>
      </div>
    );
  },
);

function SessionClimbRow({ climb }: { climb: SessionClimb }) {
  // Server returns nullable name/grade — fall back to truncated uuid so
  // a deleted-from-BoardLib climb still renders something usable.
  const name = climb.climb_name ?? climb.climb_uuid.slice(0, 8);
  const grade = climb.grade ?? '—';
  return (
    <Link
      href={`/discover/detail?id=${climb.climb_uuid}&angle=${climb.angle}`}
      data-testid={`session-climb-${climb.log_id}`}
      className="flex items-center gap-3 py-2 text-sm hover:bg-zinc-800/40 rounded transition-colors"
    >
      <span className={`text-base leading-none ${ICON_COLOR[climb.result_type]}`}>
        {ICONS[climb.result_type]}
      </span>
      <span className="flex-1 min-w-0 truncate text-zinc-200">{name}</span>
      <span className="text-xs text-zinc-500 shrink-0">{grade}</span>
      <span className="text-xs text-zinc-600 shrink-0 tabular-nums">
        {climb.angle}°
      </span>
      {climb.attempts_count > 1 && (
        <span className="text-xs text-zinc-500 shrink-0">
          ×{climb.attempts_count}
        </span>
      )}
    </Link>
  );
}
