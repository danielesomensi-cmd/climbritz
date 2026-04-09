// LED positions queried from BoardLib kilter.db, layout_id=1 (Kilter Board Original 12x12)
// via: SELECT MIN(l.position), h.x, h.y FROM placements p
//       JOIN holes h ON p.hole_id=h.id JOIN leds l ON l.hole_id=h.id
//       WHERE p.layout_id=1 GROUP BY h.x, h.y

export interface LedEntry {
  position: number;
  role_id?: number;  // 12=Start(green), 13=Middle(cyan), 14=Finish(magenta), 15=Foot(orange)
  color?: string;    // hex, e.g. "FF0000" — use instead of role_id for custom color
}

export interface Preset {
  id: number;
  name: string;
  description: string;
  leds: LedEntry[];
}

// Role IDs from placement_roles table
const START = 12;   // green   #00FF00
const MIDDLE = 13;  // cyan    #00FFFF
const FINISH = 14;  // magenta #FF00FF
const FOOT = 15;    // orange  #FFB600

export const PRESETS: Preset[] = [
  {
    id: 1,
    name: 'All Corners',
    description: '4 holds at the board corners',
    leds: [
      { position: 45, role_id: START },   // bottom-left  (x=-20, y=4)
      { position: 0,  role_id: START },   // bottom-right (x=164, y=4)
      { position: 80, role_id: START },   // top-left     (x=-16, y=152)
      { position: 641, role_id: START },  // top-right    (x=160, y=152)
    ],
  },
  {
    id: 2,
    name: 'Center Cross',
    description: '5 holds in a + pattern at the center',
    leds: [
      { position: 116, role_id: MIDDLE }, // center       (x=72, y=88)
      { position: 74,  role_id: MIDDLE }, // left         (x=56, y=88)
      { position: 158, role_id: MIDDLE }, // right        (x=88, y=88)
      { position: 113, role_id: MIDDLE }, // up           (x=72, y=104)
      { position: 119, role_id: MIDDLE }, // down         (x=72, y=72)
    ],
  },
  {
    id: 3,
    name: 'Bottom Row',
    description: 'All 18 holds on the bottom row',
    leds: [45, 44, 42, 33, 32, 30, 21, 20, 18, 16, 14, 12, 10, 8, 6, 4, 2, 0].map(
      (position) => ({ position, role_id: FOOT })
    ),
  },
  {
    id: 4,
    name: 'Diagonal',
    description: '8 holds from bottom-left to top-right',
    leds: [45, 4, 3, 76, 137, 221, 440, 641].map(
      (position) => ({ position, role_id: MIDDLE })
    ),
  },
  {
    id: 5,
    name: 'Rainbow',
    description: '4 holds across the board, one per role color',
    leds: [
      { position: 12,  role_id: START },  // bottom-center (green)
      { position: 116, role_id: MIDDLE }, // center        (cyan)
      { position: 299, role_id: FINISH }, // top-center    (magenta)
      { position: 80,  role_id: FOOT },   // left mid      (orange)
    ],
  },
  {
    id: 6,
    name: 'Start + Finish',
    description: '1 start hold (bottom) + 1 finish hold (top)',
    leds: [
      { position: 12,  role_id: START },  // bottom-center
      { position: 299, role_id: FINISH }, // top-center
    ],
  },
  {
    id: 7,
    name: 'Full Border',
    description: '103 holds around the full perimeter',
    leds: [
      0, 1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 21, 30, 32, 33, 42, 44, 45,
      46, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64,
      65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80,
      128, 129, 185, 186, 242, 243, 299, 300, 356, 357, 413, 414, 470, 471,
      525, 526, 527,
      595, 598, 601, 604, 607, 610, 613, 616, 617, 618, 619, 620, 621, 622,
      623, 624, 625, 626, 627, 628, 629, 630, 631, 632, 633, 634, 635, 636,
      637, 638, 639, 640, 641,
    ].map((position) => ({ position, role_id: MIDDLE })),
  },
  {
    id: 8,
    name: 'Random 8',
    description: '8 holds spread across the board (seed 42)',
    leds: [
      { position: 416, role_id: START },
      { position: 367, role_id: MIDDLE },
      { position: 43,  role_id: FINISH },
      { position: 13,  role_id: FOOT },
      { position: 79,  role_id: START },
      { position: 3,   role_id: MIDDLE },
      { position: 54,  role_id: FINISH },
      { position: 618, role_id: FOOT },
    ],
  },
  {
    id: 9,
    name: 'Custom Red',
    description: '5 holds in pure red (custom color test)',
    leds: [67, 72, 116, 378, 629].map(
      (position) => ({ position, color: 'FF0000' })
    ),
  },
  {
    id: 10,
    name: 'Strobe Test',
    description: 'Single hold — visual confirmation test',
    leds: [
      { position: 183, role_id: START }, // center-bottom area (x=72, y=16)
    ],
  },
];
