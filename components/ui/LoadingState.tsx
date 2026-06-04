// B033 Phase 3 — unified async-pending indicator (D18-5). One copy convention:
// "Loading…" everywhere (callers may override for a context noun, but the
// default is the single shared verb).
export interface LoadingStateProps {
  label?: string;
  className?: string;
}

export default function LoadingState({ label = 'Loading…', className = '' }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={['flex items-center justify-center gap-2 py-8 text-text-tertiary', className].join(' ')}
    >
      <span
        className="w-4 h-4 rounded-full border-2 border-zinc-600 border-t-orange-500 animate-spin"
        aria-hidden
      />
      <span className="text-sm">{label}</span>
    </div>
  );
}
