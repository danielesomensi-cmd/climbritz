import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import StarRating from '../StarRating';

describe('StarRating', () => {
  // B037 — Aurora/Kilter quality is a 0–3 scale; StarRating defaults max=3.
  it('renders with an accessible aria-label on the 0–3 scale', () => {
    render(<StarRating value={2.5} />);
    expect(screen.getByTestId('star-rating')).toHaveAttribute(
      'aria-label',
      '2.5 out of 3 stars',
    );
  });

  it('clamps values above the max (3)', () => {
    render(<StarRating value={9} />);
    expect(screen.getByTestId('star-rating')).toHaveAttribute(
      'aria-label',
      '3.0 out of 3 stars',
    );
  });

  it('clamps negative values to zero', () => {
    render(<StarRating value={-3} />);
    expect(screen.getByTestId('star-rating')).toHaveAttribute(
      'aria-label',
      '0.0 out of 3 stars',
    );
  });

  it('renders three star glyphs total by default', () => {
    render(<StarRating value={1.5} />);
    const stars = screen.getByTestId('star-rating').textContent ?? '';
    // Every visible glyph is '★' (full, half rendered as two, empty).
    // 1 full + 1 half (two glyphs) + 1 empty = 4 glyph nodes, ≥3 stars.
    expect((stars.match(/★/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it('honours an explicit max prop', () => {
    render(<StarRating value={4} max={5} />);
    expect(screen.getByTestId('star-rating')).toHaveAttribute(
      'aria-label',
      '4.0 out of 5 stars',
    );
  });
});
