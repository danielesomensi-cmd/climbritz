import { splitGrade } from '@/app/lib/grades';

interface GradeDisplayProps {
  /** The combined "6a/V3" string the API returns. */
  grade: string;
  /** Visual size variant. */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<GradeDisplayProps['size']>, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-2xl',
};

/**
 * Renders the Font grade prominently with the V-scale equivalent
 * below in smaller type. Works with the "6a/V3" string format
 * returned by the climb search API.
 */
export default function GradeDisplay({ grade, size = 'md', className = '' }: GradeDisplayProps) {
  const { font, v } = splitGrade(grade);
  return (
    <span
      data-testid="grade-display"
      className={`inline-flex flex-col items-center leading-tight ${className}`}
    >
      <span className={`font-bold text-orange-400 ${SIZE_CLASSES[size]}`}>{font}</span>
      {v && <span className="text-[0.7em] text-zinc-400">{v}</span>}
    </span>
  );
}
