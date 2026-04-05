'use client';

import { useState } from 'react';
import BoardMap, { Placement, BOARD_X_MIN, BOARD_X_MAX, BOARD_Y_MIN, BOARD_Y_MAX } from '@/components/BoardMap';
import placementsData from '@/app/data/placements_12x12.json';

const placements = placementsData as Placement[];

const SET_COLORS: Record<string, string> = {
  'Bolt Ons': '#60a5fa',
  'Screw Ons': '#f59e0b',
};

export default function BoardMapPage() {
  const [selectedHold, setSelectedHold] = useState<Placement | null>(null);
  const [showLabels, setShowLabels] = useState(false);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-4">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Kilter Board 12×12</h1>
            <p className="text-sm text-zinc-400">{placements.length} holds · Bolt Ons only</p>
          </div>
          <button
            onClick={() => setShowLabels((v) => !v)}
            className={`px-3 py-1 rounded text-sm border transition-colors ${
              showLabels
                ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                : 'border-zinc-600 text-zinc-400 hover:border-zinc-400'
            }`}
          >
            {showLabels ? 'Hide IDs' : 'Show IDs'}
          </button>
        </div>

        {/* Legend */}
        <div className="flex gap-4 text-xs text-zinc-400">
          <span>
            Board: x=[{BOARD_X_MIN}–{BOARD_X_MAX}] y=[{BOARD_Y_MIN}–{BOARD_Y_MAX}]
          </span>
          <span>Higher y = higher on board</span>
        </div>

        {/* Board */}
        <div className="overflow-x-auto">
          <div style={{ minWidth: '320px' }}>
            <BoardMap
              placements={placements}
              highlightId={selectedHold?.placement_id}
              size="full"
              showLabels={showLabels}
              onHoldClick={setSelectedHold}
            />
          </div>
        </div>

        {/* Hold detail panel */}
        {selectedHold && (
          <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4 space-y-2">
            <div className="flex items-start justify-between">
              <h2 className="font-semibold text-lg">Hold #{selectedHold.placement_id}</h2>
              <button
                onClick={() => setSelectedHold(null)}
                className="text-zinc-400 hover:text-zinc-100 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-zinc-400">Placement ID</dt>
              <dd>{selectedHold.placement_id}</dd>
              <dt className="text-zinc-400">Hole ID</dt>
              <dd>{selectedHold.hole_id}</dd>
              <dt className="text-zinc-400">Hole name</dt>
              <dd>{selectedHold.hole_name}</dd>
              <dt className="text-zinc-400">Position (x, y)</dt>
              <dd>({selectedHold.x}, {selectedHold.y})</dd>
              <dt className="text-zinc-400">Default role</dt>
              <dd>{selectedHold.default_role}</dd>
              <dt className="text-zinc-400">Set</dt>
              <dd>{selectedHold.set_name}</dd>
            </dl>
          </div>
        )}

        {/* Stats */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="text-sm font-semibold text-zinc-400 mb-3">Role distribution</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(
              placements.reduce<Record<string, number>>((acc, p) => {
                acc[p.default_role] = (acc[p.default_role] ?? 0) + 1;
                return acc;
              }, {})
            )
              .sort(([, a], [, b]) => b - a)
              .map(([role, count]) => (
                <span
                  key={role}
                  className="px-2 py-1 rounded bg-zinc-800 text-xs text-zinc-300"
                >
                  {role}: {count}
                </span>
              ))}
          </div>
        </div>
      </div>
    </main>
  );
}
