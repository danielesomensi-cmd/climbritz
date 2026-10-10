// GAME-001 — pure translation of the Add-On game state into BLE encoder
// frames. Starts/middles use role ids (colors resolved by
// kilter-protocol.PLACEMENT_ROLES); the new / previewed hold is plain white.
// No per-player colors on the wall: the 3-3-2 color quantizer and the orange
// foot role would make them ambiguous.
// GAME-002 feet mode: feet go out as role 15 (FFB600, yellow); the new foot
// of the turn is white like the new hand hold and blinks with it.

import type { EncoderHold } from '@/lib/ble/kilter-protocol';
import ledsMap from '@/app/data/leds_12x12.json';

const LED_BY_PLACEMENT = ledsMap as Record<string, number>;

export const ROLE_START = 12;
export const ROLE_MIDDLE = 13;
export const ROLE_FINISH = 14;
export const ROLE_FOOT = 15;
export const NEW_HOLD_COLOR = 'FFFFFF';

export function ledPosition(placementId: number): number | undefined {
  return LED_BY_PLACEMENT[String(placementId)];
}

export function hasLed(placementId: number): boolean {
  return ledPosition(placementId) !== undefined;
}

function push(out: EncoderHold[], placementId: number, hold: Omit<EncoderHold, 'position'>) {
  const position = ledPosition(placementId);
  if (position === undefined) return; // no LED on this placement — skip
  out.push({ position, ...hold });
}

export interface FeetLeds {
  /** Feet already in the sequence (start foot + sent feet) → role 15. */
  feet?: number[];
  /** Foot being previewed/attempted this turn → white. */
  newFootId?: number | null;
}

/**
 * In-game frame: starts green, added holds cyan, feet yellow (r15), `newId`
 * (preview or the hold being attempted) and `newFootId` white. A new id
 * already in the sequence is ignored.
 */
export function sequenceToLedCommands(
  starts: number[],
  added: number[],
  newId: number | null = null,
  { feet = [], newFootId = null }: FeetLeds = {},
): EncoderHold[] {
  const out: EncoderHold[] = [];
  const used = [...starts, ...added, ...feet];
  for (const id of starts) push(out, id, { role_id: ROLE_START });
  for (const id of added) push(out, id, { role_id: ROLE_MIDDLE });
  for (const id of feet) push(out, id, { role_id: ROLE_FOOT });
  if (newId !== null && !used.includes(newId)) {
    push(out, newId, { color: NEW_HOLD_COLOR });
  }
  if (newFootId !== null && newFootId !== newId && !used.includes(newFootId)) {
    push(out, newFootId, { color: NEW_HOLD_COLOR });
  }
  return out;
}

/** Game-over frame: the last `finishCount` added holds turn magenta (finish). */
export function finalLedCommands(
  starts: number[],
  added: number[],
  finishCount: 1 | 2 = 1,
  feet: number[] = [],
): EncoderHold[] {
  const out: EncoderHold[] = [];
  const firstFinish = added.length - Math.min(finishCount, added.length);
  for (const id of starts) push(out, id, { role_id: ROLE_START });
  added.forEach((id, i) =>
    push(out, id, { role_id: i >= firstFinish ? ROLE_FINISH : ROLE_MIDDLE }),
  );
  for (const id of feet) push(out, id, { role_id: ROLE_FOOT });
  return out;
}

/**
 * Blink the new hold (and the new foot, if any) `times` times: alternating
 * frames without / with them, always ending on the full frame so the wall
 * settles on the right state.
 */
export function blinkFrames(
  starts: number[],
  added: number[],
  newId: number,
  times = 2,
  { feet = [], newFootId = null }: FeetLeds = {},
): EncoderHold[][] {
  const without = sequenceToLedCommands(starts, added, null, { feet });
  const withNew = sequenceToLedCommands(starts, added, newId, { feet, newFootId });
  const frames: EncoderHold[][] = [];
  for (let i = 0; i < times; i++) frames.push(without, withNew);
  return frames;
}
