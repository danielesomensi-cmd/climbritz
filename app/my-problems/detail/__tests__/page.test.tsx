import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true }),
}));

const pushMock = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: jest.fn() }),
  usePathname: () => '/my-problems/detail',
  useSearchParams: () => new URLSearchParams('id=GEN-1'),
}));

jest.mock('@/app/lib/api', () => {
  const actual = jest.requireActual('@/app/lib/api');
  return {
    ...actual,
    getMyClimbDetail: jest.fn(),
    getUserClimb: jest.fn(),
    patchMyClimb: jest.fn(),
    deleteMyClimb: jest.fn(),
  };
});

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
  default: () => <div data-testid="mock-log-section" />,
}));
jest.mock('@/components/BottomNav', () => ({
  __esModule: true,
  default: () => <nav data-testid="mock-bottomnav" />,
}));

import MyProblemDetailPage from '../page';
import {
  getMyClimbDetail,
  getUserClimb,
  patchMyClimb,
  deleteMyClimb,
} from '@/app/lib/api';
import { loadCreateDraft } from '../../../create/draft-storage';

const detailMock = getMyClimbDetail as jest.MockedFunction<typeof getMyClimbDetail>;
const userClimbMock = getUserClimb as jest.MockedFunction<typeof getUserClimb>;
const patchMock = patchMyClimb as jest.MockedFunction<typeof patchMyClimb>;
const deleteMock = deleteMyClimb as jest.MockedFunction<typeof deleteMyClimb>;

const PROBLEM = {
  uuid: 'GEN-1',
  name: 'Sneaky Gaston',
  description: null,
  frames: 'p1001r12p1002r13p1004r14',
  angle: 40,
  grade: '6a/V3',
  difficulty: 16,
  seed_climb_uuid: 'SEED-1',
  ascent_count: 1,
  created_at: '2026-06-12T10:00:00Z',
  updated_at: '2026-06-12T10:00:00Z',
  holds: [
    { placement_id: 1001, role: 'start', x: null, y: null, set_id: null },
    { placement_id: 1002, role: 'middle', x: null, y: null, set_id: null },
    { placement_id: 1004, role: 'finish', x: null, y: null, set_id: null },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  detailMock.mockResolvedValue(PROBLEM);
  userClimbMock.mockResolvedValue({ state: null, recent_logs: [] });
});

describe('MyProblemDetailPage', () => {
  it('renders name, board, BLE controls and log section', async () => {
    render(<MyProblemDetailPage />);
    await waitFor(() =>
      expect(screen.getByTestId('problem-name')).toHaveTextContent('Sneaky Gaston'),
    );
    expect(screen.getByTestId('mock-board')).toBeInTheDocument();
    expect(screen.getByTestId('mock-ble')).toBeInTheDocument();
    expect(screen.getByTestId('mock-log-section')).toBeInTheDocument();
    expect(screen.getByTestId('back-link')).toHaveAttribute('href', '/my-problems');
  });

  it('tap-to-edit name PATCHes on blur', async () => {
    patchMock.mockResolvedValue({ ...PROBLEM, name: 'Renamed Crux' });
    render(<MyProblemDetailPage />);
    await waitFor(() => screen.getByTestId('problem-name'));

    fireEvent.click(screen.getByTestId('problem-name'));
    const input = screen.getByTestId('name-input');
    fireEvent.change(input, { target: { value: 'Renamed Crux' } });
    fireEvent.blur(input);

    await waitFor(() =>
      expect(patchMock).toHaveBeenCalledWith('GEN-1', { name: 'Renamed Crux' }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('problem-name')).toHaveTextContent('Renamed Crux'),
    );
  });

  it('tap-to-edit grade PATCHes on blur', async () => {
    patchMock.mockResolvedValue({ ...PROBLEM, grade: '7a/V6' });
    render(<MyProblemDetailPage />);
    await waitFor(() => screen.getByTestId('grade-edit-btn'));

    fireEvent.click(screen.getByTestId('grade-edit-btn'));
    const input = screen.getByTestId('grade-input');
    fireEvent.change(input, { target: { value: '7a/V6' } });
    fireEvent.blur(input);

    await waitFor(() =>
      expect(patchMock).toHaveBeenCalledWith('GEN-1', { grade: '7a/V6' }),
    );
  });

  it('unchanged name on blur does not PATCH', async () => {
    render(<MyProblemDetailPage />);
    await waitFor(() => screen.getByTestId('problem-name'));
    fireEvent.click(screen.getByTestId('problem-name'));
    fireEvent.blur(screen.getByTestId('name-input'));
    expect(patchMock).not.toHaveBeenCalled();
  });

  it('delete asks for confirm, then navigates back to the list', async () => {
    deleteMock.mockResolvedValue(undefined);
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<MyProblemDetailPage />);
    await waitFor(() => screen.getByTestId('delete-btn'));

    fireEvent.click(screen.getByTestId('delete-btn'));
    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith('GEN-1'));
    expect(confirmSpy).toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith('/my-problems');
    confirmSpy.mockRestore();
  });

  // A031 — hold editor entry point.
  it('Edit holds writes an edit-mode draft and routes to /create', async () => {
    render(<MyProblemDetailPage />);
    await waitFor(() => screen.getByTestId('edit-holds-btn'));
    fireEvent.click(screen.getByTestId('edit-holds-btn'));

    const draft = loadCreateDraft();
    expect(draft).not.toBeNull();
    expect(draft!.mode).toBe('edit');
    expect(draft!.uuid).toBe('GEN-1');
    expect(draft!.name).toBe('Sneaky Gaston');
    expect(draft!.hasLogs).toBe(true); // ascent_count = 1
    expect(draft!.holds).toEqual([
      { placement_id: 1001, role: 'start' },
      { placement_id: 1002, role: 'middle' },
      { placement_id: 1004, role: 'finish' },
    ]);
    expect(pushMock).toHaveBeenCalledWith('/create');
  });

  it('delete aborted at confirm does nothing', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<MyProblemDetailPage />);
    await waitFor(() => screen.getByTestId('delete-btn'));

    fireEvent.click(screen.getByTestId('delete-btn'));
    expect(deleteMock).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
