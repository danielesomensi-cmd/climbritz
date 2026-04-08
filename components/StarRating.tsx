interface StarRatingProps {
  /** 0–5 (may be fractional). Values outside are clamped. */
  value: number;
  /** Optional pixel size of each star (default 14). */
  size?: number;
  /** Optional extra classes for the wrapper. */
  className?: string;
}

/**
 * Simple 5-star display. Fills stars left-to-right in 0.5 increments.
 * Uses a text-based star glyph so no extra assets are needed.
 */
export default function StarRating({ value, size = 14, className = '' }: StarRatingProps) {
  const clamped = Math.max(0, Math.min(5, value));
  const fullStars = Math.floor(clamped);
  const hasHalf = clamped - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  return (
    <span
      data-testid="star-rating"
      className={`inline-flex items-center gap-0.5 text-amber-400 leading-none ${className}`}
      style={{ fontSize: `${size}px` }}
      aria-label={`${clamped.toFixed(1)} out of 5 stars`}
    >
      {Array.from({ length: fullStars }).map((_, i) => (
        <span key={`f${i}`} aria-hidden="true">★</span>
      ))}
      {hasHalf && (
        <span aria-hidden="true" className="relative inline-block">
          <span className="text-zinc-600">★</span>
          <span
            className="absolute inset-0 overflow-hidden"
            style={{ width: '50%' }}
          >
            ★
          </span>
        </span>
      )}
      {Array.from({ length: emptyStars }).map((_, i) => (
        <span key={`e${i}`} aria-hidden="true" className="text-zinc-600">
          ★
        </span>
      ))}
    </span>
  );
}
