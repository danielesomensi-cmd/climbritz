'use client';

// A026 — AI Problem Generator (Remix v1). Set sensible Discovery filters
// (angle / grade range / moves), generate a remixed problem from the
// matching pool, render it on the board, and light it up over BLE. Ephemeral
// — nothing is saved; "Generate again" re-rolls. Capacitor-safe: query-param
// route (no dynamic segments), static data imported, AuthGuard-wrapped.

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  generateProblem,
  saveMyClimb,
  ApiError,
  type GenerateResponse,
  type HoldPosition,
  type MovesFilter,
} from '@/app/lib/api';
import { GRADES } from '@/app/lib/grades';
import AuthGuard from '@/components/AuthGuard';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import Button from '@/components/ui/Button';
import ClimbBoardView, { ROLE_COLORS } from '@/components/ClimbBoardView';
import ClimbBleControls from '@/components/ClimbBleControls';
import {
  climbToLedCommands,
  ROLE_STRING_TO_ID,
} from '../discover/detail/climb-to-leds';

const ANGLES = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70];
const DEFAULT_ANGLE = 40;

const MOVES_OPTIONS: Array<{ label: string; value: MovesFilter }> = [
  { label: 'Any', value: 'any' },
  { label: '≤5', value: 'le5' },
  { label: '6–7', value: '6-7' },
  { label: '8–10', value: '8-10' },
  { label: '>10', value: 'gt10' },
];

// Grip-type chips are disabled until canonical hold classification (HC-7).
const GRIP_TYPES = ['Jug', 'Good Crimp', 'Crimp', 'Sloper', 'Undercling', 'Pinch'];

const ROLE_LABELS: Record<string, string> = {
  start: 'Start',
  middle: 'Middle',
  finish: 'Finish',
  foot_only: 'Foot',
};

// Sensible default band: 6a/V3 → 6c/V5 (intermediate target).
const DEFAULT_GRADE_MIN = 16;
const DEFAULT_GRADE_MAX = 20;

export default function GeneratePage() {
  return (
    <AuthGuard>
      <GeneratePageInner />
    </AuthGuard>
  );
}

function GeneratePageInner() {
  const [angle, setAngle] = useState(DEFAULT_ANGLE);
  const [gradeMin, setGradeMin] = useState(DEFAULT_GRADE_MIN);
  const [gradeMax, setGradeMax] = useState(DEFAULT_GRADE_MAX);
  const [moves, setMoves] = useState<MovesFilter>('any');

  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped on every successful generation so ClimbBleControls re-illuminates
  // the new problem (debounced) when the board is connected.
  const [genCount, setGenCount] = useState(0);

  // A030 — one-tap save. savedGen remembers which generation is already
  // saved (dedupe: re-tapping Save on the same problem is a no-op), the
  // toast is non-blocking and the generate loop stays untouched.
  const [saving, setSaving] = useState(false);
  const [savedGen, setSavedGen] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const gradeInvalid = gradeMin > gradeMax;

  const handleGenerate = async () => {
    if (gradeInvalid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await generateProblem({
        angle,
        grade_min: gradeMin,
        grade_max: gradeMax,
        moves,
      });
      setResult(res);
      setGenCount((c) => c + 1);
      setSavedGen(null); // fresh generation → saveable again
    } catch (e) {
      // 422 carries the "loosen your filters" message from the backend.
      if (e instanceof ApiError) setError(e.message);
      else setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  // Generated holds carry only placement_id + role; ClimbBoardView and
  // climbToLedCommands look up positions / LEDs from static data, so the
  // x/y/set_id are unused here (nulled to satisfy the HoldPosition type).
  const holdsForView: HoldPosition[] = useMemo(
    () =>
      (result?.holds ?? []).map((h) => ({
        placement_id: h.placement_id,
        role: h.role,
        x: null,
        y: null,
        set_id: null,
      })),
    [result],
  );

  const ledCommands = useMemo(
    () => climbToLedCommands(holdsForView),
    [holdsForView],
  );

  // A030 — one tap, optimistic, never blocks the loop. The frames string
  // is the exact BoardLib encoding rebuilt from the generated holds.
  const handleSave = async () => {
    if (!result || saving || savedGen === genCount) return;
    setSaving(true);
    try {
      const frames = result.holds
        .map((h) => `p${h.placement_id}r${ROLE_STRING_TO_ID[h.role]}`)
        .join('');
      const saved = await saveMyClimb({
        frames,
        angle: result.meta.filters.angle,
        seed_climb_uuid: result.meta.seed_uuid,
      });
      setSavedGen(genCount);
      setToast(`Saved as “${saved.name}”`);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 5000);
    } catch (e) {
      setToast(e instanceof ApiError ? `Save failed: ${e.message}` : 'Save failed');
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  const roleCounts = holdsForView.reduce<Record<string, number>>((acc, h) => {
    acc[h.role] = (acc[h.role] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-dvh bg-zinc-950 text-white pb-nav">
      <PageHeader back={{ href: '/', label: 'Home', testid: 'back-link' }} title="Create with AI" />

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-5">
        {/* ── Filters ───────────────────────────────────────────────── */}
        <Card className="p-4 space-y-5" data-testid="generate-filters">
          {/* Angle */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
              Angle
            </label>
            <div className="flex gap-1 overflow-x-auto pb-1" data-testid="angle-selector">
              {ANGLES.map((a) => (
                <Chip
                  key={a}
                  data-testid={`angle-${a}`}
                  selected={angle === a}
                  onClick={() => setAngle(a)}
                  className="shrink-0"
                >
                  {a}°
                </Chip>
              ))}
            </div>
          </div>

          {/* Grade range */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
              Grade range
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select
                data-testid="grade-min"
                value={gradeMin}
                onChange={(e) => setGradeMin(Number(e.target.value))}
                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-2 text-sm text-white"
              >
                {GRADES.map((g) => (
                  <option key={g.difficulty} value={g.difficulty}>
                    {g.font} / {g.v}
                  </option>
                ))}
              </select>
              <select
                data-testid="grade-max"
                value={gradeMax}
                onChange={(e) => setGradeMax(Number(e.target.value))}
                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-2 text-sm text-white"
              >
                {GRADES.map((g) => (
                  <option key={g.difficulty} value={g.difficulty}>
                    {g.font} / {g.v}
                  </option>
                ))}
              </select>
            </div>
            {gradeInvalid && (
              <p data-testid="grade-invalid" className="mt-2 text-xs text-red-400">
                Min grade must be ≤ max grade.
              </p>
            )}
          </div>

          {/* Moves */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
              Moves
            </label>
            <div className="flex flex-wrap gap-2">
              {MOVES_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  data-testid={`moves-${opt.value}`}
                  selected={moves === opt.value}
                  onClick={() => setMoves(opt.value)}
                >
                  {opt.label}
                </Chip>
              ))}
            </div>
          </div>

          {/* Grip type — disabled, coming soon (needs HC-7) */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
              Grip type
              <span className="ml-2 text-[0.65rem] font-normal text-orange-400/80 normal-case">
                Coming soon
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              {GRIP_TYPES.map((g) => (
                <Chip
                  key={g}
                  disabled
                  data-testid={`grip-${g}`}
                  title="Grip type filtering is coming soon"
                >
                  {g}
                </Chip>
              ))}
            </div>
          </div>

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            data-testid="generate-btn"
            onClick={handleGenerate}
            loading={loading}
            disabled={gradeInvalid}
          >
            {result ? 'Generate again' : 'Generate'}
          </Button>

          {error && (
            <p data-testid="generate-error" className="text-sm text-red-400 text-center">
              {error}
            </p>
          )}
        </Card>

        {/* ── Result ────────────────────────────────────────────────── */}
        {result && (
          <div data-testid="generate-result" className="space-y-5">
            {/* A030 — one-tap save; the generate loop stays untouched. */}
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              data-testid="save-btn"
              onClick={handleSave}
              loading={saving}
              disabled={savedGen === genCount}
            >
              {savedGen === genCount ? 'Saved ✓' : 'Save to My Problems'}
            </Button>

            {/* BLE — light up the generated problem. genCount drives the
                auto-send on re-roll when the board is connected. */}
            <ClimbBleControls
              ledCommands={ledCommands}
              climbKey={String(genCount)}
              autoSendOnKeyChange
            />

            <div className="mx-auto max-w-[280px]">
              <ClimbBoardView holds={holdsForView} />
            </div>

            {/* Role legend */}
            <div className="flex flex-wrap gap-3 text-xs">
              {Object.entries(ROLE_LABELS).map(([role, label]) => (
                <div key={role} className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ backgroundColor: ROLE_COLORS[role] }}
                  />
                  <span className="text-zinc-300">
                    {label}
                    {roleCounts[role] ? ` (${roleCounts[role]})` : ''}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-xs text-zinc-500 text-center">
              Freshly remixed from real climbs. Difficulty may drift from the
              grade you picked — this is an early generator.
            </p>
          </div>
        )}

        {/* A030 — entry point to the saved list. */}
        <Link
          href="/my-problems"
          data-testid="my-problems-link"
          className="block text-center text-sm text-orange-400 hover:text-orange-300 py-2"
        >
          My Problems →
        </Link>
      </main>

      {/* A030 — non-blocking save toast (auto-hides). */}
      {toast && (
        <div
          data-testid="save-toast"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 max-w-[90vw] rounded-full bg-zinc-800 border border-zinc-700 px-4 py-2 text-sm text-white shadow-lg"
        >
          {toast}{' '}
          <Link href="/my-problems" className="text-orange-400 font-semibold">
            View
          </Link>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
