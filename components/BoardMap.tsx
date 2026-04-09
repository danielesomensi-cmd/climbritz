'use client';

// Board coordinate bounds match the 12x12 WITH KICKBOARD product size
// (product_size_id=10): x∈[0,144], y∈[0,156]. B016 extended from the old
// 12x12-no-kickboard crop (y≥12) to include the kickboard row.
export const BOARD_X_MIN = 0;
export const BOARD_X_MAX = 144;
export const BOARD_Y_MIN = 0;
export const BOARD_Y_MAX = 156;
const BOARD_W = BOARD_X_MAX - BOARD_X_MIN; // 144
const BOARD_H = BOARD_Y_MAX - BOARD_Y_MIN; // 156

// BoardLib set IDs for Kilter Board Original (layout_id=1)
const SET_BOLT_ONS = 1;    // big bolt-on handholds
const SET_SCREW_ONS = 20;  // small screw-on footholds

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
  /** 'full' = large interactive map, 'mini' = compact reference (smaller circles) */
  size?: 'full' | 'mini';
  /** Show hole_name labels (full size only) */
  showLabels?: boolean;
  /** Called when a hold is clicked */
  onHoldClick?: (placement: Placement) => void;
  /**
   * Optional fill color per hold, keyed by placement_id. If omitted the
   * default (unclassified) cyan look is used. Used by the classify flow to
   * show per-category colors at a glance.
   */
  holdColors?: Record<number, string>;
}

// Hold images are served as static assets from public/holds/ so the
// classify and board-map flows work on Vercel without a backend dependency.
// See B010.
export function getBoardImageUrl(): string {
  return '/holds/board_original_12x12.png';
}

export function getHoldImageUrl(placementId: number): string {
  return `/holds/${placementId}.png`;
}

function toPosition(x: number, y: number) {
  return {
    left: `${((x - BOARD_X_MIN) / BOARD_W) * 100}%`,
    top: `${((BOARD_Y_MAX - y) / BOARD_H) * 100}%`,
  };
}

export default function BoardMap({
  placements,
  highlightId,
  size = 'full',
  showLabels = false,
  onHoldClick,
  holdColors,
}: BoardMapProps) {
  const isMini = size === 'mini';
  // Circle diameter as % of board width. Screw-on footholds are physically
  // much smaller than bolt-on handholds, so we draw them roughly half-size.
  const boltPct = isMini ? '3.2%' : '4.2%';
  const screwPct = isMini ? '1.8%' : '2.3%';

  return (
    <div
      data-testid="board-map"
      className="relative bg-zinc-900 rounded-lg overflow-hidden select-none"
      style={{ width: '100%', aspectRatio: `${BOARD_W} / ${BOARD_H}` }}
    >
      {/* Composite board background */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getBoardImageUrl()}
        alt="Kilter Board 12x12 layout"
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        draggable={false}
      />

      {/* Overlay clickable hold markers */}
      {placements.map((hold) => {
        const pos = toPosition(hold.x, hold.y);
        const isHighlighted = hold.placement_id === highlightId;
        const customColor = holdColors?.[hold.placement_id];
        const isScrewOn = hold.set_id === SET_SCREW_ONS;
        const holdPct = isScrewOn ? screwPct : boltPct;

        // Active hold (has a role color): hollow ring — transparent fill +
        // thick colored border — so you can still see the physical hold
        // through the circle, matching the kilterboard.io look.
        // Inactive: translucent gray fill.
        const baseClass = customColor
          ? 'bg-transparent'
          : 'border-zinc-300/70 bg-zinc-400/25 hover:bg-zinc-300/40';
        const highlightClass = isHighlighted
          ? 'ring-2 ring-yellow-300 ring-offset-1 ring-offset-transparent shadow-[0_0_10px_3px_rgba(250,204,21,0.7)] animate-pulse'
          : '';

        const ringBorder = customColor
          ? {
              borderColor: customColor,
              borderWidth: isScrewOn ? '1.5px' : '2.5px',
              boxShadow: `0 0 4px ${customColor}`,
            }
          : {};

        return (
          <button
            key={hold.placement_id}
            type="button"
            data-testid={`hold-${hold.placement_id}`}
            aria-label={`Hold ${hold.placement_id} (${hold.hole_name})`}
            onClick={onHoldClick ? () => onHoldClick(hold) : undefined}
            disabled={!onHoldClick}
            className={`absolute rounded-full border transition-all ${baseClass} ${highlightClass} ${
              onHoldClick ? 'cursor-pointer hover:scale-110' : 'cursor-default'
            }`}
            style={{
              left: pos.left,
              top: pos.top,
              transform: 'translate(-50%, -50%)',
              width: holdPct,
              aspectRatio: '1',
              padding: 0,
              ...ringBorder,
            }}
            title={showLabels ? `${hold.placement_id} (${hold.hole_name})` : undefined}
          >
            {showLabels && !isMini && (
              <span
                className="absolute left-1/2 -translate-x-1/2 top-full mt-0.5 text-[8px] text-zinc-200 bg-zinc-900/80 px-1 rounded whitespace-nowrap pointer-events-none"
                aria-hidden="true"
              >
                {hold.placement_id}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
