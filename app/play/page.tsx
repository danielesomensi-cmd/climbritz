'use client';

// GAME-001 — Add-On: the classic "add a hold" board game, 2–6 players on one
// phone. Turn: tap the next hold → Confirm → climb the whole sequence + the
// new hold → the partner on the ground taps SENT or FELL.
//
// - No AuthGuard: the game is playable signed-out and without a board; login
//   is only needed for "Save as My Problem".
// - Pure rules live in game-state.ts; BLE frames in led-commands.ts; tap
//   snapping in hold-pick.ts (BoardMap stays untouched); persistence in
//   game-storage.ts (6h TTL, resume prompt).
// - BLE: useBle().sendLEDs directly, 300ms debounce + latest-only generation
//   counter (sendLEDs does not coalesce). Never connect/disconnect on our own.
// - Timer: informative only, small and muted; counts up from turnStartedAt.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/clerk-react';
import BoardMap, { type Placement } from '@/components/BoardMap';
import BottomNav from '@/components/BottomNav';
import { useBle } from '@/components/BleProvider';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import PageHeader from '@/components/ui/PageHeader';
import StatusDot from '@/components/ui/StatusDot';
import { PRESSABLE_CLASSES } from '@/components/ui/pressable';
import { PLACEMENT_ROLES, type EncoderHold } from '@/lib/ble/kilter-protocol';
import { BUSY_STATUSES, STATUS_LABELS } from '@/lib/ble/status';
import { haptic } from '@/lib/feedback/haptics';
import { allowSleep, keepAwake } from '@/lib/feedback/keep-awake';
import { isSoundEnabled, playCue, setSoundEnabled, unlockAudio } from '@/lib/feedback/sound';
import { ApiError, saveMyClimb } from '@/app/lib/api';
import { ANGLES, DEFAULT_ANGLE } from '@/app/lib/angles';
import placementsData from '@/app/data/placements_12x12.json';
import { saveCreateDraft } from '../create/draft-storage';
import { draftToFrames, MAX_START, validateDraft } from '../create/editor-state';
import {
  activePlayers,
  addedHolds,
  DEFAULT_LIVES,
  formatElapsed,
  gameReducer,
  initialGameState,
  livesLeft,
  longestChain,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MIN_PLAYERS,
  problemName,
  scores,
  toProblemHolds,
  validatePlayerNames,
  winner,
  type GameAction,
  type GameState,
  type HoldInfo,
} from './game-state';
import { clearGame, loadGame, loadPrefs, saveGame, savePrefs } from './game-storage';
import { blinkFrames, finalLedCommands, hasLed, sequenceToLedCommands } from './led-commands';
import { nearestHold, pointToPct } from './hold-pick';

const PLACEMENTS = placementsData as Placement[];
const SET_SCREW_ONS = 20;
const BLE_DEBOUNCE_MS = 300;
const BLINK_INTERVAL_MS = 220;
const ERROR_VISIBLE_MS = 2500;
// SENT/FELL replace the Confirm button in the same spot: ignore a declare
// that lands right after Confirm (double tap / laggy tap) so nobody gets an
// accidental SENT or FELL.
const DECLARE_GUARD_MS = 500;

// UI-only player colors (never sent to the wall — see led-commands.ts).
const PLAYER_COLORS = ['#ff6b35', '#38bdf8', '#a3e635', '#f472b6', '#facc15', '#c084fc'];

const COLOR_START = `#${PLACEMENT_ROLES[12]}`;
const COLOR_MIDDLE = `#${PLACEMENT_ROLES[13]}`;
const COLOR_FINISH = `#${PLACEMENT_ROLES[14]}`;
const COLOR_NEW = '#ffffff';

const LIVES_CHOICES: Array<{ value: number; label: string }> = [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3 · Easy' },
];

function isPickable(p: Placement): boolean {
  return p.set_id !== SET_SCREW_ONS && hasLed(p.placement_id);
}

function toHoldInfo(p: Placement): HoldInfo {
  return { placement_id: p.placement_id, set_id: p.set_id, hasLed: hasLed(p.placement_id) };
}

function playerColor(i: number): string {
  return PLAYER_COLORS[i % PLAYER_COLORS.length];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- small pieces -----------------------------------------------------------

function SoundToggle() {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(isSoundEnabled()), []);
  return (
    <button
      type="button"
      data-testid="play-sound-toggle"
      aria-pressed={on}
      aria-label={on ? 'Sound on — tap to mute' : 'Sound off — tap to turn on'}
      onClick={() => {
        const next = !on;
        setSoundEnabled(next);
        setOn(next);
        if (next) {
          unlockAudio();
          playCue('tick');
        }
      }}
      className={`flex h-11 w-11 items-center justify-center rounded-full text-xl ${PRESSABLE_CLASSES} ${
        on ? 'bg-orange-500/15 text-orange-300' : 'text-zinc-500 hover:bg-zinc-800'
      }`}
    >
      <span aria-hidden>{on ? '🔊' : '🔇'}</span>
    </button>
  );
}

/** Informative, discreet turn timer: counts up from 0:00, no alarms. */
function TurnTimer({ startedAt }: { startedAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (startedAt === null) return null;
  return (
    <span data-testid="play-turn-timer" className="text-xs tabular-nums text-zinc-500">
      ⏱ {formatElapsed(now - startedAt)}
    </span>
  );
}

function BleChip() {
  const { status, connect, isCapacitorNative } = useBle();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Web: the game works on screen only — no board chip.
  if (!mounted || !isCapacitorNative) return null;
  const canConnect = status === 'idle' || status === 'error';
  const busy = BUSY_STATUSES.includes(status);
  return (
    <button
      type="button"
      data-testid="play-ble-chip"
      // Manual tap only — never auto-connect (gym etiquette).
      onClick={canConnect ? () => void connect() : undefined}
      disabled={busy}
      className={`flex min-h-[44px] items-center gap-1.5 rounded-pill border border-border-strong px-3 text-xs text-zinc-300 ${PRESSABLE_CLASSES}`}
    >
      <StatusDot status={status} className="!w-2.5 !h-2.5" />
      {canConnect ? 'Board · tap to connect' : STATUS_LABELS[status]}
    </button>
  );
}

/** Board + transparent tap overlay that snaps to the nearest pickable hold. */
function PickBoard({
  holdColors,
  onPick,
}: {
  holdColors: Record<number, string>;
  onPick?: (p: Placement) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="relative">
      <BoardMap placements={PLACEMENTS} holdColors={holdColors} />
      {onPick && (
        <div
          ref={ref}
          data-testid="play-board-overlay"
          className="absolute inset-0 z-10 cursor-pointer touch-manipulation"
          onClick={(e) => {
            const rect = ref.current?.getBoundingClientRect();
            if (!rect) return;
            const pct = pointToPct(e.clientX, e.clientY, rect);
            if (!pct) return;
            const hit = nearestHold(pct.xPct, pct.yPct, PLACEMENTS, undefined, isPickable);
            if (hit) onPick(hit);
          }}
        />
      )}
    </div>
  );
}

// ---- page -------------------------------------------------------------------

export default function PlayPage() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { status, sendLEDs, sendAllOffLEDs } = useBle();
  const isConnected = status === 'connected' || status === 'sending';

  const [game, setGame] = useState<GameState>(() => initialGameState());
  const [hydrated, setHydrated] = useState(false);
  const [resumable, setResumable] = useState<GameState | null>(null);

  // Setup form
  const [names, setNames] = useState<string[]>(['', '']);
  const [lives, setLives] = useState<number>(DEFAULT_LIVES);

  // Overflow menu + result flash + save
  const [menuOpen, setMenuOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [finishCount, setFinishCount] = useState<1 | 2>(1);
  const [angle, setAngle] = useState<number>(DEFAULT_ANGLE);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedUuid, setSavedUuid] = useState<string | null>(null);

  // Hydrate from storage after mount (static export → no storage at render).
  useEffect(() => {
    const prefs = loadPrefs();
    if (prefs) {
      const prefill = prefs.names.slice(0, MAX_PLAYERS);
      while (prefill.length < MIN_PLAYERS) prefill.push('');
      setNames(prefill);
      if ([1, 2, 3].includes(prefs.lives)) setLives(prefs.lives);
    }
    const saved = loadGame();
    if (saved && saved.phase !== 'setup') setResumable(saved);
    setHydrated(true);
  }, []);

  // Persist every change once hydrated (and not while the resume prompt is up).
  useEffect(() => {
    if (!hydrated || resumable) return;
    if (game.phase === 'setup') clearGame();
    else saveGame(game);
  }, [game, hydrated, resumable]);

  // Transient error banner.
  useEffect(() => {
    if (!game.error) return;
    const t = setTimeout(() => setGame((g) => gameReducer(g, { type: 'CLEAR_ERROR' })), ERROR_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [game.error]);

  // Keep the screen on only while a game is being played.
  const inGame = game.phase === 'pickStarts' || game.phase === 'pick' || game.phase === 'climb';
  useEffect(() => {
    if (!inGame) return;
    void keepAwake();
    return () => {
      void allowSleep();
    };
  }, [inGame]);

  useEffect(() => {
    if (!lastResult) return;
    const t = setTimeout(() => setLastResult(null), 1500);
    return () => clearTimeout(t);
  }, [lastResult]);

  const act = useCallback(
    (action: GameAction): GameState => {
      const next = gameReducer(game, action);
      setGame(next);
      if (next.error && next.error !== game.error) void haptic('error');
      return next;
    },
    [game],
  );

  // ---- derived ----
  const added = useMemo(() => addedHolds(game), [game]);
  const playerScores = useMemo(() => scores(game), [game]);
  const current = game.players[game.currentIdx] ?? '';

  const holdColors = useMemo(() => {
    const colors: Record<number, string> = {};
    for (const id of game.starts) colors[id] = COLOR_START;
    added.forEach((id, i) => {
      const isFinish = game.phase === 'over' && i >= added.length - Math.min(finishCount, added.length);
      colors[id] = isFinish ? COLOR_FINISH : COLOR_MIDDLE;
    });
    if (game.pendingId !== null && (game.phase === 'pick' || game.phase === 'climb')) {
      colors[game.pendingId] = COLOR_NEW;
    }
    return colors;
  }, [game.starts, game.pendingId, game.phase, added, finishCount]);

  // ---- BLE: debounced, latest-only ----
  const frame: EncoderHold[] | null = useMemo(() => {
    switch (game.phase) {
      case 'pickStarts':
        return sequenceToLedCommands(game.starts, []);
      case 'pick':
      case 'climb':
        return sequenceToLedCommands(game.starts, added, game.pendingId);
      case 'over':
        return finalLedCommands(game.starts, added, finishCount);
      default:
        return null;
    }
  }, [game.phase, game.starts, game.pendingId, added, finishCount]);
  const frameKey = frame ? `${game.phase}|${JSON.stringify(frame)}` : '';

  const genRef = useRef(0);
  const effectRef = useRef<'blink' | 'fell' | null>(null);
  const gameRef = useRef(game);
  gameRef.current = game;
  const frameRef = useRef(frame);
  frameRef.current = frame;

  useEffect(() => {
    const f = frameRef.current;
    if (!isConnected || !f) {
      // Nothing will be sent for this frame: drop a pending blink/fell effect
      // so it doesn't fire later on an unrelated frame (e.g. after connect).
      effectRef.current = null;
      return;
    }
    const gen = ++genRef.current;
    const timer = setTimeout(async () => {
      const effect = effectRef.current;
      effectRef.current = null;
      const g = gameRef.current;
      let steps: Array<EncoderHold[] | 'off'> = [f];
      if (effect === 'blink' && g.pendingId !== null) {
        steps = blinkFrames(g.starts, addedHolds(g), g.pendingId);
      } else if (effect === 'fell') {
        steps = ['off', f];
      }
      for (let i = 0; i < steps.length; i++) {
        if (genRef.current !== gen) return; // a newer frame superseded us
        const step = steps[i];
        if (step === 'off' || step.length === 0) await sendAllOffLEDs();
        else await sendLEDs(step);
        if (i < steps.length - 1) await sleep(BLINK_INTERVAL_MS);
      }
    }, BLE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [frameKey, isConnected, sendLEDs, sendAllOffLEDs]);

  const turnOffBoard = () => {
    genRef.current++;
    void sendAllOffLEDs();
  };

  // ---- handlers ----
  const namesCheck = validatePlayerNames(names);

  const startSetup = () => {
    unlockAudio();
    const trimmed = names.map((n) => n.trim());
    savePrefs({ names: trimmed, lives });
    setSavedUuid(null);
    setSaveError(null);
    act({ type: 'START_PICKING_STARTS', names: trimmed, lives });
  };

  const startGame = () => {
    unlockAudio();
    const next = act({ type: 'START_GAME', now: Date.now() });
    if (!next.error) {
      void haptic('medium');
      playCue('turn');
    }
  };

  const onPickStart = (p: Placement) => {
    const next = act({ type: 'TOGGLE_START', hold: toHoldInfo(p) });
    if (!next.error) void haptic('light');
  };

  const onPreview = (p: Placement) => {
    const next = act({ type: 'PREVIEW_HOLD', hold: toHoldInfo(p) });
    if (!next.error) void haptic('light');
  };

  const confirmedAtRef = useRef(0);

  const confirmHold = () => {
    const next = act({ type: 'CONFIRM_HOLD' });
    if (!next.error) {
      confirmedAtRef.current = Date.now();
      effectRef.current = 'blink';
      void haptic('light');
    }
  };

  const declare = (outcome: 'sent' | 'fell') => {
    if (Date.now() - confirmedAtRef.current < DECLARE_GUARD_MS) return;
    const who = current;
    const next = act({ type: 'DECLARE', outcome, now: Date.now() });
    if (next.error) return;
    if (outcome === 'fell') effectRef.current = 'fell';
    setMenuOpen(false);
    if (outcome === 'sent') {
      void haptic('success');
      playCue('sent');
      setLastResult(`${who} sent it · +1`);
    } else {
      void haptic('error');
      playCue('fell');
      const out = livesLeft(next, game.currentIdx) === 0;
      setLastResult(out ? `${who} is out` : `${who} fell · hold discarded`);
    }
    if (next.phase === 'over') {
      setTimeout(() => playCue('winner'), 450);
    } else {
      setTimeout(() => playCue('turn'), 600);
    }
  };

  const undoLastTurn = () => {
    setMenuOpen(false);
    setSavedUuid(null);
    act({ type: 'UNDO_LAST_TURN', now: Date.now() });
  };

  const removePlayer = (idx: number) => {
    setRemoveOpen(false);
    setMenuOpen(false);
    act({ type: 'REMOVE_PLAYER', playerIdx: idx, now: Date.now() });
  };

  const endGame = () => {
    setMenuOpen(false);
    const next = act({ type: 'END_GAME' });
    if (!next.error) playCue('winner');
  };

  const newGame = () => {
    setMenuOpen(false);
    setSavedUuid(null);
    act({ type: 'RESET' });
    setNames(game.players.length >= MIN_PLAYERS ? [...game.players] : names);
    setLives(game.lives);
  };

  const rematch = () => {
    setSavedUuid(null);
    setSaveError(null);
    act({ type: 'REMATCH' });
  };

  // ---- save as My Problem ----
  const problemHolds = useMemo(
    () => toProblemHolds(game.starts, added, finishCount),
    [game.starts, added, finishCount],
  );
  const problemValidation = validateDraft(problemHolds);

  const saveProblem = async () => {
    if (!problemValidation.valid || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await saveMyClimb({
        frames: draftToFrames(problemHolds),
        angle,
        name: problemName(game.players),
      });
      setSavedUuid(saved.uuid);
      void haptic('success');
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : 'Save failed — try again');
    } finally {
      setSaving(false);
    }
  };

  const editProblem = () => {
    saveCreateDraft({
      mode: 'new',
      name: problemName(game.players),
      grade: null,
      angle,
      holds: problemHolds,
    });
    router.push('/create');
  };

  // ---- render ----
  if (!hydrated) {
    return <div className="min-h-dvh bg-zinc-950" />;
  }

  if (resumable) {
    const who = resumable.players[resumable.currentIdx];
    const label =
      resumable.phase === 'over'
        ? 'Resume game · results'
        : resumable.phase === 'pickStarts'
          ? 'Resume game · pick start holds'
          : `Resume game · ${who}'s turn`;
    return (
      <div className="min-h-dvh bg-zinc-950 text-white pb-nav">
        <PageHeader back={{ href: '/', label: 'Home' }} title="Add-On" />
        <main className="max-w-2xl mx-auto px-4 py-6 space-y-3">
          <Card className="p-4 space-y-3">
            <p className="text-sm text-zinc-300">You have a game in progress.</p>
            <Button
              size="lg"
              className="w-full"
              data-testid="play-resume"
              onClick={() => {
                setGame({ ...resumable, error: null });
                setResumable(null);
                unlockAudio();
              }}
            >
              {label}
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              data-testid="play-new-game"
              onClick={() => {
                clearGame();
                setResumable(null);
              }}
            >
              New game
            </Button>
          </Card>
        </main>
        <BottomNav />
      </div>
    );
  }

  const errorBanner = game.error && (
    <p
      role="alert"
      data-testid="play-error"
      className="rounded-card bg-red-500/10 border border-red-500/40 px-3 py-2 text-sm text-red-300 text-center"
    >
      {game.error}
    </p>
  );

  // ---------------- SETUP ----------------
  if (game.phase === 'setup') {
    return (
      <div className="min-h-dvh bg-zinc-950 text-white pb-nav">
        <PageHeader
          back={{ href: '/', label: 'Home' }}
          title="Add-On"
          right={
            <div className="flex items-center gap-1">
              <BleChip />
              <SoundToggle />
            </div>
          }
        />
        <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
          <p className="text-sm text-zinc-400">
            Take turns adding one hold to a growing sequence. Climb it all, or lose a life.
          </p>

          <Card className="p-4 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Players</h2>
            {names.map((n, i) => (
              <div key={i} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: playerColor(i) }}
                />
                <input
                  data-testid={`play-name-${i}`}
                  value={n}
                  maxLength={MAX_NAME_LENGTH}
                  placeholder={`Player ${i + 1}`}
                  aria-label={`Player ${i + 1} name`}
                  onChange={(e) => {
                    const next = [...names];
                    next[i] = e.target.value;
                    setNames(next);
                  }}
                  className="flex-1 min-h-[48px] bg-zinc-800 border border-zinc-700 rounded px-3 text-base text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
                />
                {names.length > MIN_PLAYERS && (
                  <button
                    type="button"
                    aria-label={`Remove player ${i + 1}`}
                    onClick={() => setNames(names.filter((_, j) => j !== i))}
                    className={`flex h-11 w-11 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 ${PRESSABLE_CLASSES}`}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            {names.length < MAX_PLAYERS && (
              <Button
                variant="secondary"
                className="w-full"
                data-testid="play-add-player"
                onClick={() => setNames([...names, ''])}
              >
                + Add player
              </Button>
            )}
          </Card>

          <Card className="p-4 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Lives</h2>
            <div className="flex gap-2" role="group" aria-label="Lives per player">
              {LIVES_CHOICES.map((c) => (
                <Chip
                  key={c.value}
                  selected={lives === c.value}
                  data-testid={`play-lives-${c.value}`}
                  onClick={() => setLives(c.value)}
                  className="flex-1"
                >
                  {c.label}
                </Chip>
              ))}
            </div>
            <p className="text-xs text-zinc-500">
              Feet: any (honor rule). Fall and the hold you added is discarded.
            </p>
          </Card>

          {!namesCheck.valid && (
            <p data-testid="play-names-error" className="text-xs text-amber-400 text-center">
              {namesCheck.error}
            </p>
          )}
          {errorBanner}

          <Button
            size="lg"
            className="w-full"
            data-testid="play-pick-starts"
            disabled={!namesCheck.valid}
            onClick={startSetup}
          >
            Pick start holds →
          </Button>
        </main>
        <BottomNav />
      </div>
    );
  }

  // ---------------- PICK STARTS ----------------
  if (game.phase === 'pickStarts') {
    return (
      <div className="min-h-dvh bg-zinc-950 text-white pb-safe">
        <PageHeader
          title="Start holds"
          right={
            <div className="flex items-center gap-1">
              <BleChip />
              <SoundToggle />
            </div>
          }
        />
        <main className="max-w-2xl mx-auto px-4 py-3 space-y-3">
          <p className="text-sm text-zinc-400 text-center">
            Tap 1–{MAX_START} start holds ({game.starts.length} picked)
          </p>
          <PickBoard holdColors={holdColors} onPick={onPickStart} />
          {errorBanner}
          <Button
            size="lg"
            className="w-full min-h-[64px]"
            data-testid="play-start-game"
            disabled={game.starts.length === 0}
            onClick={startGame}
          >
            Start game
          </Button>
          <Button variant="ghost" className="w-full" onClick={newGame}>
            Back to setup
          </Button>
        </main>
      </div>
    );
  }

  // ---------------- GAME OVER ----------------
  if (game.phase === 'over') {
    const w = winner(game);
    const best = longestChain(game);
    const ranking = game.players
      .map((name, i) => ({ name, i, ...playerScores[i] }))
      .sort((a, b) => b.score - a.score || b.longestChain - a.longestChain);
    return (
      <div className="min-h-dvh bg-zinc-950 text-white pb-nav">
        <PageHeader back={{ href: '/', label: 'Home' }} title="Add-On" right={<SoundToggle />} />
        <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
          <h2 data-testid="play-winner" className="text-center text-2xl font-display font-bold text-orange-400">
            {w === null ? 'Draw!' : `🏆 ${game.players[w]} wins`}
          </h2>

          <Card className="p-4 space-y-1">
            {ranking.map((r) => (
              <div key={r.i} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: playerColor(r.i) }} />
                  {r.name}
                </span>
                <span className="tabular-nums text-zinc-300">
                  {r.score} pts · ✓{r.sent} ✗{r.fell}
                </span>
              </div>
            ))}
            {best && (
              <p className="pt-2 text-xs text-zinc-400">
                Longest chain: {best.length} ({game.players[best.playerIdx]})
              </p>
            )}
          </Card>

          <PickBoard holdColors={holdColors} />

          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 w-14">Finish</span>
              <Chip selected={finishCount === 1} onClick={() => setFinishCount(1)} data-testid="play-finish-1">
                Last hold
              </Chip>
              <Chip selected={finishCount === 2} onClick={() => setFinishCount(2)} data-testid="play-finish-2">
                Last 2 (match)
              </Chip>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="play-angle" className="text-xs text-zinc-400 w-14">
                Angle
              </label>
              <select
                id="play-angle"
                value={angle}
                onChange={(e) => setAngle(Number(e.target.value))}
                className="min-h-[44px] flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 text-base text-white"
              >
                {ANGLES.map((a) => (
                  <option key={a} value={a}>
                    {a}°
                  </option>
                ))}
              </select>
            </div>
            {!problemValidation.valid && (
              <ul data-testid="play-save-validation" className="text-xs text-amber-400 space-y-0.5">
                {problemValidation.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            {saveError && <p className="text-sm text-red-400">{saveError}</p>}
            {savedUuid ? (
              <Button
                variant="secondary"
                className="w-full"
                data-testid="play-view-saved"
                onClick={() => router.push(`/my-problems/detail?id=${savedUuid}`)}
              >
                Saved ✓ · View in My Problems
              </Button>
            ) : isSignedIn ? (
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  data-testid="play-save"
                  disabled={!problemValidation.valid}
                  loading={saving}
                  loadingLabel="Saving…"
                  onClick={saveProblem}
                >
                  Save as My Problem
                </Button>
                <Button
                  variant="secondary"
                  data-testid="play-edit"
                  disabled={!problemValidation.valid}
                  onClick={editProblem}
                >
                  Edit
                </Button>
              </div>
            ) : (
              <Button
                variant="secondary"
                className="w-full"
                data-testid="play-sign-in"
                onClick={() => router.push('/sign-in')}
              >
                Sign in to save
              </Button>
            )}
          </Card>

          <div className="space-y-2">
            <Button size="lg" className="w-full" data-testid="play-rematch" onClick={rematch}>
              Rematch
            </Button>
            <div className="flex gap-2">
              {isConnected && (
                <Button variant="secondary" className="flex-1" onClick={turnOffBoard}>
                  Turn off board
                </Button>
              )}
              <Button variant="secondary" className="flex-1" data-testid="play-undo-over" onClick={undoLastTurn}>
                Undo last turn
              </Button>
              <Button variant="secondary" className="flex-1" data-testid="play-done" onClick={newGame}>
                New game
              </Button>
            </div>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  // ---------------- PICK / CLIMB ----------------
  const color = playerColor(game.currentIdx);
  const active = activePlayers(game);
  const myLives = livesLeft(game, game.currentIdx);
  const chain = game.starts.length + added.length;

  return (
    <div className="min-h-dvh bg-zinc-950 text-white pb-safe">
      <header className="sticky top-0 z-20 bg-surface-base/95 backdrop-blur border-b border-border-default">
        <div className="max-w-2xl mx-auto px-4 pt-safe pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p
                data-testid="play-current-player"
                className="truncate font-display text-lg font-bold"
                style={{ color }}
              >
                {current}&apos;s turn
              </p>
              <p className="text-xs text-zinc-400">
                <span aria-label={`${myLives} lives left`}>{'♥'.repeat(myLives)}</span>
                {' · '}Chain {chain} · Score {playerScores[game.currentIdx]?.score ?? 0}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <BleChip />
              <SoundToggle />
              <div className="relative">
                <button
                  type="button"
                  data-testid="play-menu"
                  aria-label="Game menu"
                  aria-expanded={menuOpen}
                  onClick={() => {
                    setMenuOpen((o) => !o);
                    setRemoveOpen(false);
                  }}
                  className={`flex h-11 w-11 items-center justify-center rounded-full text-xl text-zinc-300 hover:bg-zinc-800 ${PRESSABLE_CLASSES}`}
                >
                  ⋯
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-12 z-30 w-56 rounded-card border border-border-strong bg-zinc-900 p-1 shadow-xl"
                  >
                    <MenuItem testid="play-menu-undo" disabled={game.turns.length === 0} onClick={undoLastTurn}>
                      Undo last turn
                    </MenuItem>
                    <MenuItem testid="play-menu-remove" onClick={() => setRemoveOpen((o) => !o)}>
                      Remove player…
                    </MenuItem>
                    {removeOpen &&
                      active.map((i) => (
                        <MenuItem key={i} testid={`play-remove-${i}`} onClick={() => removePlayer(i)}>
                          <span className="pl-4">✕ {game.players[i]}</span>
                        </MenuItem>
                      ))}
                    <MenuItem
                      testid="play-menu-rules"
                      onClick={() => {
                        setRulesOpen((o) => !o);
                        setMenuOpen(false);
                      }}
                    >
                      Rules
                    </MenuItem>
                    <MenuItem testid="play-menu-end" onClick={endGame}>
                      End game
                    </MenuItem>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Other players at a glance */}
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-zinc-500">
            {game.players.map((p, i) => {
              const out = !active.includes(i);
              return (
                <span key={i} className={out ? 'line-through opacity-60' : ''}>
                  <span style={{ color: playerColor(i) }}>●</span> {p} {playerScores[i]?.score ?? 0}
                  {!out && game.lives > 1 ? ` ${'♥'.repeat(livesLeft(game, i))}` : ''}
                </span>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-3 space-y-3">
        {rulesOpen && (
          <Card className="p-3 text-xs text-zinc-300 space-y-1" data-testid="play-rules">
            <p>Tap the next hold, confirm, then climb the whole sequence plus the new hold.</p>
            <p>Your partner taps SENT or FELL. Sent: +1 and the hold stays. Fell: the hold is discarded and you lose a life.</p>
            <p>Feet: any (honor rule). Last climber standing wins.</p>
            <button type="button" className="text-orange-400 min-h-[44px]" onClick={() => setRulesOpen(false)}>
              Close
            </button>
          </Card>
        )}

        {lastResult && (
          <p data-testid="play-last-result" className="text-center text-sm text-zinc-300">
            {lastResult}
          </p>
        )}

        <PickBoard holdColors={holdColors} onPick={game.phase === 'pick' ? onPreview : undefined} />

        <div className="flex items-center justify-between">
          <TurnTimer startedAt={game.turnStartedAt} />
          {game.phase === 'climb' && (
            <button
              type="button"
              data-testid="play-change-hold"
              onClick={() => act({ type: 'UNDO_PICK' })}
              className="min-h-[44px] px-2 text-sm text-zinc-400 hover:text-orange-400"
            >
              Change hold
            </button>
          )}
        </div>

        {errorBanner}

        {game.phase === 'pick' ? (
          <>
            <p className="text-center text-sm text-zinc-400">
              {game.pendingId === null ? 'Tap the hold you want to add' : 'Tap another hold to change it'}
            </p>
            <Button
              size="lg"
              className="w-full min-h-[64px] text-lg"
              data-testid="play-confirm"
              disabled={game.pendingId === null}
              onClick={confirmHold}
            >
              Confirm hold
            </Button>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              data-testid="play-sent"
              onClick={() => declare('sent')}
              className={`min-h-[120px] rounded-card bg-emerald-500 text-zinc-950 text-2xl font-bold ${PRESSABLE_CLASSES}`}
            >
              SENT ✓
            </button>
            <button
              type="button"
              data-testid="play-fell"
              onClick={() => declare('fell')}
              className={`min-h-[120px] rounded-card bg-red-500 text-zinc-950 text-2xl font-bold ${PRESSABLE_CLASSES}`}
            >
              FELL ✗
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  disabled,
  testid,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  testid?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      data-testid={testid}
      disabled={disabled}
      onClick={onClick}
      className="flex w-full min-h-[44px] items-center rounded px-3 text-left text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
