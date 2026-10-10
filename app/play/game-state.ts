// GAME-001 — Add-On game, pure state machine.
//
// No React, no Date.now(), no storage: every time-dependent action carries
// `now` in its payload (turnStartedAt), so the reducer is deterministic and
// jest covers every transition. Same style as app/create/editor-state.ts.
//
// Flow:
//   setup ─START_PICKING_STARTS→ pickStarts ─START_GAME→ pick
//   pick  ─PREVIEW_HOLD→ pick (pendingId) ─CONFIRM_HOLD→ climb
//   climb ─UNDO_PICK→ pick
//   climb ─DECLARE{sent|fell}→ pick (next active player) | over
//   any in-game ─UNDO_LAST_TURN→ climb of the previous turn (also from over)
//   any in-game ─REMOVE_PLAYER / END_GAME→ …
//   over ─REMATCH→ pickStarts   ─RESET→ setup
//
// Owner rules (GAME-001):
//   - SENT keeps the added hold in the sequence (+1 score).
//   - FELL DISCARDS the added hold and costs one life; the next player starts
//     from the same sequence. 0 lives → eliminated.
//   - Lives 1 (default, classic elimination) / 2 / 3 ("Easy").
//   - Timer is informative only: the state just records turnStartedAt; there
//     is deliberately no timeout/auto-fail action.
//
// Invalid actions never throw: they return the state with `error` set (the UI
// shows it + error haptic). Any valid action clears `error`.

import type { DraftHold } from '../create/draft-storage';
import { MAX_FINISH, MAX_START } from '../create/editor-state';

export type GamePhase = 'setup' | 'pickStarts' | 'pick' | 'climb' | 'over';
export type TurnOutcome = 'sent' | 'fell';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const MAX_NAME_LENGTH = 16;
export const LIVES_OPTIONS = [1, 2, 3] as const;
export const DEFAULT_LIVES = 1;

const SET_SCREW_ONS = 20;

export interface Turn {
  playerIdx: number;
  holdId: number;
  outcome: TurnOutcome;
}

export interface GameState {
  phase: GamePhase;
  /** Player names, in turn order. */
  players: string[];
  /** Lives each player starts with. */
  lives: number;
  /** Start holds (1–MAX_START placement ids). */
  starts: number[];
  /** Every declared turn, in order — scores/lives/sequence derive from it. */
  turns: Turn[];
  /** Indices of players removed via the menu (not via lives). */
  removed: number[];
  /** Index (into players) of the player whose turn it is. */
  currentIdx: number;
  /** Hold being previewed (pick) or attempted (climb). */
  pendingId: number | null;
  /** Epoch ms when the current turn began (informative timer). */
  turnStartedAt: number | null;
  error: string | null;
}

/** What the reducer needs to know about a tapped hold. */
export interface HoldInfo {
  placement_id: number;
  set_id: number;
  hasLed: boolean;
}

export type GameAction =
  | { type: 'START_PICKING_STARTS'; names: string[]; lives: number }
  | { type: 'TOGGLE_START'; hold: HoldInfo }
  | { type: 'START_GAME'; now: number }
  | { type: 'PREVIEW_HOLD'; hold: HoldInfo }
  | { type: 'CONFIRM_HOLD' }
  | { type: 'UNDO_PICK' }
  | { type: 'DECLARE'; outcome: TurnOutcome; now: number }
  | { type: 'UNDO_LAST_TURN'; now: number }
  | { type: 'REMOVE_PLAYER'; playerIdx: number; now: number }
  | { type: 'END_GAME' }
  | { type: 'REMATCH' }
  | { type: 'RESET' }
  | { type: 'CLEAR_ERROR' };

export function initialGameState(players: string[] = [], lives = DEFAULT_LIVES): GameState {
  return {
    phase: 'setup',
    players,
    lives,
    starts: [],
    turns: [],
    removed: [],
    currentIdx: 0,
    pendingId: null,
    turnStartedAt: null,
    error: null,
  };
}

// ---- selectors --------------------------------------------------------------

/** Holds successfully added (SENT), in order. FELL holds are discarded. */
export function addedHolds(state: Pick<GameState, 'turns'>): number[] {
  return state.turns.filter((t) => t.outcome === 'sent').map((t) => t.holdId);
}

/** Full climbed sequence: starts + added holds. */
export function sequence(state: Pick<GameState, 'starts' | 'turns'>): number[] {
  return [...state.starts, ...addedHolds(state)];
}

export interface PlayerScore {
  score: number;
  sent: number;
  fell: number;
  /** Longest sequence length this player sent (tie-break). */
  longestChain: number;
}

/** Scores derived from the turn list (+1 per successful added hold). */
export function computeScores(
  turns: Turn[],
  playerCount: number,
  startCount: number,
): PlayerScore[] {
  const out: PlayerScore[] = Array.from({ length: playerCount }, () => ({
    score: 0,
    sent: 0,
    fell: 0,
    longestChain: 0,
  }));
  let chain = startCount;
  for (const t of turns) {
    const s = out[t.playerIdx];
    if (!s) continue;
    if (t.outcome === 'sent') {
      chain += 1;
      s.score += 1;
      s.sent += 1;
      s.longestChain = Math.max(s.longestChain, chain);
    } else {
      s.fell += 1;
    }
  }
  return out;
}

export function scores(state: GameState): PlayerScore[] {
  return computeScores(state.turns, state.players.length, state.starts.length);
}

export function livesLeft(state: GameState, playerIdx: number): number {
  const falls = state.turns.filter(
    (t) => t.playerIdx === playerIdx && t.outcome === 'fell',
  ).length;
  return Math.max(0, state.lives - falls);
}

export function isActive(state: GameState, playerIdx: number): boolean {
  return !state.removed.includes(playerIdx) && livesLeft(state, playerIdx) > 0;
}

export function activePlayers(state: GameState): number[] {
  return state.players.map((_, i) => i).filter((i) => isActive(state, i));
}

/** Longest chain sent in the game, with who sent it (null if none). */
export function longestChain(state: GameState): { length: number; playerIdx: number } | null {
  const s = scores(state);
  let best: { length: number; playerIdx: number } | null = null;
  for (let i = 0; i < s.length; i++) {
    const len = s[i].longestChain;
    if (len > 0 && (best === null || len > best.length)) {
      best = { length: len, playerIdx: i };
    }
  }
  return best;
}

/**
 * Winner index, or null for a draw / no game. Last standing wins outright;
 * otherwise (End game) best score, tie-break longest chain.
 */
export function winner(state: GameState): number | null {
  if (state.players.length === 0) return null;
  const active = activePlayers(state);
  if (active.length === 1) return active[0];
  const pool = active.length > 0 ? active : state.players.map((_, i) => i);
  const s = scores(state);
  const ranked = [...pool].sort(
    (a, b) => s[b].score - s[a].score || s[b].longestChain - s[a].longestChain,
  );
  const [first, second] = ranked;
  if (
    second !== undefined &&
    s[first].score === s[second].score &&
    s[first].longestChain === s[second].longestChain
  ) {
    return null;
  }
  return first;
}

// ---- validation -------------------------------------------------------------

export interface NameValidation {
  valid: boolean;
  error: string | null;
}

export function validatePlayerNames(names: string[]): NameValidation {
  const trimmed = names.map((n) => n.trim());
  if (trimmed.length < MIN_PLAYERS) {
    return { valid: false, error: `At least ${MIN_PLAYERS} players` };
  }
  if (trimmed.length > MAX_PLAYERS) {
    return { valid: false, error: `At most ${MAX_PLAYERS} players` };
  }
  if (trimmed.some((n) => n.length === 0)) {
    return { valid: false, error: 'Every player needs a name' };
  }
  if (trimmed.some((n) => n.length > MAX_NAME_LENGTH)) {
    return { valid: false, error: `Names are max ${MAX_NAME_LENGTH} characters` };
  }
  const lower = trimmed.map((n) => n.toLowerCase());
  if (new Set(lower).size !== lower.length) {
    return { valid: false, error: 'Player names must be unique' };
  }
  return { valid: true, error: null };
}

function holdError(hold: HoldInfo, taken: number[]): string | null {
  if (hold.set_id === SET_SCREW_ONS) return "Footholds (screw-ons) can't be picked";
  if (!hold.hasLed) return 'This hold has no LED — pick another';
  if (taken.includes(hold.placement_id)) return 'Already in the sequence';
  return null;
}

// ---- reducer ----------------------------------------------------------------

function fail(state: GameState, error: string): GameState {
  return { ...state, error };
}

const OUT_OF_PHASE = 'Not available right now';

/** Next active player after `from` (wrapping), or -1 if none. */
function nextActiveAfter(state: GameState, from: number): number {
  const n = state.players.length;
  for (let step = 1; step <= n; step++) {
    const i = (from + step) % n;
    if (isActive(state, i)) return i;
  }
  return -1;
}

/** After a turn change: game over if ≤1 player is left, else hand over. */
function advance(state: GameState, from: number, now: number): GameState {
  const active = activePlayers(state);
  if (active.length <= 1) {
    return { ...state, phase: 'over', pendingId: null, turnStartedAt: null, error: null };
  }
  return {
    ...state,
    phase: 'pick',
    currentIdx: nextActiveAfter(state, from),
    pendingId: null,
    turnStartedAt: now,
    error: null,
  };
}

const IN_GAME: GamePhase[] = ['pick', 'climb', 'over'];

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_PICKING_STARTS': {
      if (state.phase !== 'setup') return fail(state, OUT_OF_PHASE);
      const v = validatePlayerNames(action.names);
      if (!v.valid) return fail(state, v.error ?? 'Invalid players');
      if (!(LIVES_OPTIONS as readonly number[]).includes(action.lives)) {
        return fail(state, 'Lives must be 1, 2 or 3');
      }
      return {
        ...initialGameState(action.names.map((n) => n.trim()), action.lives),
        phase: 'pickStarts',
      };
    }

    case 'TOGGLE_START': {
      if (state.phase !== 'pickStarts') return fail(state, OUT_OF_PHASE);
      const id = action.hold.placement_id;
      if (state.starts.includes(id)) {
        return { ...state, starts: state.starts.filter((s) => s !== id), error: null };
      }
      const err = holdError(action.hold, state.starts);
      if (err) return fail(state, err);
      if (state.starts.length >= MAX_START) {
        return fail(state, `Max ${MAX_START} start holds`);
      }
      return { ...state, starts: [...state.starts, id], error: null };
    }

    case 'START_GAME': {
      if (state.phase !== 'pickStarts') return fail(state, OUT_OF_PHASE);
      if (state.starts.length < 1) return fail(state, 'Pick at least one start hold');
      return {
        ...state,
        phase: 'pick',
        turns: [],
        removed: [],
        currentIdx: 0,
        pendingId: null,
        turnStartedAt: action.now,
        error: null,
      };
    }

    case 'PREVIEW_HOLD': {
      if (state.phase !== 'pick') return fail(state, OUT_OF_PHASE);
      const err = holdError(action.hold, sequence(state));
      if (err) return fail(state, err);
      return { ...state, pendingId: action.hold.placement_id, error: null };
    }

    case 'CONFIRM_HOLD': {
      if (state.phase !== 'pick') return fail(state, OUT_OF_PHASE);
      if (state.pendingId === null) return fail(state, 'Tap a hold first');
      return { ...state, phase: 'climb', error: null };
    }

    case 'UNDO_PICK': {
      if (state.phase !== 'climb') return fail(state, OUT_OF_PHASE);
      return { ...state, phase: 'pick', error: null };
    }

    case 'DECLARE': {
      if (state.phase !== 'climb' || state.pendingId === null) {
        return fail(state, OUT_OF_PHASE);
      }
      const turn: Turn = {
        playerIdx: state.currentIdx,
        holdId: state.pendingId,
        outcome: action.outcome,
      };
      const next = { ...state, turns: [...state.turns, turn] };
      return advance(next, state.currentIdx, action.now);
    }

    case 'UNDO_LAST_TURN': {
      if (!IN_GAME.includes(state.phase)) return fail(state, OUT_OF_PHASE);
      const last = state.turns[state.turns.length - 1];
      if (!last) return fail(state, 'Nothing to undo');
      return {
        ...state,
        phase: 'climb',
        turns: state.turns.slice(0, -1),
        // The undone player is back on the wall even if removed meanwhile.
        removed: state.removed.filter((i) => i !== last.playerIdx),
        currentIdx: last.playerIdx,
        pendingId: last.holdId,
        turnStartedAt: action.now,
        error: null,
      };
    }

    case 'REMOVE_PLAYER': {
      if (state.phase !== 'pick' && state.phase !== 'climb') {
        return fail(state, OUT_OF_PHASE);
      }
      const idx = action.playerIdx;
      if (idx < 0 || idx >= state.players.length || !isActive(state, idx)) {
        return fail(state, 'Player is not in the game');
      }
      const next = { ...state, removed: [...state.removed, idx] };
      if (idx === state.currentIdx) return advance(next, idx, action.now);
      if (activePlayers(next).length <= 1) return advance(next, idx, action.now);
      return { ...next, error: null };
    }

    case 'END_GAME': {
      if (state.phase !== 'pick' && state.phase !== 'climb') {
        return fail(state, OUT_OF_PHASE);
      }
      return { ...state, phase: 'over', pendingId: null, turnStartedAt: null, error: null };
    }

    case 'REMATCH': {
      if (state.phase !== 'over') return fail(state, OUT_OF_PHASE);
      return { ...initialGameState(state.players, state.lives), phase: 'pickStarts' };
    }

    case 'RESET':
      return initialGameState(state.players, state.lives);

    case 'CLEAR_ERROR':
      return state.error === null ? state : { ...state, error: null };

    default:
      return state;
  }
}

// ---- save as My Problem -----------------------------------------------------

/**
 * Map the final sequence to editor holds: starts → start, added → middle,
 * the last `finishCount` (1 or 2, ≤ MAX_FINISH) added holds → finish.
 * Feed the result to validateDraft / draftToFrames (editor-state).
 */
export function toProblemHolds(
  starts: number[],
  added: number[],
  finishCount: 1 | 2 = 1,
): DraftHold[] {
  const n = Math.min(finishCount, MAX_FINISH, added.length);
  const firstFinish = added.length - n;
  return [
    ...starts.map((id) => ({ placement_id: id, role: 'start' })),
    ...added.map((id, i) => ({
      placement_id: id,
      role: i >= firstFinish ? 'finish' : 'middle',
    })),
  ];
}

/** "Add-On · Dani vs Marco" (2 players) / "Add-On · N players", ≤60 chars. */
export function problemName(players: string[]): string {
  const name =
    players.length === 2
      ? `Add-On · ${players[0]} vs ${players[1]}`
      : `Add-On · ${players.length} players`;
  return name.slice(0, 60);
}

// ---- informative turn timer -------------------------------------------------

/** Elapsed turn time as m:ss (counts up from 0:00; negatives clamp to 0). */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
