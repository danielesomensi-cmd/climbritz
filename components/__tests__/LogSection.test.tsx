/**
 * A021.3.6 — LogSection unit tests.
 *
 * Covers:
 *  - Each result button (Flash / Send / Attempt) calls POST /api/logs with
 *    the right body.
 *  - Project toggle calls PATCH /api/user-climbs/{uuid}/project.
 *  - Tapping Send while is_project=true opens the modal AND does NOT call
 *    POST /api/logs until the user picks an action.
 *  - Modal "Sì, rimuovi" → POST /api/logs THEN PATCH project=false.
 *  - Modal "No, mantienilo" → POST /api/logs only.
 *  - Modal "Annulla" → no POST.
 *  - Capacitor back button (simulated) closes the modal without calling POST.
 *  - UX-003: no instant Remove button; every successful log shows an Undo
 *    toast that PATCHes today's row back to its pre-tap snapshot, or
 *    DELETEs it when the tap created it.
 */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import type {
  ClimbLogResponse,
  UserClimbDetail,
  UserClimbState,
} from '@/app/lib/api';

// Mock the API module — we re-import getUserClimb inside the component
// via dynamic import, so the mock has to cover both the static import
// path used at module load and the dynamic one used in handlers.
const createLogMock = jest.fn();
const getUserClimbMock = jest.fn();
const patchUserClimbProjectMock = jest.fn();
const deleteLogMock = jest.fn();
const patchLogMock = jest.fn();

jest.mock('@/app/lib/api', () => {
  class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  return {
    ApiError,
    createLog: (...args: unknown[]) => createLogMock(...args),
    getUserClimb: (...args: unknown[]) => getUserClimbMock(...args),
    patchUserClimbProject: (...args: unknown[]) =>
      patchUserClimbProjectMock(...args),
    deleteLog: (...args: unknown[]) => deleteLogMock(...args),
    patchLog: (...args: unknown[]) => patchLogMock(...args),
  };
});

// Capacitor back-button mock — the component dynamically imports
// @capacitor/app; we expose the registered listener so a test can fire
// it manually as if Android sent a back press.
let capturedBackButtonListener:
  | ((event: { canGoBack: boolean }) => void)
  | null = null;
const addListenerMock = jest.fn(
  async (
    eventName: string,
    handler: (event: { canGoBack: boolean }) => void,
  ) => {
    if (eventName === 'backButton') capturedBackButtonListener = handler;
    return { remove: jest.fn() };
  },
);
jest.mock('@capacitor/app', () => ({
  App: {
    addListener: (...args: Parameters<typeof addListenerMock>) =>
      addListenerMock(...args),
  },
}));

const hapticMock = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/feedback/haptics', () => ({
  haptic: (...args: unknown[]) => hapticMock(...args),
}));

import LogSection from '../LogSection';

const CLIMB_UUID = 'uuid-test-climb';
const ANGLE = 40;
const TODAY = new Date();
const TODAY_ISO = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, '0')}-${String(TODAY.getDate()).padStart(2, '0')}`;

function mkState(overrides: Partial<UserClimbState> = {}): UserClimbState {
  return {
    climb_uuid: CLIMB_UUID,
    angle: ANGLE,
    is_project: false,
    best_result: null,
    last_logged_at: null,
    ...overrides,
  };
}

function mkLog(overrides: Partial<ClimbLogResponse> = {}): ClimbLogResponse {
  return {
    id: 'log-id-1',
    user_id: 'user-1',
    climb_uuid: CLIMB_UUID,
    angle: ANGLE,
    local_date: TODAY_ISO,
    result_type: 'send',
    attempts_count: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function mkDetail(overrides: Partial<UserClimbDetail> = {}): UserClimbDetail {
  return {
    state: mkState(),
    recent_logs: [],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  capturedBackButtonListener = null;
  createLogMock.mockResolvedValue({ log: mkLog(), user_state: mkState() });
  patchUserClimbProjectMock.mockResolvedValue(mkState({ is_project: true }));
  deleteLogMock.mockResolvedValue(undefined);
  patchLogMock.mockResolvedValue({ log: mkLog(), user_state: mkState() });
  getUserClimbMock.mockResolvedValue(mkDetail());
});

describe('LogSection — result buttons', () => {
  it.each(['flash', 'send', 'attempt'] as const)(
    'tapping %s calls POST /api/logs with the right body',
    async (result) => {
      const onMutated = jest.fn();
      render(
        <LogSection
          climbUuid={CLIMB_UUID}
          angle={ANGLE}
          detail={mkDetail()}
          onMutated={onMutated}
        />,
      );
      fireEvent.click(screen.getByTestId(`log-btn-${result}`));
      await waitFor(() => expect(createLogMock).toHaveBeenCalledTimes(1));
      expect(createLogMock).toHaveBeenCalledWith(CLIMB_UUID, ANGLE, result);
      await waitFor(() => expect(onMutated).toHaveBeenCalledTimes(1));
    },
  );

  it('fires a light haptic after a successful log (NATIVE-001)', async () => {
    render(
      <LogSection
        climbUuid={CLIMB_UUID}
        angle={ANGLE}
        detail={mkDetail()}
        onMutated={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('log-btn-attempt'));
    await waitFor(() => expect(hapticMock).toHaveBeenCalledWith('light'));
  });

  it('does not fire a haptic when the log fails', async () => {
    createLogMock.mockRejectedValueOnce(new Error('boom'));
    render(
      <LogSection
        climbUuid={CLIMB_UUID}
        angle={ANGLE}
        detail={mkDetail()}
        onMutated={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('log-btn-send'));
    await waitFor(() => expect(createLogMock).toHaveBeenCalled());
    await screen.findByText(/network error/i);
    expect(hapticMock).not.toHaveBeenCalled();
  });

  it('refetches detail after a successful log', async () => {
    const onMutated = jest.fn();
    const fresh = mkDetail({
      state: mkState({ best_result: 'send' }),
      recent_logs: [mkLog()],
    });
    getUserClimbMock.mockResolvedValue(fresh);
    render(
      <LogSection
        climbUuid={CLIMB_UUID}
        angle={ANGLE}
        detail={mkDetail()}
        onMutated={onMutated}
      />,
    );
    fireEvent.click(screen.getByTestId('log-btn-send'));
    await waitFor(() => expect(onMutated).toHaveBeenCalledWith(fresh));
  });
});

describe('LogSection — project toggle', () => {
  it('tapping ☆ calls PATCH project=true when is_project is false', async () => {
    render(
      <LogSection
        climbUuid={CLIMB_UUID}
        angle={ANGLE}
        detail={mkDetail({ state: mkState({ is_project: false }) })}
        onMutated={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('log-btn-project'));
    await waitFor(() =>
      expect(patchUserClimbProjectMock).toHaveBeenCalledWith(
        CLIMB_UUID,
        ANGLE,
        true,
      ),
    );
  });

  it('tapping ★ calls PATCH project=false when is_project is true', async () => {
    render(
      <LogSection
        climbUuid={CLIMB_UUID}
        angle={ANGLE}
        detail={mkDetail({ state: mkState({ is_project: true }) })}
        onMutated={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('log-btn-project'));
    await waitFor(() =>
      expect(patchUserClimbProjectMock).toHaveBeenCalledWith(
        CLIMB_UUID,
        ANGLE,
        false,
      ),
    );
  });

  it('tapping Attempt while is_project=true does NOT open the modal', async () => {
    render(
      <LogSection
        climbUuid={CLIMB_UUID}
        angle={ANGLE}
        detail={mkDetail({ state: mkState({ is_project: true }) })}
        onMutated={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('log-btn-attempt'));
    await waitFor(() => expect(createLogMock).toHaveBeenCalledTimes(1));
    expect(
      screen.queryByTestId('project-removal-modal'),
    ).not.toBeInTheDocument();
  });
});

describe('LogSection — project-removal modal (Send / Flash while project)', () => {
  it('opens the modal on Send while is_project=true and defers the log', async () => {
    render(
      <LogSection
        climbUuid={CLIMB_UUID}
        angle={ANGLE}
        detail={mkDetail({ state: mkState({ is_project: true }) })}
        onMutated={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('log-btn-send'));
    expect(screen.getByTestId('project-removal-modal')).toBeInTheDocument();
    expect(createLogMock).not.toHaveBeenCalled();
  });

  it('opens the modal on Flash while is_project=true and defers the log', async () => {
    render(
      <LogSection
        climbUuid={CLIMB_UUID}
        angle={ANGLE}
        detail={mkDetail({ state: mkState({ is_project: true }) })}
        onMutated={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('log-btn-flash'));
    expect(screen.getByTestId('project-removal-modal')).toBeInTheDocument();
    expect(createLogMock).not.toHaveBeenCalled();
  });

  it('Sì, rimuovi → POST /api/logs THEN PATCH project=false', async () => {
    render(
      <LogSection
        climbUuid={CLIMB_UUID}
        angle={ANGLE}
        detail={mkDetail({ state: mkState({ is_project: true }) })}
        onMutated={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('log-btn-send'));
    fireEvent.click(screen.getByTestId('modal-confirm-remove'));

    await waitFor(() => expect(createLogMock).toHaveBeenCalledTimes(1));
    expect(createLogMock).toHaveBeenCalledWith(CLIMB_UUID, ANGLE, 'send');
    await waitFor(() =>
      expect(patchUserClimbProjectMock).toHaveBeenCalledWith(
        CLIMB_UUID,
        ANGLE,
        false,
      ),
    );
    // Ordering: createLog ran before patchUserClimbProject so a failure
    // in the log post wouldn't have already removed the project flag.
    const logCallOrder = createLogMock.mock.invocationCallOrder[0];
    const patchCallOrder = patchUserClimbProjectMock.mock.invocationCallOrder[0];
    expect(logCallOrder).toBeLessThan(patchCallOrder);
  });

  it('No, mantienilo → POST /api/logs only, no project PATCH', async () => {
    render(
      <LogSection
        climbUuid={CLIMB_UUID}
        angle={ANGLE}
        detail={mkDetail({ state: mkState({ is_project: true }) })}
        onMutated={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('log-btn-send'));
    fireEvent.click(screen.getByTestId('modal-keep-project'));

    await waitFor(() => expect(createLogMock).toHaveBeenCalledTimes(1));
    // Wait long enough for any errant follow-up PATCH to surface.
    await new Promise((r) => setTimeout(r, 20));
    expect(patchUserClimbProjectMock).not.toHaveBeenCalled();
  });

  it('Annulla → no POST and no PATCH', async () => {
    render(
      <LogSection
        climbUuid={CLIMB_UUID}
        angle={ANGLE}
        detail={mkDetail({ state: mkState({ is_project: true }) })}
        onMutated={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('log-btn-send'));
    fireEvent.click(screen.getByTestId('modal-cancel'));

    expect(
      screen.queryByTestId('project-removal-modal'),
    ).not.toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 20));
    expect(createLogMock).not.toHaveBeenCalled();
    expect(patchUserClimbProjectMock).not.toHaveBeenCalled();
  });

  it('backdrop click acts like Annulla', async () => {
    render(
      <LogSection
        climbUuid={CLIMB_UUID}
        angle={ANGLE}
        detail={mkDetail({ state: mkState({ is_project: true }) })}
        onMutated={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('log-btn-send'));
    fireEvent.click(screen.getByTestId('project-removal-modal'));
    await waitFor(() =>
      expect(
        screen.queryByTestId('project-removal-modal'),
      ).not.toBeInTheDocument(),
    );
    expect(createLogMock).not.toHaveBeenCalled();
  });

  it('Android back button closes the modal without calling POST', async () => {
    render(
      <LogSection
        climbUuid={CLIMB_UUID}
        angle={ANGLE}
        detail={mkDetail({ state: mkState({ is_project: true }) })}
        onMutated={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('log-btn-send'));
    expect(screen.getByTestId('project-removal-modal')).toBeInTheDocument();

    // The component's useEffect registers the listener asynchronously
    // (dynamic import + await addListener). Wait for it to land.
    await waitFor(() => expect(capturedBackButtonListener).not.toBeNull());

    // Simulate the Android system back press.
    act(() => {
      capturedBackButtonListener!({ canGoBack: true });
    });

    await waitFor(() =>
      expect(
        screen.queryByTestId('project-removal-modal'),
      ).not.toBeInTheDocument(),
    );
    expect(createLogMock).not.toHaveBeenCalled();
  });
});

describe('LogSection — UX-003 Undo toast', () => {
  it('never renders an instant Remove button; grid is always 4 columns', () => {
    render(
      <LogSection
        climbUuid={CLIMB_UUID}
        angle={ANGLE}
        detail={mkDetail({ recent_logs: [mkLog()] })}
        onMutated={jest.fn()}
      />,
    );
    expect(screen.queryByTestId('log-btn-remove')).not.toBeInTheDocument();
    expect(screen.getByTestId('log-grid')).toHaveClass('grid-cols-4');
  });

  it('4 attempts → send by mistake → Undo restores attempt ×4', async () => {
    // Today's row already holds 4 attempts.
    const before = mkLog({ id: 'today-row', result_type: 'attempt', attempts_count: 4 });
    // Server upgrades the same row to send ×5.
    const upgraded = mkLog({ id: 'today-row', result_type: 'send', attempts_count: 5 });
    createLogMock.mockResolvedValue({ log: upgraded, user_state: mkState({ best_result: 'send' }) });
    getUserClimbMock.mockResolvedValueOnce(
      mkDetail({ state: mkState({ best_result: 'send' }), recent_logs: [upgraded] }),
    );
    const restored = mkDetail({ recent_logs: [before] });
    getUserClimbMock.mockResolvedValueOnce(restored);
    const onMutated = jest.fn();

    render(
      <LogSection
        climbUuid={CLIMB_UUID}
        angle={ANGLE}
        detail={mkDetail({ recent_logs: [before] })}
        onMutated={onMutated}
      />,
    );
    fireEvent.click(screen.getByTestId('log-btn-send'));
    const toast = await screen.findByTestId('toast');
    expect(toast).toHaveTextContent('Logged Send');

    fireEvent.click(screen.getByTestId('toast-action'));
    await waitFor(() =>
      expect(patchLogMock).toHaveBeenCalledWith('today-row', {
        result_type: 'attempt',
        attempts_count: 4,
      }),
    );
    expect(deleteLogMock).not.toHaveBeenCalled();
    await waitFor(() => expect(onMutated).toHaveBeenLastCalledWith(restored));
    await waitFor(() => expect(screen.queryByTestId('toast')).not.toBeInTheDocument());
  });

  it('detail not loaded yet: snapshots via GET first so Undo PATCHes, never DELETEs an existing row', async () => {
    const before = mkLog({ id: 'today-row', result_type: 'attempt', attempts_count: 3 });
    const upgraded = mkLog({ id: 'today-row', result_type: 'send', attempts_count: 4 });
    createLogMock.mockResolvedValue({ log: upgraded, user_state: mkState() });
    getUserClimbMock.mockResolvedValueOnce(mkDetail({ recent_logs: [before] }));
    render(
      <LogSection climbUuid={CLIMB_UUID} angle={ANGLE} detail={null} onMutated={jest.fn()} />,
    );
    fireEvent.click(screen.getByTestId('log-btn-send'));
    await screen.findByTestId('toast');
    fireEvent.click(screen.getByTestId('toast-action'));
    await waitFor(() =>
      expect(patchLogMock).toHaveBeenCalledWith('today-row', {
        result_type: 'attempt',
        attempts_count: 3,
      }),
    );
    expect(deleteLogMock).not.toHaveBeenCalled();
  });

  it('detail unknown and GET fails: logs without offering Undo', async () => {
    getUserClimbMock.mockRejectedValueOnce(new Error('offline'));
    render(
      <LogSection climbUuid={CLIMB_UUID} angle={ANGLE} detail={null} onMutated={jest.fn()} />,
    );
    fireEvent.click(screen.getByTestId('log-btn-send'));
    await waitFor(() => expect(createLogMock).toHaveBeenCalled());
    await waitFor(() => expect(getUserClimbMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
  });

  it('Undo DELETEs the row when the tap created it (no log today before)', async () => {
    createLogMock.mockResolvedValue({ log: mkLog({ id: 'fresh-row' }), user_state: mkState() });
    render(
      <LogSection
        climbUuid={CLIMB_UUID}
        angle={ANGLE}
        detail={mkDetail()}
        onMutated={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('log-btn-send'));
    fireEvent.click(await screen.findByTestId('toast-action'));
    await waitFor(() => expect(deleteLogMock).toHaveBeenCalledWith('fresh-row'));
    expect(patchLogMock).not.toHaveBeenCalled();
  });

  it('a log from another day is not treated as today’s snapshot', async () => {
    const old = mkLog({ id: 'old-row', local_date: '2020-01-01', result_type: 'attempt', attempts_count: 3 });
    createLogMock.mockResolvedValue({ log: mkLog({ id: 'new-row' }), user_state: mkState() });
    render(
      <LogSection
        climbUuid={CLIMB_UUID}
        angle={ANGLE}
        detail={mkDetail({ recent_logs: [old] })}
        onMutated={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('log-btn-attempt'));
    fireEvent.click(await screen.findByTestId('toast-action'));
    await waitFor(() => expect(deleteLogMock).toHaveBeenCalledWith('new-row'));
    expect(patchLogMock).not.toHaveBeenCalled();
  });

  it('no toast when the log fails', async () => {
    createLogMock.mockRejectedValueOnce(new Error('boom'));
    render(
      <LogSection
        climbUuid={CLIMB_UUID}
        angle={ANGLE}
        detail={mkDetail()}
        onMutated={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('log-btn-send'));
    await screen.findByText(/network error/i);
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
  });

  it('toast auto-dismisses without touching the log', async () => {
    jest.useFakeTimers();
    try {
      render(
        <LogSection
          climbUuid={CLIMB_UUID}
          angle={ANGLE}
          detail={mkDetail()}
          onMutated={jest.fn()}
        />,
      );
      fireEvent.click(screen.getByTestId('log-btn-send'));
      await screen.findByTestId('toast');
      act(() => {
        jest.advanceTimersByTime(10_000);
      });
      expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
      expect(deleteLogMock).not.toHaveBeenCalled();
      expect(patchLogMock).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('Undo after modal "Yes, remove" also restores the project flag', async () => {
    createLogMock.mockResolvedValue({ log: mkLog({ id: 'proj-row' }), user_state: mkState() });
    render(
      <LogSection
        climbUuid={CLIMB_UUID}
        angle={ANGLE}
        detail={mkDetail({ state: mkState({ is_project: true }) })}
        onMutated={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('log-btn-send'));
    fireEvent.click(screen.getByTestId('modal-confirm-remove'));
    await waitFor(() =>
      expect(patchUserClimbProjectMock).toHaveBeenCalledWith(CLIMB_UUID, ANGLE, false),
    );
    fireEvent.click(await screen.findByTestId('toast-action'));
    await waitFor(() => expect(deleteLogMock).toHaveBeenCalledWith('proj-row'));
    await waitFor(() =>
      expect(patchUserClimbProjectMock).toHaveBeenLastCalledWith(CLIMB_UUID, ANGLE, true),
    );
  });
});

describe('LogSection — B027 Project label + destructive modal', () => {
  it('Project button label flips between "Project" (inactive) and "Active"', () => {
    const { rerender } = render(
      <LogSection
        climbUuid={CLIMB_UUID}
        angle={ANGLE}
        detail={mkDetail({ state: mkState({ is_project: false }) })}
        onMutated={jest.fn()}
      />,
    );
    expect(screen.getByTestId('log-btn-project')).toHaveTextContent('Project');
    expect(screen.getByTestId('log-btn-project')).not.toHaveTextContent('Active');

    rerender(
      <LogSection
        climbUuid={CLIMB_UUID}
        angle={ANGLE}
        detail={mkDetail({ state: mkState({ is_project: true }) })}
        onMutated={jest.fn()}
      />,
    );
    expect(screen.getByTestId('log-btn-project')).toHaveTextContent('Active');
  });

  it('Modal "Yes, remove" CTA renders with destructive (red) styling', async () => {
    // Force the project-removal modal: is_project=true + tap Send.
    const detail = mkDetail({ state: mkState({ is_project: true }) });
    render(
      <LogSection
        climbUuid={CLIMB_UUID}
        angle={ANGLE}
        detail={detail}
        onMutated={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('log-btn-send'));
    const removeBtn = await screen.findByTestId('modal-confirm-remove');
    expect(removeBtn.className).toMatch(/bg-red-/);
    expect(removeBtn.className).not.toMatch(/bg-orange-/);
    // "No, keep it" is now the primary brand-orange option.
    const keepBtn = screen.getByTestId('modal-keep-project');
    expect(keepBtn.className).toMatch(/bg-orange-/);
  });
});

// UX-002 / QW5 — bigger log buttons, no sub-12px labels.
describe('LogSection — tap targets', () => {
  it('every log button is min-h-14 and no label uses text-[10px]', () => {
    const { container } = render(
      <LogSection
        climbUuid={CLIMB_UUID}
        angle={ANGLE}
        detail={mkDetail({ recent_logs: [mkLog()] })}
        onMutated={jest.fn()}
      />,
    );
    const buttons = screen.getByTestId('log-grid').querySelectorAll('button');
    expect(buttons).toHaveLength(4);
    buttons.forEach((b) => expect(b).toHaveClass('min-h-14'));
    expect(container.querySelector('[class*="text-[10px]"]')).toBeNull();
  });
});
