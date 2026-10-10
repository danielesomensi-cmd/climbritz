import { type ReactNode } from 'react';

// B033 Phase 3 — unified "nothing here yet" surface (D18-5). icon + title +
// optional hint + optional action.
/** Primary-button look for a <Link> passed as `action` (the next step). */
export const EMPTY_CTA_CLASSES =
  'inline-flex min-h-[44px] items-center justify-center rounded-xl bg-orange-500 px-5 text-sm font-bold text-zinc-950 hover:bg-orange-400 active:scale-[0.98] transition touch-manipulation select-none';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, hint, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4">
      {icon && (
        <div className="text-4xl mb-3" aria-hidden>
          {icon}
        </div>
      )}
      <p className="text-text-secondary">{title}</p>
      {hint && <p className="text-sm text-text-muted mt-1">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
