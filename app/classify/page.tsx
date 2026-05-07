'use client';

import { useEffect, useMemo, useReducer, useState } from 'react';
import BoardMap, { type Placement, getHoldImageUrl } from '@/components/BoardMap';
import BottomNav from '@/components/BottomNav';
import AuthGuard from '@/components/AuthGuard';
import {
  ALL_HOLDS,
  CATEGORIES,
  CATEGORY_FILL,
  LS_KEY,
  TOTAL,
  buildExportData,
  firstUnclassified,
  initialState,
  reducer,
  shareOrDownload,
  type Category,
  type ClassifyState,
} from './state';

function ClassifyContent() {
  const [state, dispatch] = useReducer(reducer, null, () => initialState());
  const [selected, setSelected] = useState<Placement | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ClassifyState;
        if (parsed.version === 2) dispatch({ type: 'RESTORE', state: parsed });
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
  const skippedCount = state.skipped.length;
  const progress = Math.round((classifiedCount / TOTAL) * 100);
  const isDone = classifiedCount === TOTAL;

  // Build the color map that drives the board overlay: every classified hold
  // gets its category fill color, every skipped hold gets a dark muted fill.
  // Unclassified holds are left undefined → default gray styling.
  const holdColors = useMemo(() => {
    const map: Record<number, string> = {};
    for (const [idStr, cat] of Object.entries(state.classifications)) {
      map[Number(idStr)] = CATEGORY_FILL[cat];
    }
    for (const id of state.skipped) {
      map[id] = '#52525b'; // zinc-600 — dim but distinct from "not touched yet" gray
    }
    return map;
  }, [state.classifications, state.skipped]);

  const currentCategory: Category | undefined = selected
    ? state.classifications[selected.placement_id]
    : undefined;
  const isSelectedSkipped = selected ? state.skipped.includes(selected.placement_id) : false;

  const jumpToNext = () => {
    const next = firstUnclassified(state);
    if (next) setSelected(next);
  };

  const handleClassify = (category: Category) => {
    if (!selected) return;
    dispatch({ type: 'CLASSIFY', placementId: selected.placement_id, category });
  };

  const handleSkip = () => {
    if (!selected) return;
    dispatch({ type: 'SKIP', placementId: selected.placement_id });
  };

  const handleExport = () => shareOrDownload(buildExportData(state));

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 pt-safe px-4 pb-24">
      <div className="max-w-6xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Hold Classification</h1>
            <p className="text-xs text-zinc-400">Click any hold to classify or reclassify it.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              data-testid="btn-next"
              onClick={jumpToNext}
              disabled={isDone}
              className="px-3 py-1.5 rounded-lg border border-blue-600 text-sm text-blue-300 hover:border-blue-400 hover:bg-blue-500/10 disabled:opacity-30 transition-colors"
            >
              Prossima non classificata →
            </button>
            <button
              data-testid="btn-export"
              onClick={handleExport}
              className="px-3 py-1.5 rounded-lg border border-emerald-600 text-sm text-emerald-300 hover:border-emerald-400 hover:bg-emerald-500/10 transition-colors"
            >
              Export JSON
            </button>
            <button
              onClick={() => setConfirmReset(true)}
              className="px-3 py-1.5 rounded-lg border border-zinc-700 text-sm text-zinc-400 hover:border-red-500 hover:text-red-400 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-300">
              <span data-testid="progress-text">{classifiedCount} / {TOTAL}</span> classified
              {skippedCount > 0 && <span className="text-zinc-500"> · {skippedCount} skipped</span>}
            </span>
            <span className="text-zinc-400">{progress}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div
              data-testid="progress-bar"
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full bg-zinc-400/30 border border-zinc-300/60" />
            Not classified
          </span>
          {CATEGORIES.map((c) => (
            <span key={c.value} className="inline-flex items-center gap-1">
              <span
                className="inline-block w-3 h-3 rounded-full border border-white/60"
                style={{ backgroundColor: c.fill }}
              />
              {c.label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full border border-white/40 bg-zinc-600" />
            Skipped
          </span>
        </div>

        {/* Main layout: board + side/below panel */}
        <div className="grid gap-4 md:grid-cols-[1fr_360px]">
          {/* Board */}
          <div>
            <BoardMap
              placements={ALL_HOLDS}
              highlightId={selected?.placement_id}
              holdColors={holdColors}
              size="full"
              onHoldClick={setSelected}
            />
          </div>

          {/* Detail panel */}
          <aside
            data-testid="classify-panel"
            className="rounded-lg border border-zinc-700 bg-zinc-900 p-4 min-h-[320px] flex flex-col gap-3"
          >
            {selected == null ? (
              <div className="flex-1 flex items-center justify-center text-center text-sm text-zinc-500 px-4">
                {isDone ? (
                  <span>
                    🎉 All {TOTAL} holds classified! Use <strong>Export JSON</strong> above to
                    download your work.
                  </span>
                ) : (
                  <span>
                    Click a hold on the board to classify it, or tap{' '}
                    <strong>Prossima non classificata</strong> to jump to the first untouched hold.
                  </span>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-semibold text-lg">Hold #{selected.placement_id}</h2>
                    <p className="text-xs text-zinc-500">
                      {selected.hole_name} · ({selected.x}, {selected.y}) · {selected.default_role}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-zinc-400 hover:text-zinc-100 text-2xl leading-none"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                {/* Large crop */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getHoldImageUrl(selected.placement_id)}
                  alt={`Hold ${selected.placement_id}`}
                  className="w-full aspect-square object-contain rounded-lg bg-zinc-800 border border-zinc-700"
                />

                {/* Current status */}
                {currentCategory ? (
                  <p className="text-sm text-zinc-300">
                    Currently:{' '}
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
                      style={{ backgroundColor: CATEGORY_FILL[currentCategory] }}
                    >
                      {CATEGORIES.find((c) => c.value === currentCategory)?.label}
                    </span>
                  </p>
                ) : isSelectedSkipped ? (
                  <p className="text-sm text-amber-400">Currently skipped</p>
                ) : (
                  <p className="text-sm text-zinc-500">Not classified yet</p>
                )}

                {/* Category buttons */}
                <div className="grid grid-cols-2 gap-2" data-testid="category-buttons">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      data-testid={`btn-${cat.value}`}
                      onClick={() => handleClassify(cat.value)}
                      className={`py-3 rounded-lg font-semibold text-sm transition-all active:scale-95 ${cat.color} ${
                        currentCategory === cat.value
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900'
                          : ''
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Skip / jump */}
                <div className="flex gap-2 pt-1">
                  <button
                    data-testid="btn-skip"
                    onClick={handleSkip}
                    disabled={isSelectedSkipped}
                    className="flex-1 py-2 rounded-lg border border-zinc-700 text-xs text-zinc-300 hover:border-zinc-400 disabled:opacity-40 transition-colors"
                  >
                    Skip
                  </button>
                  <button
                    onClick={jumpToNext}
                    disabled={isDone}
                    className="flex-1 py-2 rounded-lg border border-blue-700 text-xs text-blue-300 hover:border-blue-400 disabled:opacity-40 transition-colors"
                  >
                    Next →
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>

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
                    setSelected(null);
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
      <BottomNav />
    </main>
  );
}

export default function ClassifyPage() {
  return (
    <AuthGuard>
      <ClassifyContent />
    </AuthGuard>
  );
}
