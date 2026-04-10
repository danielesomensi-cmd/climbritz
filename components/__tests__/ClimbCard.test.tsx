import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ClimbCard from '../ClimbCard';
import type { ClimbSearchResult } from '@/app/lib/api';

const SAMPLE: ClimbSearchResult = {
  uuid: 'abc-123',
  name: 'The Dyno Project',
  setter: 'john_doe',
  grade: '7a/V6',
  angle: 40,
  ascensionist_count: 1234,
  quality_average: 4.2,
};

describe('ClimbCard', () => {
  it('renders the climb name, setter, grade, and angle', () => {
    render(<ClimbCard climb={SAMPLE} />);
    expect(screen.getByText('The Dyno Project')).toBeInTheDocument();
    expect(screen.getByText(/by john_doe/)).toBeInTheDocument();
    expect(screen.getByText('7a')).toBeInTheDocument();
    expect(screen.getByText('V6')).toBeInTheDocument();
    expect(screen.getByText('40°')).toBeInTheDocument();
  });

  it('formats ascent counts >= 1000 as "k" units', () => {
    render(<ClimbCard climb={SAMPLE} />);
    expect(screen.getByText(/1\.2k ascents/)).toBeInTheDocument();
  });

  it('shows raw count below 1000', () => {
    render(<ClimbCard climb={{ ...SAMPLE, ascensionist_count: 42 }} />);
    expect(screen.getByText(/42 ascents/)).toBeInTheDocument();
  });

  it('links to the climb detail page with angle query param', () => {
    render(<ClimbCard climb={SAMPLE} />);
    const link = screen.getByTestId('climb-card-abc-123');
    expect(link).toHaveAttribute('href', '/discover/detail?id=abc-123&angle=40');
  });
});
