'use client';

import { useMemo } from 'react';
import BoardMap, { type Placement } from './BoardMap';
import type { HoldPosition } from '@/app/lib/api';
import allPlacements from '@/app/data/placements_12x12.json';

/** Role → fill color mapping (matches kilterboard.io convention). */
export const ROLE_COLORS: Record<string, string> = {
  start: '#22c55e',     // green
  middle: '#06b6d4',    // cyan
  finish: '#a855f7',    // magenta/purple
  foot_only: '#facc15', // yellow
};

interface ClimbBoardViewProps {
  holds: HoldPosition[];
}

/**
 * Renders the full 12x12 Kilter Board with the given climb's active holds
 * colored by role. Inactive holds appear in the BoardMap's default gray
 * look. Reuses the existing BoardMap component so coordinate math stays
 * in one place.
 */
export default function ClimbBoardView({ holds }: ClimbBoardViewProps) {
  const placements = allPlacements as Placement[];

  const holdColors = useMemo(() => {
    const map: Record<number, string> = {};
    for (const h of holds) {
      const color = ROLE_COLORS[h.role];
      if (color) map[h.placement_id] = color;
    }
    return map;
  }, [holds]);

  return (
    <div data-testid="climb-board-view">
      <BoardMap placements={placements} holdColors={holdColors} />
    </div>
  );
}
