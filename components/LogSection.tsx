'use client';

import { useCallback, useEffect, useState } from 'react';
import type { App as CapacitorApp, BackButtonListenerEvent } from '@capacitor/app';
import {
  ApiError,
  createLog,
  deleteLog,
  patchLog,
  patchUserClimbProject,
  type ClimbLogResponse,
  type LogResultType,
  type UserClimbDetail,
  type UserClimbState,
} from '@/app/lib/api';
import { haptic } from '@/lib/feedback/haptics';
import Toast from '@/components/ui/Toast';

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
  { result: 'flash', label: 'Flash', icon: '⚡', color: 'bg-state-flash-solid hover:bg-state-flash-solid-hover border-state-flash-solid-border' },
  { result: 'send', label: 'Send', icon: '✓', color: 'bg-state-send-solid hover:bg-state-send-solid-hover border-state-send-solid-border' },
  { result: 'attempt', label: 'Attempt', icon: '•', color: 'bg-state-attempt-solid hover:bg-state-attempt-solid-hover border-state-attempt-solid-border' },
];

const RESULT_LABEL: Record<LogResultType, string> = {
  flash: 'Flash',
  send: 'Send',
  attempt: 'Attempt',
};

/** UX-003 — everything Undo needs to put today's row back exactly as it was
 *  before the tap. `previous === null` means the tap created the row, so
 *  Undo deletes it; otherwise Undo PATCHes the snapshot back. */
interface UndoRecord {
  key: number;
  logId: string;
  previous: { result_type: LogResultType; attempts_count: number } | null;
  /** The tap also cleared the project flag (modal "Yes, remove") → Undo
   *  sets it back. */
  projectCleared: boolean;
  message: string;
}

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
  const [pending, setPending] = useState<LogResultType | 'project' | 'undo' | null>(null);
  const [undo, setUndo] = useState<UndoRecord | null>(null);
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
    async (result: LogResultType): Promise<boolean> => {
      setPending(result);
      setError(null);
      setUndo(null);
      // UX-003: snapshot today's row BEFORE the POST so Undo can restore it.
      // No optimistic update — the buttons stay disabled until the server
      // answers, so this snapshot always reflects the last persisted state.
      try {
        // If the parent's detail hasn't loaded (or its fetch failed) we don't
        // know whether today's row exists: an Undo that DELETEs could wipe a
        // pre-existing row. Fetch it now; if that fails, log without Undo.
        let known: UserClimbDetail | null = detail;
        if (!known) {
          try {
            const { getUserClimb } = await import('@/app/lib/api');
            known = await getUserClimb(climbUuid, angle);
          } catch {
            known = null;
          }
        }
        const before = known ? findTodaysLog(known.recent_logs) : null;
        const snapshot = before
          ? { id: before.id, result_type: before.result_type, attempts_count: before.attempts_count }
          : null;
        const res = await createLog(climbUuid, angle, result);
        const logId = res?.log?.id ?? snapshot?.id;
        if (logId && known) {
          const isSameRow = snapshot !== null && snapshot.id === logId;
          setUndo({
            key: Date.now(),
            logId,
            previous: isSameRow
              ? { result_type: snapshot.result_type, attempts_count: snapshot.attempts_count }
              : null,
            projectCleared: false,
            message: `Logged ${RESULT_LABEL[result]}`,
          });
        }
        // NATIVE-001: confirm the log with a light tap (no-op on web).
        void haptic('light');
        // Refetch detail to pick up new last_logged_at + recent_logs.
        // We can't reuse the POST response's user_state for the
        // recent_logs list — that endpoint returns only the new log,
        // not the full history.
        const { getUserClimb } = await import('@/app/lib/api');
        const fresh = await getUserClimb(climbUuid, angle);
        onMutated(fresh);
        return true;
      } catch (e) {
        const message = e instanceof ApiError ? e.message : 'Network error';
        setError(message);
        return false;
      } finally {
        setPending(null);
      }
    },
    [climbUuid, angle, onMutated, detail],
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

  // UX-003: revert the last log tap. Restores the exact pre-tap row (PATCH)
  // or deletes it if the tap created it, then re-adds the project flag if
  // the same tap had cleared it.
  const handleUndo = async () => {
    if (!undo) return;
    const record = undo;
    setPending('undo');
    setError(null);
    try {
      if (record.previous) {
        await patchLog(record.logId, record.previous);
      } else {
        await deleteLog(record.logId);
      }
      if (record.projectCleared) {
        await patchUserClimbProject(climbUuid, angle, true);
      }
      setUndo(null);
      const { getUserClimb } = await import('@/app/lib/api');
      const fresh = await getUserClimb(climbUuid, angle);
      onMutated(fresh);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Network error';
      setError(message);
      setUndo(null);
    } finally {
      setPending(null);
    }
  };

  const handleToastDismiss = useCallback(() => setUndo(null), []);

  const handleModalConfirmRemoveProject = async () => {
    if (!pendingProjectModal) return;
    const result = pendingProjectModal;
    setPendingProjectModal(null);
    // Log first, then clear the project flag — order matters: if the
    // log post fails we don't want to have already removed the project.
    const ok = await performLog(result);
    if (!ok) return;
    // Keep Undo disabled until projectCleared is recorded — otherwise an
    // Undo tapped mid-request would revert the log but not the project flag.
    setPending('project');
    try {
      await patchUserClimbProject(climbUuid, angle, false);
      setUndo((u) => (u ? { ...u, projectCleared: true } : u));
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

      {/* B-A021-fix-1.1.1 — single-row grid. UX-003: the instant
          "Remove" button is gone (mis-taps are reverted via the Undo toast),
          so the grid is always 4 columns. All buttons share the same
          icon-over-label stack so they read consistently on a phone. */}
      <div data-testid="log-grid" className="grid grid-cols-4 gap-2">
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
                'min-h-14 px-1 touch-manipulation select-none active:scale-[0.97] motion-reduce:active:scale-100 rounded-lg text-white font-bold',
                'border-2 transition-all flex flex-col items-center justify-center gap-0',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                btn.color,
                isTodaysResult ? 'ring-2 ring-white' : '',
              ].join(' ')}
            >
              <span className="text-xl leading-none">{btn.icon}</span>
              <span className="max-w-full truncate text-xs leading-tight">
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
            'min-h-14 px-1 touch-manipulation select-none active:scale-[0.97] motion-reduce:active:scale-100 rounded-lg border-2 font-bold',
            'flex flex-col items-center justify-center gap-0 transition-all',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            isProject
              ? 'bg-orange-500 border-orange-600 text-zinc-950 hover:bg-orange-400'
              : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-zinc-500',
          ].join(' ')}
        >
          <span className="text-xl leading-none">{isProject ? '★' : '☆'}</span>
          {/* B027: dynamic label so the button is unambiguous — when the
              climb is already a project, tapping toggles it off, so we
              reflect that in the label instead of always saying "Project". */}
          <span className="max-w-full truncate text-xs leading-tight">
            {pending === 'project'
              ? '…'
              : isProject
                ? 'Active'
                : 'Project'}
          </span>
        </button>

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

      {undo && (
        <Toast
          toastKey={undo.key}
          message={undo.message}
          actionLabel="Undo"
          onAction={handleUndo}
          onDismiss={handleToastDismiss}
          busy={pending !== null}
        />
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
          {/* B027: destructive action gets the red destructive-style; the
              safer "keep it" option is promoted to brand-orange primary so
              taps on muscle memory don't accidentally drop the project. */}
          <button
            type="button"
            data-testid="modal-confirm-remove"
            onClick={onConfirmRemove}
            className="min-h-14 px-4 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold border-2 border-red-700"
          >
            Yes, remove
          </button>
          <button
            type="button"
            data-testid="modal-keep-project"
            onClick={onKeep}
            className="min-h-14 px-4 rounded-lg bg-orange-500 hover:bg-orange-400 text-zinc-950 font-bold border-2 border-orange-600"
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
