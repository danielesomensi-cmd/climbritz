import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
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
  },
  {
    uuid: 'uuid-2',
    name: 'Test Climb Two',
    setter: 'tester',
    grade: '7a/V6',
    angle: 40,
    ascensionist_count: 50,
    quality_average: 4.5,
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  searchParamsString = '';
  searchClimbsMock.mockResolvedValue(SAMPLE_RESULTS);
});

describe('DiscoverPage', () => {
  it('renders the header with default angle 40', () => {
    render(<DiscoverPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Discover' })).toBeInTheDocument();
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
    // Default angle button is highlighted (orange background class)
    expect(screen.getByTestId('angle-40').className).toMatch(/bg-orange-500/);
  });

  it('shows the empty hint when no query is entered', () => {
    render(<DiscoverPage />);
    expect(screen.getByTestId('results-empty').textContent).toMatch(/Start typing/);
  });

  it('does not call the API with an empty query', async () => {
    render(<DiscoverPage />);
    // Wait past debounce window
    await new Promise((r) => setTimeout(r, 350));
    expect(searchClimbsMock).not.toHaveBeenCalled();
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

  it('shows the no-results message when the API returns []', async () => {
    searchClimbsMock.mockResolvedValueOnce([]);
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
});
