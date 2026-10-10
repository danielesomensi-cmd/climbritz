// GAME-001 — hit-testing for the transparent tap overlay above BoardMap.
// BoardMap's hold circles are small (4.2% / 2.3% of the width) and shared
// with /classify, /create and /board-map, so instead of enlarging them we
// snap a tap to the nearest eligible hold within a generous radius.

import {
  BOARD_X_MAX,
  BOARD_X_MIN,
  BOARD_Y_MAX,
  BOARD_Y_MIN,
  type Placement,
} from '@/components/BoardMap';

const BOARD_W = BOARD_X_MAX - BOARD_X_MIN;
const BOARD_H = BOARD_Y_MAX - BOARD_Y_MIN;

/** Default snap radius, as a percentage of the board WIDTH. */
export const DEFAULT_PICK_RADIUS_PCT = 6;

/** Tap position (client px) → percentages of the overlay box (0–100). */
export function pointToPct(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): { xPct: number; yPct: number } | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    xPct: ((clientX - rect.left) / rect.width) * 100,
    yPct: ((clientY - rect.top) / rect.height) * 100,
  };
}

/**
 * Nearest placement to a tap expressed in overlay percentages (same mapping
 * as BoardMap.toPosition: x left→right, y top = BOARD_Y_MAX). Distance is
 * measured in board units so the snap circle is round on the real board.
 * Returns null when nothing eligible is within `radiusPct` (% of width).
 */
export function nearestHold<P extends Pick<Placement, 'x' | 'y'>>(
  xPct: number,
  yPct: number,
  placements: P[],
  radiusPct: number = DEFAULT_PICK_RADIUS_PCT,
  eligible: (p: P) => boolean = () => true,
): P | null {
  const bx = BOARD_X_MIN + (xPct / 100) * BOARD_W;
  const by = BOARD_Y_MAX - (yPct / 100) * BOARD_H;
  const maxDist = (radiusPct / 100) * BOARD_W;
  let best: P | null = null;
  let bestD2 = maxDist * maxDist;
  for (const p of placements) {
    if (!eligible(p)) continue;
    const dx = p.x - bx;
    const dy = p.y - by;
    const d2 = dx * dx + dy * dy;
    if (d2 <= bestD2) {
      best = p;
      bestD2 = d2;
    }
  }
  return best;
}
