/**
 * A021.4.5 — Discovery chip filters integration tests.
 *
 * Covers:
 *  - Chip rows render with 'all' default on first load (no stored state)
 *  - Clicking 'Solo' / 'Escludi' updates the search params + survives a
 *    navigation round-trip via sessionStorage (forward-compatible)
 *  - countActiveFilters reflects non-'all' chip state on the Filters badge
 *  - Stored entries from before Phase 4 (no doneFilter/projectFilter
 *    keys) load cleanly and default to 'all'
 *  - searchClimbs is invoked with the right done_filter/project_filter
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock Clerk hook used by AuthGuard.
jest.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true }),
}));

const searchClimbsMock = jest.fn();
jest.mock('@/app/lib/api', () => {
  const actual = jest.requireActual('@/app/lib/api');
  return {
    ...actual,
    searchClimbs: (...args: unknown[]) => searchClimbsMock(...args),
  };
});

const routerReplaceMock = jest.fn();
let searchParamsString = '';
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(searchParamsString),
  usePathname: () => '/discover',
  useRouter: () => ({
    push: jest.fn(),
    replace: routerReplaceMock,
    refresh: jest.fn(),
  }),
}));

import DiscoverPage from '../page';
import { countActiveFilters } from '@/components/FilterPanel';

beforeEach(() => {
  jest.clearAllMocks();
  searchParamsString = '';
  window.sessionStorage.clear();
  searchClimbsMock.mockResolvedValue({ climbs: [], total_count: 0 });
});

describe('Discovery chip filters — defaults', () => {
  it('renders both chip rows with "Tutti" active on first load', async () => {
    render(<DiscoverPage />);
    await waitFor(() =>
      expect(screen.getByTestId('chip-done-all')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('chip-done-all')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('chip-project-all')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // 'Solo' and 'Escludi' inactive on both rows
    expect(screen.getByTestId('chip-done-only')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByTestId('chip-project-exclude')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('does not contribute to the filter badge when both chips are "Tutti"', async () => {
    render(<DiscoverPage />);
    await waitFor(() =>
      expect(screen.getByTestId('filter-toggle')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('filter-count-badge')).not.toBeInTheDocument();
  });
});

describe('Discovery chip filters — interaction', () => {
  it('tapping "Solo" on Done sends done_filter=only to searchClimbs', async () => {
    render(<DiscoverPage />);
    await waitFor(() =>
      expect(screen.getByTestId('chip-done-only')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId('chip-done-only'));
    await waitFor(() => {
      const lastCall =
        searchClimbsMock.mock.calls[searchClimbsMock.mock.calls.length - 1];
      expect(lastCall?.[0]).toEqual(
        expect.objectContaining({ done_filter: 'only' }),
      );
    });
  });

  it('tapping "Escludi" on Project sends project_filter=exclude', async () => {
    render(<DiscoverPage />);
    await waitFor(() =>
      expect(screen.getByTestId('chip-project-exclude')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId('chip-project-exclude'));
    await waitFor(() => {
      const lastCall =
        searchClimbsMock.mock.calls[searchClimbsMock.mock.calls.length - 1];
      expect(lastCall?.[0]).toEqual(
        expect.objectContaining({ project_filter: 'exclude' }),
      );
    });
  });

  it('badge appears with count 1 when one chip is non-Tutti', async () => {
    render(<DiscoverPage />);
    await waitFor(() =>
      expect(screen.getByTestId('chip-done-only')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId('chip-done-only'));
    await waitFor(() =>
      expect(screen.getByTestId('filter-count-badge')).toHaveTextContent('1'),
    );
  });

  it('badge counts 2 when both chips are non-Tutti', async () => {
    render(<DiscoverPage />);
    await waitFor(() =>
      expect(screen.getByTestId('chip-done-only')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId('chip-done-only'));
    fireEvent.click(screen.getByTestId('chip-project-exclude'));
    await waitFor(() =>
      expect(screen.getByTestId('filter-count-badge')).toHaveTextContent('2'),
    );
  });
});

describe('Discovery chip filters — persistence', () => {
  it('chip selections persist via sessionStorage across remount', async () => {
    const { unmount } = render(<DiscoverPage />);
    await waitFor(() =>
      expect(screen.getByTestId('chip-done-only')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId('chip-done-only'));
    fireEvent.click(screen.getByTestId('chip-project-exclude'));
    // Allow the saveDiscoverFilters effect to flush.
    await waitFor(() => {
      const lastCall =
        searchClimbsMock.mock.calls[searchClimbsMock.mock.calls.length - 1];
      expect(lastCall?.[0]).toEqual(
        expect.objectContaining({
          done_filter: 'only',
          project_filter: 'exclude',
        }),
      );
    });

    unmount();
    // Fresh remount with no URL params — should pick up stored state.
    searchParamsString = '';
    render(<DiscoverPage />);
    await waitFor(() =>
      expect(screen.getByTestId('chip-done-only')).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
    expect(screen.getByTestId('chip-project-exclude')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('forward-compat: stored entries from before Phase 4 load cleanly with chips defaulting to "Tutti"', async () => {
    // Simulate a sessionStorage entry written by the pre-Phase-4 code path:
    // no doneFilter / projectFilter keys in filters.
    window.sessionStorage.setItem(
      'kilter-up:discover:filters',
      JSON.stringify({
        query: '',
        angle: 40,
        filters: {
          sort: 'popularity',
          moves: 'any',
          // Notably ABSENT: doneFilter, projectFilter.
        },
        timestamp: Date.now(),
      }),
    );
    render(<DiscoverPage />);
    await waitFor(() =>
      expect(screen.getByTestId('chip-done-all')).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
    expect(screen.getByTestId('chip-project-all')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

describe('countActiveFilters — chip contribution', () => {
  it('counts neither chip when both are "all"', () => {
    expect(
      countActiveFilters({
        sort: 'popularity',
        moves: 'any',
        doneFilter: 'all',
        projectFilter: 'all',
      }),
    ).toBe(0);
  });

  it('counts doneFilter when non-all', () => {
    expect(
      countActiveFilters({
        sort: 'popularity',
        moves: 'any',
        doneFilter: 'only',
        projectFilter: 'all',
      }),
    ).toBe(1);
  });

  it('counts both when both are non-all', () => {
    expect(
      countActiveFilters({
        sort: 'popularity',
        moves: 'any',
        doneFilter: 'only',
        projectFilter: 'exclude',
      }),
    ).toBe(2);
  });

  it('does not count chips when fields are missing entirely (pre-Phase-4 Filters object)', () => {
    expect(
      countActiveFilters({
        sort: 'popularity',
        moves: 'any',
      }),
    ).toBe(0);
  });
});
