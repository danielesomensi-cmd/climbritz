'use client';

import { useEffect, useReducer, useCallback, useState } from 'react';
import BoardMap, { Placement, getHoldImageUrl } from '@/components/BoardMap';
import placementsData from '@/app/data/placements_12x12.json';

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = 'jug' | 'good_crimp' | 'crimp' | 'sloper' | 'undercling' | 'pinch';

/**
 * State design:
 * - visitedOrder: placement_ids in the order they were shown (incl. skipped + classified)
 * - cursor: position in visitedOrder, OR visitedOrder.length = "show next unvisited"
 * - classifications + skipped: the actual data
 *
 * This lets "back" navigate into already-visited holds without losing the queue.
 */
interface ClassifyState {
  version: 1;
  visitedOrder: number[];
  cursor: number;
  classifications: Record<number, Category>;
  skipped: number[];
}

type Action =
  | { type: 'CLASSIFY'; placementId: number; category: Category }
  | { type: 'SKIP'; placementId: number }
  | { type: 'BACK' }
  | { type: 'RESET' }
  | { type: 'RESTORE'; state: ClassifyState };

// ─── Constants ────────────────────────────────────────────────────────────────

const LS_KEY = 'kilter_hold_classifications';

// Sorted: top of board first (y DESC), then left-to-right (x ASC)
const ALL_HOLDS: Placement[] = (placementsData as Placement[]).slice().sort(
  (a, b) => b.y - a.y || a.x - b.x,
);
const TOTAL = ALL_HOLDS.length;

const CATEGORIES: { value: Category; label: string; color: string }[] = [
  { value: 'jug',        label: 'Jug',       color: 'bg-green-600 hover:bg-green-500' },
  { value: 'good_crimp', label: 'Good Crimp', color: 'bg-blue-600 hover:bg-blue-500' },
  { value: 'crimp',      label: 'Crimp',      color: 'bg-orange-500 hover:bg-orange-400' },
  { value: 'sloper',     label: 'Sloper',     color: 'bg-purple-600 hover:bg-purple-500' },
  { value: 'undercling', label: 'Undercling', color: 'bg-red-600 hover:bg-red-500' },
  { value: 'pinch',      label: 'Pinch',      color: 'bg-yellow-500 hover:bg-yellow-400 text-zinc-900' },
];

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function initialState(): ClassifyState {
  return { version: 1, visitedOrder: [], cursor: 0, classifications: {}, skipped: [] };
}

/**
 * Returns the next hold to show that hasn't been visited yet.
 * Priority order:
 *   1. Unclassified, unskipped holds (in sorted board order)
 *   2. Skipped holds (appended at end, in skip order)
 */
function nextUnvisited(state: ClassifyState): Placement | null {
  const visited = new Set(state.visitedOrder);
  const classified = new Set(Object.keys(state.classifications).map(Number));
  const skippedSet = new Set(state.skipped);

  // First: unclassified, unskipped, unvisited
  const pending = ALL_HOLDS.find(
    (h) => !classified.has(h.placement_id) && !skippedSet.has(h.placement_id) && !visited.has(h.placement_id),
  );
  if (pending) return pending;

  // Then: skipped holds not yet re-visited
  const revisitSkipped = state.skipped.find((id) => !visited.has(id));
  if (revisitSkipped != null) {
    return ALL_HOLDS.find((h) => h.placement_id === revisitSkipped) ?? null;
  }

  return null;
}

/**
 * Returns the hold to display for the current cursor position.
 */
function currentHoldForState(state: ClassifyState): Placement | null {
  if (state.cursor < state.visitedOrder.length) {
    const id = state.visitedOrder[state.cursor];
    return ALL_HOLDS.find((h) => h.placement_id === id) ?? null;
  }
  // cursor is at the frontier → show next unvisited
  return nextUnvisited(state);
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

function reducer(state: ClassifyState, action: Action): ClassifyState {
  switch (action.type) {
    case 'CLASSIFY': {
      const alreadyVisited = state.visitedOrder.includes(action.placementId);
      return {
        ...state,
        classifications: { ...state.classifications, [action.placementId]: action.category },
        skipped: state.skipped.filter((id) => id !== action.placementId),
        visitedOrder: alreadyVisited
          ? state.visitedOrder
          : [...state.visitedOrder, action.placementId],
        cursor: state.cursor + 1,
      };
    }
    case 'SKIP': {
      const alreadyVisited = state.visitedOrder.includes(action.placementId);
      const alreadySkipped = state.skipped.includes(action.placementId);
      return {
        ...state,
        skipped: alreadySkipped ? state.skipped : [...state.skipped, action.placementId],
        visitedOrder: alreadyVisited
          ? state.visitedOrder
          : [...state.visitedOrder, action.placementId],
        cursor: state.cursor + 1,
      };
    }
    case 'BACK':
      return { ...state, cursor: Math.max(0, state.cursor - 1) };
    case 'RESET':
      return initialState();
    case 'RESTORE':
      return action.state;
    default:
      return state;
  }
}

// ─── Export helpers ───────────────────────────────────────────────────────────

function buildExportData(state: ClassifyState) {
  const classifiedList = Object.entries(state.classifications).map(([id, category]) => {
    const hold = ALL_HOLDS.find((h) => h.placement_id === Number(id));
    return { placement_id: Number(id), category, x: hold?.x ?? 0, y: hold?.y ?? 0 };
  });

  const counts = CATEGORIES.reduce<Record<string, number>>((acc, c) => {
    acc[c.value] = 0;
    return acc;
  }, {});
  for (const cat of Object.values(state.classifications)) {
    counts[cat] = (counts[cat] ?? 0) + 1;
  }

  return {
    version: 1,
    board: 'kilter_original_12x12',
    classifier: 'anonymous',
    date: new Date().toISOString(),
    total: TOTAL,
    classified: classifiedList.length,
    skipped: state.skipped.length,
    categories: counts,
    classifications: classifiedList,
  };
}

async function shareOrDownload(data: object) {
  const filename = `kilter_classifications_${Date.now()}.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const file = new File([blob], filename, { type: 'application/json' });

  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Hold Classifications' });
      return;
    } catch {
      // fall through to download
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}


// ─── Component ────────────────────────────────────────────────────────────────

export default function ClassifyPage() {
  const [state, dispatch] = useReducer(reducer, null, () => initialState());
  const [confirmReset, setConfirmReset] = useState(false);

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ClassifyState;
        if (parsed.version === 1) dispatch({ type: 'RESTORE', state: parsed });
      }
    } catch {
      // ignore corrupt localStorage
    }
  }, []);

  // Persist on every state change
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }, [state]);

  const classifiedCount = Object.keys(state.classifications).length;
  const isDone = classifiedCount === TOTAL;
  const currentHold = currentHoldForState(state);
  const progress = Math.round((classifiedCount / TOTAL) * 100);

  const handleClassify = useCallback(
    (category: Category) => {
      if (currentHold) dispatch({ type: 'CLASSIFY', placementId: currentHold.placement_id, category });
    },
    [currentHold],
  );

  const handleSkip = useCallback(() => {
    if (currentHold) dispatch({ type: 'SKIP', placementId: currentHold.placement_id });
  }, [currentHold]);

  const handleBack = useCallback(() => dispatch({ type: 'BACK' }), []);
  const handleExport = useCallback(() => shareOrDownload(buildExportData(state)), [state]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center px-4 py-6">
      <div className="w-full max-w-md space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Hold Classification</h1>
          <button
            onClick={() => setConfirmReset(true)}
            className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
          >
            Reset
          </button>
        </div>

        {/* Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">{classifiedCount} / {TOTAL}</span>
            <span className="text-zinc-400">{progress}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div
              data-testid="progress-bar"
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          {state.skipped.length > 0 && (
            <p className="text-xs text-zinc-500">
              {state.skipped.length} skipped — will appear at end
            </p>
          )}
        </div>

        {/* Done */}
        {isDone ? (
          <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-8 text-center space-y-4">
            <p className="text-3xl">🎉</p>
            <p className="text-xl font-bold">All done!</p>
            <p className="text-zinc-400 text-sm">
              {classifiedCount} holds classified · {state.skipped.length} skipped
            </p>
            <button
              onClick={handleExport}
              className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold text-lg transition-colors"
            >
              Export JSON
            </button>
          </div>
        ) : currentHold == null ? (
          // All holds visited (all remaining skipped)
          <div className="text-center text-zinc-400 py-8 space-y-4">
            <p>All holds visited.</p>
            {state.skipped.length > 0 && (
              <p className="text-sm">
                {state.skipped.length} skipped holds remain unclassified.
              </p>
            )}
            <button
              onClick={handleExport}
              className="px-6 py-2 bg-blue-700 hover:bg-blue-600 rounded-lg text-sm font-semibold"
            >
              Export JSON
            </button>
          </div>
        ) : (
          <>
            {/* Composite board with current hold highlighted */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-2">
              <p className="text-[10px] text-zinc-500 mb-1 text-center">Board position</p>
              <BoardMap
                placements={ALL_HOLDS}
                highlightId={currentHold.placement_id}
                size="mini"
              />
            </div>

            {/* Current hold — large crop */}
            <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getHoldImageUrl(currentHold.placement_id)}
                alt={`Hold ${currentHold.placement_id}`}
                className="w-56 h-56 object-contain rounded-lg bg-zinc-800"
              />
              <p className="text-xs text-zinc-500">
                #{currentHold.placement_id} · ({currentHold.x}, {currentHold.y}) · {currentHold.default_role}
              </p>
              {/* Show current classification if reviewing */}
              {state.classifications[currentHold.placement_id] && (
                <span className="text-xs bg-zinc-700 rounded px-2 py-0.5 text-zinc-300">
                  Current: {state.classifications[currentHold.placement_id].replace('_', ' ')}
                </span>
              )}
            </div>

            {/* Category buttons */}
            <div className="grid grid-cols-2 gap-3" data-testid="category-buttons">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  data-testid={`btn-${cat.value}`}
                  onClick={() => handleClassify(cat.value)}
                  className={`py-4 rounded-xl font-semibold text-base transition-all active:scale-95 ${cat.color} ${
                    state.classifications[currentHold.placement_id] === cat.value
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-950'
                      : ''
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Controls */}
            <div className="flex gap-2">
              <button
                data-testid="btn-back"
                onClick={handleBack}
                disabled={state.cursor === 0}
                className="flex-1 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:border-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ← Back
              </button>
              <button
                data-testid="btn-skip"
                onClick={handleSkip}
                className="flex-1 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:border-zinc-400 transition-colors"
              >
                Skip
              </button>
              <button
                data-testid="btn-export"
                onClick={handleExport}
                className="flex-1 py-2 rounded-lg border border-blue-700 text-sm text-blue-300 hover:border-blue-400 transition-colors"
              >
                Export
              </button>
            </div>
          </>
        )}

        {/* Reset confirmation modal */}
        {confirmReset && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
            <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6 w-full max-w-xs space-y-4">
              <p className="font-semibold text-center">Reset all progress?</p>
              <p className="text-sm text-zinc-400 text-center">
                This will clear all {classifiedCount} classifications. Cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmReset(false)}
                  className="flex-1 py-2 rounded-lg border border-zinc-600 text-sm hover:border-zinc-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  data-testid="btn-confirm-reset"
                  onClick={() => {
                    dispatch({ type: 'RESET' });
                    setConfirmReset(false);
                  }}
                  className="flex-1 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-sm font-semibold transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
