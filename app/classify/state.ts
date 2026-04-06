// Pure helpers + types for the classify flow.
// Kept outside page.tsx so Next.js App Router's page-export constraint
// doesn't complain (only `default`, `metadata`, etc. may be exported from page files).

import type { Placement } from '@/components/BoardMap';
import placementsData from '@/app/data/placements_12x12.json';

export type Category = 'jug' | 'good_crimp' | 'crimp' | 'sloper' | 'undercling' | 'pinch';

export interface ClassifyState {
  version: 2;
  classifications: Record<number, Category>;
  skipped: number[];
}

export type ClassifyAction =
  | { type: 'CLASSIFY'; placementId: number; category: Category }
  | { type: 'SKIP'; placementId: number }
  | { type: 'UNSKIP'; placementId: number }
  | { type: 'RESET' }
  | { type: 'RESTORE'; state: ClassifyState };

export const LS_KEY = 'kilter_hold_classifications';

// Sorted: top of board first (y DESC), then left-to-right (x ASC)
export const ALL_HOLDS: Placement[] = (placementsData as Placement[])
  .slice()
  .sort((a, b) => b.y - a.y || a.x - b.x);

export const TOTAL = ALL_HOLDS.length;

export const CATEGORIES: {
  value: Category;
  label: string;
  /** Tailwind classes for buttons */
  color: string;
  /** Raw hex used to fill the matching circle on the board overlay */
  fill: string;
}[] = [
  { value: 'jug',        label: 'Jug',        color: 'bg-green-600 hover:bg-green-500',                       fill: '#16a34a' },
  { value: 'good_crimp', label: 'Good Crimp', color: 'bg-blue-600 hover:bg-blue-500',                         fill: '#2563eb' },
  { value: 'crimp',      label: 'Crimp',      color: 'bg-orange-500 hover:bg-orange-400',                     fill: '#f97316' },
  { value: 'sloper',     label: 'Sloper',     color: 'bg-purple-600 hover:bg-purple-500',                     fill: '#9333ea' },
  { value: 'undercling', label: 'Undercling', color: 'bg-red-600 hover:bg-red-500',                           fill: '#dc2626' },
  { value: 'pinch',      label: 'Pinch',      color: 'bg-yellow-500 hover:bg-yellow-400 text-zinc-900',       fill: '#eab308' },
];

/** Lookup table: category value → fill hex. */
export const CATEGORY_FILL: Record<Category, string> = CATEGORIES.reduce(
  (acc, c) => {
    acc[c.value] = c.fill;
    return acc;
  },
  {} as Record<Category, string>,
);

export function initialState(): ClassifyState {
  return { version: 2, classifications: {}, skipped: [] };
}

/**
 * Returns the first hold (in sorted board order) that is neither classified
 * nor skipped. Used by the "next unclassified" jump button. Returns null when
 * nothing is pending.
 */
export function firstUnclassified(state: ClassifyState): Placement | null {
  const classified = new Set(Object.keys(state.classifications).map(Number));
  const skippedSet = new Set(state.skipped);
  return (
    ALL_HOLDS.find(
      (h) => !classified.has(h.placement_id) && !skippedSet.has(h.placement_id),
    ) ?? null
  );
}

export function reducer(state: ClassifyState, action: ClassifyAction): ClassifyState {
  switch (action.type) {
    case 'CLASSIFY':
      return {
        ...state,
        classifications: { ...state.classifications, [action.placementId]: action.category },
        // Classifying implicitly removes the skip flag.
        skipped: state.skipped.filter((id) => id !== action.placementId),
      };
    case 'SKIP': {
      if (state.skipped.includes(action.placementId)) return state;
      // Remove any existing classification when skipping.
      const { [action.placementId]: _removed, ...rest } = state.classifications;
      return { ...state, classifications: rest, skipped: [...state.skipped, action.placementId] };
    }
    case 'UNSKIP':
      return { ...state, skipped: state.skipped.filter((id) => id !== action.placementId) };
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
    version: 2,
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
