import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ClimbDetailPage from '../detail/page';

let searchParamsString = 'id=uuid-1&angle=40';
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(searchParamsString),
  usePathname: () => '/discover/detail',
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
});
