'use client';

import { useEffect, useReducer, useCallback, useState } from 'react';
import BoardMap, { getHoldImageUrl } from '@/components/BoardMap';
import {
  ALL_HOLDS,
  CATEGORIES,
  LS_KEY,
  TOTAL,
  buildExportData,
  currentHoldForState,
  initialState,
  reducer,
  shareOrDownload,
  type Category,
  type ClassifyState,
} from './state';

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
