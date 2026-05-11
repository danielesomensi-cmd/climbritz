'use client';

import { memo } from 'react';
import Link from 'next/link';
import type { ClimbSearchResult } from '@/app/lib/api';
import GradeDisplay from './GradeDisplay';
import StarRating from './StarRating';
import StateIcons from './StateIcons';

interface ClimbCardProps {
  climb: ClimbSearchResult;
}

function formatAscents(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

// B020: memoised — DiscoverPage now renders up to 500 cards, so we want
// the card list to be stable across parent re-renders (filter UI state,
// debounce ticks, sessionStorage writes) when the climb prop is unchanged.
function ClimbCardComponent({ climb }: ClimbCardProps) {
  return (
    <Link
      href={`/discover/detail?id=${climb.uuid}&angle=${climb.angle}`}
      data-testid={`climb-card-${climb.uuid}`}
      className="flex items-center gap-4 p-4 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-orange-500/50 hover:bg-zinc-800/60 transition-colors"
    >
      <GradeDisplay grade={climb.grade} size="lg" />

      <div
        data-testid="card-info-column"
        className="flex-1 min-w-0"
      >
        <div className="text-white font-semibold truncate">{climb.name}</div>
        <div className="text-xs text-zinc-400 truncate">by {climb.setter}</div>
        <div className="mt-1 flex items-center gap-3">
          <StarRating value={climb.quality_average} size={12} />
          <span className="text-xs text-zinc-500">
            {formatAscents(climb.ascensionist_count)} ascents
          </span>
        </div>
        {/* B-A021-fix-2.4.1 — state icon strip as its own row INSIDE the
            info column, below the stars/ascents line. Previously absolute-
            positioned top-2/right-3, which on iPhone overlapped the Angle
            column's "ANGLE" / "40°" stack. StateIcons returns null when
            user_state is null/empty so this row collapses to zero height
            for climbs the user has no history on. */}
        <div className="mt-1 empty:hidden">
          <StateIcons userState={climb.user_state} />
        </div>
      </div>

      <div className="text-right shrink-0">
        <div className="text-xs text-zinc-400 uppercase tracking-wide">Angle</div>
        <div className="text-white font-semibold">{climb.angle}°</div>
      </div>
    </Link>
  );
}

export default memo(ClimbCardComponent);
