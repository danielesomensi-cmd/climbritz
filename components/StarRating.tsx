interface StarRatingProps {
  /** Quality value. Clamped to [0, max]. */
  value: number;
  /** Top of the scale. Aurora/Kilter quality is 0–3 (B037), so this
   *  defaults to 3 — a max-quality climb renders as 3/3 filled, not 3/5. */
  max?: number;
  /** Optional pixel size of each star (default 14). */
  size?: number;
  /** Optional extra classes for the wrapper. */
  className?: string;
}

/**
 * Star display on a 0–`max` scale (default 3 — the Aurora/Kilter quality
 * scale, B037). Fills stars left-to-right in 0.5 increments using a text
 * glyph, so no extra assets are needed.
 */
export default function StarRating({ value, max = 3, size = 14, className = '' }: StarRatingProps) {
  const clamped = Math.max(0, Math.min(max, value));
  const fullStars = Math.floor(clamped);
  const hasHalf = clamped - fullStars >= 0.5;
  const emptyStars = max - fullStars - (hasHalf ? 1 : 0);

  return (
    <span
      data-testid="star-rating"
      className={`inline-flex items-center gap-0.5 text-amber-400 leading-none ${className}`}
      style={{ fontSize: `${size}px` }}
      aria-label={`${clamped.toFixed(1)} out of ${max} stars`}
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
