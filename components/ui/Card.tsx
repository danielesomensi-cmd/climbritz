import { type HTMLAttributes } from 'react';
import { PRESSABLE_CLASSES } from './pressable';

// B033 Phase 3 — content-container primitive (climb card, session/stat card,
// classify panel, BLE preset card). `interactive` adds the hover border for
// Link/button cards; UX-002 adds the shared press feel (pressable.ts).
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export default function Card({ interactive = false, className = '', children, ...rest }: CardProps) {
  return (
    <div
      className={[
        'bg-surface-raised border border-border-default rounded-card',
        interactive ? `${PRESSABLE_CLASSES} hover:border-orange-500/50` : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}
