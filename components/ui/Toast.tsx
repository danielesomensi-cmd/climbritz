'use client';

import { useEffect, useRef } from 'react';
import { PRESSABLE_CLASSES } from './pressable';

// UX-003 — transient confirmation with an optional action (e.g. "Undo").
// Fixed above the BottomNav (6rem + bottom safe-area, same math as .pb-nav)
// so it never covers the nav or the home indicator. Auto-dismisses after
// `durationMs`; the timer restarts whenever `toastKey` changes so a second
// log tap gets its own full window. `aria-live="polite"` announces the
// message to screen readers without stealing focus.

export interface ToastProps {
  message: string;
  /** Label of the inline action button (omit for an informational toast). */
  actionLabel?: string;
  onAction?: () => void;
  /** Called when the timer expires (and after the action is tapped). */
  onDismiss: () => void;
  durationMs?: number;
  /** While true the action button is disabled and the timer is paused. */
  busy?: boolean;
  /** Changes on every new toast so the auto-dismiss timer restarts. */
  toastKey?: string | number;
}

export const TOAST_DEFAULT_DURATION_MS = 6000;

export default function Toast({
  message,
  actionLabel,
  onAction,
  onDismiss,
  durationMs = TOAST_DEFAULT_DURATION_MS,
  busy = false,
  toastKey,
}: ToastProps) {
  // Keep the latest onDismiss without restarting the timer on each render.
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (busy) return;
    const t = setTimeout(() => dismissRef.current(), durationMs);
    return () => clearTimeout(t);
  }, [durationMs, busy, toastKey]);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4"
      style={{
        bottom:
          'calc(6rem + max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px)))',
      }}
    >
      <div
        data-testid="toast"
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-lg border border-border-strong bg-surface-raised px-4 py-2 shadow-lg"
      >
        <span className="min-w-0 flex-1 truncate text-sm text-text-secondary">
          {message}
        </span>
        {actionLabel && onAction && (
          <button
            type="button"
            data-testid="toast-action"
            onClick={onAction}
            disabled={busy}
            className={`min-h-[44px] shrink-0 rounded-md px-3 text-sm font-bold text-orange-400 hover:text-orange-300 disabled:opacity-50 ${PRESSABLE_CLASSES}`}
          >
            {busy ? `${actionLabel}…` : actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
