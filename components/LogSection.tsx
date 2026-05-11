'use client';

import { useCallback, useEffect, useState } from 'react';
import type { App as CapacitorApp, BackButtonListenerEvent } from '@capacitor/app';
import {
  ApiError,
  createLog,
  deleteLog,
  patchUserClimbProject,
  type ClimbLogResponse,
  type LogResultType,
  type UserClimbDetail,
  type UserClimbState,
} from '@/app/lib/api';

interface LogSectionProps {
  climbUuid: string;
  angle: number;
  /** Current detail state — passed in by the parent so the parent owns
   *  the cache (also used by RecentLogs below). */
  detail: UserClimbDetail | null;
  /** Called after every successful mutation so the parent re-fetches.
   *  Returns the fresh detail so the LogSection can update local UI
   *  without waiting for a round-trip to render the new state. */
  onMutated: (next: UserClimbDetail) => void;
}

interface ResultButton {
  result: LogResultType;
  label: string;
  icon: string;
  color: string;
}

const RESULT_BUTTONS: ResultButton[] = [
  { result: 'flash', label: 'Flash', icon: '⚡', color: 'bg-yellow-500 hover:bg-yellow-400 border-yellow-600' },
  { result: 'send', label: 'Send', icon: '✓', color: 'bg-green-600 hover:bg-green-500 border-green-700' },
  { result: 'attempt', label: 'Attempt', icon: '•', color: 'bg-zinc-700 hover:bg-zinc-600 border-zinc-600' },
];

// ISO local_date strings (YYYY-MM-DD) compare lexicographically so we can
// just == them. The backend always emits this format.
function isToday(localDate: string): boolean {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return localDate === `${yyyy}-${mm}-${dd}`;
}

function findTodaysLog(logs: ClimbLogResponse[]): ClimbLogResponse | null {
  return logs.find((l) => isToday(l.local_date)) ?? null;
}


export default function LogSection({
  climbUuid,
  angle,
  detail,
  onMutated,
}: LogSectionProps) {
  const [pending, setPending] = useState<LogResultType | 'project' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Modal state: null = closed, otherwise carries the pending result type
  // that triggered the prompt. Send/Flash while is_project=true → modal.
  const [pendingProjectModal, setPendingProjectModal] = useState<LogResultType | null>(null);

  const state: UserClimbState | null = detail?.state ?? null;
  const todaysLog = detail ? findTodaysLog(detail.recent_logs) : null;
  const isProject = state?.is_project ?? false;

  // A021: clear pending project modal when the back button fires (Android
  // physical button via Capacitor, or the browser's popstate). Without
  // this, tapping back on Android while the modal is open would either
  // dismiss the entire page or do nothing — both worse than closing the
  // modal in place.
  useEffect(() => {
    if (!pendingProjectModal) return;

    let appPlugin: typeof CapacitorApp | undefined;
    let removeListener: (() => void) | undefined;

    const setup = async () => {
      try {
        const mod = await import('@capacitor/app');
        appPlugin = mod.App;
        const handle = await appPlugin.addListener(
          'backButton',
          (_event: BackButtonListenerEvent) => {
            setPendingProjectModal(null);
          },
        );
        removeListener = () => {
          handle.remove();
        };
      } catch {
        // @capacitor/app not available (web build, test env) — fall
        // back to popstate. We push a no-op state on open and pop it on
        // close so the browser back button has something to consume.
      }
    };
    setup();

    const onPopState = () => setPendingProjectModal(null);
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', onPopState);
    }

    return () => {
      removeListener?.();
      if (typeof window !== 'undefined') {
        window.removeEventListener('popstate', onPopState);
      }
    };
  }, [pendingProjectModal]);

  const performLog = useCallback(
    async (result: LogResultType) => {
      setPending(result);
      setError(null);
      try {
        await createLog(climbUuid, angle, result);
        // Refetch detail to pick up new last_logged_at + recent_logs.
        // We can't reuse the POST response's user_state for the
        // recent_logs list — that endpoint returns only the new log,
        // not the full history.
        const { getUserClimb } = await import('@/app/lib/api');
        const fresh = await getUserClimb(climbUuid, angle);
        onMutated(fresh);
      } catch (e) {
        const message = e instanceof ApiError ? e.message : 'Network error';
        setError(message);
      } finally {
        setPending(null);
      }
    },
    [climbUuid, angle, onMutated],
  );

  const handleResultButton = (result: LogResultType) => {
    // Confirmation modal only fires when the user is *completing* a
    // project (send/flash). Attempts on a project don't prompt — you're
    // still working it.
    if (isProject && (result === 'send' || result === 'flash')) {
      setPendingProjectModal(result);
      return;
    }
    performLog(result);
  };

  const handleProjectToggle = async () => {
    setPending('project');
    setError(null);
    try {
      await patchUserClimbProject(climbUuid, angle, !isProject);
      const { getUserClimb } = await import('@/app/lib/api');
      const fresh = await getUserClimb(climbUuid, angle);
      onMutated(fresh);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Network error';
      setError(message);
    } finally {
      setPending(null);
    }
  };

  const handleRemoveTodaysLog = async () => {
    if (!todaysLog) return;
    setPending('remove');
    setError(null);
    try {
      await deleteLog(todaysLog.id);
      const { getUserClimb } = await import('@/app/lib/api');
      const fresh = await getUserClimb(climbUuid, angle);
      onMutated(fresh);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Network error';
      setError(message);
    } finally {
      setPending(null);
    }
  };

  const handleModalConfirmRemoveProject = async () => {
    if (!pendingProjectModal) return;
    const result = pendingProjectModal;
    setPendingProjectModal(null);
    // Log first, then clear the project flag — order matters: if the
    // log post fails we don't want to have already removed the project.
    await performLog(result);
    try {
      await patchUserClimbProject(climbUuid, angle, false);
      const { getUserClimb } = await import('@/app/lib/api');
      const fresh = await getUserClimb(climbUuid, angle);
      onMutated(fresh);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Network error';
      setError(message);
    }
  };

  const handleModalKeepProject = async () => {
    if (!pendingProjectModal) return;
    const result = pendingProjectModal;
    setPendingProjectModal(null);
    await performLog(result);
  };

  const handleModalCancel = () => {
    setPendingProjectModal(null);
  };

  return (
    <div data-testid="log-section" className="space-y-3">
      <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
        Log your attempt
      </div>

      {/* B-A021-fix-1.1.1 — single-row grid. 5 cols when a Remove
          button is present (today's log exists), 4 cols otherwise.
          All buttons share the same icon-over-label stack so they read
          consistently at the narrow per-cell width on a phone. */}
      <div
        data-testid="log-grid"
        className={`grid ${todaysLog ? 'grid-cols-5' : 'grid-cols-4'} gap-2`}
      >
        {RESULT_BUTTONS.map((btn) => {
          const isPending = pending === btn.result;
          const isTodaysResult = todaysLog?.result_type === btn.result;
          return (
            <button
              key={btn.result}
              type="button"
              data-testid={`log-btn-${btn.result}`}
              onClick={() => handleResultButton(btn.result)}
              disabled={pending !== null}
              className={[
                'min-h-12 px-1 rounded-lg text-white font-bold',
                'border-2 transition-all flex flex-col items-center justify-center gap-0',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                btn.color,
                isTodaysResult ? 'ring-2 ring-white' : '',
              ].join(' ')}
            >
              <span className="text-xl leading-none">{btn.icon}</span>
              <span className="text-[10px] leading-tight">
                {isPending ? '…' : btn.label}
                {isTodaysResult && todaysLog && todaysLog.attempts_count > 1
                  ? ` ×${todaysLog.attempts_count}`
                  : ''}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          data-testid="log-btn-project"
          onClick={handleProjectToggle}
          disabled={pending !== null}
          className={[
            'min-h-12 px-1 rounded-lg border-2 font-bold',
            'flex flex-col items-center justify-center gap-0 transition-all',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            isProject
              ? 'bg-orange-500 border-orange-600 text-white hover:bg-orange-400'
              : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-zinc-500',
          ].join(' ')}
        >
          <span className="text-xl leading-none">{isProject ? '★' : '☆'}</span>
          <span className="text-[10px] leading-tight">
            {pending === 'project' ? '…' : 'Project'}
          </span>
        </button>

        {todaysLog && (
          <button
            type="button"
            data-testid="log-btn-remove"
            onClick={handleRemoveTodaysLog}
            disabled={pending !== null}
            className="min-h-12 px-1 rounded-lg border-2 border-red-900 bg-red-950/40 text-red-300 font-bold flex flex-col items-center justify-center gap-0 transition-all hover:bg-red-900/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-xl leading-none">🗑</span>
            <span className="text-[10px] leading-tight">
              {pending === 'remove' ? '…' : 'Remove'}
            </span>
          </button>
        )}
      </div>

      {error && (
        <div
          data-testid="log-error"
          className="p-2.5 rounded-lg bg-red-900/40 border border-red-700 text-sm text-red-300"
          role="alert"
        >
          {error}
        </div>
      )}

      {pendingProjectModal && (
        <ProjectRemovalModal
          onConfirmRemove={handleModalConfirmRemoveProject}
          onKeep={handleModalKeepProject}
          onCancel={handleModalCancel}
        />
      )}
    </div>
  );
}

interface ProjectRemovalModalProps {
  onConfirmRemove: () => void;
  onKeep: () => void;
  onCancel: () => void;
}

function ProjectRemovalModal({
  onConfirmRemove,
  onKeep,
  onCancel,
}: ProjectRemovalModalProps) {
  return (
    <div
      data-testid="project-removal-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-removal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl bg-zinc-900 border border-zinc-700 p-5 space-y-4"
      >
        <div>
          <h2
            id="project-removal-title"
            className="text-lg font-bold text-white"
          >
            Remove from projects?
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            You sent this problem — keep the &ldquo;project&rdquo; flag?
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            data-testid="modal-confirm-remove"
            onClick={onConfirmRemove}
            className="min-h-14 px-4 rounded-lg bg-orange-500 hover:bg-orange-400 text-white font-bold border-2 border-orange-600"
          >
            Yes, remove
          </button>
          <button
            type="button"
            data-testid="modal-keep-project"
            onClick={onKeep}
            className="min-h-14 px-4 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold border-2 border-zinc-700"
          >
            No, keep it
          </button>
          <button
            type="button"
            data-testid="modal-cancel"
            onClick={onCancel}
            className="min-h-12 px-4 rounded-lg text-zinc-500 hover:text-zinc-300 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
