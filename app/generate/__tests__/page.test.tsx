import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/generate',
}));

jest.mock('@/app/lib/api', () => {
  const actual = jest.requireActual('@/app/lib/api');
  return { ...actual, generateProblem: jest.fn() };
});

// Heavy children → lightweight stubs (BLE / board tested elsewhere).
jest.mock('@/components/ClimbBoardView', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-board" />,
  ROLE_COLORS: { start: '#000', middle: '#000', finish: '#000', foot_only: '#000' },
}));
jest.mock('@/components/ClimbBleControls', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-ble" />,
}));
jest.mock('@/components/BottomNav', () => ({
  __esModule: true,
  default: () => <nav data-testid="mock-bottomnav" />,
}));

import GeneratePage from '../page';
import { generateProblem, ApiError } from '@/app/lib/api';

const generateMock = generateProblem as jest.MockedFunction<typeof generateProblem>;

const RESULT = {
  holds: [
    { placement_id: 1001, role: 'start' },
    { placement_id: 1002, role: 'middle' },
    { placement_id: 1003, role: 'middle' },
    { placement_id: 1004, role: 'finish' },
    { placement_id: 1005, role: 'foot_only' },
  ],
  meta: { seed_uuid: 'SEED-1', swapped_count: 2, filters: {} },
};

beforeEach(() => generateMock.mockReset());

describe('GeneratePage', () => {
  it('renders the filter controls + disabled grip-type chips', () => {
    render(<GeneratePage />);
    expect(screen.getByTestId('angle-selector')).toBeInTheDocument();
    expect(screen.getByTestId('grade-min')).toBeInTheDocument();
    expect(screen.getByTestId('moves-any')).toBeInTheDocument();
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
    // Grip chips are disabled.
    expect(screen.getByTestId('grip-Crimp')).toBeDisabled();
    expect(screen.getByTestId('generate-btn')).toHaveTextContent('Generate');
  });

  it('does NOT render a result before generating', () => {
    render(<GeneratePage />);
    expect(screen.queryByTestId('generate-result')).not.toBeInTheDocument();
  });

  it('generates a problem and renders the board + BLE + legend', async () => {
    generateMock.mockResolvedValue(RESULT);
    render(<GeneratePage />);
    fireEvent.click(screen.getByTestId('generate-btn'));

    await waitFor(() =>
      expect(screen.getByTestId('generate-result')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('mock-board')).toBeInTheDocument();
    expect(screen.getByTestId('mock-ble')).toBeInTheDocument();
    // Button flips to "Generate again" once a result exists.
    expect(screen.getByTestId('generate-btn')).toHaveTextContent('Generate again');
    expect(generateMock).toHaveBeenCalledWith(
      expect.objectContaining({ angle: 40, grade_min: 16, grade_max: 20, moves: 'any' }),
    );
  });

  it('re-rolls on Generate again', async () => {
    generateMock.mockResolvedValue(RESULT);
    render(<GeneratePage />);
    fireEvent.click(screen.getByTestId('generate-btn'));
    await waitFor(() => expect(screen.getByTestId('generate-result')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('generate-btn'));
    await waitFor(() => expect(generateMock).toHaveBeenCalledTimes(2));
  });

  it('shows the backend 422 message on a too-small pool', async () => {
    generateMock.mockRejectedValue(new ApiError(422, 'Not enough source problems. Loosen the filters.'));
    render(<GeneratePage />);
    fireEvent.click(screen.getByTestId('generate-btn'));
    await waitFor(() =>
      expect(screen.getByTestId('generate-error')).toHaveTextContent(/loosen/i),
    );
    expect(screen.queryByTestId('generate-result')).not.toBeInTheDocument();
  });

  it('blocks generation when min grade exceeds max grade', () => {
    render(<GeneratePage />);
    // Default min=16, set max below it → 13 (5a/V1).
    fireEvent.change(screen.getByTestId('grade-max'), { target: { value: '13' } });
    expect(screen.getByTestId('grade-invalid')).toBeInTheDocument();
    expect(screen.getByTestId('generate-btn')).toBeDisabled();
    fireEvent.click(screen.getByTestId('generate-btn'));
    expect(generateMock).not.toHaveBeenCalled();
  });
});
