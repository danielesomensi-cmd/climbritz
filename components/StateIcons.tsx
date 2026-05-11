'use client';

import type { UserClimbState } from '@/app/lib/api';

interface StateIconsProps {
  /** Per-climb state from the search overlay. Null/undefined → render
   *  nothing (anonymous request, or no history + not flagged). */
  userState?: UserClimbState | null;
  /** Compact variant used on Discovery cards. Default size = 14px. */
  size?: number;
}

/**
 * A021.4.1 — icon strip used by ClimbCard to communicate the user's
 * history at a glance:
 *
 *   ⚡ = the climb is in flash history
 *   ✓ = sent (and not yet flashed)
 *   ☆ = flagged as project (current state, independent of history)
 *
 * Both icons can render together (e.g. flashed + still on the project
 * list — a real case: user flashes a climb and answers "No, keep it"
 * on the project-removal modal). Order is fixed: best_result first,
 * then project flag.
 */
export default function StateIcons({ userState, size = 14 }: StateIconsProps) {
  if (!userState) return null;

  const hasFlash = userState.best_result === 'flash';
  const hasSend = userState.best_result === 'send';
  const isProject = userState.is_project;

  if (!hasFlash && !hasSend && !isProject) return null;

  const style = { fontSize: `${size}px`, lineHeight: 1 };

  return (
    <div
      data-testid="state-icons"
      className="flex items-center gap-1"
      aria-label={[
        hasFlash ? 'flashed' : null,
        hasSend ? 'sent' : null,
        isProject ? 'project' : null,
      ]
        .filter(Boolean)
        .join(', ')}
    >
      {hasFlash && (
        <span
          data-testid="state-icon-flash"
          className="text-yellow-300"
          style={style}
          aria-hidden="true"
        >
          ⚡
        </span>
      )}
      {hasSend && (
        <span
          data-testid="state-icon-send"
          className="text-green-400"
          style={style}
          aria-hidden="true"
        >
          ✓
        </span>
      )}
      {isProject && (
        <span
          data-testid="state-icon-project"
          className="text-orange-400"
          style={style}
          aria-hidden="true"
        >
          ★
        </span>
      )}
    </div>
  );
}
