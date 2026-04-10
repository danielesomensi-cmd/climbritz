'use client';

import type { LedHold } from './presets';

// Coordinate bounds match product_size_id=10 ("12x12 with kickboard")
// Same constants as BoardMap.tsx: x∈[0,144], y∈[0,156]
const BOARD_W = 144;
const BOARD_H = 156;

// Role ID → display color (matches Kilter Board LED role colors)
const ROLE_COLORS: Record<number, string> = {
  12: '#00FF00', // Start   — green
  13: '#00FFFF', // Middle  — cyan
  14: '#FF00FF', // Finish  — magenta
  15: '#FFB600', // Foot    — orange
};

function holdColor(hold: LedHold): string {
  if (hold.color) return `#${hold.color}`;
  if (hold.role_id !== undefined) return ROLE_COLORS[hold.role_id] ?? '#FFFFFF';
  return '#FFFFFF';
}

interface BoardPreviewProps {
  holds: LedHold[];
}

export function BoardPreview({ holds }: BoardPreviewProps) {
  // Only render circles for holds with valid 12x12 coordinates
  const visible = holds.filter((h) => h.x !== null && h.y !== null);

  return (
    <div className="relative w-full" style={{ aspectRatio: `${BOARD_W}/${BOARD_H}` }}>
      {/* Plain <img> instead of next/image — works in Capacitor static export */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/holds/board_original_12x12.png"
        alt="Kilter Board 12x12"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill' }}
        className="rounded"
      />
      {visible.map((h, i) => {
        const pctLeft = ((h.x as number) / BOARD_W) * 100;
        const pctBottom = ((h.y as number) / BOARD_H) * 100;
        const color = holdColor(h);
        return (
          <div
            key={i}
            className="absolute rounded-full border-2 border-white/60"
            style={{
              left: `${pctLeft}%`,
              bottom: `${pctBottom}%`,
              transform: 'translate(-50%, 50%)',
              width: '3.8%',
              height: '3.5%',
              backgroundColor: color,
              boxShadow: `0 0 6px 2px ${color}88`,
              zIndex: 10,
            }}
          />
        );
      })}
    </div>
  );
}
