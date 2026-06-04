import { type HTMLAttributes } from 'react';

// B033 Phase 3 — content-container primitive (climb card, session/stat card,
// classify panel, BLE preset card). `interactive` adds the hover border for
// Link/button cards.
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export default function Card({ interactive = false, className = '', children, ...rest }: CardProps) {
  return (
    <div
      className={[
        'bg-surface-raised border border-border-default rounded-card',
        interactive ? 'transition-colors hover:border-orange-500/50' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}
