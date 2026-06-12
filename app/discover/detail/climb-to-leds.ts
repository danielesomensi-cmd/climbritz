// Translate a climb's placement-based holds into the BLE encoder input:
// { position: <led_position>, role_id }. Colors are resolved downstream by
// kilter-protocol.PLACEMENT_ROLES — this module must NOT know hex values.

import type { HoldPosition } from '@/app/lib/api';
import type { EncoderHold } from '@/lib/ble/kilter-protocol';
import ledsMap from '@/app/data/leds_12x12.json';

// Role strings the climb API returns → role_id the BLE encoder expects.
// Source of truth for role_id → color is kilter-protocol.PLACEMENT_ROLES.
// Exported for A030: the generate page serializes saved problems into the
// BoardLib frames encoding (p{placement_id}r{role_id}) with the same map.
export const ROLE_STRING_TO_ID: Record<string, number> = {
  start: 12,
  middle: 13,
  finish: 14,
  foot_only: 15,
};

const LED_BY_PLACEMENT = ledsMap as Record<string, number>;

/**
 * Convert a climb's holds into BLE encoder input. Drops holds whose role is
 * unknown or whose placement_id has no LED on the 12x12 board (edge cases —
 * reported via console.warn so the dev catches data issues without breaking
 * the send).
 */
export function climbToLedCommands(holds: HoldPosition[]): EncoderHold[] {
  const out: EncoderHold[] = [];
  for (const h of holds) {
    const roleId = ROLE_STRING_TO_ID[h.role];
    if (roleId === undefined) {
      console.warn(`[climb-to-leds] unknown role "${h.role}" on placement ${h.placement_id} — skipped`);
      continue;
    }
    const ledPosition = LED_BY_PLACEMENT[String(h.placement_id)];
    if (ledPosition === undefined) {
      console.warn(`[climb-to-leds] placement ${h.placement_id} has no LED mapping — skipped`);
      continue;
    }
    out.push({ position: ledPosition, role_id: roleId });
  }
  return out;
}
