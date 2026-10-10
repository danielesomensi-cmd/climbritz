// HC-REVIEW — AI-suggested hold types that the user confirms or corrects.
// Pure helpers (no React) so the queue logic is unit-testable.
//
// The suggestions are a static draft (app/data/hold_suggestions.json),
// generated offline from the hold drawings + how often each hold is used as
// a hand vs a foot in the Kilter DB. They are NEVER saved as classifications
// on their own: only the user's tap (confirm or change) writes one.

import type { Placement } from '@/components/BoardMap';
import suggestionsData from '@/app/data/hold_suggestions.json';
import type { Category } from './state';

export type Confidence = 'high' | 'medium' | 'low';

export interface HoldSuggestion {
  category: Category;
  confidence: Confidence;
  /** One short sentence: what in the drawing/data drove the guess. */
  why: string;
}

interface SuggestionsFile {
  version: number;
  suggestions: Record<string, HoldSuggestion>;
}

export const SUGGESTIONS: Record<number, HoldSuggestion> = Object.fromEntries(
  Object.entries((suggestionsData as SuggestionsFile).suggestions).map(([id, s]) => [
    Number(id),
    s,
  ]),
);

export const REVIEW_BATCH = 20;

/** Centre of the 12x12 hand area — where a fresh review starts. */
const BOARD_MID = { x: 72, y: 84 };

/**
 * The next `n` holds to review: they have a suggestion and are neither
 * classified nor skipped. When the user already classified some holds, the
 * queue starts from the ones closest to that work (same wall area, so the
 * user can check them in person without walking around), then hops to the
 * nearest remaining hold each time. With nothing classified yet it starts
 * from the middle of the board (hand holds, not the kicker feet).
 */
export function buildReviewQueue(
  holds: Placement[],
  classifications: Record<number, Category>,
  skipped: number[],
  suggestions: Record<number, HoldSuggestion> = SUGGESTIONS,
  n: number = REVIEW_BATCH,
): number[] {
  const skippedSet = new Set(skipped);
  const done = holds.filter((h) => classifications[h.placement_id] !== undefined);
  const pending = holds.filter(
    (h) =>
      suggestions[h.placement_id] !== undefined &&
      classifications[h.placement_id] === undefined &&
      !skippedSet.has(h.placement_id),
  );

  const dist2 = (a: Placement, b: Placement) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  // Each pending hold's distance to the nearest anchor (classified holds plus
  // the holds already queued) — a greedy walk outward from the done area.
  const anchors: Placement[] = done.length > 0 ? [...done] : [];
  const queue: number[] = [];
  const left = [...pending];
  while (queue.length < n && left.length > 0) {
    let best = 0;
    let bestScore = Infinity;
    left.forEach((h, i) => {
      const score =
        anchors.length > 0
          ? Math.min(...anchors.map((a) => dist2(a, h)))
          : (h.x - BOARD_MID.x) ** 2 + (h.y - BOARD_MID.y) ** 2; // no anchors: board centre
      if (score < bestScore || (score === bestScore && h.placement_id < left[best].placement_id)) {
        bestScore = score;
        best = i;
      }
    });
    const [picked] = left.splice(best, 1);
    queue.push(picked.placement_id);
    anchors.push(picked);
  }
  return queue;
}

export interface ReviewStats {
  confirmed: number;
  changed: number;
}

export const REVIEW_STATS_KEY = 'climbritz.classify.review';

export function loadReviewStats(): ReviewStats {
  try {
    const raw = localStorage.getItem(REVIEW_STATS_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<ReviewStats>;
      return { confirmed: s.confirmed ?? 0, changed: s.changed ?? 0 };
    }
  } catch {
    // ignore
  }
  return { confirmed: 0, changed: 0 };
}

export function saveReviewStats(stats: ReviewStats): void {
  try {
    localStorage.setItem(REVIEW_STATS_KEY, JSON.stringify(stats));
  } catch {
    // ignore (private mode)
  }
}
