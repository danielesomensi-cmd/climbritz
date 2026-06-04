'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';

// B033 Phase 3 — commit-action button primitive. Closes the solid-fill side of
// D18-3 (commit vs filter) and bakes in the D18-8 contrast fix: `primary` is
// brand orange with near-black text (~6.8:1, passes AA at every size).
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
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, disabled, className = '', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-card font-semibold transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      ].join(' ')}
      {...rest}
    >
      {loading ? '…' : children}
    </button>
  );
});

export default Button;
