import {
  activePlayers,
  addedHolds,
  computeScores,
  feetHolds,
  startsComplete,
  formatElapsed,
  gameReducer,
  initialGameState,
  livesLeft,
  longestChain,
  problemName,
  scores,
  sequence,
  toProblemHolds,
  validatePlayerNames,
  winner,
  type GameAction,
  type GameState,
  type HoldInfo,
} from '../game-state';
import { draftToFrames, validateDraft } from '../../create/editor-state';

const hold = (id: number, extra: Partial<HoldInfo> = {}): HoldInfo => ({
  placement_id: id,
  set_id: 1,
  hasLed: true,
  ...extra,
});

function run(state: GameState, ...actions: GameAction[]): GameState {
  return actions.reduce(gameReducer, state);
}

/** A game in the `pick` phase, start hold 1, started at t=1000. */
function started(names = ['Dani', 'Marco'], lives = 1): GameState {
  return run(
    initialGameState(),
    { type: 'START_PICKING_STARTS', names, lives },
    { type: 'TOGGLE_START', hold: hold(1) },
    { type: 'START_GAME', now: 1000 },
  );
}

/** Play one full turn: preview `id`, confirm, declare. */
function turn(state: GameState, id: number, outcome: 'sent' | 'fell', now = 2000): GameState {
  return run(
    state,
    { type: 'PREVIEW_HOLD', hold: hold(id) },
    { type: 'CONFIRM_HOLD' },
    { type: 'DECLARE', outcome, now },
  );
}

describe('setup', () => {
  it('starts in setup with default 1 life', () => {
    const s = initialGameState();
    expect(s.phase).toBe('setup');
    expect(s.lives).toBe(1);
  });

  it('START_PICKING_STARTS trims names and moves to pickStarts', () => {
    const s = gameReducer(initialGameState(), {
      type: 'START_PICKING_STARTS',
      names: [' Dani ', 'Marco'],
      lives: 3,
    });
    expect(s.phase).toBe('pickStarts');
    expect(s.players).toEqual(['Dani', 'Marco']);
    expect(s.lives).toBe(3);
    expect(s.error).toBeNull();
  });

  it('rejects invalid players and lives', () => {
    const one = gameReducer(initialGameState(), { type: 'START_PICKING_STARTS', names: ['A'], lives: 1 });
    expect(one.phase).toBe('setup');
    expect(one.error).toMatch(/At least 2/);
    const badLives = gameReducer(initialGameState(), {
      type: 'START_PICKING_STARTS',
      names: ['A', 'B'],
      lives: 4,
    });
    expect(badLives.error).toMatch(/Lives/);
  });

  it('validatePlayerNames covers count, empty, length, duplicates', () => {
    expect(validatePlayerNames(['A', 'B']).valid).toBe(true);
    expect(validatePlayerNames(['A', 'B', 'C', 'D', 'E', 'F']).valid).toBe(true);
    expect(validatePlayerNames(['A', 'B', 'C', 'D', 'E', 'F', 'G']).error).toMatch(/At most 6/);
    expect(validatePlayerNames(['A', '  ']).error).toMatch(/needs a name/);
    expect(validatePlayerNames(['A', 'x'.repeat(17)]).error).toMatch(/max 16/);
    expect(validatePlayerNames(['Dani', 'dani ']).error).toMatch(/unique/);
  });
});

describe('pickStarts', () => {
  const base = () =>
    gameReducer(initialGameState(), { type: 'START_PICKING_STARTS', names: ['A', 'B'], lives: 1 });

  it('toggles starts on and off, max 2', () => {
    let s = run(base(), { type: 'TOGGLE_START', hold: hold(1) }, { type: 'TOGGLE_START', hold: hold(2) });
    expect(s.starts).toEqual([1, 2]);
    const third = gameReducer(s, { type: 'TOGGLE_START', hold: hold(3) });
    expect(third.starts).toEqual([1, 2]);
    expect(third.error).toMatch(/Max 2/);
    s = gameReducer(s, { type: 'TOGGLE_START', hold: hold(1) });
    expect(s.starts).toEqual([2]);
  });

  it('rejects screw-ons and LED-less holds', () => {
    expect(gameReducer(base(), { type: 'TOGGLE_START', hold: hold(5, { set_id: 20 }) }).error).toMatch(/screw-ons/);
    expect(gameReducer(base(), { type: 'TOGGLE_START', hold: hold(5, { hasLed: false }) }).error).toMatch(/no LED/);
  });

  it('START_GAME needs a start hold and stamps turnStartedAt', () => {
    expect(gameReducer(base(), { type: 'START_GAME', now: 5 }).error).toMatch(/start hold/);
    const s = run(base(), { type: 'TOGGLE_START', hold: hold(1) }, { type: 'START_GAME', now: 1234 });
    expect(s.phase).toBe('pick');
    expect(s.currentIdx).toBe(0);
    expect(s.turnStartedAt).toBe(1234);
  });
});

describe('pick / climb', () => {
  it('PREVIEW_HOLD sets pending; can change the preview', () => {
    let s = gameReducer(started(), { type: 'PREVIEW_HOLD', hold: hold(10) });
    expect(s.pendingId).toBe(10);
    s = gameReducer(s, { type: 'PREVIEW_HOLD', hold: hold(11) });
    expect(s.pendingId).toBe(11);
    expect(s.phase).toBe('pick');
  });

  it('rejects a hold already in the sequence (start or added)', () => {
    const s = started();
    expect(gameReducer(s, { type: 'PREVIEW_HOLD', hold: hold(1) }).error).toMatch(/Already/);
    const after = turn(s, 10, 'sent');
    expect(gameReducer(after, { type: 'PREVIEW_HOLD', hold: hold(10) }).error).toMatch(/Already/);
  });

  it('rejects screw-on / LED-less preview', () => {
    const s = started();
    expect(gameReducer(s, { type: 'PREVIEW_HOLD', hold: hold(9, { set_id: 20 }) }).error).toBeTruthy();
    expect(gameReducer(s, { type: 'PREVIEW_HOLD', hold: hold(9, { hasLed: false }) }).error).toBeTruthy();
  });

  it('CONFIRM_HOLD needs a preview, then moves to climb', () => {
    const s = started();
    const bad = gameReducer(s, { type: 'CONFIRM_HOLD' });
    expect(bad.phase).toBe('pick');
    expect(bad.error).toMatch(/Tap a hold/);
    const ok = run(s, { type: 'PREVIEW_HOLD', hold: hold(10) }, { type: 'CONFIRM_HOLD' });
    expect(ok.phase).toBe('climb');
    expect(ok.pendingId).toBe(10);
  });

  it('UNDO_PICK returns to pick without changing the turn or timer', () => {
    const s = run(started(), { type: 'PREVIEW_HOLD', hold: hold(10) }, { type: 'CONFIRM_HOLD' }, { type: 'UNDO_PICK' });
    expect(s.phase).toBe('pick');
    expect(s.currentIdx).toBe(0);
    expect(s.turnStartedAt).toBe(1000);
  });

  it('rejects out-of-phase actions with an error, never throws', () => {
    const s = started();
    expect(gameReducer(s, { type: 'DECLARE', outcome: 'sent', now: 1 }).error).toBeTruthy();
    expect(gameReducer(s, { type: 'UNDO_PICK' }).error).toBeTruthy();
    expect(gameReducer(s, { type: 'TOGGLE_START', hold: hold(3) }).error).toBeTruthy();
    expect(gameReducer(s, { type: 'REMATCH' }).error).toBeTruthy();
    expect(gameReducer(initialGameState(), { type: 'CONFIRM_HOLD' }).error).toBeTruthy();
  });

  it('a valid action clears a previous error', () => {
    const err = gameReducer(started(), { type: 'CONFIRM_HOLD' });
    expect(err.error).not.toBeNull();
    expect(gameReducer(err, { type: 'PREVIEW_HOLD', hold: hold(10) }).error).toBeNull();
    expect(gameReducer(err, { type: 'CLEAR_ERROR' }).error).toBeNull();
  });
});

describe('DECLARE', () => {
  it('SENT keeps the hold, scores +1, passes the turn and resets the timer', () => {
    const s = turn(started(), 10, 'sent', 9000);
    expect(addedHolds(s)).toEqual([10]);
    expect(sequence(s)).toEqual([1, 10]);
    expect(scores(s)[0].score).toBe(1);
    expect(s.currentIdx).toBe(1);
    expect(s.phase).toBe('pick');
    expect(s.pendingId).toBeNull();
    expect(s.turnStartedAt).toBe(9000);
  });

  it('FELL discards the hold and the next player starts from the same sequence', () => {
    const s0 = turn(started(['A', 'B', 'C'], 2), 10, 'sent', 2000); // A sends 10
    const s1 = turn(s0, 11, 'fell', 3000); // B falls on 11
    expect(sequence(s1)).toEqual([1, 10]);
    expect(addedHolds(s1)).not.toContain(11);
    expect(livesLeft(s1, 1)).toBe(1);
    expect(s1.currentIdx).toBe(2);
    expect(s1.turnStartedAt).toBe(3000);
    // The discarded hold can be picked again.
    expect(gameReducer(s1, { type: 'PREVIEW_HOLD', hold: hold(11) }).error).toBeNull();
  });

  it('1 life: a fall eliminates; last standing wins → over', () => {
    const s = turn(started(['A', 'B']), 10, 'fell');
    expect(livesLeft(s, 0)).toBe(0);
    expect(s.phase).toBe('over');
    expect(s.turnStartedAt).toBeNull();
    expect(winner(s)).toBe(1);
  });

  it('eliminated players are skipped in the rotation', () => {
    let s = started(['A', 'B', 'C']);
    s = turn(s, 10, 'sent'); // A
    s = turn(s, 11, 'fell'); // B out
    expect(activePlayers(s)).toEqual([0, 2]);
    expect(s.currentIdx).toBe(2);
    s = turn(s, 12, 'sent'); // C
    expect(s.currentIdx).toBe(0); // wraps past B
    s = turn(s, 13, 'sent'); // A
    expect(s.currentIdx).toBe(2);
  });

  it('3 lives ("Easy") survives two falls', () => {
    let s = started(['A', 'B'], 3);
    s = turn(s, 10, 'fell'); // A
    s = turn(s, 10, 'sent'); // B
    s = turn(s, 11, 'fell'); // A
    expect(livesLeft(s, 0)).toBe(1);
    expect(s.phase).toBe('pick');
    s = turn(s, 11, 'sent'); // B
    s = turn(s, 12, 'fell'); // A out
    expect(s.phase).toBe('over');
    expect(winner(s)).toBe(1);
  });
});

describe('UNDO_LAST_TURN', () => {
  it('restores the previous turn in climb with the same hold pending', () => {
    let s = turn(started(), 10, 'sent', 2000);
    s = gameReducer(s, { type: 'UNDO_LAST_TURN', now: 7000 });
    expect(s.phase).toBe('climb');
    expect(s.currentIdx).toBe(0);
    expect(s.pendingId).toBe(10);
    expect(s.turns).toEqual([]);
    expect(s.turnStartedAt).toBe(7000);
  });

  it('works from over and revives the eliminated player', () => {
    const over = turn(started(), 10, 'fell');
    expect(over.phase).toBe('over');
    const s = gameReducer(over, { type: 'UNDO_LAST_TURN', now: 1 });
    expect(s.phase).toBe('climb');
    expect(livesLeft(s, 0)).toBe(1);
  });

  it('errors when there is nothing to undo', () => {
    expect(gameReducer(started(), { type: 'UNDO_LAST_TURN', now: 1 }).error).toMatch(/Nothing/);
    expect(gameReducer(initialGameState(), { type: 'UNDO_LAST_TURN', now: 1 }).error).toBeTruthy();
  });
});

describe('REMOVE_PLAYER / END_GAME / REMATCH / RESET', () => {
  it('removing the current player passes the turn and resets the timer', () => {
    const s = gameReducer(started(['A', 'B', 'C']), { type: 'REMOVE_PLAYER', playerIdx: 0, now: 4000 });
    expect(s.currentIdx).toBe(1);
    expect(s.turnStartedAt).toBe(4000);
    expect(activePlayers(s)).toEqual([1, 2]);
  });

  it('removing another player keeps the turn; down to one ends the game', () => {
    let s = gameReducer(started(['A', 'B', 'C']), { type: 'REMOVE_PLAYER', playerIdx: 2, now: 4000 });
    expect(s.currentIdx).toBe(0);
    expect(s.turnStartedAt).toBe(1000);
    s = gameReducer(s, { type: 'REMOVE_PLAYER', playerIdx: 1, now: 5000 });
    expect(s.phase).toBe('over');
    expect(winner(s)).toBe(0);
  });

  it('rejects removing an unknown or already-out player', () => {
    const s = gameReducer(started(), { type: 'REMOVE_PLAYER', playerIdx: 9, now: 1 });
    expect(s.error).toBeTruthy();
  });

  it('END_GAME → best score wins, tie-break longest chain, else draw', () => {
    let s = started(['A', 'B'], 3);
    s = turn(s, 10, 'sent'); // A chain 2
    s = turn(s, 11, 'sent'); // B chain 3
    let over = gameReducer(s, { type: 'END_GAME' });
    expect(over.phase).toBe('over');
    // Same score (1 each) → B wins on longest chain (3 > 2).
    expect(winner(over)).toBe(1);
    s = turn(s, 12, 'sent'); // A score 2
    over = gameReducer(s, { type: 'END_GAME' });
    expect(winner(over)).toBe(0);
    expect(longestChain(over)).toEqual({ length: 4, playerIdx: 0 });
    // No turns at all → draw.
    expect(winner(gameReducer(started(), { type: 'END_GAME' }))).toBeNull();
  });

  it('REMATCH keeps players + lives and returns to pickStarts', () => {
    const over = turn(started(['A', 'B'], 1), 10, 'fell');
    const s = gameReducer(over, { type: 'REMATCH' });
    expect(s.phase).toBe('pickStarts');
    expect(s.players).toEqual(['A', 'B']);
    expect(s.turns).toEqual([]);
    expect(s.starts).toEqual([]);
  });

  it('RESET returns to setup keeping the names', () => {
    const s = gameReducer(started(), { type: 'RESET' });
    expect(s.phase).toBe('setup');
    expect(s.players).toEqual(['Dani', 'Marco']);
  });
});

describe('scores + save mapping', () => {
  it('computeScores derives score / falls / longest chain', () => {
    const sc = computeScores(
      [
        { playerIdx: 0, holdId: 10, outcome: 'sent' },
        { playerIdx: 1, holdId: 11, outcome: 'fell' },
        { playerIdx: 1, holdId: 12, outcome: 'sent' },
      ],
      2,
      2,
    );
    expect(sc[0]).toEqual({ score: 1, sent: 1, fell: 0, longestChain: 3 });
    expect(sc[1]).toEqual({ score: 1, sent: 1, fell: 1, longestChain: 4 });
  });

  it('toProblemHolds maps starts r12, added r13, last r14', () => {
    const holds = toProblemHolds([1], [10, 11, 12]);
    expect(draftToFrames(holds)).toBe('p1r12p10r13p11r13p12r14');
    expect(validateDraft(holds).valid).toBe(true);
  });

  it('"Last 2" makes the last two holds finishes', () => {
    const holds = toProblemHolds([1, 2], [10, 11], 2);
    expect(draftToFrames(holds)).toBe('p1r12p2r12p10r14p11r14');
    expect(validateDraft(holds).valid).toBe(true);
  });

  it('too short a game fails validation', () => {
    expect(validateDraft(toProblemHolds([1], [10])).valid).toBe(false);
    expect(validateDraft(toProblemHolds([1], [])).valid).toBe(false);
  });

  it('problemName', () => {
    expect(problemName(['Dani', 'Marco'])).toBe('Add-On · Dani vs Marco');
    expect(problemName(['A', 'B', 'C'])).toBe('Add-On · 3 players');
    expect(problemName(['x'.repeat(40), 'y'.repeat(40)]).length).toBeLessThanOrEqual(60);
  });
});

describe('formatElapsed', () => {
  it('counts up as m:ss and clamps negatives', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(9_999)).toBe('0:09');
    expect(formatElapsed(75_000)).toBe('1:15');
    expect(formatElapsed(-5)).toBe('0:00');
  });
});

// ---- GAME-002 feet mode ------------------------------------------------------

/** Feet-mode game in `pick`: start hands 1+2, start foot 3 (screw-on). */
function startedFeet(names = ['Dani', 'Marco'], lives = 2): GameState {
  return run(
    initialGameState(),
    { type: 'START_PICKING_STARTS', names, lives, feet: true },
    { type: 'TOGGLE_START', hold: hold(1) },
    { type: 'TOGGLE_START', hold: hold(2) },
    { type: 'TOGGLE_START_FOOT', hold: hold(3, { set_id: 20 }) },
    { type: 'START_GAME', now: 1000 },
  );
}

/** One feet-mode turn: hand `id`, optional foot, confirm, declare. */
function feetTurn(
  state: GameState,
  id: number,
  foot: number | null,
  outcome: 'sent' | 'fell',
  now = 2000,
): GameState {
  const actions: GameAction[] = [{ type: 'PREVIEW_HOLD', hold: hold(id) }];
  if (foot !== null) actions.push({ type: 'PREVIEW_FOOT', hold: hold(foot, { set_id: 20 }) });
  actions.push({ type: 'CONFIRM_HOLD' }, { type: 'DECLARE', outcome, now });
  return run(state, ...actions);
}

describe('feet mode — setup and starts', () => {
  it('defaults OFF; START_PICKING_STARTS persists the option', () => {
    expect(initialGameState().feet).toBe(false);
    const s = gameReducer(initialGameState(), {
      type: 'START_PICKING_STARTS',
      names: ['A', 'B'],
      lives: 1,
      feet: true,
    });
    expect(s.feet).toBe(true);
    expect(s.startFoot).toBeNull();
  });

  it('requires exactly 2 start hands + 1 start foot', () => {
    let s = run(initialGameState(), {
      type: 'START_PICKING_STARTS',
      names: ['A', 'B'],
      lives: 1,
      feet: true,
    });
    s = run(s, { type: 'TOGGLE_START', hold: hold(1) });
    expect(gameReducer(s, { type: 'START_GAME', now: 1 }).error).toBe('Pick 2 start holds');
    s = run(s, { type: 'TOGGLE_START', hold: hold(2) });
    expect(startsComplete(s)).toBe(false);
    expect(gameReducer(s, { type: 'START_GAME', now: 1 }).error).toBe('Pick 1 start foot');
    // Third hand is rejected in feet mode (exactly 2).
    expect(gameReducer(s, { type: 'TOGGLE_START', hold: hold(9) }).error).toBe('Max 2 start holds');
    s = run(s, { type: 'TOGGLE_START_FOOT', hold: hold(3, { set_id: 20 }) });
    expect(startsComplete(s)).toBe(true);
    const g = gameReducer(s, { type: 'START_GAME', now: 1 });
    expect(g.phase).toBe('pick');
    expect(g.starts).toEqual([1, 2]);
    expect(g.startFoot).toBe(3);
  });

  it('start foot: screw-ons allowed, tap again clears, new tap replaces, no hand overlap', () => {
    let s = run(
      initialGameState(),
      { type: 'START_PICKING_STARTS', names: ['A', 'B'], lives: 1, feet: true },
      { type: 'TOGGLE_START', hold: hold(1) },
    );
    s = run(s, { type: 'TOGGLE_START_FOOT', hold: hold(3, { set_id: 20 }) });
    expect(s.startFoot).toBe(3);
    s = run(s, { type: 'TOGGLE_START_FOOT', hold: hold(4) });
    expect(s.startFoot).toBe(4);
    s = run(s, { type: 'TOGGLE_START_FOOT', hold: hold(4) });
    expect(s.startFoot).toBeNull();
    expect(gameReducer(s, { type: 'TOGGLE_START_FOOT', hold: hold(1) }).error).toBe(
      'Already a start hold',
    );
    expect(gameReducer(s, { type: 'TOGGLE_START_FOOT', hold: hold(5, { hasLed: false }) }).error).toMatch(
      /no LED/,
    );
    s = run(s, { type: 'TOGGLE_START_FOOT', hold: hold(3) });
    expect(gameReducer(s, { type: 'TOGGLE_START', hold: hold(3) }).error).toBe('Already the start foot');
  });

  it('feet actions are rejected when feet mode is OFF', () => {
    const pick = run(
      initialGameState(),
      { type: 'START_PICKING_STARTS', names: ['A', 'B'], lives: 1 },
    );
    expect(gameReducer(pick, { type: 'TOGGLE_START_FOOT', hold: hold(3) }).error).toBe(
      'Not available right now',
    );
    const s = started();
    expect(gameReducer(s, { type: 'PREVIEW_FOOT', hold: hold(3) }).error).toBe(
      'Not available right now',
    );
  });
});

describe('feet mode — turns', () => {
  it('a turn may add one optional foot; SENT keeps hand + foot', () => {
    let s = startedFeet();
    s = feetTurn(s, 10, 11, 'sent');
    expect(s.turns[0]).toEqual({ playerIdx: 0, holdId: 10, footId: 11, outcome: 'sent' });
    expect(sequence(s)).toEqual([1, 2, 10]);
    expect(feetHolds(s)).toEqual([3, 11]);
    expect(s.pendingFootId).toBeNull();
    // Foot is optional.
    s = feetTurn(s, 12, null, 'sent');
    expect(s.turns[1].footId).toBeNull();
    expect(feetHolds(s)).toEqual([3, 11]);
    expect(sequence(s)).toEqual([1, 2, 10, 12]);
  });

  it('FELL discards both the hand and the foot and costs a life', () => {
    let s = startedFeet();
    s = feetTurn(s, 10, 11, 'fell');
    expect(sequence(s)).toEqual([1, 2]);
    expect(feetHolds(s)).toEqual([3]);
    expect(livesLeft(s, 0)).toBe(1);
    // Discarded holds are free again.
    expect(gameReducer(s, { type: 'PREVIEW_FOOT', hold: hold(11) }).error).toBeNull();
    expect(gameReducer(s, { type: 'PREVIEW_HOLD', hold: hold(10) }).error).toBeNull();
  });

  it('PREVIEW_FOOT toggles, rejects used holds and the pending hand; CLEAR_FOOT clears', () => {
    let s = feetTurn(startedFeet(), 10, 11, 'sent');
    s = run(s, { type: 'PREVIEW_HOLD', hold: hold(20) });
    expect(gameReducer(s, { type: 'PREVIEW_FOOT', hold: hold(20) }).error).toBe(
      'Already picked as the hand hold',
    );
    expect(gameReducer(s, { type: 'PREVIEW_FOOT', hold: hold(11) }).error).toBe(
      'Already in the sequence',
    );
    expect(gameReducer(s, { type: 'PREVIEW_FOOT', hold: hold(3) }).error).toBe(
      'Already in the sequence',
    );
    expect(gameReducer(s, { type: 'PREVIEW_FOOT', hold: hold(10) }).error).toBe(
      'Already in the sequence',
    );
    s = run(s, { type: 'PREVIEW_FOOT', hold: hold(21, { set_id: 20 }) });
    expect(s.pendingFootId).toBe(21);
    // A hand can't land on the pending foot, nor on a used foot.
    expect(gameReducer(s, { type: 'PREVIEW_HOLD', hold: hold(21) }).error).toBe(
      'Already picked as the foot',
    );
    expect(gameReducer(s, { type: 'PREVIEW_HOLD', hold: hold(11) }).error).toBe(
      'Already in the sequence',
    );
    s = run(s, { type: 'PREVIEW_FOOT', hold: hold(22) });
    expect(s.pendingFootId).toBe(22);
    s = run(s, { type: 'PREVIEW_FOOT', hold: hold(22) });
    expect(s.pendingFootId).toBeNull();
    s = run(s, { type: 'PREVIEW_FOOT', hold: hold(22) }, { type: 'CLEAR_FOOT' });
    expect(s.pendingFootId).toBeNull();
  });

  it('UNDO_PICK keeps the pending foot; CONFIRM needs the hand, not the foot', () => {
    let s = run(startedFeet(), { type: 'PREVIEW_FOOT', hold: hold(11) });
    expect(gameReducer(s, { type: 'CONFIRM_HOLD' }).error).toBe('Tap a hold first');
    s = run(s, { type: 'PREVIEW_HOLD', hold: hold(10) }, { type: 'CONFIRM_HOLD' });
    expect(s.phase).toBe('climb');
    s = run(s, { type: 'UNDO_PICK' });
    expect(s.phase).toBe('pick');
    expect(s.pendingId).toBe(10);
    expect(s.pendingFootId).toBe(11);
  });

  it('UNDO_LAST_TURN removes the foot from the sequence and restores it as pending', () => {
    let s = feetTurn(startedFeet(), 10, 11, 'sent');
    s = gameReducer(s, { type: 'UNDO_LAST_TURN', now: 5000 });
    expect(s.phase).toBe('climb');
    expect(s.pendingId).toBe(10);
    expect(s.pendingFootId).toBe(11);
    expect(feetHolds(s)).toEqual([3]);
    // Undo a foot-less turn → no pending foot.
    s = feetTurn(startedFeet(), 10, null, 'sent');
    s = gameReducer(s, { type: 'UNDO_LAST_TURN', now: 5000 });
    expect(s.pendingFootId).toBeNull();
  });

  it('REMATCH / RESET keep feet mode on', () => {
    const over = run(feetTurn(startedFeet(['A', 'B'], 1), 10, 11, 'fell'));
    expect(over.phase).toBe('over');
    const r = gameReducer(over, { type: 'REMATCH' });
    expect(r.feet).toBe(true);
    expect(r.startFoot).toBeNull();
    expect(gameReducer(over, { type: 'RESET' }).feet).toBe(true);
  });

  it('feet OFF: turns carry no footId (GAME-001 shape unchanged)', () => {
    const s = turn(started(), 10, 'sent');
    expect(s.turns[0]).toEqual({ playerIdx: 0, holdId: 10, outcome: 'sent' });
    expect(feetHolds(s)).toEqual([]);
    expect(s.pendingFootId).toBeNull();
  });
});

describe('feet mode — save as My Problem', () => {
  it('feet map to r15; starts r12; hands r13; finish only on hand holds', () => {
    let s = startedFeet();
    s = feetTurn(s, 10, 11, 'sent');
    s = feetTurn(s, 12, 13, 'fell'); // discarded
    s = feetTurn(s, 14, null, 'sent');
    const holds = toProblemHolds(s.starts, addedHolds(s), 1, feetHolds(s));
    expect(draftToFrames(holds)).toBe('p1r12p2r12p10r13p14r14p3r15p11r15');
    expect(validateDraft(holds).valid).toBe(true);
    const two = toProblemHolds(s.starts, addedHolds(s), 2, feetHolds(s));
    expect(draftToFrames(two)).toBe('p1r12p2r12p10r14p14r14p3r15p11r15');
    expect(validateDraft(two).valid).toBe(true);
  });

  it('feet never count as finish: 2 starts + foot with no hand added is invalid', () => {
    const holds = toProblemHolds([1, 2], [], 1, [3, 4]);
    expect(validateDraft(holds).valid).toBe(false);
    expect(validateDraft(holds).errors).toContain('Add a finish hold');
  });
});
