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

  // A021.4.1 — StateIcons mount when the backend overlay attaches
  // user_state. With no state (anonymous request, no history), the
  // strip should not appear.
  describe('A021.4 — StateIcons integration', () => {
    it('renders no state icons when user_state is null', () => {
      render(<ClimbCard climb={{ ...SAMPLE, user_state: null }} />);
      expect(screen.queryByTestId('state-icons')).not.toBeInTheDocument();
    });

    it('renders no state icons when user_state is undefined', () => {
      render(<ClimbCard climb={SAMPLE} />);
      expect(screen.queryByTestId('state-icons')).not.toBeInTheDocument();
    });

    it('renders flash icon when best_result is flash', () => {
      render(
        <ClimbCard
          climb={{
            ...SAMPLE,
            user_state: {
              climb_uuid: 'abc-123',
              angle: 40,
              is_project: false,
              best_result: 'flash',
              last_logged_at: null,
            },
          }}
        />,
      );
      expect(screen.getByTestId('state-icon-flash')).toBeInTheDocument();
    });

    it('renders send + project together for a sent project climb', () => {
      render(
        <ClimbCard
          climb={{
            ...SAMPLE,
            user_state: {
              climb_uuid: 'abc-123',
              angle: 40,
              is_project: true,
              best_result: 'send',
              last_logged_at: '2026-05-11T18:30:00Z',
            },
          }}
        />,
      );
      expect(screen.getByTestId('state-icon-send')).toBeInTheDocument();
      expect(screen.getByTestId('state-icon-project')).toBeInTheDocument();
    });
  });
});
