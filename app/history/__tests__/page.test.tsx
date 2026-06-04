/**
 * A021.5.9 — /history page integration tests.
 *
 * Recharts is heavy + relies on ResizeObserver, so we mock its
 * containers to keep the tests fast and deterministic. The real
 * Recharts components are exercised in the manual gym/web check.
 */

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import type {
  PyramidEntry,
  SessionResponse,
  TrendEntry,
} from '@/app/lib/api';

jest.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true }),
}));

jest.mock('next/navigation', () => ({
  usePathname: () => '/history',
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
}));

const getSessionsMock = jest.fn();
const getPyramidMock = jest.fn();
const getTrendMock = jest.fn();
jest.mock('@/app/lib/api', () => {
  const actual = jest.requireActual('@/app/lib/api');
  return {
    ...actual,
    getSessions: (...args: unknown[]) => getSessionsMock(...args),
    getPyramid: (...args: unknown[]) => getPyramidMock(...args),
    getTrend: (...args: unknown[]) => getTrendMock(...args),
  };
});

// Recharts: stub the ResponsiveContainer and the chart primitives so
// the test environment doesn't need ResizeObserver / SVG sizing math.
jest.mock('recharts', () => {
  const React = require('react');
  const passthrough = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children);
  return {
    ResponsiveContainer: passthrough,
    BarChart: passthrough,
    Bar: () => null,
    LineChart: passthrough,
    Line: () => null,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
  };
});

import HistoryPage from '../page';

function mkSession(
  date: string,
  overrides: Partial<SessionResponse> = {},
): SessionResponse {
  return {
    date,
    total_climbs: 2,
    sends: 1,
    flashes: 1,
    attempts: 0,
    climbs: [
      {
        climb_uuid: 'uuid-a',
        angle: 40,
        result_type: 'send',
        attempts_count: 1,
        log_id: `${date}-send`,
        climb_name: 'The Test Send',
        grade: '6a/V3',
      },
      {
        climb_uuid: 'uuid-b',
        angle: 40,
        result_type: 'flash',
        attempts_count: 1,
        log_id: `${date}-flash`,
        climb_name: 'Easy Warm-up',
        grade: '5+/V0',
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  getSessionsMock.mockResolvedValue([]);
  getPyramidMock.mockResolvedValue([]);
  getTrendMock.mockResolvedValue([]);
});

describe('HistoryPage — B026 header + stats polish', () => {
  it('does not render a back-link on the header (top-level route)', async () => {
    render(<HistoryPage />);
    await waitFor(() =>
      expect(screen.queryByTestId('history-loading')).not.toBeInTheDocument(),
    );
    expect(screen.queryByTestId('back-link')).not.toBeInTheDocument();
  });

  it('dims zero-value stat cards, keeps non-zero ones full', async () => {
    // B033: SENDS = send-or-better (sends + flashes). To get a zero SENDS
    // card the session must have neither a send nor a flash — one attempt.
    getSessionsMock.mockResolvedValue([
      mkSession('2026-05-19', {
        total_climbs: 1,
        sends: 0,
        flashes: 0,
        attempts: 1,
      }),
    ]);
    render(<HistoryPage />);
    await waitFor(() =>
      expect(screen.queryByTestId('history-loading')).not.toBeInTheDocument(),
    );
    // 0 sends-or-better → dimmed. 1 climb → full saturation.
    expect(screen.getByTestId('stat-card-sends').className).toMatch(
      /opacity-50/,
    );
    expect(screen.getByTestId('stat-card-climbs').className).not.toMatch(
      /opacity-50/,
    );
  });
});

describe('HistoryPage — loading + empty state', () => {
  it('shows a loading indicator before data resolves', async () => {
    // Never-resolving promise to keep us in the loading state.
    getSessionsMock.mockReturnValue(new Promise(() => {}));
    getPyramidMock.mockReturnValue(new Promise(() => {}));
    getTrendMock.mockReturnValue(new Promise(() => {}));
    render(<HistoryPage />);
    expect(await screen.findByTestId('history-loading')).toBeInTheDocument();
  });

  it('renders the empty state for a brand-new user', async () => {
    render(<HistoryPage />);
    await waitFor(() =>
      expect(screen.queryByTestId('history-loading')).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId('sessions-empty')).toBeInTheDocument();
    expect(screen.getByTestId('pyramid-empty')).toBeInTheDocument();
    expect(screen.getByTestId('trend-empty')).toBeInTheDocument();
  });
});

describe('HistoryPage — stats header', () => {
  it('counts sessions, climbs, sends, flashes and shows pyramid peak', async () => {
    getSessionsMock.mockResolvedValue([
      mkSession('2026-05-11', { sends: 2, flashes: 1, total_climbs: 3 }),
      mkSession('2026-05-09', { sends: 0, flashes: 2, total_climbs: 2 }),
    ]);
    const peakEntries: PyramidEntry[] = [
      { grade_band: '5+/V0', count: 2 },
      { grade_band: '6a/V3', count: 4 },
      { grade_band: '6b/V4', count: 1 },
    ];
    getPyramidMock.mockResolvedValue(peakEntries);

    render(<HistoryPage />);
    await waitFor(() =>
      expect(screen.queryByTestId('history-loading')).not.toBeInTheDocument(),
    );

    // A024: per-tile testids so we can assert each metric unambiguously.
    // B033: SENDS is send-or-better (plain sends + flashes).
    expect(screen.getByTestId('stat-card-sessions')).toHaveTextContent('2');
    expect(screen.getByTestId('stat-card-climbs')).toHaveTextContent('5'); // 3+2 volume
    expect(screen.getByTestId('stat-card-flashes')).toHaveTextContent('3'); // 1+2 flashes
    expect(screen.getByTestId('stat-card-sends')).toHaveTextContent('5'); // (2+1)+(0+2) send-or-better
    expect(screen.getByTestId('stat-card-peak')).toHaveTextContent('6b/V4'); // last entry
  });
});

describe('HistoryPage — date range picker', () => {
  it('refetches all three sections when the range changes', async () => {
    render(<HistoryPage />);
    await waitFor(() => expect(getSessionsMock).toHaveBeenCalled());
    const sessionsCallsBefore = getSessionsMock.mock.calls.length;
    const pyramidCallsBefore = getPyramidMock.mock.calls.length;
    const trendCallsBefore = getTrendMock.mock.calls.length;

    fireEvent.click(screen.getByTestId('range-30'));
    await waitFor(() =>
      expect(getSessionsMock.mock.calls.length).toBeGreaterThan(
        sessionsCallsBefore,
      ),
    );
    expect(getPyramidMock.mock.calls.length).toBeGreaterThan(
      pyramidCallsBefore,
    );
    expect(getTrendMock.mock.calls.length).toBeGreaterThan(trendCallsBefore);
  });

  it('"All" range omits the `from` param', async () => {
    render(<HistoryPage />);
    await waitFor(() => expect(getSessionsMock).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('range-all'));
    await waitFor(() => {
      const last = getSessionsMock.mock.calls.at(-1);
      expect(last?.[0]).toBeUndefined();
    });
  });
});

describe('HistoryPage — pyramid filter toggle', () => {
  it('changing the filter triggers a pyramid refetch with the new value', async () => {
    render(<HistoryPage />);
    // Pyramid section only renders after the loading state resolves.
    await waitFor(() =>
      expect(screen.getByTestId('pyramid-filter-flash')).toBeInTheDocument(),
    );
    const before = getPyramidMock.mock.calls.length;
    fireEvent.click(screen.getByTestId('pyramid-filter-flash'));
    await waitFor(() => {
      expect(getPyramidMock.mock.calls.length).toBeGreaterThan(before);
      const last = getPyramidMock.mock.calls.at(-1);
      expect(last?.[2]).toBe('flash');
    });
  });
});

describe('HistoryPage — sessions interaction', () => {
  // A024: the activity calendar (and its day → session-card scroll) was
  // removed; the sessions list is now the only session surface.
  it('clicking a session-climb row routes to /discover/detail', async () => {
    const iso = '2026-05-11';
    getSessionsMock.mockResolvedValue([mkSession(iso)]);
    render(<HistoryPage />);
    await waitFor(() =>
      expect(
        screen.getByTestId(`session-climb-${iso}-send`),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByTestId(`session-climb-${iso}-send`),
    ).toHaveAttribute('href', '/discover/detail?id=uuid-a&angle=40');
  });
});

describe('HistoryPage — error state', () => {
  it('surfaces an error banner when fetches fail', async () => {
    const { ApiError } = jest.requireActual('@/app/lib/api');
    getSessionsMock.mockRejectedValue(new ApiError(500, 'boom'));
    getPyramidMock.mockResolvedValue([]);
    getTrendMock.mockResolvedValue([]);
    render(<HistoryPage />);
    await waitFor(() =>
      expect(screen.getByTestId('history-error')).toHaveTextContent('boom'),
    );
  });
});

describe('TrendChart — series toggles', () => {
  it('Flash + Send active by default, Attempt off', async () => {
    getTrendMock.mockResolvedValue([
      { week_start: '2026-05-11', flash_count: 1, send_count: 2, attempt_count: 5 },
    ] satisfies TrendEntry[]);
    render(<HistoryPage />);
    await waitFor(() =>
      expect(screen.getByTestId('trend-toggle-flash')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('trend-toggle-flash')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('trend-toggle-send')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('trend-toggle-attempt')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('clicking a series toggle flips its pressed state', async () => {
    render(<HistoryPage />);
    await waitFor(() =>
      expect(screen.getByTestId('trend-toggle-attempt')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId('trend-toggle-attempt'));
    expect(screen.getByTestId('trend-toggle-attempt')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
