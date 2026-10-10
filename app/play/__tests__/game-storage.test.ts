import {
  clearGame,
  GAME_KEY,
  GAME_MAX_AGE_MS,
  isGameState,
  loadGame,
  loadPrefs,
  PREFS_KEY,
  saveGame,
  savePrefs,
} from '../game-storage';
import { gameReducer, initialGameState, type GameAction, type GameState } from '../game-state';

function sample(): GameState {
  const actions: GameAction[] = [
    { type: 'START_PICKING_STARTS', names: ['Dani', 'Marco'], lives: 2 },
    { type: 'TOGGLE_START', hold: { placement_id: 1, set_id: 1, hasLed: true } },
    { type: 'START_GAME', now: 1000 },
  ];
  return actions.reduce(gameReducer, initialGameState());
}

beforeEach(() => window.localStorage.clear());

describe('game storage', () => {
  it('round-trips a game and strips the transient error', () => {
    const s = { ...sample(), error: 'boom' };
    saveGame(s, 10_000);
    expect(loadGame(10_001)).toEqual({ ...s, error: null });
  });

  it('expires after 6h and clears the key', () => {
    saveGame(sample(), 0);
    expect(loadGame(GAME_MAX_AGE_MS)).not.toBeNull();
    expect(loadGame(GAME_MAX_AGE_MS + 1)).toBeNull();
    expect(window.localStorage.getItem(GAME_KEY)).toBeNull();
  });

  it('drops corrupt JSON or wrong shapes', () => {
    window.localStorage.setItem(GAME_KEY, '{nope');
    expect(loadGame()).toBeNull();
    window.localStorage.setItem(GAME_KEY, JSON.stringify({ savedAt: Date.now(), state: { phase: 'warp' } }));
    expect(loadGame()).toBeNull();
    expect(window.localStorage.getItem(GAME_KEY)).toBeNull();
  });

  it('clearGame removes the key', () => {
    saveGame(sample());
    clearGame();
    expect(loadGame()).toBeNull();
  });

  it('isGameState validates turns', () => {
    const s = sample();
    expect(isGameState(s)).toBe(true);
    expect(isGameState({ ...s, turns: [{ playerIdx: 0, holdId: 1, outcome: 'maybe' }] })).toBe(false);
    expect(isGameState(null)).toBe(false);
  });

  it('prefs round-trip and reject bad shapes', () => {
    expect(loadPrefs()).toBeNull();
    savePrefs({ names: ['A', 'B'], lives: 3 });
    expect(loadPrefs()).toEqual({ names: ['A', 'B'], lives: 3, feet: false });
    savePrefs({ names: ['A', 'B'], lives: 2, feet: true });
    expect(loadPrefs()).toEqual({ names: ['A', 'B'], lives: 2, feet: true });
    window.localStorage.setItem(PREFS_KEY, JSON.stringify({ names: [1], lives: 1 }));
    expect(loadPrefs()).toBeNull();
  });

  it('round-trips a feet-mode game (start foot, turn feet, pending foot)', () => {
    const feet: GameAction[] = [
      { type: 'START_PICKING_STARTS', names: ['Dani', 'Marco'], lives: 2, feet: true },
      { type: 'TOGGLE_START', hold: { placement_id: 1, set_id: 1, hasLed: true } },
      { type: 'TOGGLE_START', hold: { placement_id: 2, set_id: 1, hasLed: true } },
      { type: 'TOGGLE_START_FOOT', hold: { placement_id: 3, set_id: 20, hasLed: true } },
      { type: 'START_GAME', now: 1000 },
      { type: 'PREVIEW_HOLD', hold: { placement_id: 10, set_id: 1, hasLed: true } },
      { type: 'PREVIEW_FOOT', hold: { placement_id: 11, set_id: 20, hasLed: true } },
      { type: 'CONFIRM_HOLD' },
      { type: 'DECLARE', outcome: 'sent', now: 2000 },
      { type: 'PREVIEW_HOLD', hold: { placement_id: 12, set_id: 1, hasLed: true } },
      { type: 'PREVIEW_FOOT', hold: { placement_id: 13, set_id: 1, hasLed: true } },
    ];
    const s = feet.reduce(gameReducer, initialGameState());
    expect(s.turns[0].footId).toBe(11);
    expect(s.pendingFootId).toBe(13);
    saveGame(s, 10_000);
    expect(loadGame(10_001)).toEqual(s);
    expect(isGameState({ ...s, startFoot: 'x' })).toBe(false);
    expect(isGameState({ ...s, turns: [{ playerIdx: 0, holdId: 1, footId: 'x', outcome: 'sent' }] })).toBe(false);
  });

  it('loads a game saved before feet mode as feet OFF', () => {
    const legacy: Record<string, unknown> = { ...sample() };
    delete legacy.feet;
    delete legacy.startFoot;
    delete legacy.pendingFootId;
    window.localStorage.setItem(GAME_KEY, JSON.stringify({ state: legacy, savedAt: 10_000 }));
    const s = loadGame(10_001);
    expect(s).not.toBeNull();
    expect(s?.feet).toBe(false);
    expect(s?.startFoot).toBeNull();
    expect(s?.pendingFootId).toBeNull();
  });

  it('never throws when storage is unavailable', () => {
    const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => saveGame(sample())).not.toThrow();
    expect(() => savePrefs({ names: [], lives: 1 })).not.toThrow();
    spy.mockRestore();
    const get = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(loadGame()).toBeNull();
    expect(loadPrefs()).toBeNull();
    get.mockRestore();
  });
});
