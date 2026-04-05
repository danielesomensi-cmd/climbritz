'use client';

// Board coordinate bounds (from 12x12_placements.json)
export const BOARD_X_MIN = 0;
export const BOARD_X_MAX = 144;
export const BOARD_Y_MIN = 16;
export const BOARD_Y_MAX = 152;
const BOARD_W = BOARD_X_MAX - BOARD_X_MIN; // 144
const BOARD_H = BOARD_Y_MAX - BOARD_Y_MIN; // 136

export interface Placement {
  placement_id: number;
  hole_id: number;
  x: number;
  y: number;
  hole_name: string;
  default_role: string;
  set_name: string;
  set_id: number;
  role_id: number;
}

interface BoardMapProps {
  placements: Placement[];
  /** placement_id of the hold to highlight */
  highlightId?: number;
  /** 'full' = full page board with images, 'mini' = inline reference with dots */
  size?: 'full' | 'mini';
  /** Show hole_name labels (full size only) */
  showLabels?: boolean;
  /** Called when a hold is clicked */
  onHoldClick?: (placement: Placement) => void;
}

function toPosition(x: number, y: number) {
  return {
    left: `${(x / BOARD_W) * 100}%`,
    top: `${((BOARD_Y_MAX - y) / BOARD_H) * 100}%`,
  };
}

function getImageUrl(placementId: number): string {
  const base =
    typeof window !== 'undefined'
      ? (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8001')
      : 'http://localhost:8001';
  return `${base}/api/holds/${placementId}/image`;
}

export default function BoardMap({
  placements,
  highlightId,
  size = 'full',
  showLabels = false,
  onHoldClick,
}: BoardMapProps) {
  const isMini = size === 'mini';

  // Dot size for mini, image size for full — expressed as % of board width
  // At mini ~150px: 5% = 7.5px dots | At full ~700px: 3% = 21px images
  const holdPct = isMini ? '5%' : '3.2%';

  return (
    <div
      data-testid="board-map"
      className="relative bg-zinc-900 rounded overflow-hidden"
      style={{ width: '100%', aspectRatio: `${BOARD_W} / ${BOARD_H}` }}
    >
      {placements.map((hold) => {
        const pos = toPosition(hold.x, hold.y);
        const isHighlighted = hold.placement_id === highlightId;

        return (
          <div
            key={hold.placement_id}
            data-testid={`hold-${hold.placement_id}`}
            className="absolute"
            style={{
              left: pos.left,
              top: pos.top,
              transform: 'translate(-50%, -50%)',
              width: holdPct,
              aspectRatio: '1',
              cursor: onHoldClick ? 'pointer' : 'default',
            }}
            onClick={() => onHoldClick?.(hold)}
            title={showLabels ? `${hold.placement_id} (${hold.hole_name})` : undefined}
          >
            {isMini ? (
              <div
                className={`w-full h-full rounded-full transition-colors ${
                  isHighlighted
                    ? 'bg-yellow-400 shadow-[0_0_6px_2px_rgba(250,204,21,0.7)]'
                    : 'bg-zinc-500 opacity-60'
                }`}
              />
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getImageUrl(hold.placement_id)}
                  alt={`Hold ${hold.placement_id}`}
                  className={`w-full h-full object-contain rounded transition-all ${
                    isHighlighted
                      ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-zinc-900 scale-125'
                      : ''
                  }`}
                  loading="lazy"
                />
                {showLabels && (
                  <span
                    className="absolute left-1/2 -translate-x-1/2 top-full text-[6px] text-zinc-400 whitespace-nowrap"
                    aria-hidden="true"
                  >
                    {hold.placement_id}
                  </span>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
