import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: jest.fn() }),
  usePathname: () => '/generate',
}));

jest.mock('@/app/lib/api', () => {
  const actual = jest.requireActual('@/app/lib/api');
  return {
    ...actual,
    generateProblem: jest.fn(),
    saveMyClimb: jest.fn(),
    proposeName: jest.fn(),
  };
});

const pushMock = jest.fn();

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
import { generateProblem, proposeName, saveMyClimb, ApiError } from '@/app/lib/api';
import { loadCreateDraft } from '../../create/draft-storage';

const generateMock = generateProblem as jest.MockedFunction<typeof generateProblem>;
const saveMock = saveMyClimb as jest.MockedFunction<typeof saveMyClimb>;
const proposeNameMock = proposeName as jest.MockedFunction<typeof proposeName>;

const SAVED = {
  uuid: 'GEN-UUID-1',
  name: 'Sneaky Gaston',
  description: null,
  frames: 'p1001r12p1002r13p1003r13p1004r14p1005r15',
  angle: 40,
  grade: '6a/V3',
  difficulty: 16,
  seed_climb_uuid: 'SEED-1',
  ascent_count: 0,
  created_at: '2026-06-12T10:00:00Z',
  updated_at: '2026-06-12T10:00:00Z',
};

const RESULT = {
  holds: [
    { placement_id: 1001, role: 'start' },
    { placement_id: 1002, role: 'middle' },
    { placement_id: 1003, role: 'middle' },
    { placement_id: 1004, role: 'finish' },
    { placement_id: 1005, role: 'foot_only' },
  ],
  meta: {
    seed_uuid: 'SEED-1',
    swapped_count: 2,
    filters: { angle: 40, grade_min: 16, grade_max: 20, moves: 'any' as const },
  },
};

beforeEach(() => {
  generateMock.mockReset();
  saveMock.mockReset();
  proposeNameMock.mockReset();
  // A031 — name-on-generate fires on every generation; default resolved.
  proposeNameMock.mockResolvedValue({ name: 'Witty Deadpoint', source: 'ai' });
  pushMock.mockReset();
  window.sessionStorage.clear();
});

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

  // ── A030: one-tap save ────────────────────────────────────────────────

  describe('A030 — save to My Problems', () => {
    async function generateOnce() {
      generateMock.mockResolvedValue(RESULT);
      render(<GeneratePage />);
      fireEvent.click(screen.getByTestId('generate-btn'));
      await waitFor(() =>
        expect(screen.getByTestId('generate-result')).toBeInTheDocument(),
      );
    }

    it('no Save button before generating', () => {
      render(<GeneratePage />);
      expect(screen.queryByTestId('save-btn')).not.toBeInTheDocument();
    });

    it('saves with the exact BoardLib frames, generation angle and seed', async () => {
      saveMock.mockResolvedValue(SAVED);
      await generateOnce();
      fireEvent.click(screen.getByTestId('save-btn'));
      await waitFor(() =>
        expect(saveMock).toHaveBeenCalledWith(
          expect.objectContaining({
            frames: 'p1001r12p1002r13p1003r13p1004r14p1005r15',
            angle: 40,
            seed_climb_uuid: 'SEED-1',
          }),
        ),
      );
    });

    it('shows a toast with the AI name and a My Problems link', async () => {
      saveMock.mockResolvedValue(SAVED);
      await generateOnce();
      fireEvent.click(screen.getByTestId('save-btn'));
      await waitFor(() =>
        expect(screen.getByTestId('save-toast')).toHaveTextContent('Sneaky Gaston'),
      );
    });

    it('dedupes: Save disables after success until the next generation', async () => {
      saveMock.mockResolvedValue(SAVED);
      await generateOnce();
      fireEvent.click(screen.getByTestId('save-btn'));
      await waitFor(() =>
        expect(screen.getByTestId('save-btn')).toHaveTextContent('Saved ✓'),
      );
      expect(screen.getByTestId('save-btn')).toBeDisabled();
      fireEvent.click(screen.getByTestId('save-btn'));
      expect(saveMock).toHaveBeenCalledTimes(1);

      // Re-roll → saveable again.
      fireEvent.click(screen.getByTestId('generate-btn'));
      await waitFor(() =>
        expect(screen.getByTestId('save-btn')).toHaveTextContent('Save as is'),
      );
      expect(screen.getByTestId('save-btn')).not.toBeDisabled();
    });

    it('save failure shows a toast and keeps the loop usable', async () => {
      saveMock.mockRejectedValue(new ApiError(500, 'boom'));
      await generateOnce();
      fireEvent.click(screen.getByTestId('save-btn'));
      await waitFor(() =>
        expect(screen.getByTestId('save-toast')).toHaveTextContent(/save failed/i),
      );
      expect(screen.getByTestId('save-btn')).not.toBeDisabled();
      expect(screen.getByTestId('generate-btn')).not.toBeDisabled();
    });

    it('renders the My Problems entry link', () => {
      render(<GeneratePage />);
      expect(screen.getByTestId('my-problems-link')).toHaveAttribute(
        'href',
        '/my-problems',
      );
    });
  });

  // ── A031: name-on-generate + editor entry points + rename ─────────────

  describe('A031 — name-on-generate', () => {
    it('shows the AI name above the board after a generation', async () => {
      generateMock.mockResolvedValue(RESULT);
      render(<GeneratePage />);
      fireEvent.click(screen.getByTestId('generate-btn'));
      await waitFor(() =>
        expect(screen.getByTestId('generated-name')).toHaveTextContent('Witty Deadpoint'),
      );
      expect(proposeNameMock).toHaveBeenCalledWith(
        expect.objectContaining({ angle: 40 }),
      );
    });

    it('the board renders without waiting for the name (skeleton shown)', async () => {
      generateMock.mockResolvedValue(RESULT);
      proposeNameMock.mockReturnValue(new Promise(() => {})); // never resolves
      render(<GeneratePage />);
      fireEvent.click(screen.getByTestId('generate-btn'));
      await waitFor(() =>
        expect(screen.getByTestId('generate-result')).toBeInTheDocument(),
      );
      expect(screen.getByTestId('mock-board')).toBeInTheDocument();
      expect(screen.getByTestId('generated-name-skeleton')).toBeInTheDocument();
      expect(screen.queryByTestId('generated-name')).not.toBeInTheDocument();
    });

    it('stale guard: a slow name from an old roll never lands on a new one', async () => {
      generateMock.mockResolvedValue(RESULT);
      let resolveFirst!: (v: { name: string; source: 'ai' | 'fallback' }) => void;
      proposeNameMock
        .mockImplementationOnce(
          () => new Promise((res) => { resolveFirst = res; }),
        )
        .mockResolvedValueOnce({ name: 'Fresh Name', source: 'ai' });

      render(<GeneratePage />);
      fireEvent.click(screen.getByTestId('generate-btn'));
      await waitFor(() => expect(proposeNameMock).toHaveBeenCalledTimes(1));

      // Re-roll BEFORE the first name resolves.
      fireEvent.click(screen.getByTestId('generate-btn'));
      await waitFor(() =>
        expect(screen.getByTestId('generated-name')).toHaveTextContent('Fresh Name'),
      );

      // The stale response resolves now — it must be discarded.
      resolveFirst({ name: 'Stale Name', source: 'ai' });
      await waitFor(() =>
        expect(screen.getByTestId('generated-name')).toHaveTextContent('Fresh Name'),
      );
    });

    it('falls back to a local client name when the request errors', async () => {
      generateMock.mockResolvedValue(RESULT);
      proposeNameMock.mockRejectedValue(new Error('offline'));
      render(<GeneratePage />);
      fireEvent.click(screen.getByTestId('generate-btn'));
      await waitFor(() =>
        expect(screen.getByTestId('generated-name')).toBeInTheDocument(),
      );
      expect(screen.getByTestId('generated-name').textContent).toMatch(/\w+ \w+/);
    });

    it('Save as is persists the DISPLAYED name', async () => {
      generateMock.mockResolvedValue(RESULT);
      saveMock.mockResolvedValue(SAVED);
      render(<GeneratePage />);
      fireEvent.click(screen.getByTestId('generate-btn'));
      await waitFor(() =>
        expect(screen.getByTestId('generated-name')).toHaveTextContent('Witty Deadpoint'),
      );
      fireEvent.click(screen.getByTestId('save-btn'));
      await waitFor(() =>
        expect(saveMock).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Witty Deadpoint' }),
        ),
      );
    });
  });

  describe('A031 — editor entry points + AI Create rename', () => {
    it('Edit writes the draft (holds + displayed name + seed) and routes to /create', async () => {
      generateMock.mockResolvedValue(RESULT);
      render(<GeneratePage />);
      fireEvent.click(screen.getByTestId('generate-btn'));
      await waitFor(() =>
        expect(screen.getByTestId('generated-name')).toHaveTextContent('Witty Deadpoint'),
      );
      fireEvent.click(screen.getByTestId('edit-btn'));

      const draft = loadCreateDraft();
      expect(draft).not.toBeNull();
      expect(draft!.mode).toBe('new');
      expect(draft!.name).toBe('Witty Deadpoint');
      expect(draft!.angle).toBe(40);
      expect(draft!.seed_climb_uuid).toBe('SEED-1');
      expect(draft!.holds).toHaveLength(RESULT.holds.length);
      expect(pushMock).toHaveBeenCalledWith('/create');
    });

    it('Start from blank writes an empty draft and routes to /create', () => {
      render(<GeneratePage />);
      fireEvent.click(screen.getByTestId('start-blank-btn'));
      const draft = loadCreateDraft();
      expect(draft).not.toBeNull();
      expect(draft!.mode).toBe('new');
      expect(draft!.holds).toEqual([]);
      expect(draft!.name).toBe('');
      expect(pushMock).toHaveBeenCalledWith('/create');
    });

    it('page header says AI Create', () => {
      render(<GeneratePage />);
      expect(screen.getByText('AI Create')).toBeInTheDocument();
    });
  });
});
