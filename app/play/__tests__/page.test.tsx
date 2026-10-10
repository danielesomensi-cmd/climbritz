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
jest.mock('@/components/BleProvider', () => ({
  useBle: () => ({
    status: 'idle',
    sendLEDs,
    sendAllOffLEDs: jest.fn(() => Promise.resolve()),
    connect,
    isCapacitorNative: false,
  }),
}));

jest.mock('@/components/BottomNav', () => ({
  __esModule: true,
  default: () => <nav data-testid="mock-bottomnav" />,
}));

jest.mock('@/lib/feedback/haptics', () => ({ haptic: jest.fn(() => Promise.resolve()) }));
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
import { GAME_KEY } from '../game-storage';

type P = { placement_id: number; set_id: number };
const LEDS = ledsMap as Record<string, number>;
const pickable = (placementsData as P[]).filter(
  (p) => p.set_id === 1 && LEDS[String(p.placement_id)] !== undefined,
);
const [h1, h2, h3] = pickable;

function tapHold(p: unknown) {
  tapQueue.push(p);
  fireEvent.click(screen.getByTestId('play-board-overlay'));
}

beforeEach(() => {
  window.localStorage.clear();
  tapQueue.length = 0;
  jest.clearAllMocks();
});

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
    fireEvent.click(screen.getByTestId('play-confirm'));
    fireEvent.click(screen.getByTestId('play-sent'));
    expect(screen.getByTestId('play-current-player')).toHaveTextContent("Marco's turn");

    tapHold(h3);
    fireEvent.click(screen.getByTestId('play-confirm'));
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
    fireEvent.click(screen.getByTestId('play-confirm'));
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

  it('never connects the board on its own and sends nothing while disconnected', async () => {
    await startTwoPlayerGame();
    expect(connect).not.toHaveBeenCalled();
    expect(sendLEDs).not.toHaveBeenCalled();
  });
});
