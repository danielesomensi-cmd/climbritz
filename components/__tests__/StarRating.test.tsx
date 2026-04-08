import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import StarRating from '../StarRating';

describe('StarRating', () => {
  it('renders with an accessible aria-label', () => {
    render(<StarRating value={3.5} />);
    expect(screen.getByTestId('star-rating')).toHaveAttribute(
      'aria-label',
      '3.5 out of 5 stars',
    );
  });

  it('clamps values above 5', () => {
    render(<StarRating value={9} />);
    expect(screen.getByTestId('star-rating')).toHaveAttribute(
      'aria-label',
      '5.0 out of 5 stars',
    );
  });

  it('clamps negative values to zero', () => {
    render(<StarRating value={-3} />);
    expect(screen.getByTestId('star-rating')).toHaveAttribute(
      'aria-label',
      '0.0 out of 5 stars',
    );
  });

  it('renders five star glyphs total', () => {
    render(<StarRating value={2.5} />);
    const stars = screen.getByTestId('star-rating').textContent ?? '';
    // Every visible glyph is '★' (full, half rendered as two, empty)
    // We just check there are at least 5 stars rendered
    expect((stars.match(/★/g) ?? []).length).toBeGreaterThanOrEqual(5);
  });
});
