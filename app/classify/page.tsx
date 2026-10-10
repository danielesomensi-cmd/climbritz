'use client';

import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import BoardMap, { type Placement, getHoldImageUrl } from '@/components/BoardMap';
import BottomNav from '@/components/BottomNav';
import AuthGuard from '@/components/AuthGuard';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import {
  bulkImportClassifications,
  deleteClassification,
  listClassifications,
  upsertClassification,
} from '@/app/lib/api';
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
import {
  SUGGESTIONS,
  buildReviewQueue,
  loadReviewStats,
  saveReviewStats,
  type Confidence,
} from './review';

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: 'fairly sure',
  medium: 'likely',
  low: 'rough guess',
};

const VALID_CATEGORIES = new Set<string>(CATEGORIES.map((c) => c.value));

/** Build a ClassifyState from the backend rows. The backend has no concept
 *  of "skipped" (client-side only), so skipped always comes back empty. */
function stateFromRows(
  rows: { placement_id: number; category: string }[],
): ClassifyState {
  const classifications: Record<number, Category> = {};
  for (const r of rows) {
    if (VALID_CATEGORIES.has(r.category)) {
      classifications[r.placement_id] = r.category as Category;
    }
  }
  return { version: 2, classifications, skipped: [] };
}

function ClassifyContent() {
  const { user } = useUser();
  const [state, dispatch] = useReducer(reducer, null, () => initialState());
  const [selected, setSelected] = useState<Placement | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // HC-REVIEW — a batch of AI suggestions being confirmed/corrected.
  const [reviewQueue, setReviewQueue] = useState<number[] | null>(null);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [batchStats, setBatchStats] = useState({ confirmed: 0, changed: 0 });

  // Auto-dismiss the toast.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Restore from localStorage on mount (instant paint / offline cache).
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

  // Hydrate from the backend (source of truth). When the backend has data
  // it overwrites the local cache; when it's empty we keep whatever the
  // localStorage restore loaded (no auto-migration — local-only work is
  // not destroyed, but it's never pushed up automatically either).
  useEffect(() => {
    let cancelled = false;
    listClassifications()
      .then((rows) => {
        if (cancelled || rows.length === 0) return;
        dispatch({ type: 'RESTORE', state: stateFromRows(rows) });
      })
      .catch(() => {
        // Not signed in yet / offline — the localStorage cache stands in.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist on every state change (write-through cache).
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

  const classifyHold = async (placementId: number, category: Category) => {
    const prev = state;
    dispatch({ type: 'CLASSIFY', placementId, category });
    try {
      await upsertClassification(placementId, category);
    } catch {
      dispatch({ type: 'RESTORE', state: prev });
      setToast('Could not save — please retry.');
    }
  };

  const handleClassify = (category: Category) => {
    if (selected) void classifyHold(selected.placement_id, category);
  };

  // ── HC-REVIEW ──────────────────────────────────────────────────────────────
  const pendingSuggestions = useMemo(
    () =>
      ALL_HOLDS.filter(
        (h) =>
          SUGGESTIONS[h.placement_id] !== undefined &&
          state.classifications[h.placement_id] === undefined &&
          !state.skipped.includes(h.placement_id),
      ).length,
    [state.classifications, state.skipped],
  );
  const reviewId = reviewQueue ? reviewQueue[reviewIndex] : undefined;
  const reviewHold = reviewId !== undefined ? ALL_HOLDS.find((h) => h.placement_id === reviewId) : undefined;
  const reviewSuggestion = reviewId !== undefined ? SUGGESTIONS[reviewId] : undefined;
  const reviewDone = reviewQueue !== null && reviewIndex >= reviewQueue.length;

  const reviewRef = useRef<HTMLDivElement | null>(null);
  const startReview = () => {
    setSelected(null);
    // Bring the question into view (it sits below the header + board on phones).
    setTimeout(() => reviewRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }), 50);
    setReviewQueue(buildReviewQueue(ALL_HOLDS, state.classifications, state.skipped));
    setReviewIndex(0);
    setBatchStats({ confirmed: 0, changed: 0 });
  };

  const answerReview = (category: Category | null) => {
    if (reviewId === undefined || !reviewSuggestion) return;
    if (category === null) {
      dispatch({ type: 'SKIP', placementId: reviewId });
    } else {
      void classifyHold(reviewId, category);
      const agreed = category === reviewSuggestion.category;
      setBatchStats((b) => ({
        confirmed: b.confirmed + (agreed ? 1 : 0),
        changed: b.changed + (agreed ? 0 : 1),
      }));
      const total = loadReviewStats();
      saveReviewStats({
        confirmed: total.confirmed + (agreed ? 1 : 0),
        changed: total.changed + (agreed ? 0 : 1),
      });
    }
    setReviewIndex((i) => i + 1);
  };

  const handleSkip = async () => {
    if (!selected) return;
    const placementId = selected.placement_id;
    const wasClassified = state.classifications[placementId] !== undefined;
    const prev = state;
    dispatch({ type: 'SKIP', placementId });
    if (wasClassified) {
      try {
        await deleteClassification(placementId);
      } catch {
        dispatch({ type: 'RESTORE', state: prev });
        setToast('Could not save — please retry.');
      }
    }
  };

  const handleReset = async () => {
    const prev = state;
    const classifiedIds = Object.keys(state.classifications).map(Number);
    dispatch({ type: 'RESET' });
    setSelected(null);
    setConfirmReset(false);
    try {
      await Promise.all(classifiedIds.map((id) => deleteClassification(id)));
    } catch {
      dispatch({ type: 'RESTORE', state: prev });
      setToast('Could not reset — please retry.');
    }
  };

  const handleExport = () => shareOrDownload(buildExportData(state));

  const handleSendExport = async () => {
    const email = user?.primaryEmailAddress?.emailAddress ?? 'anonymous';
    const data = { ...buildExportData(state), classifier: email };
    const json = JSON.stringify(data, null, 2);
    try {
      await navigator.clipboard?.writeText(json);
    } catch {
      // clipboard unavailable — the mailto still opens, user can paste manually
    }
    const subject = encodeURIComponent(`Climbritz hold classification — ${email}`);
    const body = encodeURIComponent(
      'Your classification JSON is on your clipboard. Please paste it below and send.',
    );
    window.location.href = `mailto:daniele.somensi@gmail.com?subject=${subject}&body=${body}`;
    setToast('Export copied to clipboard — paste it in your email and send.');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-importing the same file
    if (!file) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setToast('Invalid JSON file.');
      return;
    }

    const items = (parsed as { classifications?: unknown })?.classifications;
    const valid =
      Array.isArray(items) &&
      items.every(
        (it) =>
          it &&
          typeof it.placement_id === 'number' &&
          VALID_CATEGORIES.has(it.category),
      );
    if (!valid) {
      setToast('Invalid JSON file.');
      return;
    }

    try {
      const { total } = await bulkImportClassifications(
        (items as { placement_id: number; category: Category }[]).map((it) => ({
          placement_id: it.placement_id,
          category: it.category,
        })),
      );
      const rows = await listClassifications();
      dispatch({ type: 'RESTORE', state: stateFromRows(rows) });
      setToast(`Imported ${total} classifications.`);
    } catch {
      setToast('Import failed — please retry.');
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 pt-safe px-4 pb-nav">
      <div className="max-w-6xl mx-auto space-y-4">

        {/* B-CSS-RESET 3/3: title first, then the banner — the page used to open
            on the orange banner with the H1 buried underneath it. */}
        <div>
          <h1 className="text-page-title font-display">Hold Classification</h1>
          <p className="text-sm text-zinc-400 mt-1">Tap any hold to classify or reclassify it.</p>
        </div>

        {/* A023: growth banner — invite to contribute */}
        <div
          data-testid="growth-banner"
          className="rounded-xl border border-orange-500/50 bg-orange-500/10 p-4"
        >
          <p className="font-bold text-orange-500">Propose your classification of the holds</p>
          <p className="text-sm text-zinc-300 mt-1">
            Help us build the world&apos;s first hold-type database for the Kilter Board. Tap each
            hold and tell us what it feels like to climb on.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* B033: Next is navigation, not a category — moved off blue (blue is
              reserved for the good_crimp category swatch) to a neutral button. */}
          {pendingSuggestions > 0 && (
            <Button variant="primary" data-testid="btn-review" onClick={startReview}>
              ✨ Review AI suggestions
            </Button>
          )}
          <Button variant="secondary" data-testid="btn-next" onClick={jumpToNext} disabled={isDone}>
            Next unclassified →
          </Button>
          <Button variant="secondary" data-testid="btn-send-export" onClick={handleSendExport}>
            Send my export
          </Button>
          <Button variant="secondary" data-testid="btn-export" onClick={handleExport}>
            Export JSON
          </Button>
          <Button variant="secondary" data-testid="btn-import" onClick={() => fileInputRef.current?.click()}>
            Import JSON
          </Button>
          <input
            ref={fileInputRef}
            data-testid="import-file-input"
            type="file"
            accept=".json,application/json"
            onChange={handleImportFile}
            className="hidden"
          />
          <Button variant="ghost" onClick={() => setConfirmReset(true)} className="hover:text-red-400">
            Reset
          </Button>
        </div>

        {/* A023: prize message */}
        <p data-testid="prize-message" className="text-xs text-zinc-500">
          <strong className="text-zinc-400">
            The first 10 climbers to complete a full board classification will receive a prize.
          </strong>{' '}
          Send your export when you&apos;re done.
        </p>

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
              className="h-full bg-orange-500 transition-all duration-300"
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
              highlightId={reviewQueue && !reviewDone ? reviewId : selected?.placement_id}
              holdColors={holdColors}
              size="full"
              onHoldClick={(h) => {
                if (reviewQueue) return; // the review card drives the selection
                setSelected(h);
              }}
            />
          </div>

          {/* HC-REVIEW card — first on mobile so the question sits above the board. */}
          {reviewQueue && (
            <div ref={reviewRef} className="order-first md:order-none scroll-mt-4">
            <Card
              data-testid="review-panel"
              className="border-orange-500/60 p-4 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold text-lg">AI suggestions</h2>
                  <p className="text-xs text-zinc-400" data-testid="review-progress">
                    {reviewDone
                      ? 'Batch done'
                      : `${reviewIndex + 1} of ${reviewQueue.length}${
                          classifiedCount > 0 ? ' · near the holds you already did' : ''
                        }`}
                  </p>
                </div>
                <button
                  onClick={() => setReviewQueue(null)}
                  className="text-zinc-400 hover:text-zinc-100 text-2xl leading-none min-h-11 min-w-11"
                  aria-label="Close review"
                >
                  ×
                </button>
              </div>

              {reviewDone ? (
                <div className="space-y-3" data-testid="review-summary">
                  <p className="text-lg font-semibold">
                    AI was right on {batchStats.confirmed} of {batchStats.confirmed + batchStats.changed}
                  </p>
                  <p className="text-sm text-zinc-400">
                    Every answer is saved as your classification. Changed ones teach us where the
                    drawings mislead.
                  </p>
                  <div className="flex gap-2">
                    {pendingSuggestions > 0 && (
                      <Button variant="primary" className="flex-1" data-testid="btn-review-more" onClick={startReview}>
                        Review 20 more
                      </Button>
                    )}
                    <Button variant="secondary" className="flex-1" onClick={() => setReviewQueue(null)}>
                      Done
                    </Button>
                  </div>
                </div>
              ) : reviewHold && reviewSuggestion ? (
                <>
                  <div className="flex gap-3 items-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getHoldImageUrl(reviewHold.placement_id)}
                      alt={`Hold ${reviewHold.placement_id}`}
                      className="w-32 h-32 shrink-0 object-contain rounded-lg bg-zinc-800 border border-zinc-700"
                    />
                    <div className="min-w-0">
                      <p className="text-xs text-zinc-500">
                        Hold #{reviewHold.placement_id} · {reviewHold.hole_name}
                      </p>
                      <p className="mt-1 text-sm text-zinc-300">AI suggests</p>
                      <span
                        data-testid="review-suggestion"
                        className="mt-1 inline-block rounded px-2 py-0.5 text-base font-bold text-white"
                        style={{ backgroundColor: CATEGORY_FILL[reviewSuggestion.category] }}
                      >
                        {CATEGORIES.find((c) => c.value === reviewSuggestion.category)?.label}
                      </span>
                      <span className="ml-2 text-xs text-zinc-400">
                        {CONFIDENCE_LABEL[reviewSuggestion.confidence]}
                      </span>
                      <p className="mt-1 text-xs text-zinc-500">{reviewSuggestion.why}</p>
                    </div>
                  </div>

                  <button
                    data-testid="btn-review-confirm"
                    onClick={() => answerReview(reviewSuggestion.category)}
                    className="min-h-14 w-full rounded-lg text-base font-bold text-white transition active:scale-[0.98] touch-manipulation select-none"
                    style={{ backgroundColor: CATEGORY_FILL[reviewSuggestion.category] }}
                  >
                    ✓ Yes, {CATEGORIES.find((c) => c.value === reviewSuggestion.category)?.label}
                  </button>

                  <p className="text-xs text-zinc-400">No — it&apos;s a…</p>
                  <div className="grid grid-cols-3 gap-2" data-testid="review-alternatives">
                    {CATEGORIES.filter((c) => c.value !== reviewSuggestion.category).map((cat) => (
                      <button
                        key={cat.value}
                        data-testid={`review-${cat.value}`}
                        onClick={() => answerReview(cat.value)}
                        className={`min-h-12 rounded-lg text-sm font-semibold transition active:scale-95 touch-manipulation select-none ${cat.color}`}
                      >
                        {cat.label}
                      </button>
                    ))}
                    <button
                      data-testid="review-skip"
                      onClick={() => answerReview(null)}
                      className="min-h-12 rounded-lg border border-zinc-700 text-sm text-zinc-300 transition active:scale-95 touch-manipulation select-none"
                    >
                      Skip
                    </button>
                  </div>
                </>
              ) : null}
            </Card>
            </div>
          )}

          {/* Detail panel */}
          {!reviewQueue && (
          <Card
            data-testid="classify-panel"
            className="border-border-strong p-4 min-h-[320px] flex flex-col gap-3"
          >
            {selected == null ? (
              <div className="flex-1 flex items-center justify-center">
                {isDone ? (
                  <EmptyState
                    icon="🎉"
                    title={
                      <span>
                        All {TOTAL} holds classified! Use <strong>Export JSON</strong> above to
                        download your work.
                      </span>
                    }
                  />
                ) : (
                  <EmptyState
                    title={
                      <span>
                        Tap a hold on the board to classify it, or tap{' '}
                        <strong>Next unclassified</strong> to jump to the first untouched hold.
                      </span>
                    }
                  />
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
                  <Button variant="secondary" className="flex-1" data-testid="btn-skip" onClick={handleSkip} disabled={isSelectedSkipped}>
                    Skip
                  </Button>
                  <Button variant="secondary" className="flex-1" onClick={jumpToNext} disabled={isDone}>
                    Next →
                  </Button>
                </div>
              </>
            )}
          </Card>
          )}
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
                <Button variant="secondary" className="flex-1" onClick={() => setConfirmReset(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" className="flex-1" data-testid="btn-confirm-reset" onClick={handleReset}>
                  Reset
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div
            data-testid="toast"
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-zinc-800 border border-zinc-600 px-4 py-2 text-sm text-zinc-100 shadow-lg"
          >
            {toast}
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
