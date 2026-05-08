import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// A019.16: ClimbDetailPage is AuthGuard-wrapped — mock signed-in.
jest.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true }),
}));

import ClimbDetailPage from '../detail/page';
import { saveFilteredList, clearFilteredList } from '../filtered-list-storage';

let searchParamsString = 'id=uuid-1&angle=40';
const routerPushMock = jest.fn();
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(searchParamsString),
  usePathname: () => '/discover/detail',
  useRouter: () => ({ push: routerPushMock, replace: jest.fn(), refresh: jest.fn() }),
}));

jest.mock('@/app/lib/api', () => {
  const actual = jest.requireActual('@/app/lib/api');
  return {
    ...actual,
    getClimbDetail: jest.fn(),
  };
});

// Mock the placements JSON for ClimbBoardView (smaller for speed).
jest.mock('@/app/data/placements_12x12.json', () => [
  { placement_id: 1001, hole_id: 2001, x: 0,  y: 152, hole_name: '0,152', default_role: 'middle', set_name: 'Bolt Ons', set_id: 1, role_id: 13 },
  { placement_id: 1002, hole_id: 2002, x: 8,  y: 144, hole_name: '1,144', default_role: 'start',  set_name: 'Bolt Ons', set_id: 1, role_id: 12 },
  { placement_id: 1003, hole_id: 2003, x: 16, y: 136, hole_name: '2,136', default_role: 'finish', set_name: 'Bolt Ons', set_id: 1, role_id: 14 },
]);

import { getClimbDetail } from '@/app/lib/api';
const getClimbDetailMock = getClimbDetail as jest.MockedFunction<typeof getClimbDetail>;

const SAMPLE_CLIMB = {
  uuid: 'uuid-1',
  name: 'The Test Send',
  setter: 'tester',
  description: 'A nice warmup problem.',
  holds: [
    { placement_id: 1001, role: 'start', x: 0, y: 152, set_id: 1 },
    { placement_id: 1002, role: 'middle', x: 8, y: 144, set_id: 1 },
    { placement_id: 1003, role: 'finish', x: 16, y: 136, set_id: 1 },
  ],
  stats: [
    { angle: 40, grade: '6a/V3', difficulty: 16, ascensionist_count: 1500, quality_average: 4.0 },
    { angle: 45, grade: '6b/V4', difficulty: 18, ascensionist_count: 800, quality_average: 3.8 },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  searchParamsString = 'id=uuid-1&angle=40';
  getClimbDetailMock.mockResolvedValue(SAMPLE_CLIMB);
  window.sessionStorage.clear();
});

describe('ClimbDetailPage', () => {
  it('shows a loading state initially', () => {
    render(<ClimbDetailPage />);
    expect(screen.getByTestId('detail-loading')).toBeInTheDocument();
  });

  it('renders the climb name, setter, description, and grade after load', async () => {
    render(<ClimbDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId('climb-name')).toHaveTextContent('The Test Send');
    });
    expect(screen.getByText(/by tester/)).toBeInTheDocument();
    expect(screen.getByTestId('climb-description')).toHaveTextContent('A nice warmup problem.');
    expect(screen.getByText('6a')).toBeInTheDocument();
  });

  it('renders the board visualization with active hold colors', async () => {
    render(<ClimbDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId('climb-board-view')).toBeInTheDocument();
    });
    expect(screen.getByTestId('hold-1001').style.borderColor).not.toBe('');
    expect(screen.getByTestId('hold-1002').style.borderColor).not.toBe('');
    expect(screen.getByTestId('hold-1003').style.borderColor).not.toBe('');
  });

  it('shows other available angles as links', async () => {
    render(<ClimbDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId('other-angles')).toBeInTheDocument();
    });
    expect(screen.getByText(/45° · 6b/)).toBeInTheDocument();
  });

  it('back link points to /discover', async () => {
    render(<ClimbDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId('back-link')).toHaveAttribute('href', '/discover');
    });
  });

  it('shows an error if the API rejects', async () => {
    getClimbDetailMock.mockRejectedValueOnce(new Error('not found'));
    render(<ClimbDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId('detail-error')).toHaveTextContent('not found');
    });
  });

  it('calls the API with the angle from the URL', async () => {
    searchParamsString = 'id=uuid-1&angle=50';
    render(<ClimbDetailPage />);
    await waitFor(() => {
      expect(getClimbDetailMock).toHaveBeenCalledWith('uuid-1', 50);
    });
  });

  describe('Next/Prev navigation (A014)', () => {
    const withList = (index: number) => {
      saveFilteredList({
        climbIds: ['uuid-0', 'uuid-1', 'uuid-2'],
        angle: 40,
        timestamp: Date.now(),
      });
      searchParamsString = `id=uuid-${index}&angle=40`;
    };

    it('renders Next/Prev and the position indicator when uuid is in the saved list', async () => {
      withList(1);
      render(<ClimbDetailPage />);
      await waitFor(() => {
        expect(screen.getByTestId('list-nav')).toBeInTheDocument();
      });
      expect(screen.getByTestId('list-nav-position')).toHaveTextContent('2 of 3');
      expect(screen.getByTestId('list-nav-prev')).not.toBeDisabled();
      expect(screen.getByTestId('list-nav-next')).not.toBeDisabled();
    });

    it('disables Prev on the first climb in the list', async () => {
      withList(0);
      render(<ClimbDetailPage />);
      await waitFor(() => {
        expect(screen.getByTestId('list-nav-prev')).toBeDisabled();
      });
      expect(screen.getByTestId('list-nav-next')).not.toBeDisabled();
      expect(screen.getByTestId('list-nav-position')).toHaveTextContent('1 of 3');
    });

    it('disables Next on the last climb in the list', async () => {
      withList(2);
      render(<ClimbDetailPage />);
      await waitFor(() => {
        expect(screen.getByTestId('list-nav-next')).toBeDisabled();
      });
      expect(screen.getByTestId('list-nav-prev')).not.toBeDisabled();
      expect(screen.getByTestId('list-nav-position')).toHaveTextContent('3 of 3');
    });

    it('hides the whole row on a deep link (no saved list)', async () => {
      clearFilteredList();
      render(<ClimbDetailPage />);
      await waitFor(() => {
        expect(screen.getByTestId('climb-name')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('list-nav')).not.toBeInTheDocument();
    });

    it('hides the row when the uuid is not in the saved list', async () => {
      saveFilteredList({
        climbIds: ['someone-else', 'another-one'],
        angle: 40,
        timestamp: Date.now(),
      });
      render(<ClimbDetailPage />);
      await waitFor(() => {
        expect(screen.getByTestId('climb-name')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('list-nav')).not.toBeInTheDocument();
    });

    it('hides the row when the saved list is stale (>24h) and clears it', async () => {
      saveFilteredList({
        climbIds: ['uuid-0', 'uuid-1', 'uuid-2'],
        angle: 40,
        timestamp: Date.now() - 25 * 60 * 60 * 1000,
      });
      searchParamsString = 'id=uuid-1&angle=40';
      render(<ClimbDetailPage />);
      await waitFor(() => {
        expect(screen.getByTestId('climb-name')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('list-nav')).not.toBeInTheDocument();
      expect(window.sessionStorage.getItem('kilter-up:discover:filtered-list')).toBeNull();
    });

    it('tapping Next routes to the next climb, keeping the list angle', async () => {
      withList(1);
      render(<ClimbDetailPage />);
      await waitFor(() => expect(screen.getByTestId('list-nav-next')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('list-nav-next'));
      expect(routerPushMock).toHaveBeenCalledWith('/discover/detail?id=uuid-2&angle=40');
    });

    it('tapping Prev routes to the previous climb', async () => {
      withList(1);
      render(<ClimbDetailPage />);
      await waitFor(() => expect(screen.getByTestId('list-nav-prev')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('list-nav-prev'));
      expect(routerPushMock).toHaveBeenCalledWith('/discover/detail?id=uuid-0&angle=40');
    });

    it('does not route past the end of the list', async () => {
      withList(2);
      render(<ClimbDetailPage />);
      await waitFor(() => expect(screen.getByTestId('list-nav-next')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('list-nav-next'));
      expect(routerPushMock).not.toHaveBeenCalled();
    });
  });
});
