'use client';

import { useState } from 'react';
import BoardMap, {
  Placement,
  BOARD_X_MIN,
  BOARD_X_MAX,
  BOARD_Y_MIN,
  BOARD_Y_MAX,
  getHoldImageUrl,
} from '@/components/BoardMap';
import AuthGuard from '@/components/AuthGuard';
import placementsData from '@/app/data/placements_12x12.json';

const placements = placementsData as Placement[];

function BoardMapContent() {
  const [selectedHold, setSelectedHold] = useState<Placement | null>(null);
  const [showLabels, setShowLabels] = useState(false);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 pt-safe px-4 pb-4">
      <div className="max-w-6xl mx-auto space-y-4">
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

        <div className="text-xs text-zinc-400">
          Board: x=[{BOARD_X_MIN}–{BOARD_X_MAX}] y=[{BOARD_Y_MIN}–{BOARD_Y_MAX}] · Click a hold for details
        </div>

        {/* Responsive layout: board + detail panel */}
        <div className="grid gap-4 md:grid-cols-[1fr_320px]">
          {/* Board */}
          <div>
            <BoardMap
              placements={placements}
              highlightId={selectedHold?.placement_id}
              size="full"
              showLabels={showLabels}
              onHoldClick={setSelectedHold}
            />
          </div>

          {/* Detail panel — side on desktop, below on mobile */}
          <aside
            className="rounded-lg border border-zinc-700 bg-zinc-900 p-4 min-h-[260px]"
            data-testid="hold-detail-panel"
          >
            {selectedHold ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <h2 className="font-semibold text-lg">Hold #{selectedHold.placement_id}</h2>
                  <button
                    onClick={() => setSelectedHold(null)}
                    className="text-zinc-400 hover:text-zinc-100 text-2xl leading-none"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                {/* Large crop of the individual hold */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getHoldImageUrl(selectedHold.placement_id)}
                  alt={`Hold ${selectedHold.placement_id}`}
                  className="w-full aspect-square object-contain rounded-lg bg-zinc-800 border border-zinc-700"
                />

                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-zinc-400">Placement</dt>
                  <dd>{selectedHold.placement_id}</dd>
                  <dt className="text-zinc-400">Hole</dt>
                  <dd>
                    {selectedHold.hole_name} <span className="text-zinc-500">(#{selectedHold.hole_id})</span>
                  </dd>
                  <dt className="text-zinc-400">Position</dt>
                  <dd>({selectedHold.x}, {selectedHold.y})</dd>
                  <dt className="text-zinc-400">Role</dt>
                  <dd>{selectedHold.default_role}</dd>
                  <dt className="text-zinc-400">Set</dt>
                  <dd>{selectedHold.set_name}</dd>
                </dl>
              </div>
            ) : (
              <p className="text-sm text-zinc-500 text-center pt-16">
                Click a hold on the board to see its details.
              </p>
            )}
          </aside>
        </div>

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

export default function BoardMapPage() {
  return (
    <AuthGuard>
      <BoardMapContent />
    </AuthGuard>
  );
}
