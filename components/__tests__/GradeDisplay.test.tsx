import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import GradeDisplay from '../GradeDisplay';

describe('GradeDisplay', () => {
  it('splits "6a/V3" into Font + V-scale halves', () => {
    render(<GradeDisplay grade="6a/V3" />);
    expect(screen.getByText('6a')).toBeInTheDocument();
    expect(screen.getByText('V3')).toBeInTheDocument();
  });

  it('falls back to the raw string when no slash is present', () => {
    render(<GradeDisplay grade="7b" />);
    expect(screen.getByText('7b')).toBeInTheDocument();
  });
});
