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
//   - Feet mode (GAME-002, optional, default OFF): start = exactly 2 start
//     hands + 1 start foot; each turn adds 1 hand (required) and MAY add 1
//     foot. FELL discards both. Feet go to the wall/save as role 15 and never
//     count as start/finish. Feet OFF = GAME-001 behaviour exactly.
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
/** Feet mode: exact start hand holds required. */
export const FEET_START_HANDS = 2;

const SET_SCREW_ONS = 20;

export interface Turn {
  playerIdx: number;
  holdId: number;
  /** Optional foot added this turn (feet mode only). */
  footId?: number | null;
  outcome: TurnOutcome;
}

export interface GameState {
  phase: GamePhase;
  /** Player names, in turn order. */
  players: string[];
  /** Lives each player starts with. */
  lives: number;
  /** Start holds (1–MAX_START placement ids; exactly 2 in feet mode). */
  starts: number[];
  /** Feet mode: each turn may add one foot; start = 2 hands + 1 foot. */
  feet: boolean;
  /** Feet mode: the start foot (null until picked / feet off). */
  startFoot: number | null;
  /** Every declared turn, in order — scores/lives/sequence derive from it. */
  turns: Turn[];
  /** Indices of players removed via the menu (not via lives). */
  removed: number[];
  /** Index (into players) of the player whose turn it is. */
  currentIdx: number;
  /** Hold being previewed (pick) or attempted (climb). */
  pendingId: number | null;
  /** Feet mode: optional foot previewed/attempted this turn. */
  pendingFootId: number | null;
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
  | { type: 'START_PICKING_STARTS'; names: string[]; lives: number; feet?: boolean }
  | { type: 'TOGGLE_START'; hold: HoldInfo }
  | { type: 'TOGGLE_START_FOOT'; hold: HoldInfo }
  | { type: 'START_GAME'; now: number }
  | { type: 'PREVIEW_HOLD'; hold: HoldInfo }
  | { type: 'PREVIEW_FOOT'; hold: HoldInfo }
  | { type: 'CLEAR_FOOT' }
  | { type: 'CONFIRM_HOLD' }
  | { type: 'UNDO_PICK' }
  | { type: 'DECLARE'; outcome: TurnOutcome; now: number }
  | { type: 'UNDO_LAST_TURN'; now: number }
  | { type: 'REMOVE_PLAYER'; playerIdx: number; now: number }
  | { type: 'END_GAME' }
  | { type: 'REMATCH' }
  | { type: 'RESET' }
  | { type: 'CLEAR_ERROR' };

export function initialGameState(
  players: string[] = [],
  lives = DEFAULT_LIVES,
  feet = false,
): GameState {
  return {
    phase: 'setup',
    players,
    lives,
    starts: [],
    feet,
    startFoot: null,
    turns: [],
    removed: [],
    currentIdx: 0,
    pendingId: null,
    pendingFootId: null,
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

/** Feet kept in the problem: start foot + feet of SENT turns, in order. */
export function feetHolds(state: Pick<GameState, 'startFoot' | 'turns'>): number[] {
  const out: number[] = state.startFoot !== null ? [state.startFoot] : [];
  for (const t of state.turns) {
    if (t.outcome === 'sent' && t.footId != null) out.push(t.footId);
  }
  return out;
}

/** Every placement already used (hands + feet). */
function takenHolds(state: GameState): number[] {
  return [...sequence(state), ...feetHolds(state)];
}

/** Feet mode: are the start holds complete (2 hands + 1 foot)? */
export function startsComplete(state: GameState): boolean {
  if (!state.feet) return state.starts.length >= 1;
  return state.starts.length === FEET_START_HANDS && state.startFoot !== null;
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
  return footError(hold, taken);
}

/** Feet may be any hold with an LED, screw-ons included. */
function footError(hold: HoldInfo, taken: number[]): string | null {
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
    return {
      ...state,
      phase: 'over',
      pendingId: null,
      pendingFootId: null,
      turnStartedAt: null,
      error: null,
    };
  }
  return {
    ...state,
    phase: 'pick',
    currentIdx: nextActiveAfter(state, from),
    pendingId: null,
    pendingFootId: null,
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
        ...initialGameState(action.names.map((n) => n.trim()), action.lives, action.feet === true),
        phase: 'pickStarts',
      };
    }

    case 'TOGGLE_START': {
      if (state.phase !== 'pickStarts') return fail(state, OUT_OF_PHASE);
      const id = action.hold.placement_id;
      if (state.starts.includes(id)) {
        return { ...state, starts: state.starts.filter((s) => s !== id), error: null };
      }
      if (id === state.startFoot) return fail(state, 'Already the start foot');
      const err = holdError(action.hold, state.starts);
      if (err) return fail(state, err);
      const max = state.feet ? FEET_START_HANDS : MAX_START;
      if (state.starts.length >= max) {
        return fail(state, `Max ${max} start holds`);
      }
      return { ...state, starts: [...state.starts, id], error: null };
    }

    case 'TOGGLE_START_FOOT': {
      if (state.phase !== 'pickStarts' || !state.feet) return fail(state, OUT_OF_PHASE);
      const id = action.hold.placement_id;
      if (id === state.startFoot) return { ...state, startFoot: null, error: null };
      if (state.starts.includes(id)) return fail(state, 'Already a start hold');
      const err = footError(action.hold, []);
      if (err) return fail(state, err);
      // One start foot: a new tap replaces it.
      return { ...state, startFoot: id, error: null };
    }

    case 'START_GAME': {
      if (state.phase !== 'pickStarts') return fail(state, OUT_OF_PHASE);
      if (state.feet) {
        if (state.starts.length !== FEET_START_HANDS) {
          return fail(state, `Pick ${FEET_START_HANDS} start holds`);
        }
        if (state.startFoot === null) return fail(state, 'Pick 1 start foot');
      } else if (state.starts.length < 1) {
        return fail(state, 'Pick at least one start hold');
      }
      return {
        ...state,
        phase: 'pick',
        turns: [],
        removed: [],
        currentIdx: 0,
        pendingId: null,
        pendingFootId: null,
        turnStartedAt: action.now,
        error: null,
      };
    }

    case 'PREVIEW_HOLD': {
      if (state.phase !== 'pick') return fail(state, OUT_OF_PHASE);
      if (action.hold.placement_id === state.pendingFootId) {
        return fail(state, 'Already picked as the foot');
      }
      const err = holdError(action.hold, takenHolds(state));
      if (err) return fail(state, err);
      return { ...state, pendingId: action.hold.placement_id, error: null };
    }

    case 'PREVIEW_FOOT': {
      if (state.phase !== 'pick' || !state.feet) return fail(state, OUT_OF_PHASE);
      const id = action.hold.placement_id;
      if (id === state.pendingFootId) return { ...state, pendingFootId: null, error: null };
      if (id === state.pendingId) return fail(state, 'Already picked as the hand hold');
      const err = footError(action.hold, takenHolds(state));
      if (err) return fail(state, err);
      return { ...state, pendingFootId: id, error: null };
    }

    case 'CLEAR_FOOT': {
      if (state.phase !== 'pick') return fail(state, OUT_OF_PHASE);
      return { ...state, pendingFootId: null, error: null };
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
      if (state.feet) turn.footId = state.pendingFootId;
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
        pendingFootId: last.footId ?? null,
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
      return {
        ...state,
        phase: 'over',
        pendingId: null,
        pendingFootId: null,
        turnStartedAt: null,
        error: null,
      };
    }

    case 'REMATCH': {
      if (state.phase !== 'over') return fail(state, OUT_OF_PHASE);
      return { ...initialGameState(state.players, state.lives, state.feet), phase: 'pickStarts' };
    }

    case 'RESET':
      return initialGameState(state.players, state.lives, state.feet);

    case 'CLEAR_ERROR':
      return state.error === null ? state : { ...state, error: null };

    default:
      return state;
  }
}

// ---- save as My Problem -----------------------------------------------------

/**
 * Map the final sequence to editor holds: starts → start, added → middle,
 * the last `finishCount` (1 or 2, ≤ MAX_FINISH) added HAND holds → finish,
 * feet → foot_only (r15; never start/finish).
 * Feed the result to validateDraft / draftToFrames (editor-state).
 */
export function toProblemHolds(
  starts: number[],
  added: number[],
  finishCount: 1 | 2 = 1,
  feet: number[] = [],
): DraftHold[] {
  const n = Math.min(finishCount, MAX_FINISH, added.length);
  const firstFinish = added.length - n;
  return [
    ...starts.map((id) => ({ placement_id: id, role: 'start' })),
    ...added.map((id, i) => ({
      placement_id: id,
      role: i >= firstFinish ? 'finish' : 'middle',
    })),
    ...feet.map((id) => ({ placement_id: id, role: 'foot_only' })),
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
