// Pure helpers + types for the classify flow.
// Kept outside page.tsx so Next.js App Router's page-export constraint
// doesn't complain (only `default`, `metadata`, etc. may be exported from page files).

import type { Placement } from '@/components/BoardMap';
import placementsData from '@/app/data/placements_12x12.json';

export type Category = 'jug' | 'good_crimp' | 'crimp' | 'sloper' | 'undercling' | 'pinch';

export interface ClassifyState {
  version: 1;
  visitedOrder: number[];
  cursor: number;
  classifications: Record<number, Category>;
  skipped: number[];
}

export type ClassifyAction =
  | { type: 'CLASSIFY'; placementId: number; category: Category }
  | { type: 'SKIP'; placementId: number }
  | { type: 'BACK' }
  | { type: 'RESET' }
  | { type: 'RESTORE'; state: ClassifyState };

export const LS_KEY = 'kilter_hold_classifications';

// Sorted: top of board first (y DESC), then left-to-right (x ASC)
export const ALL_HOLDS: Placement[] = (placementsData as Placement[])
  .slice()
  .sort((a, b) => b.y - a.y || a.x - b.x);

export const TOTAL = ALL_HOLDS.length;

export const CATEGORIES: { value: Category; label: string; color: string }[] = [
  { value: 'jug',        label: 'Jug',        color: 'bg-green-600 hover:bg-green-500' },
  { value: 'good_crimp', label: 'Good Crimp', color: 'bg-blue-600 hover:bg-blue-500' },
  { value: 'crimp',      label: 'Crimp',      color: 'bg-orange-500 hover:bg-orange-400' },
  { value: 'sloper',     label: 'Sloper',     color: 'bg-purple-600 hover:bg-purple-500' },
  { value: 'undercling', label: 'Undercling', color: 'bg-red-600 hover:bg-red-500' },
  { value: 'pinch',      label: 'Pinch',      color: 'bg-yellow-500 hover:bg-yellow-400 text-zinc-900' },
];

export function initialState(): ClassifyState {
  return { version: 1, visitedOrder: [], cursor: 0, classifications: {}, skipped: [] };
}

/**
 * Returns the next hold to show that hasn't been visited yet.
 * Priority: unclassified+unskipped first, then skipped holds.
 */
export function nextUnvisited(state: ClassifyState): Placement | null {
  const visited = new Set(state.visitedOrder);
  const classified = new Set(Object.keys(state.classifications).map(Number));
  const skippedSet = new Set(state.skipped);

  const pending = ALL_HOLDS.find(
    (h) =>
      !classified.has(h.placement_id) &&
      !skippedSet.has(h.placement_id) &&
      !visited.has(h.placement_id),
  );
  if (pending) return pending;

  const revisitSkipped = state.skipped.find((id) => !visited.has(id));
  if (revisitSkipped != null) {
    return ALL_HOLDS.find((h) => h.placement_id === revisitSkipped) ?? null;
  }

  return null;
}

export function currentHoldForState(state: ClassifyState): Placement | null {
  if (state.cursor < state.visitedOrder.length) {
    const id = state.visitedOrder[state.cursor];
    return ALL_HOLDS.find((h) => h.placement_id === id) ?? null;
  }
  return nextUnvisited(state);
}

export function reducer(state: ClassifyState, action: ClassifyAction): ClassifyState {
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

export function buildExportData(state: ClassifyState) {
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

export async function shareOrDownload(data: object) {
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
