// sessionStorage-backed persistence of the last Discover filter result list,
// so /discover/detail can offer Next/Prev navigation without re-fetching the
// whole page. Scope is per-tab and per-session — intentionally short-lived.

const LIST_KEY = 'kilter-up:discover:filtered-list';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface FilteredList {
  climbIds: string[]; // ordered uuids as the user saw them
  angle: number;      // angle used when filtering — Next/Prev reuses it
  timestamp: number;  // Date.now() at write time
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function saveFilteredList(list: FilteredList): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.setItem(LIST_KEY, JSON.stringify(list));
  } catch {
    // Storage quota, private mode, etc. — silent drop: the feature degrades
    // to "no Next/Prev" which is acceptable.
  }
}

export function clearFilteredList(): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.removeItem(LIST_KEY);
  } catch {
    // ignore
  }
}

/**
 * Read the saved filter list. Returns null if missing, corrupt, or stale.
 * Stale entries are cleared as a side effect so they don't sit around.
 */
export function readFilteredList(): FilteredList | null {
  if (!isBrowser()) return null;
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(LIST_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearFilteredList();
    return null;
  }
  if (!isFilteredList(parsed)) {
    clearFilteredList();
    return null;
  }
  if (Date.now() - parsed.timestamp > MAX_AGE_MS) {
    clearFilteredList();
    return null;
  }
  return parsed;
}

function isFilteredList(x: unknown): x is FilteredList {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    Array.isArray(o.climbIds) &&
    o.climbIds.every((id) => typeof id === 'string') &&
    typeof o.angle === 'number' &&
    typeof o.timestamp === 'number'
  );
}

/**
 * Given the current climb uuid, resolve its index in the saved list.
 * Returns null if no valid list, or if the uuid is not part of it
 * (deep link / stale entry case).
 */
export function resolvePosition(
  currentUuid: string,
): { list: FilteredList; index: number } | null {
  const list = readFilteredList();
  if (!list) return null;
  const index = list.climbIds.indexOf(currentUuid);
  if (index < 0) return null;
  return { list, index };
}
