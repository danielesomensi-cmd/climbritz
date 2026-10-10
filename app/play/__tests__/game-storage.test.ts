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
    expect(loadPrefs()).toEqual({ names: ['A', 'B'], lives: 3 });
    window.localStorage.setItem(PREFS_KEY, JSON.stringify({ names: [1], lives: 1 }));
    expect(loadPrefs()).toBeNull();
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
