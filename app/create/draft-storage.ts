// A031 — sessionStorage hand-off of an editor draft between /generate,
// /my-problems/detail and /create. Frames can be hundreds of chars, so the
// draft travels via storage, NOT the query string (Capacitor routing stays
// clean). Same idiom + TTL semantics as filtered-list-storage.

export interface DraftHold {
  placement_id: number;
  role: string; // start | middle | finish | foot_only
}

export interface CreateDraft {
  /** 'new' → Save POSTs a new problem; 'edit' → Save PATCHes `uuid`. */
  mode: 'new' | 'edit';
  uuid?: string;
  name: string;
  grade: string | null;
  angle: number;
  holds: DraftHold[];
  seed_climb_uuid?: string | null;
  /** Edit mode: the problem has logs → light confirm before saving. */
  hasLogs?: boolean;
  timestamp: number;
}

const KEY = 'climbritz:create:draft';
const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour — a hand-off, not a store

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function saveCreateDraft(draft: Omit<CreateDraft, 'timestamp'>): void {
  if (!isBrowser()) return;
  try {
    const payload: CreateDraft = { ...draft, timestamp: Date.now() };
    window.sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Quota/private mode — the editor falls back to a blank board.
  }
}

export function clearCreateDraft(): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function loadCreateDraft(): CreateDraft | null {
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
    clearCreateDraft();
    return null;
  }
  if (!isCreateDraft(parsed)) {
    clearCreateDraft();
    return null;
  }
  if (Date.now() - parsed.timestamp > MAX_AGE_MS) {
    clearCreateDraft();
    return null;
  }
  return parsed;
}

const ROLES = ['start', 'middle', 'finish', 'foot_only'];

function isCreateDraft(x: unknown): x is CreateDraft {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  if (o.mode !== 'new' && o.mode !== 'edit') return false;
  if (o.mode === 'edit' && typeof o.uuid !== 'string') return false;
  if (typeof o.name !== 'string') return false;
  if (o.grade !== null && typeof o.grade !== 'string') return false;
  if (typeof o.angle !== 'number') return false;
  if (typeof o.timestamp !== 'number') return false;
  if (!Array.isArray(o.holds)) return false;
  return (o.holds as unknown[]).every((h) => {
    if (!h || typeof h !== 'object') return false;
    const hold = h as Record<string, unknown>;
    return (
      typeof hold.placement_id === 'number' &&
      typeof hold.role === 'string' &&
      ROLES.includes(hold.role)
    );
  });
}
