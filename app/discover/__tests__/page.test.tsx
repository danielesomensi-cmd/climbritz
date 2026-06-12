import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// A019.16: DiscoverPage is now AuthGuard-wrapped. Per-test override possible
// via mockUseAuth.mockReturnValueOnce(...). Default = signed-in (beforeEach).
const mockUseAuth = jest.fn();
jest.mock('@clerk/clerk-react', () => ({
  useAuth: () => mockUseAuth(),
}));

import DiscoverPage from '../page';

// Mock next/navigation hooks.
const replaceMock = jest.fn();
let searchParamsString = '';
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => new URLSearchParams(searchParamsString),
  usePathname: () => '/discover',
}));

// Mock the search API.
jest.mock('@/app/lib/api', () => {
  const actual = jest.requireActual('@/app/lib/api');
  return {
    ...actual,
    searchClimbs: jest.fn(),
  };
});

import { searchClimbs } from '@/app/lib/api';
const searchClimbsMock = searchClimbs as jest.MockedFunction<typeof searchClimbs>;

const SAMPLE_RESULTS = [
  {
    uuid: 'uuid-1',
    name: 'Test Climb One',
    setter: 'tester',
    grade: '6a/V3',
    angle: 40,
    ascensionist_count: 100,
    quality_average: 3.5,
    is_nomatch: false,
  },
  {
    uuid: 'uuid-2',
    name: 'Test Climb Two',
    setter: 'tester',
    grade: '7a/V6',
    angle: 40,
    ascensionist_count: 50,
    quality_average: 4.5,
    is_nomatch: false,
  },
];

// B020: searchClimbs returns an envelope. Helper keeps test fixtures terse.
function envelope(climbs: typeof SAMPLE_RESULTS, totalCount?: number) {
  return { climbs, total_count: totalCount ?? climbs.length };
}

beforeEach(() => {
  jest.clearAllMocks();
  searchParamsString = '';
  window.sessionStorage.clear();
  searchClimbsMock.mockResolvedValue(envelope(SAMPLE_RESULTS));
  mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: true });
});

describe('DiscoverPage', () => {
  it('renders the header with default angle 40', () => {
    render(<DiscoverPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Discover' })).toBeInTheDocument();
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
    // Default angle button is highlighted (orange background class)
    expect(screen.getByTestId('angle-40').className).toMatch(/bg-orange-500/);
  });

  it('fetches results immediately on mount with no query (browse-by-filter)', async () => {
    render(<DiscoverPage />);
    await waitFor(() => {
      expect(searchClimbsMock).toHaveBeenCalled();
    });
    // First call should have no q (browse mode), only the default angle
    const firstCallArgs = searchClimbsMock.mock.calls[0][0];
    expect(firstCallArgs.q).toBeUndefined();
    expect(firstCallArgs.angle).toBe(40);
  });

  it('shows results from the initial browse-by-filter fetch', async () => {
    render(<DiscoverPage />);
    await waitFor(() => {
      expect(screen.getByText('Test Climb One')).toBeInTheDocument();
      expect(screen.getByText('Test Climb Two')).toBeInTheDocument();
    });
  });

  it('debounces the API call and renders results', async () => {
    render(<DiscoverPage />);
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'test' } });

    await waitFor(
      () => {
        expect(searchClimbsMock).toHaveBeenCalledWith(
          expect.objectContaining({ q: 'test', angle: 40 }),
        );
      },
      { timeout: 1000 },
    );

    await waitFor(() => {
      expect(screen.getByText('Test Climb One')).toBeInTheDocument();
      expect(screen.getByText('Test Climb Two')).toBeInTheDocument();
    });
  });

  it('changing the angle updates the search call', async () => {
    render(<DiscoverPage />);
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'test' } });
    await waitFor(() => expect(searchClimbsMock).toHaveBeenCalled());
    searchClimbsMock.mockClear();

    fireEvent.click(screen.getByTestId('angle-50'));

    await waitFor(() => {
      expect(searchClimbsMock).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'test', angle: 50 }),
      );
    });
  });

  it('applying a grade filter passes it to the API', async () => {
    render(<DiscoverPage />);
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'test' } });
    await waitFor(() => expect(searchClimbsMock).toHaveBeenCalled());
    searchClimbsMock.mockClear();

    fireEvent.click(screen.getByTestId('filter-toggle'));
    fireEvent.change(screen.getByTestId('filter-grade-min'), { target: { value: '18' } });

    await waitFor(() => {
      expect(searchClimbsMock).toHaveBeenCalledWith(
        expect.objectContaining({ grade_min: 18 }),
      );
    });
  });

  it('shows an error message if the API rejects', async () => {
    searchClimbsMock.mockRejectedValueOnce(new Error('boom'));
    render(<DiscoverPage />);
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'test' } });
    await waitFor(() => {
      expect(screen.getByTestId('results-error')).toHaveTextContent('boom');
    });
  });

  it('shows the no-results message when the API returns 0 climbs', async () => {
    searchClimbsMock.mockResolvedValueOnce(envelope([], 0));
    render(<DiscoverPage />);
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'xyz' } });
    await waitFor(() => {
      expect(screen.getByTestId('results-empty').textContent).toMatch(/No climbs match/);
    });
  });

  it('initialises state from URL params', async () => {
    searchParamsString = 'q=alpha&angle=50&grade_min=18&sort=quality';
    render(<DiscoverPage />);
    expect((screen.getByTestId('search-input') as HTMLInputElement).value).toBe('alpha');
    expect(screen.getByTestId('angle-50').className).toMatch(/bg-orange-500/);
    await waitFor(() => {
      expect(searchClimbsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          q: 'alpha',
          angle: 50,
          grade_min: 18,
          sort: 'quality',
        }),
      );
    });
  });

  describe('filter persistence (B017.3)', () => {
    it('uses defaults when no URL params and empty sessionStorage', async () => {
      render(<DiscoverPage />);
      expect(screen.getByTestId('angle-40').className).toMatch(/bg-orange-500/);
      expect((screen.getByTestId('search-input') as HTMLInputElement).value).toBe('');
    });

    it('restores angle from sessionStorage when URL has no params', async () => {
      // Seed storage as if the user had set angle=45 on a prior mount
      window.sessionStorage.setItem(
        'climbritz:discover:filters',
        JSON.stringify({
          query: '',
          angle: 45,
          filters: { sort: 'popularity' },
          timestamp: Date.now(),
        }),
      );

      render(<DiscoverPage />);
      expect(screen.getByTestId('angle-45').className).toMatch(/bg-orange-500/);
    });

    it('URL params override sessionStorage on mount', async () => {
      window.sessionStorage.setItem(
        'climbritz:discover:filters',
        JSON.stringify({
          query: '',
          angle: 45,
          filters: { sort: 'popularity' },
          timestamp: Date.now(),
        }),
      );
      searchParamsString = 'angle=60';

      render(<DiscoverPage />);
      expect(screen.getByTestId('angle-60').className).toMatch(/bg-orange-500/);
    });

    it('writes to sessionStorage when the user changes the angle', async () => {
      render(<DiscoverPage />);
      fireEvent.click(screen.getByTestId('angle-55'));

      await waitFor(() => {
        const raw = window.sessionStorage.getItem('climbritz:discover:filters');
        expect(raw).not.toBeNull();
        const parsed = JSON.parse(raw!);
        expect(parsed.angle).toBe(55);
      });
    });

    it('change → unmount → remount restores the changed angle', async () => {
      const { unmount } = render(<DiscoverPage />);
      fireEvent.click(screen.getByTestId('angle-65'));

      // Give the save useEffect a chance to run
      await waitFor(() => {
        const raw = window.sessionStorage.getItem('climbritz:discover:filters');
        expect(raw).not.toBeNull();
        expect(JSON.parse(raw!).angle).toBe(65);
      });

      unmount();
      render(<DiscoverPage />);
      expect(screen.getByTestId('angle-65').className).toMatch(/bg-orange-500/);
    });

    it('falls back to defaults after sessionStorage is cleared', async () => {
      window.sessionStorage.setItem(
        'climbritz:discover:filters',
        JSON.stringify({
          query: '',
          angle: 45,
          filters: { sort: 'popularity' },
          timestamp: Date.now(),
        }),
      );
      window.sessionStorage.removeItem('climbritz:discover:filters');

      render(<DiscoverPage />);
      expect(screen.getByTestId('angle-40').className).toMatch(/bg-orange-500/);
    });
  });

  describe('prominent Filters button (B017 follow-up)', () => {
    it('renders with Filters label, no badge, and neutral bg when no filters active', () => {
      render(<DiscoverPage />);
      const btn = screen.getByTestId('filter-toggle');
      expect(btn).toHaveTextContent('Filters');
      expect(screen.queryByTestId('filter-count-badge')).not.toBeInTheDocument();
      expect(btn.className).toMatch(/bg-zinc-800/);
      expect(btn.className).not.toMatch(/bg-orange-500/);
    });

    it('has a minimum tap height of 56px', () => {
      render(<DiscoverPage />);
      const btn = screen.getByTestId('filter-toggle');
      expect(btn.className).toMatch(/min-h-\[56px\]/);
    });

    it('starts with aria-expanded=false and the panel collapsed', () => {
      render(<DiscoverPage />);
      const btn = screen.getByTestId('filter-toggle');
      expect(btn).toHaveAttribute('aria-expanded', 'false');
      expect(btn).toHaveAttribute('aria-controls', 'discover-filter-panel');
      expect(screen.queryByTestId('filter-panel')).not.toBeInTheDocument();
    });

    it('clicking the button toggles aria-expanded and renders panel content', () => {
      render(<DiscoverPage />);
      const btn = screen.getByTestId('filter-toggle');

      fireEvent.click(btn);
      expect(btn).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByTestId('filter-panel')).toBeInTheDocument();

      fireEvent.click(btn);
      expect(btn).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('filter-panel')).not.toBeInTheDocument();
    });

    it('switches to orange bg and shows count=1 when one filter is active', async () => {
      render(<DiscoverPage />);
      fireEvent.click(screen.getByTestId('filter-toggle'));
      fireEvent.change(screen.getByTestId('filter-grade-min'), { target: { value: '18' } });

      await waitFor(() => {
        const btn = screen.getByTestId('filter-toggle');
        expect(btn.className).toMatch(/bg-orange-500/);
        expect(screen.getByTestId('filter-count-badge')).toHaveTextContent('1');
      });
    });

    it('shows count=2 when two filters are active', async () => {
      render(<DiscoverPage />);
      fireEvent.click(screen.getByTestId('filter-toggle'));
      fireEvent.change(screen.getByTestId('filter-grade-min'), { target: { value: '18' } });
      fireEvent.click(screen.getByTestId('filter-ascents-50+'));

      await waitFor(() => {
        expect(screen.getByTestId('filter-count-badge')).toHaveTextContent('2');
      });
    });

    it('counts a non-default sort as an active filter', async () => {
      render(<DiscoverPage />);
      fireEvent.click(screen.getByTestId('filter-toggle'));
      fireEvent.click(screen.getByTestId('filter-sort-quality'));

      await waitFor(() => {
        expect(screen.getByTestId('filter-count-badge')).toHaveTextContent('1');
      });
    });
  });

  describe('moves filter (A019)', () => {
    it('clicking a moves chip passes the bucket to the API', async () => {
      render(<DiscoverPage />);
      await waitFor(() => expect(searchClimbsMock).toHaveBeenCalled());
      searchClimbsMock.mockClear();

      fireEvent.click(screen.getByTestId('filter-toggle'));
      fireEvent.click(screen.getByTestId('filter-moves-8-10'));

      await waitFor(() => {
        expect(searchClimbsMock).toHaveBeenCalledWith(
          expect.objectContaining({ moves: '8-10' }),
        );
      });
    });

    it('selecting a non-Any bucket increments the active-filter badge', async () => {
      render(<DiscoverPage />);
      fireEvent.click(screen.getByTestId('filter-toggle'));
      fireEvent.click(screen.getByTestId('filter-moves-le5'));

      await waitFor(() => {
        expect(screen.getByTestId('filter-count-badge')).toHaveTextContent('1');
      });
    });

    it('clicking Any clears the moves bucket and removes the badge', async () => {
      render(<DiscoverPage />);
      fireEvent.click(screen.getByTestId('filter-toggle'));
      fireEvent.click(screen.getByTestId('filter-moves-gt10'));
      await waitFor(() => {
        expect(screen.getByTestId('filter-count-badge')).toHaveTextContent('1');
      });

      fireEvent.click(screen.getByTestId('filter-moves-any'));
      await waitFor(() => {
        expect(screen.queryByTestId('filter-count-badge')).not.toBeInTheDocument();
      });
    });

    it('initial moves chip is Any when no URL param or storage', () => {
      render(<DiscoverPage />);
      fireEvent.click(screen.getByTestId('filter-toggle'));
      expect(screen.getByTestId('filter-moves-any').className).toMatch(/bg-orange-500/);
    });

    it('initialises moves from a URL param', async () => {
      searchParamsString = 'moves=6-7';
      render(<DiscoverPage />);
      fireEvent.click(screen.getByTestId('filter-toggle'));
      expect(screen.getByTestId('filter-moves-6-7').className).toMatch(/bg-orange-500/);
      await waitFor(() => {
        expect(searchClimbsMock).toHaveBeenCalledWith(
          expect.objectContaining({ moves: '6-7' }),
        );
      });
    });
  });

  describe('benchmark filter (A022)', () => {
    it('toggling Benchmarks only passes benchmark: true to the API', async () => {
      render(<DiscoverPage />);
      await waitFor(() => expect(searchClimbsMock).toHaveBeenCalled());
      searchClimbsMock.mockClear();

      fireEvent.click(screen.getByTestId('filter-toggle'));
      fireEvent.click(screen.getByTestId('filter-benchmark'));

      await waitFor(() => {
        expect(searchClimbsMock).toHaveBeenCalledWith(
          expect.objectContaining({ benchmark: true }),
        );
      });
    });

    it('enabling the toggle increments the active-filter badge', async () => {
      render(<DiscoverPage />);
      fireEvent.click(screen.getByTestId('filter-toggle'));
      fireEvent.click(screen.getByTestId('filter-benchmark'));

      await waitFor(() => {
        expect(screen.getByTestId('filter-count-badge')).toHaveTextContent('1');
      });
    });

    it('toggling off clears benchmark and removes the badge', async () => {
      render(<DiscoverPage />);
      fireEvent.click(screen.getByTestId('filter-toggle'));
      fireEvent.click(screen.getByTestId('filter-benchmark'));
      await waitFor(() => {
        expect(screen.getByTestId('filter-count-badge')).toHaveTextContent('1');
      });

      fireEvent.click(screen.getByTestId('filter-benchmark'));
      await waitFor(() => {
        expect(screen.queryByTestId('filter-count-badge')).not.toBeInTheDocument();
      });
    });

    it('initialises benchmark from a URL param', async () => {
      searchParamsString = 'benchmark=true';
      render(<DiscoverPage />);
      fireEvent.click(screen.getByTestId('filter-toggle'));
      expect(screen.getByTestId('filter-benchmark').className).toMatch(/bg-orange-500/);
      await waitFor(() => {
        expect(searchClimbsMock).toHaveBeenCalledWith(
          expect.objectContaining({ benchmark: true }),
        );
      });
    });
  });

  describe('no-matching filter (A029)', () => {
    it('toggling No matching only passes nomatch: true to the API', async () => {
      render(<DiscoverPage />);
      await waitFor(() => expect(searchClimbsMock).toHaveBeenCalled());
      searchClimbsMock.mockClear();

      fireEvent.click(screen.getByTestId('filter-toggle'));
      fireEvent.click(screen.getByTestId('filter-nomatch'));

      await waitFor(() => {
        expect(searchClimbsMock).toHaveBeenCalledWith(
          expect.objectContaining({ nomatch: true }),
        );
      });
    });

    it('enabling the toggle increments the active-filter badge', async () => {
      render(<DiscoverPage />);
      fireEvent.click(screen.getByTestId('filter-toggle'));
      fireEvent.click(screen.getByTestId('filter-nomatch'));

      await waitFor(() => {
        expect(screen.getByTestId('filter-count-badge')).toHaveTextContent('1');
      });
    });

    it('toggling off clears nomatch and removes the badge', async () => {
      render(<DiscoverPage />);
      fireEvent.click(screen.getByTestId('filter-toggle'));
      fireEvent.click(screen.getByTestId('filter-nomatch'));
      await waitFor(() => {
        expect(screen.getByTestId('filter-count-badge')).toHaveTextContent('1');
      });

      fireEvent.click(screen.getByTestId('filter-nomatch'));
      await waitFor(() => {
        expect(screen.queryByTestId('filter-count-badge')).not.toBeInTheDocument();
      });
    });

    it('initialises nomatch from a URL param', async () => {
      searchParamsString = 'nomatch=true';
      render(<DiscoverPage />);
      fireEvent.click(screen.getByTestId('filter-toggle'));
      expect(screen.getByTestId('filter-nomatch').className).toMatch(/bg-orange-500/);
      await waitFor(() => {
        expect(searchClimbsMock).toHaveBeenCalledWith(
          expect.objectContaining({ nomatch: true }),
        );
      });
    });
  });

  describe('My Problems filter (A030)', () => {
    it('toggling My problems only passes my_problems: only to the API', async () => {
      render(<DiscoverPage />);
      await waitFor(() => expect(searchClimbsMock).toHaveBeenCalled());
      searchClimbsMock.mockClear();

      fireEvent.click(screen.getByTestId('filter-toggle'));
      fireEvent.click(screen.getByTestId('filter-my-problems'));

      await waitFor(() => {
        expect(searchClimbsMock).toHaveBeenCalledWith(
          expect.objectContaining({ my_problems: 'only' }),
        );
      });
    });

    it('default sends no my_problems restriction (include)', async () => {
      render(<DiscoverPage />);
      await waitFor(() => expect(searchClimbsMock).toHaveBeenCalled());
      expect(searchClimbsMock).toHaveBeenCalledWith(
        expect.objectContaining({ my_problems: undefined }),
      );
    });

    it('initialises from a my_problems=only URL param', async () => {
      searchParamsString = 'my_problems=only';
      render(<DiscoverPage />);
      fireEvent.click(screen.getByTestId('filter-toggle'));
      expect(screen.getByTestId('filter-my-problems')).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await waitFor(() => {
        expect(searchClimbsMock).toHaveBeenCalledWith(
          expect.objectContaining({ my_problems: 'only' }),
        );
      });
    });
  });

  describe('search cap + overflow banner (B020)', () => {
    function fakeClimb(i: number) {
      return {
        uuid: `uuid-${i}`,
        name: `Climb ${i}`,
        setter: 'tester',
        grade: '6a/V3',
        angle: 40,
        ascensionist_count: 10,
        quality_average: 3.0,
        is_nomatch: false,
      };
    }

    it('does not pass an explicit limit (relies on backend default of 500)', async () => {
      render(<DiscoverPage />);
      await waitFor(() => expect(searchClimbsMock).toHaveBeenCalled());
      const args = searchClimbsMock.mock.calls[0][0];
      expect(args.limit).toBeUndefined();
    });

    it('renders every climb returned (200 mock climbs → 200 cards)', async () => {
      const big = Array.from({ length: 200 }, (_, i) => fakeClimb(i));
      searchClimbsMock.mockResolvedValue(envelope(big));
      render(<DiscoverPage />);
      await waitFor(() => {
        expect(screen.getByTestId('climb-card-uuid-0')).toBeInTheDocument();
      });
      // Spot-check the tail to confirm no internal slice
      expect(screen.getByTestId('climb-card-uuid-199')).toBeInTheDocument();
    });

    it('shows overflow banner when total_count > climbs.length', async () => {
      const climbs = Array.from({ length: 500 }, (_, i) => fakeClimb(i));
      searchClimbsMock.mockResolvedValue(envelope(climbs, 1500));
      render(<DiscoverPage />);
      const banner = await screen.findByTestId('results-overflow-banner');
      expect(banner).toHaveTextContent('Showing the first 500 of 1500 results');
      expect(banner).toHaveTextContent('Narrow the filters');
    });

    it('does NOT show banner when total_count == climbs.length', async () => {
      const climbs = Array.from({ length: 50 }, (_, i) => fakeClimb(i));
      searchClimbsMock.mockResolvedValue(envelope(climbs, 50));
      render(<DiscoverPage />);
      await waitFor(() =>
        expect(screen.getByTestId('climb-card-uuid-0')).toBeInTheDocument(),
      );
      expect(screen.queryByTestId('results-overflow-banner')).not.toBeInTheDocument();
    });

    it('does NOT show banner when no results at all', async () => {
      searchClimbsMock.mockResolvedValue(envelope([], 0));
      render(<DiscoverPage />);
      await waitFor(() => {
        expect(screen.getByTestId('results-empty')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('results-overflow-banner')).not.toBeInTheDocument();
    });
  });

  describe('auth gating (A019.16)', () => {
    it('redirects to /sign-in when isSignedIn=false (no API call, no results)', async () => {
      mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: false });

      render(<DiscoverPage />);

      await waitFor(() => {
        expect(replaceMock).toHaveBeenCalledWith('/sign-in');
      });
      // Discovery contents should never render — search header and results
      // both live behind the AuthGuard, so neither should appear and no
      // backend search should fire.
      expect(
        screen.queryByRole('heading', { level: 1, name: 'Discover' }),
      ).not.toBeInTheDocument();
      expect(searchClimbsMock).not.toHaveBeenCalled();
    });

    it('shows the spinner while Clerk is still loading (no redirect, no API call)', () => {
      mockUseAuth.mockReturnValue({ isLoaded: false, isSignedIn: false });

      render(<DiscoverPage />);

      expect(replaceMock).not.toHaveBeenCalled();
      expect(searchClimbsMock).not.toHaveBeenCalled();
      expect(
        screen.queryByRole('heading', { level: 1, name: 'Discover' }),
      ).not.toBeInTheDocument();
    });
  });
});
