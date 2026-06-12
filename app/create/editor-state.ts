// A031 — pure hold-editor logic (palette + paint), kept DB/React-free so
// jest can exercise every transition. The page wires it to BoardMap taps.
//
// Role/placement semantics (Phase 0, verified on the real corpus):
// bolt-ons (set_id 1) carry every role in real climbs — including foot
// (47k foot placements on bolt-ons in the first 30k listed climbs) — so
// they accept Start/Middle/Finish/Foot. Screw-ons (set_id 20) are ~94%
// foot in real data and the brief pins them to Foot only.

import type { DraftHold } from './draft-storage';

export type PaletteRole = 'start' | 'middle' | 'finish' | 'foot_only' | 'erase';

const SET_SCREW_ONS = 20;

/** Per-role hold caps mirrored by the server (my_climbs_service A031). */
export const MAX_START = 2;
export const MAX_FINISH = 2;
export const MIN_HOLDS = 3;

/**
 * Apply one paint action. Returns the next holds array (new reference on
 * change, SAME reference when the action is a no-op — callers can use
 * identity to skip BLE re-sends).
 *
 * Rules:
 *  - erase           → remove the hold (no-op if absent);
 *  - same role tap   → toggle off (remove);
 *  - screw-on + hand role → no-op (footholds paint only with Foot);
 *  - otherwise       → set/replace the role.
 */
export function paintHold(
  holds: DraftHold[],
  placementId: number,
  setId: number,
  role: PaletteRole,
): DraftHold[] {
  const existing = holds.find((h) => h.placement_id === placementId);

  if (role === 'erase') {
    if (!existing) return holds;
    return holds.filter((h) => h.placement_id !== placementId);
  }

  if (setId === SET_SCREW_ONS && role !== 'foot_only') return holds;

  if (existing) {
    if (existing.role === role) {
      // Toggle off.
      return holds.filter((h) => h.placement_id !== placementId);
    }
    return holds.map((h) =>
      h.placement_id === placementId ? { ...h, role } : h,
    );
  }
  return [...holds, { placement_id: placementId, role }];
}

export interface DraftValidation {
  valid: boolean;
  errors: string[];
}

/** Client-side mirror of the server's structural rules (1–2 start,
 *  1–2 finish, ≥3 holds). Messages are user-facing (English). */
export function validateDraft(holds: DraftHold[]): DraftValidation {
  const errors: string[] = [];
  const starts = holds.filter((h) => h.role === 'start').length;
  const finishes = holds.filter((h) => h.role === 'finish').length;

  if (holds.length < MIN_HOLDS) {
    errors.push(`At least ${MIN_HOLDS} holds (${holds.length} so far)`);
  }
  if (starts < 1) errors.push('Add a start hold');
  if (starts > MAX_START) errors.push(`Max ${MAX_START} start holds (${starts} painted)`);
  if (finishes < 1) errors.push('Add a finish hold');
  if (finishes > MAX_FINISH) errors.push(`Max ${MAX_FINISH} finish holds (${finishes} painted)`);

  return { valid: errors.length === 0, errors };
}

const ROLE_TO_ID: Record<string, number> = {
  start: 12,
  middle: 13,
  finish: 14,
  foot_only: 15,
};

/** Serialize a draft into the exact BoardLib frames encoding. */
export function draftToFrames(holds: DraftHold[]): string {
  return holds
    .map((h) => `p${h.placement_id}r${ROLE_TO_ID[h.role]}`)
    .join('');
}
