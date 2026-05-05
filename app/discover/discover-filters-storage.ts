// sessionStorage-backed persistence of the Discover filter UI state, so
// filters (including angle and search query) survive navigation to and
// back from /discover/detail. Scope is per-tab and per-session — mirrors
// the pattern used by filtered-list-storage.ts.

import type { Filters } from '@/components/FilterPanel';

const KEY = 'kilter-up:discover:filters';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface DiscoverFilters {
  query: string;
  angle: number;
  filters: Filters;
  timestamp: number;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function saveDiscoverFilters(
  state: Omit<DiscoverFilters, 'timestamp'>,
): void {
  if (!isBrowser()) return;
  try {
    const payload: DiscoverFilters = { ...state, timestamp: Date.now() };
    window.sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Storage quota or private mode — silent drop: filters degrade to
    // URL-param behaviour, which is acceptable.
  }
}

export function clearDiscoverFilters(): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/**
 * Read the saved filter state. Returns null if missing, corrupt, or stale.
 * Stale entries are cleared as a side effect.
 */
export function loadDiscoverFilters(): DiscoverFilters | null {
  if (!isBrowser()) return null;
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearDiscoverFilters();
    return null;
  }
  if (!isDiscoverFilters(parsed)) {
    clearDiscoverFilters();
    return null;
  }
  if (Date.now() - parsed.timestamp > MAX_AGE_MS) {
    clearDiscoverFilters();
    return null;
  }
  return parsed;
}

const SORT_VALUES = ['popularity', 'quality', 'grade_asc', 'grade_desc'];
const MOVES_VALUES = ['any', 'le5', '6-7', '8-10', 'gt10'];

function isDiscoverFilters(x: unknown): x is DiscoverFilters {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  if (typeof o.query !== 'string') return false;
  if (typeof o.angle !== 'number') return false;
  if (typeof o.timestamp !== 'number') return false;
  if (!o.filters || typeof o.filters !== 'object') return false;

  const f = o.filters as Record<string, unknown>;
  if (!SORT_VALUES.includes(f.sort as string)) return false;
  // moves is optional for backwards compatibility with pre-A019 entries.
  if (f.moves !== undefined && !MOVES_VALUES.includes(f.moves as string)) return false;
  for (const k of ['gradeMin', 'gradeMax', 'minAscents', 'minQuality']) {
    if (f[k] !== undefined && typeof f[k] !== 'number') return false;
  }
  return true;
}
