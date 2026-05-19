import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Auth: render as signed-in so AuthGuard passes children through.
jest.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true }),
}));

// Router/searchParams: pin to a known climb uuid + angle.
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams('id=uuid-test&angle=40'),
  usePathname: () => '/discover/detail',
}));

// API: resolve immediately with a minimal climb + user_climb fixture.
jest.mock('@/app/lib/api', () => {
  const actual = jest.requireActual('@/app/lib/api');
  return {
    ...actual,
    getClimbDetail: jest.fn(),
    getUserClimb: jest.fn(),
  };
});

// Heavy children — mock to lightweight stubs so the test focuses on the
// detail page's own JSX rather than re-testing ClimbBoardView / BLE / etc.
jest.mock('@/components/ClimbBoardView', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-board" />,
  ROLE_COLORS: { start: '#000', middle: '#000', finish: '#000', foot_only: '#000' },
}));
jest.mock('@/components/ClimbBleControls', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-ble" />,
}));
jest.mock('@/components/LogSection', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-logsection" />,
}));
jest.mock('@/components/RecentLogs', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-recentlogs" />,
}));
jest.mock('@/components/BottomNav', () => ({
  __esModule: true,
  default: () => <nav data-testid="mock-bottomnav" />,
}));

import ClimbDetailPage from '../page';
import { getClimbDetail, getUserClimb } from '@/app/lib/api';

const getClimbDetailMock = getClimbDetail as jest.MockedFunction<typeof getClimbDetail>;
const getUserClimbMock = getUserClimb as jest.MockedFunction<typeof getUserClimb>;

const CLIMB_FIXTURE = {
  uuid: 'uuid-test',
  name: 'Regression Climb',
  setter: 'tester',
  description: '',
  frames_count: 1,
  stats: [
    {
      angle: 40,
      grade: '6a/V3',
      ascensionist_count: 100,
      quality_average: 3.5,
      difficulty_average: 18,
    },
  ],
  holds: [],
};

const USER_CLIMB_FIXTURE = {
  climb_uuid: 'uuid-test',
  angle: 40,
  state: { is_project: false, best_result: null, last_logged_at: null },
  recent_logs: [],
};

beforeEach(() => {
  getClimbDetailMock.mockReset();
  getUserClimbMock.mockReset();
  getClimbDetailMock.mockResolvedValue(CLIMB_FIXTURE as never);
  getUserClimbMock.mockResolvedValue(USER_CLIMB_FIXTURE as never);
});

describe('ClimbDetailPage — B021 Coach removal', () => {
  it('renders the climb without an "Analyze with Coach" CTA', async () => {
    render(<ClimbDetailPage />);
    // Wait for the climb to actually render so the negative assertion is
    // meaningful (without this, the conditional block is skipped and the
    // assertion passes trivially).
    await waitFor(() => {
      expect(screen.getByTestId('climb-name')).toHaveTextContent('Regression Climb');
    });
    expect(screen.queryByText(/analyze with coach/i)).not.toBeInTheDocument();
  });
});
