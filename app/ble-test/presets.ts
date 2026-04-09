// LED positions queried from BoardLib kilter.db, layout_id=1 (Kilter Board Original 12x12)
// Board coordinates (x,y) from product_size_id=10: "12x12 with kickboard"
//   x∈[0,144], y∈[0,156] — same system used by BoardMap.tsx
// Positions not in product_size_id=10 have x/y=null: BLE still sends them,
//   but no circle is drawn on the visual preview.

// Pre-computed from:
//   SELECT l.position, h.x, h.y FROM leds l JOIN holes h ON l.hole_id=h.id
//   WHERE l.product_size_id=10 AND l.position IN (...)
const POSITION_COORDS: Record<number, [number, number]> = {
  0: [140, 4],    1: [136, 8],    2: [132, 4],    3: [128, 8],
  4: [124, 4],    6: [116, 4],    8: [108, 4],    10: [100, 4],
  12: [92, 4],    13: [88, 8],    14: [84, 4],    16: [76, 4],
  18: [68, 4],    20: [60, 4],    21: [56, 8],    30: [20, 4],
  32: [12, 4],    33: [4, 4],     42: [8, 40],    43: [12, 44],
  44: [8, 48],    45: [4, 52],    46: [8, 56],    48: [8, 64],
  49: [4, 68],    50: [8, 72],    51: [12, 76],   52: [8, 80],
  53: [4, 84],    54: [8, 88],    55: [12, 92],   56: [8, 96],
  57: [4, 100],   58: [8, 104],   59: [12, 108],  60: [8, 112],
  61: [4, 116],   62: [8, 120],   63: [12, 124],  64: [8, 128],
  65: [4, 132],   66: [8, 136],   67: [8, 144],   68: [8, 152],
  69: [16, 152],  70: [16, 144],  71: [16, 136],  72: [20, 132],
  73: [16, 128],  74: [16, 120],  75: [20, 116],  76: [16, 112],
  77: [16, 104],  78: [20, 100],  79: [16, 96],   80: [16, 88],
  113: [24, 112], 116: [24, 128], 119: [24, 152],
  128: [32, 104], 129: [36, 100], 137: [32, 56],
  158: [40, 80],  183: [52, 84],  185: [48, 72],  186: [52, 68],
  221: [56, 152], 242: [64, 40],  243: [68, 36],
  299: [88, 16],  300: [88, 24],
  356: [104, 48], 357: [104, 56], 367: [108, 108], 378: [116, 132],
  413: [120, 80], 414: [120, 88], 416: [120, 96],
  440: [128, 72], 470: [136, 112], 471: [136, 120],
};

export interface LedHold {
  position: number;  // LED position sent via BLE
  role_id?: number;  // 12=Start(green), 13=Middle(cyan), 14=Finish(magenta), 15=Foot(orange)
  color?: string;    // custom hex e.g. "FF0000"
  // Board coordinates for visual overlay (null = outside 12x12 bounds, BLE-only)
  x: number | null;
  y: number | null;
}

export interface Preset {
  id: number;
  name: string;
  description: string;
  holds: LedHold[];
}

// Role IDs from placement_roles table
const START = 12;   // green   #00FF00
const MIDDLE = 13;  // cyan    #00FFFF
const FINISH = 14;  // magenta #FF00FF
const FOOT = 15;    // orange  #FFB600

function hold(
  position: number,
  roleOrColor: { role_id: number } | { color: string }
): LedHold {
  const coords = POSITION_COORDS[position] ?? null;
  return {
    position,
    ...roleOrColor,
    x: coords ? coords[0] : null,
    y: coords ? coords[1] : null,
  };
}

export const PRESETS: Preset[] = [
  {
    id: 1,
    name: 'All Corners',
    description: '4 holds at the board corners',
    holds: [
      hold(45,  { role_id: START }),   // bottom-left  (x=4,   y=52)
      hold(0,   { role_id: START }),   // bottom-right (x=140, y=4)
      hold(80,  { role_id: START }),   // top-left     (x=16,  y=88)
      hold(641, { role_id: START }),   // top-right    (no 12x12 coords — BLE only)
    ],
  },
  {
    id: 2,
    name: 'Center Cross',
    description: '5 holds in a + pattern at the center',
    holds: [
      hold(116, { role_id: MIDDLE }), // center (x=24, y=128)
      hold(74,  { role_id: MIDDLE }), // left   (x=16, y=120)
      hold(158, { role_id: MIDDLE }), // right  (x=40, y=80)
      hold(113, { role_id: MIDDLE }), // up     (x=24, y=112)
      hold(119, { role_id: MIDDLE }), // down   (x=24, y=152)
    ],
  },
  {
    id: 3,
    name: 'Bottom Row',
    description: 'All 18 holds on the bottom row',
    holds: [45, 44, 42, 33, 32, 30, 21, 20, 18, 16, 14, 12, 10, 8, 6, 4, 2, 0].map(
      (pos) => hold(pos, { role_id: FOOT })
    ),
  },
  {
    id: 4,
    name: 'Diagonal',
    description: '8 holds from bottom-left to top-right',
    holds: [45, 4, 3, 76, 137, 221, 440, 641].map(
      (pos) => hold(pos, { role_id: MIDDLE })
    ),
  },
  {
    id: 5,
    name: 'Rainbow',
    description: '4 holds across the board, one per role color',
    holds: [
      hold(12,  { role_id: START }),  // bottom-center (green)
      hold(116, { role_id: MIDDLE }), // center        (cyan)
      hold(299, { role_id: FINISH }), // top-center    (magenta)
      hold(80,  { role_id: FOOT }),   // left mid      (orange)
    ],
  },
  {
    id: 6,
    name: 'Start + Finish',
    description: '1 start hold (bottom) + 1 finish hold (top)',
    holds: [
      hold(12,  { role_id: START }),
      hold(299, { role_id: FINISH }),
    ],
  },
  {
    id: 7,
    name: 'Full Border',
    description: '103 holds around the full perimeter',
    holds: [
      0, 1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 21, 30, 32, 33, 42, 44, 45,
      46, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64,
      65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80,
      128, 129, 185, 186, 242, 243, 299, 300, 356, 357, 413, 414, 470, 471,
      525, 526, 527,
      595, 598, 601, 604, 607, 610, 613, 616, 617, 618, 619, 620, 621, 622,
      623, 624, 625, 626, 627, 628, 629, 630, 631, 632, 633, 634, 635, 636,
      637, 638, 639, 640, 641,
    ].map((pos) => hold(pos, { role_id: MIDDLE })),
  },
  {
    id: 8,
    name: 'Random 8',
    description: '8 holds spread across the board (seed 42)',
    holds: [
      hold(416, { role_id: START }),
      hold(367, { role_id: MIDDLE }),
      hold(43,  { role_id: FINISH }),
      hold(13,  { role_id: FOOT }),
      hold(79,  { role_id: START }),
      hold(3,   { role_id: MIDDLE }),
      hold(54,  { role_id: FINISH }),
      hold(618, { role_id: FOOT }),
    ],
  },
  {
    id: 9,
    name: 'Custom Red',
    description: '5 holds in pure red (custom color test)',
    holds: [67, 72, 116, 378, 629].map(
      (pos) => hold(pos, { color: 'FF0000' })
    ),
  },
  {
    id: 10,
    name: 'Strobe Test',
    description: 'Single hold — visual confirmation test',
    holds: [hold(183, { role_id: START })],
  },
];
