'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { PRESSABLE_CLASSES } from './pressable';

// B033 Phase 3 — commit-action button primitive. Closes the solid-fill side of
// D18-3 (commit vs filter) and bakes in the D18-8 contrast fix: `primary` is
// brand orange with near-black text (~6.8:1, passes AA at every size).
// UX-002: loading keeps the label (or `loadingLabel`) next to a spinner and
// sets aria-busy; press state (active:scale) + touch-manipulation +
// select-none for a native-feeling tap.
type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost';
type ButtonSize = 'md' | 'lg';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-orange-500 hover:bg-orange-400 text-zinc-950',
  secondary: 'bg-surface-overlay hover:bg-zinc-700 text-text-primary border border-border-strong',
  destructive: 'bg-feedback-error hover:bg-red-400 text-zinc-950',
  ghost: 'bg-transparent hover:bg-surface-overlay text-text-secondary',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: 'min-h-[44px] px-4 text-sm',
  lg: 'min-h-[56px] px-6 text-base',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Text shown next to the spinner while loading. Defaults to `children`. */
  loadingLabel?: string;
}

function Spinner() {
  return (
    <span
      data-testid="button-spinner"
      aria-hidden="true"
      className="inline-block h-4 w-4 shrink-0 rounded-full border-2 border-current border-r-transparent animate-spin motion-reduce:animate-none"
    />
  );
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    loadingLabel,
    disabled,
    className = '',
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-card font-semibold',
        PRESSABLE_CLASSES,
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      ].join(' ')}
      {...rest}
    >
      {loading ? (
        <>
          <Spinner />
          {loadingLabel ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
});

export default Button;
