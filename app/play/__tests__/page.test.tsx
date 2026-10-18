import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import placementsData from '@/app/data/placements_12x12.json';
import ledsMap from '@/app/data/leds_12x12.json';

jest.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: false }),
}));

const pushMock = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: jest.fn() }),
  usePathname: () => '/play',
}));

const sendLEDs = jest.fn(() => Promise.resolve());
const connect = jest.fn();
const MOCK_BLE_DEFAULT = { status: 'idle', isCapacitorNative: false, lastError: null as string | null };
let mockBle = { ...MOCK_BLE_DEFAULT };
jest.mock('@/components/BleProvider', () => ({
  useBle: () => ({
    ...mockBle,
    sendLEDs,
    sendAllOffLEDs: jest.fn(() => Promise.resolve()),
    connect,
  }),
}));

jest.mock('@/components/BottomNav', () => ({
  __esModule: true,
  default: () => <nav data-testid="mock-bottomnav" />,
}));

jest.mock('@/lib/feedback/haptics', () => ({ haptic: jest.fn(() => Promise.resolve()) }));
jest.mock('@/lib/feedback/sound', () => ({
  ...jest.requireActual('@/lib/feedback/sound'),
  playCue: jest.fn(),
}));
jest.mock('@/lib/feedback/keep-awake', () => ({
  keepAwake: jest.fn(() => Promise.resolve(true)),
  allowSleep: jest.fn(() => Promise.resolve()),
}));

// Tap snapping is unit-tested in hold-pick.test.ts; here each overlay tap
// resolves to the next queued placement.
const tapQueue: unknown[] = [];
jest.mock('../hold-pick', () => ({
  pointToPct: () => ({ xPct: 0, yPct: 0 }),
  nearestHold: () => tapQueue.shift() ?? null,
}));

import PlayPage from '../page';
import { keepAwake } from '@/lib/feedback/keep-awake';
import { haptic } from '@/lib/feedback/haptics';
import { playCue } from '@/lib/feedback/sound';
import { GAME_KEY } from '../game-storage';

type P = { placement_id: number; set_id: number };
const LEDS = ledsMap as Record<string, number>;
const pickable = (placementsData as P[]).filter(
  (p) => p.set_id === 1 && LEDS[String(p.placement_id)] !== undefined,
);
const [h1, h2, h3, h4, h5, h6] = pickable;

function tapHold(p: unknown) {
  tapQueue.push(p);
  fireEvent.click(screen.getByTestId('play-board-overlay'));
}

// Controllable clock: SENT/FELL ignore taps landing < 500ms after Confirm.
let clock = 1_000_000;
let nowSpy: jest.SpyInstance<number, []>;
beforeEach(() => {
  window.localStorage.clear();
  tapQueue.length = 0;
  mockBle = { ...MOCK_BLE_DEFAULT };
  jest.clearAllMocks();
  clock = 1_000_000;
  nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => clock);
});
afterEach(() => {
  nowSpy.mockRestore();
});

function confirmHold() {
  fireEvent.click(screen.getByTestId('play-confirm'));
  clock += 1000;
}

async function renderPage() {
  render(<PlayPage />);
  await screen.findByTestId('play-pick-starts');
}

async function startTwoPlayerGame() {
  await renderPage();
  fireEvent.change(screen.getByTestId('play-name-0'), { target: { value: 'Dani' } });
  fireEvent.change(screen.getByTestId('play-name-1'), { target: { value: 'Marco' } });
  fireEvent.click(screen.getByTestId('play-pick-starts'));
  tapHold(h1);
  fireEvent.click(screen.getByTestId('play-start-game'));
}

describe('/play', () => {
  it('connected: board chip re-sends the current holds (manual light up)', async () => {
    mockBle = { ...MOCK_BLE_DEFAULT, status: 'connected', isCapacitorNative: true };
    await startTwoPlayerGame();
    const chip = screen.getByTestId('play-ble-chip');
    expect(chip).toHaveTextContent('Light up');
    sendLEDs.mockClear();
    fireEvent.click(chip);
    expect(sendLEDs).toHaveBeenCalledTimes(1);
    expect((sendLEDs.mock.calls[0] as unknown[])[0]).toHaveLength(1); // the start hold
    expect(connect).not.toHaveBeenCalled();
  });

  it('connected with a failed write: chip shows the failure and retries on tap', async () => {
    mockBle = { status: 'connected', isCapacitorNative: true, lastError: 'write failed' };
    await startTwoPlayerGame();
    const chip = screen.getByTestId('play-ble-chip');
    expect(chip).toHaveTextContent('LEDs failed · retry');
    expect(chip).toHaveAttribute('title', 'write failed');
    sendLEDs.mockClear();
    fireEvent.click(chip);
    expect(sendLEDs).toHaveBeenCalledTimes(1);
  });

  it('disconnected: chip connects, never sends', async () => {
    mockBle = { ...MOCK_BLE_DEFAULT, isCapacitorNative: true };
    await startTwoPlayerGame();
    const chip = screen.getByTestId('play-ble-chip');
    expect(chip).toHaveTextContent('tap to connect');
    fireEvent.click(chip);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(sendLEDs).not.toHaveBeenCalled();
  });

  it('setup: lives default 1, sound off by default, Easy option, names required', async () => {
    await renderPage();
    expect(screen.getByTestId('play-lives-1')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('play-lives-3')).toHaveTextContent('Easy');
    const sound = screen.getByTestId('play-sound-toggle');
    expect(sound).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(sound);
    expect(sound).toHaveAttribute('aria-pressed', 'true');
    expect(window.localStorage.getItem('climbritz.sound.enabled')).toBe('1');
    expect(screen.getByTestId('play-pick-starts')).toBeDisabled();
  });

  it('plays a full turn: pick, confirm, SENT passes the turn; FELL ends a 1-life game', async () => {
    await startTwoPlayerGame();
    expect(screen.getByTestId('play-current-player')).toHaveTextContent("Dani's turn");
    expect(screen.getByTestId('play-turn-timer')).toHaveTextContent('0:00');
    expect(keepAwake).toHaveBeenCalled();

    expect(screen.getByTestId('play-confirm')).toBeDisabled();
    tapHold(h2);
    confirmHold();
    fireEvent.click(screen.getByTestId('play-sent'));
    expect(screen.getByTestId('play-current-player')).toHaveTextContent("Marco's turn");

    tapHold(h3);
    confirmHold();
    fireEvent.click(screen.getByTestId('play-fell'));
    expect(screen.getByTestId('play-winner')).toHaveTextContent('Dani wins');
    // Signed out → login only needed to save.
    expect(screen.getByTestId('play-sign-in')).toBeInTheDocument();
    // Too short to save (1 start + 1 added): validation is shown.
    expect(screen.getByTestId('play-save-validation')).toBeInTheDocument();
  });

  it('undo last turn from the menu returns to the climb', async () => {
    await startTwoPlayerGame();
    tapHold(h2);
    confirmHold();
    fireEvent.click(screen.getByTestId('play-sent'));
    fireEvent.click(screen.getByTestId('play-menu'));
    fireEvent.click(screen.getByTestId('play-menu-undo'));
    expect(screen.getByTestId('play-current-player')).toHaveTextContent("Dani's turn");
    expect(screen.getByTestId('play-sent')).toBeInTheDocument();
  });

  it('persists the game and offers to resume it', async () => {
    await startTwoPlayerGame();
    expect(window.localStorage.getItem(GAME_KEY)).not.toBeNull();
    // Remount: resume prompt names the player whose turn it is.
    const { unmount } = render(<div />);
    unmount();
    document.body.innerHTML = '';
    render(<PlayPage />);
    const resume = await screen.findByTestId('play-resume');
    expect(resume).toHaveTextContent("Dani's turn");
    await act(async () => {
      fireEvent.click(resume);
    });
    expect(screen.getByTestId('play-current-player')).toHaveTextContent("Dani's turn");
  });

  it('ignores a SENT/FELL tap landing right after Confirm (double tap)', async () => {
    await startTwoPlayerGame();
    tapHold(h2);
    fireEvent.click(screen.getByTestId('play-confirm'));
    fireEvent.click(screen.getByTestId('play-fell'));
    expect(screen.getByTestId('play-current-player')).toHaveTextContent("Dani's turn");
    expect(screen.getByTestId('play-fell')).toBeInTheDocument();
    clock += 600;
    fireEvent.click(screen.getByTestId('play-sent'));
    expect(screen.getByTestId('play-current-player')).toHaveTextContent("Marco's turn");
  });

  it('never connects the board on its own and sends nothing while disconnected', async () => {
    await startTwoPlayerGame();
    expect(connect).not.toHaveBeenCalled();
    expect(sendLEDs).not.toHaveBeenCalled();
  });

  it('shows the current player name and lives big, others compactly', async () => {
    await renderPage();
    fireEvent.change(screen.getByTestId('play-name-0'), { target: { value: 'Dani' } });
    fireEvent.change(screen.getByTestId('play-name-1'), { target: { value: 'Marco' } });
    fireEvent.click(screen.getByTestId('play-lives-2'));
    fireEvent.click(screen.getByTestId('play-pick-starts'));
    tapHold(h1);
    fireEvent.click(screen.getByTestId('play-start-game'));
    const name = screen.getByTestId('play-current-player');
    expect(name).toHaveTextContent("Dani's turn");
    expect(name.querySelector('span')?.className).toMatch(/font-black/);
    const lives = screen.getByTestId('play-lives');
    expect(lives).toHaveAttribute('aria-label', '2 lives left');
    expect(lives).toHaveTextContent('♥♥');
    expect(screen.getByTestId('play-others')).toHaveTextContent('Marco');
    // Fall once → last life, hollow heart shown.
    tapHold(h2);
    confirmHold();
    fireEvent.click(screen.getByTestId('play-fell'));
    expect(playCue).toHaveBeenCalledWith('fell');
    expect(screen.getByTestId('play-current-player')).toHaveTextContent("Marco's turn");
    tapHold(h2);
    confirmHold();
    fireEvent.click(screen.getByTestId('play-sent'));
    expect(screen.getByTestId('play-lives')).toHaveTextContent('Last life!');
    expect(screen.getByTestId('play-lives')).toHaveTextContent('♥♡');
  });

  it('knock-out plays the elimination cue, then the winner fanfare + success haptic + confetti', async () => {
    jest.useFakeTimers({ doNotFake: ['Date'] });
    try {
      await startTwoPlayerGame();
      tapHold(h2);
      confirmHold();
      fireEvent.click(screen.getByTestId('play-fell'));
      expect(playCue).toHaveBeenCalledWith('eliminated');
      expect(playCue).not.toHaveBeenCalledWith('fell');
      expect(playCue).not.toHaveBeenCalledWith('winner');
      expect(screen.getByTestId('play-winner')).toHaveTextContent('Marco wins');
      expect(screen.getByTestId('play-confetti')).toBeInTheDocument();
      act(() => {
        jest.advanceTimersByTime(1500);
      });
      expect(playCue).toHaveBeenCalledWith('winner');
      expect(haptic).toHaveBeenCalledWith('success');
    } finally {
      jest.useRealTimers();
    }
  });

  it('feet mode: toggle, 2 start hands then 1 start foot, optional foot per turn', async () => {
    await renderPage();
    const toggle = screen.getByTestId('play-feet-toggle');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.change(screen.getByTestId('play-name-0'), { target: { value: 'Dani' } });
    fireEvent.change(screen.getByTestId('play-name-1'), { target: { value: 'Marco' } });
    fireEvent.click(screen.getByTestId('play-lives-2'));
    fireEvent.click(screen.getByTestId('play-pick-starts'));

    // Step 1: 2 start hands.
    expect(screen.getByTestId('play-starts-instruction')).toHaveTextContent('Pick 2 start holds');
    expect(screen.getByTestId('play-step-hands')).toHaveAttribute('aria-pressed', 'true');
    tapHold(h1);
    expect(screen.getByTestId('play-start-game')).toBeDisabled();
    tapHold(h2);
    // Auto-advance to step 2: the start foot.
    expect(screen.getByTestId('play-step-foot')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('play-starts-instruction')).toHaveTextContent('Pick 1 start foot');
    expect(screen.getByTestId('play-start-game')).toBeDisabled();
    tapHold(h3);
    expect(screen.getByTestId('play-step-foot')).toHaveTextContent('1/1');
    fireEvent.click(screen.getByTestId('play-start-game'));

    // Turn: hand required, foot optional.
    expect(screen.getByTestId('play-target-hand')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('play-add-foot')).toBeNull();
    tapHold(h4);
    fireEvent.click(screen.getByTestId('play-add-foot'));
    expect(screen.getByTestId('play-target-foot')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('play-pick-hint')).toHaveTextContent('Tap a foot hold (optional)');
    tapHold(h5);
    expect(screen.getByTestId('play-confirm')).toHaveTextContent('Confirm hand + foot');
    confirmHold();
    fireEvent.click(screen.getByTestId('play-fell'));
    expect(screen.getByTestId('play-last-result')).toHaveTextContent('Dani fell · hand + foot discarded');

    // Next turn resets to Hand; skipping the foot is fine.
    expect(screen.getByTestId('play-target-hand')).toHaveAttribute('aria-pressed', 'true');
    tapHold(h6);
    expect(screen.getByTestId('play-confirm')).toHaveTextContent('Confirm hold');
    confirmHold();
    fireEvent.click(screen.getByTestId('play-sent'));
    expect(screen.getByTestId('play-current-player')).toHaveTextContent("Dani's turn");

    // Prefs remember feet mode.
    expect(JSON.parse(window.localStorage.getItem('climbritz:play:prefs') ?? '{}').feet).toBe(true);
    // Persisted game carries the start foot.
    const saved = JSON.parse(window.localStorage.getItem(GAME_KEY) ?? '{}');
    expect(saved.state.feet).toBe(true);
    expect(saved.state.startFoot).toBe((h3 as P).placement_id);
  });

  it('feet OFF: no hand/foot picker and the classic start step', async () => {
    await startTwoPlayerGame();
    expect(screen.queryByTestId('play-target-foot')).toBeNull();
    tapHold(h2);
    expect(screen.queryByTestId('play-add-foot')).toBeNull();
  });

  it('layout: board fills the area between header and the bottom action bar; game over shows Rematch before the save card', async () => {
    await startTwoPlayerGame();
    const area = screen.getByTestId('play-board-area');
    expect(area).toContainElement(screen.getByTestId('play-board-overlay'));
    // Primary action lives after the board (thumb zone), not inside it.
    expect(area).not.toContainElement(screen.getByTestId('play-confirm'));
    expect(
      area.compareDocumentPosition(screen.getByTestId('play-confirm')) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    tapHold(h2);
    confirmHold();
    expect(screen.getByTestId('play-board-area')).not.toContainElement(screen.getByTestId('play-sent'));
    fireEvent.click(screen.getByTestId('play-fell'));
    const rematch = screen.getByTestId('play-rematch');
    expect(
      rematch.compareDocumentPosition(screen.getByTestId('play-sign-in')) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
  it('undo right after a knock-out cancels the pending winner fanfare', async () => {
    jest.useFakeTimers({ doNotFake: ['Date'] });
    try {
      await startTwoPlayerGame();
      tapHold(h2);
      confirmHold();
      fireEvent.click(screen.getByTestId('play-fell'));
      expect(screen.getByTestId('play-winner')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('play-undo-over'));
      expect(screen.getByTestId('play-sent')).toBeInTheDocument();
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(playCue).not.toHaveBeenCalledWith('winner');
    } finally {
      jest.useRealTimers();
    }
  });

  it('feet mode: resuming a start pick with both hands set lands on the foot step', async () => {
    const { unmount } = render(<PlayPage />);
    await screen.findByTestId('play-pick-starts');
    fireEvent.click(screen.getByTestId('play-feet-toggle'));
    fireEvent.change(screen.getByTestId('play-name-0'), { target: { value: 'Dani' } });
    fireEvent.change(screen.getByTestId('play-name-1'), { target: { value: 'Marco' } });
    fireEvent.click(screen.getByTestId('play-pick-starts'));
    tapHold(h1);
    tapHold(h2);
    unmount();
    render(<PlayPage />);
    fireEvent.click(await screen.findByTestId('play-resume'));
    expect(screen.getByTestId('play-step-foot')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('play-starts-instruction')).toHaveTextContent('Pick 1 start foot');
  });
});
