import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true }),
}));

const pushMock = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: jest.fn() }),
  usePathname: () => '/create',
}));

jest.mock('@/app/lib/api', () => {
  const actual = jest.requireActual('@/app/lib/api');
  return { ...actual, saveMyClimb: jest.fn(), patchMyClimb: jest.fn() };
});

// Lightweight BoardMap stub — exposes three tappable holds (two bolt-ons,
// one screw-on) and mirrors the holdColors contract.
jest.mock('@/components/BoardMap', () => ({
  __esModule: true,
  default: ({
    onHoldClick,
    holdColors,
  }: {
    onHoldClick?: (p: unknown) => void;
    holdColors?: Record<number, string>;
  }) => (
    <div data-testid="mock-board">
      {[
        { placement_id: 1001, set_id: 1 },
        { placement_id: 1002, set_id: 1 },
        { placement_id: 2001, set_id: 20 },
      ].map((p) => (
        <button
          key={p.placement_id}
          data-testid={`hold-${p.placement_id}`}
          data-color={holdColors?.[p.placement_id] ?? ''}
          onClick={() => onHoldClick?.(p)}
        />
      ))}
    </div>
  ),
}));

jest.mock('@/components/BleProvider', () => ({
  useBle: () => ({ status: 'disconnected', sendLEDs: jest.fn() }),
}));

jest.mock('@/components/BottomNav', () => ({
  __esModule: true,
  default: () => <nav data-testid="mock-bottomnav" />,
}));

import CreatePage from '../page';
import { saveMyClimb, patchMyClimb } from '@/app/lib/api';
import { saveCreateDraft } from '../draft-storage';

const saveMock = saveMyClimb as jest.MockedFunction<typeof saveMyClimb>;
const patchMock = patchMyClimb as jest.MockedFunction<typeof patchMyClimb>;

const SAVED = {
  uuid: 'NEW-UUID',
  name: 'Painted Crux',
  description: null,
  frames: 'p1001r12p1002r13p2001r15',
  angle: 40,
  grade: null,
  difficulty: null,
  seed_climb_uuid: null,
  ascent_count: 0,
  created_at: '2026-06-13T10:00:00Z',
  updated_at: '2026-06-13T10:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
});

function paint(holdId: number, role: string) {
  fireEvent.click(screen.getByTestId(`palette-${role}`));
  fireEvent.click(screen.getByTestId(`hold-${holdId}`));
}

describe('CreatePage — blank board', () => {
  it('starts empty with validation errors and Save disabled', () => {
    render(<CreatePage />);
    expect(screen.getByTestId('editor-validation')).toHaveTextContent('Add a start hold');
    expect(screen.getByTestId('editor-validation')).toHaveTextContent('Add a finish hold');
    expect(screen.getByTestId('editor-save')).toBeDisabled();
  });

  it('paint start + middle + finish enables Save', () => {
    render(<CreatePage />);
    paint(1001, 'start');
    paint(1002, 'middle');
    // Screw-on takes Foot — but we need a finish first; repaint 1002.
    paint(1002, 'finish'); // replaces middle with finish
    paint(2001, 'foot_only');
    expect(screen.queryByTestId('editor-validation')).not.toBeInTheDocument();
    expect(screen.getByTestId('editor-save')).not.toBeDisabled();
  });

  it('hand roles do not paint screw-on footholds', () => {
    render(<CreatePage />);
    paint(2001, 'start');
    expect(screen.getByTestId('hold-2001')).toHaveAttribute('data-color', '');
    paint(2001, 'foot_only');
    expect(screen.getByTestId('hold-2001')).not.toHaveAttribute('data-color', '');
  });

  it('save POSTs the painted frames and navigates to the new detail', async () => {
    saveMock.mockResolvedValue(SAVED);
    render(<CreatePage />);
    paint(1001, 'start');
    paint(1002, 'finish');
    paint(2001, 'foot_only');
    fireEvent.click(screen.getByTestId('editor-save'));

    await waitFor(() =>
      expect(saveMock).toHaveBeenCalledWith(
        expect.objectContaining({
          frames: 'p1001r12p1002r14p2001r15',
          angle: 40,
        }),
      ),
    );
    // Empty name → omitted → server proposes one (v1 behavior).
    expect(saveMock.mock.calls[0][0]).not.toHaveProperty('name');
    expect(pushMock).toHaveBeenCalledWith('/my-problems/detail?id=NEW-UUID');
  });

  it('clear all asks confirm and empties the board', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<CreatePage />);
    paint(1001, 'start');
    fireEvent.click(screen.getByTestId('editor-clear'));
    expect(confirmSpy).toHaveBeenCalled();
    expect(screen.getByTestId('hold-1001')).toHaveAttribute('data-color', '');
    confirmSpy.mockRestore();
  });

  it('cancel with dirty state asks confirm, then routes to AI Create', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<CreatePage />);
    paint(1001, 'start');
    fireEvent.click(screen.getByTestId('editor-cancel'));
    expect(confirmSpy).toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith('/generate');
    confirmSpy.mockRestore();
  });
});

describe('CreatePage — pre-loaded drafts', () => {
  it('loads a generate hand-off (name + holds) and saves with name/seed', async () => {
    saveCreateDraft({
      mode: 'new',
      name: 'Sneaky Gaston',
      grade: null,
      angle: 45,
      holds: [
        { placement_id: 1001, role: 'start' },
        { placement_id: 1002, role: 'finish' },
        { placement_id: 2001, role: 'foot_only' },
      ],
      seed_climb_uuid: 'SEED-1',
    });
    saveMock.mockResolvedValue(SAVED);
    render(<CreatePage />);

    expect(screen.getByTestId('editor-name')).toHaveValue('Sneaky Gaston');
    expect(screen.getByTestId('hold-1001')).not.toHaveAttribute('data-color', '');

    fireEvent.click(screen.getByTestId('editor-save'));
    await waitFor(() =>
      expect(saveMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Sneaky Gaston',
          angle: 45,
          seed_climb_uuid: 'SEED-1',
        }),
      ),
    );
  });

  it('edit mode PATCHes the existing uuid; logged problems get a confirm', async () => {
    saveCreateDraft({
      mode: 'edit',
      uuid: 'GEN-1',
      name: 'Existing',
      grade: '6a/V3',
      angle: 40,
      holds: [
        { placement_id: 1001, role: 'start' },
        { placement_id: 1002, role: 'finish' },
        { placement_id: 2001, role: 'foot_only' },
      ],
      hasLogs: true,
    });
    patchMock.mockResolvedValue({ ...SAVED, uuid: 'GEN-1' });
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<CreatePage />);

    // Angle is pinned in edit mode (logs are keyed by (uuid, angle)).
    expect(screen.getByTestId('editor-angle')).toBeDisabled();

    paint(1002, 'middle'); // change something: finish → middle… invalid; repaint
    paint(1002, 'finish');
    fireEvent.click(screen.getByTestId('editor-save'));

    await waitFor(() =>
      expect(patchMock).toHaveBeenCalledWith(
        'GEN-1',
        expect.objectContaining({
          frames: 'p1001r12p1002r14p2001r15',
          name: 'Existing',
          grade: '6a/V3',
        }),
      ),
    );
    expect(confirmSpy).toHaveBeenCalledWith(
      'Holds will change; your existing logs stay attached. Save?',
    );
    expect(pushMock).toHaveBeenCalledWith('/my-problems/detail?id=GEN-1');
    confirmSpy.mockRestore();
  });

  it('edit mode without logs saves without the confirm', async () => {
    saveCreateDraft({
      mode: 'edit',
      uuid: 'GEN-2',
      name: 'Quiet',
      grade: null,
      angle: 40,
      holds: [
        { placement_id: 1001, role: 'start' },
        { placement_id: 1002, role: 'finish' },
        { placement_id: 2001, role: 'foot_only' },
      ],
      hasLogs: false,
    });
    patchMock.mockResolvedValue({ ...SAVED, uuid: 'GEN-2' });
    const confirmSpy = jest.spyOn(window, 'confirm');
    render(<CreatePage />);
    fireEvent.click(screen.getByTestId('editor-save'));
    await waitFor(() => expect(patchMock).toHaveBeenCalled());
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
