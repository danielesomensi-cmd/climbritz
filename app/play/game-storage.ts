// GAME-001 — localStorage persistence for the Add-On game.
//
// Two keys:
//  - the in-progress game (6h TTL) so a backgrounded / killed app can resume;
//  - per-device prefs (last player names + lives) to prefill the setup.
// Every access is wrapped in try/catch (private mode, cleared site data,
// thumbnail capture) and every read is type-guarded: a corrupt or stale
// entry is dropped and the page simply starts a new game.

import type { GamePhase, GameState, Turn } from './game-state';

export const GAME_KEY = 'climbritz:play:game';
export const PREFS_KEY = 'climbritz:play:prefs';
export const GAME_MAX_AGE_MS = 6 * 60 * 60 * 1000;

interface StoredGame {
  state: GameState;
  savedAt: number;
}

export interface PlayPrefs {
  names: string[];
  lives: number;
  /** GAME-002 feet mode (absent in older prefs → off). */
  feet?: boolean;
}

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function readJson(key: string): unknown {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function remove(key: string): void {
  try {
    storage()?.removeItem(key);
  } catch {
    // ignore
  }
}

export function saveGame(state: GameState, now: number = Date.now()): void {
  const s = storage();
  if (!s) return;
  try {
    // The error banner is transient UI — never persist it.
    const payload: StoredGame = { state: { ...state, error: null }, savedAt: now };
    s.setItem(GAME_KEY, JSON.stringify(payload));
  } catch {
    // Quota / private mode — the game just won't survive a reload.
  }
}

export function clearGame(): void {
  remove(GAME_KEY);
}

export function loadGame(now: number = Date.now()): GameState | null {
  const parsed = readJson(GAME_KEY);
  if (parsed === null) return null;
  if (!isStoredGame(parsed) || now - parsed.savedAt > GAME_MAX_AGE_MS) {
    clearGame();
    return null;
  }
  // GAME-002: games saved before feet mode lack the feet fields → feet off.
  const st = parsed.state as GameState;
  return {
    ...st,
    feet: st.feet === true,
    startFoot: st.startFoot ?? null,
    pendingFootId: st.pendingFootId ?? null,
  };
}

export function savePrefs(prefs: PlayPrefs): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

export function loadPrefs(): PlayPrefs | null {
  const parsed = readJson(PREFS_KEY);
  if (!parsed || typeof parsed !== 'object') return null;
  const o = parsed as Record<string, unknown>;
  if (!isStringArray(o.names) || typeof o.lives !== 'number') return null;
  return { names: o.names, lives: o.lives, feet: o.feet === true };
}

// ---- type guards ------------------------------------------------------------

const PHASES: GamePhase[] = ['setup', 'pickStarts', 'pick', 'climb', 'over'];

function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((v) => typeof v === 'string');
}

function isNumberArray(x: unknown): x is number[] {
  return Array.isArray(x) && x.every((v) => typeof v === 'number');
}

function isNumOrNull(x: unknown): x is number | null {
  return x === null || typeof x === 'number';
}

function isTurn(x: unknown): x is Turn {
  if (!x || typeof x !== 'object') return false;
  const t = x as Record<string, unknown>;
  return (
    typeof t.playerIdx === 'number' &&
    typeof t.holdId === 'number' &&
    (t.footId === undefined || isNumOrNull(t.footId)) &&
    (t.outcome === 'sent' || t.outcome === 'fell')
  );
}

export function isGameState(x: unknown): x is GameState {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.phase === 'string' &&
    PHASES.includes(o.phase as GamePhase) &&
    isStringArray(o.players) &&
    typeof o.lives === 'number' &&
    isNumberArray(o.starts) &&
    (o.feet === undefined || typeof o.feet === 'boolean') &&
    (o.startFoot === undefined || isNumOrNull(o.startFoot)) &&
    (o.pendingFootId === undefined || isNumOrNull(o.pendingFootId)) &&
    Array.isArray(o.turns) &&
    o.turns.every(isTurn) &&
    isNumberArray(o.removed) &&
    typeof o.currentIdx === 'number' &&
    isNumOrNull(o.pendingId) &&
    isNumOrNull(o.turnStartedAt) &&
    (o.error === null || typeof o.error === 'string')
  );
}

function isStoredGame(x: unknown): x is StoredGame {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return typeof o.savedAt === 'number' && isGameState(o.state);
}
