// LED position → board coordinates for product_size_id=10 (12x12 with kickboard)
// Queried directly from: SELECT l.position, h.x, h.y FROM leds l JOIN holes h ON l.hole_id=h.id
//                        WHERE l.product_size_id=10 AND h.x BETWEEN 0 AND 144 AND h.y BETWEEN 0 AND 156
// Board coordinate system: x∈[0,144], y∈[0,156], y=0 at bottom, y=156 at top.
// Image mapping: left% = x/144*100, bottom% = y/156*100.
// Total: 476 positions. Positions outside ps10 (≥477, e.g. 525-641) get null coords → BLE-only.
const POSITION_COORDS: Record<number, [number, number]> = {
  0: [140, 4],  1: [136, 8],  2: [132, 4],  3: [128, 8],
  4: [124, 4],  5: [120, 8],  6: [116, 4],  7: [112, 8],
  8: [108, 4],  9: [104, 8],  10: [100, 4],  11: [96, 8],
  12: [92, 4],  13: [88, 8],  14: [84, 4],  15: [80, 8],
  16: [76, 4],  17: [72, 8],  18: [68, 4],  19: [64, 8],
  20: [60, 4],  21: [56, 8],  22: [52, 4],  23: [48, 8],
  24: [44, 4],  25: [40, 8],  26: [36, 4],  27: [32, 8],
  28: [28, 4],  29: [24, 8],  30: [20, 4],  31: [16, 8],
  32: [12, 4],  33: [4, 4],  34: [8, 8],  36: [8, 16],
  37: [4, 20],  38: [8, 24],  39: [12, 28],  40: [8, 32],
  41: [4, 36],  42: [8, 40],  43: [12, 44],  44: [8, 48],
  45: [4, 52],  46: [8, 56],  47: [12, 60],  48: [8, 64],
  49: [4, 68],  50: [8, 72],  51: [12, 76],  52: [8, 80],
  53: [4, 84],  54: [8, 88],  55: [12, 92],  56: [8, 96],
  57: [4, 100],  58: [8, 104],  59: [12, 108],  60: [8, 112],
  61: [4, 116],  62: [8, 120],  63: [12, 124],  64: [8, 128],
  65: [4, 132],  66: [8, 136],  67: [8, 144],  68: [8, 152],
  69: [16, 152],  70: [16, 144],  71: [16, 136],  72: [20, 132],
  73: [16, 128],  74: [16, 120],  75: [20, 116],  76: [16, 112],
  77: [16, 104],  78: [20, 100],  79: [16, 96],  80: [16, 88],
  81: [20, 84],  82: [16, 80],  83: [16, 72],  84: [20, 68],
  85: [16, 64],  86: [16, 56],  87: [20, 52],  88: [16, 48],
  89: [16, 40],  90: [20, 36],  91: [16, 32],  92: [16, 24],
  93: [20, 20],  94: [16, 16],  95: [24, 16],  96: [24, 24],
  97: [28, 28],  98: [24, 32],  99: [24, 40],  100: [28, 44],
  101: [24, 48],  102: [24, 56],  103: [28, 60],  104: [24, 64],
  105: [24, 72],  106: [28, 76],  107: [24, 80],  108: [24, 88],
  109: [28, 92],  110: [24, 96],  111: [24, 104],  112: [28, 108],
  113: [24, 112],  114: [24, 120],  115: [28, 124],  116: [24, 128],
  117: [24, 136],  118: [24, 144],  119: [24, 152],  120: [32, 152],
  121: [32, 144],  122: [32, 136],  123: [36, 132],  124: [32, 128],
  125: [32, 120],  126: [36, 116],  127: [32, 112],  128: [32, 104],
  129: [36, 100],  130: [32, 96],  131: [32, 88],  132: [36, 84],
  133: [32, 80],  134: [32, 72],  135: [36, 68],  136: [32, 64],
  137: [32, 56],  138: [36, 52],  139: [32, 48],  140: [32, 40],
  141: [36, 36],  142: [32, 32],  143: [32, 24],  144: [36, 20],
  145: [32, 16],  146: [40, 16],  147: [40, 24],  148: [44, 28],
  149: [40, 32],  150: [40, 40],  151: [44, 44],  152: [40, 48],
  153: [40, 56],  154: [44, 60],  155: [40, 64],  156: [40, 72],
  157: [44, 76],  158: [40, 80],  159: [40, 88],  160: [44, 92],
  161: [40, 96],  162: [40, 104],  163: [44, 108],  164: [40, 112],
  165: [40, 120],  166: [44, 124],  167: [40, 128],  168: [40, 136],
  169: [40, 144],  170: [40, 152],  171: [48, 152],  172: [48, 144],
  173: [48, 136],  174: [52, 132],  175: [48, 128],  176: [48, 120],
  177: [52, 116],  178: [48, 112],  179: [48, 104],  180: [52, 100],
  181: [48, 96],  182: [48, 88],  183: [52, 84],  184: [48, 80],
  185: [48, 72],  186: [52, 68],  187: [48, 64],  188: [48, 56],
  189: [52, 52],  190: [48, 48],  191: [48, 40],  192: [52, 36],
  193: [48, 32],  194: [48, 24],  195: [52, 20],  196: [48, 16],
  197: [56, 16],  198: [56, 24],  199: [60, 28],  200: [56, 32],
  201: [56, 40],  202: [60, 44],  203: [56, 48],  204: [56, 56],
  205: [60, 60],  206: [56, 64],  207: [56, 72],  208: [60, 76],
  209: [56, 80],  210: [56, 88],  211: [60, 92],  212: [56, 96],
  213: [56, 104],  214: [60, 108],  215: [56, 112],  216: [56, 120],
  217: [60, 124],  218: [56, 128],  219: [56, 136],  220: [56, 144],
  221: [56, 152],  222: [64, 152],  223: [64, 144],  224: [64, 136],
  225: [68, 132],  226: [64, 128],  227: [64, 120],  228: [68, 116],
  229: [64, 112],  230: [64, 104],  231: [68, 100],  232: [64, 96],
  233: [64, 88],  234: [68, 84],  235: [64, 80],  236: [64, 72],
  237: [68, 68],  238: [64, 64],  239: [64, 56],  240: [68, 52],
  241: [64, 48],  242: [64, 40],  243: [68, 36],  244: [64, 32],
  245: [64, 24],  246: [68, 20],  247: [64, 16],  248: [72, 16],
  249: [72, 24],  250: [76, 28],  251: [72, 32],  252: [72, 40],
  253: [76, 44],  254: [72, 48],  255: [72, 56],  256: [76, 60],
  257: [72, 64],  258: [72, 72],  259: [76, 76],  260: [72, 80],
  261: [72, 88],  262: [76, 92],  263: [72, 96],  264: [72, 104],
  265: [76, 108],  266: [72, 112],  267: [72, 120],  268: [76, 124],
  269: [72, 128],  270: [72, 136],  271: [72, 144],  272: [72, 152],
  273: [80, 152],  274: [80, 144],  275: [80, 136],  276: [84, 132],
  277: [80, 128],  278: [80, 120],  279: [84, 116],  280: [80, 112],
  281: [80, 104],  282: [84, 100],  283: [80, 96],  284: [80, 88],
  285: [84, 84],  286: [80, 80],  287: [80, 72],  288: [84, 68],
  289: [80, 64],  290: [80, 56],  291: [84, 52],  292: [80, 48],
  293: [80, 40],  294: [84, 36],  295: [80, 32],  296: [80, 24],
  297: [84, 20],  298: [80, 16],  299: [88, 16],  300: [88, 24],
  301: [92, 28],  302: [88, 32],  303: [88, 40],  304: [92, 44],
  305: [88, 48],  306: [88, 56],  307: [92, 60],  308: [88, 64],
  309: [88, 72],  310: [92, 76],  311: [88, 80],  312: [88, 88],
  313: [92, 92],  314: [88, 96],  315: [88, 104],  316: [92, 108],
  317: [88, 112],  318: [88, 120],  319: [92, 124],  320: [88, 128],
  321: [88, 136],  322: [88, 144],  323: [88, 152],  324: [96, 152],
  325: [96, 144],  326: [96, 136],  327: [100, 132],  328: [96, 128],
  329: [96, 120],  330: [100, 116],  331: [96, 112],  332: [96, 104],
  333: [100, 100],  334: [96, 96],  335: [96, 88],  336: [100, 84],
  337: [96, 80],  338: [96, 72],  339: [100, 68],  340: [96, 64],
  341: [96, 56],  342: [100, 52],  343: [96, 48],  344: [96, 40],
  345: [100, 36],  346: [96, 32],  347: [96, 24],  348: [100, 20],
  349: [96, 16],  350: [104, 16],  351: [104, 24],  352: [108, 28],
  353: [104, 32],  354: [104, 40],  355: [108, 44],  356: [104, 48],
  357: [104, 56],  358: [108, 60],  359: [104, 64],  360: [104, 72],
  361: [108, 76],  362: [104, 80],  363: [104, 88],  364: [108, 92],
  365: [104, 96],  366: [104, 104],  367: [108, 108],  368: [104, 112],
  369: [104, 120],  370: [108, 124],  371: [104, 128],  372: [104, 136],
  373: [104, 144],  374: [104, 152],  375: [112, 152],  376: [112, 144],
  377: [112, 136],  378: [116, 132],  379: [112, 128],  380: [112, 120],
  381: [116, 116],  382: [112, 112],  383: [112, 104],  384: [116, 100],
  385: [112, 96],  386: [112, 88],  387: [116, 84],  388: [112, 80],
  389: [112, 72],  390: [116, 68],  391: [112, 64],  392: [112, 56],
  393: [116, 52],  394: [112, 48],  395: [112, 40],  396: [116, 36],
  397: [112, 32],  398: [112, 24],  399: [116, 20],  400: [112, 16],
  401: [120, 16],  402: [120, 24],  403: [124, 28],  404: [120, 32],
  405: [120, 40],  406: [124, 44],  407: [120, 48],  408: [120, 56],
  409: [124, 60],  410: [120, 64],  411: [120, 72],  412: [124, 76],
  413: [120, 80],  414: [120, 88],  415: [124, 92],  416: [120, 96],
  417: [120, 104],  418: [124, 108],  419: [120, 112],  420: [120, 120],
  421: [124, 124],  422: [120, 128],  423: [120, 136],  424: [120, 144],
  425: [120, 152],  426: [128, 152],  427: [128, 144],  428: [128, 136],
  429: [132, 132],  430: [128, 128],  431: [128, 120],  432: [132, 116],
  433: [128, 112],  434: [128, 104],  435: [132, 100],  436: [128, 96],
  437: [128, 88],  438: [132, 84],  439: [128, 80],  440: [128, 72],
  441: [132, 68],  442: [128, 64],  443: [128, 56],  444: [132, 52],
  445: [128, 48],  446: [128, 40],  447: [132, 36],  448: [128, 32],
  449: [128, 24],  450: [132, 20],  451: [128, 16],  452: [136, 16],
  453: [136, 24],  454: [140, 28],  455: [136, 32],  456: [136, 40],
  457: [140, 44],  458: [136, 48],  459: [136, 56],  460: [140, 60],
  461: [136, 64],  462: [136, 72],  463: [140, 76],  464: [136, 80],
  465: [136, 88],  466: [140, 92],  467: [136, 96],  468: [136, 104],
  469: [140, 108],  470: [136, 112],  471: [136, 120],  472: [140, 124],
  473: [136, 128],  474: [136, 136],  475: [136, 144],  476: [136, 152],
};

export interface LedHold {
  position: number;  // LED position sent via BLE
  role_id?: number;  // 12=Start(green), 13=Middle(cyan), 14=Finish(magenta), 15=Foot(orange)
  color?: string;    // custom hex e.g. "FF0000"
  // Board coordinates for visual overlay (null = outside ps10 bounds, BLE-only)
  x: number | null;
  y: number | null;
}

export interface Preset {
  id: number;
  name: string;
  description: string;
  holds: LedHold[];
}

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

// Reverse lookup (x,y) → position — built once from POSITION_COORDS.
// Used by grid() to pick LEDs for pixel-art presets.
const POS_BY_XY: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  for (const [pos, [x, y]] of Object.entries(POSITION_COORDS)) {
    m[`${x},${y}`] = Number(pos);
  }
  return m;
})();

// Main climbing-hold grid: col ∈ [0..16] → x = 8 + col*8, row ∈ [0..17] → y = 16 + row*8.
// Row 0 is the bottom of the main grid; row 17 is the top (y=152).
function grid(col: number, row: number): number {
  const x = 8 + col * 8;
  const y = 16 + row * 8;
  const p = POS_BY_XY[`${x},${y}`];
  if (p === undefined) throw new Error(`No LED at grid (${col},${row}) → (${x},${y})`);
  return p;
}

// 24-bit palette — hex values that bin cleanly via the kilter-protocol encoder.
// Encoder: R,G in 3 bits (/32), B in 2 bits (/64). See lib/ble/kilter-protocol.ts.
const RED = 'FF0000';       // 7/0/0
const ORANGE = 'FF6000';    // 7/3/0
const YELLOW = 'FFFF00';    // 7/7/0
const GREEN = '00FF00';     // 0/7/0
const CYAN = '00FFFF';      // 0/7/3
const BLUE = '0000FF';      // 0/0/3
const MAGENTA = 'FF00FF';   // 7/0/3
const WHITE = 'FFFFFF';     // 7/7/3

// Stress-test preset: light every LED in POSITION_COORDS, grouped into
// horizontal y-bands (8-unit bands matching the grid step). Bands cycle through
// the 8-colour rainbow from bottom to top.
const STRESS_PALETTE = [RED, ORANGE, YELLOW, GREEN, CYAN, BLUE, MAGENTA, WHITE];

function buildAllLedsStressTest(): LedHold[] {
  const bands = new Map<number, Array<{ pos: number; x: number; y: number }>>();
  for (const [posStr, [x, y]] of Object.entries(POSITION_COORDS)) {
    const band = Math.floor(y / 8);
    if (!bands.has(band)) bands.set(band, []);
    bands.get(band)!.push({ pos: Number(posStr), x, y });
  }
  const holds: LedHold[] = [];
  const bandKeys = [...bands.keys()].sort((a, b) => a - b);
  bandKeys.forEach((bandIdx, i) => {
    const color = STRESS_PALETTE[i % STRESS_PALETTE.length];
    for (const led of bands.get(bandIdx)!) {
      holds.push({ position: led.pos, color, x: led.x, y: led.y });
    }
  });
  return holds;
}

// A028 — max-brightness diagnostic: every LED full white. On RGB LEDs white
// lights all three channels (7+7+3), so it's physically brighter than any
// saturated colour in the rainbow stress test. Same 476 LEDs / packet load as
// #11 — only the colour differs. WHITE ('FFFFFF') encodes to byte 0xFF via
// kilter-protocol's encodeColor.
function buildAllLedsWhite(): LedHold[] {
  const holds: LedHold[] = [];
  for (const [posStr, [x, y]] of Object.entries(POSITION_COORDS)) {
    holds.push({ position: Number(posStr), color: WHITE, x, y });
  }
  return holds;
}

export const PRESETS: Preset[] = [
  {
    id: 1,
    name: 'Space Invader',
    description: 'Pixel-art alien — Taito 1978',
    holds: [
      ...[
        // Antennae (top)
        [6,13],[10,13],
        // Top body
        [5,12],[6,12],[7,12],[8,12],[9,12],[10,12],[11,12],
        // Eye band — gaps at cols 6 and 10 form the eyes
        [5,11],[7,11],[8,11],[9,11],[11,11],
        // Mid body
        [5,10],[6,10],[7,10],[8,10],[9,10],[10,10],[11,10],
        // Legs (4 dangling)
        [5, 9],[7, 9],[9, 9],[11, 9],
        // Outer foot tips
        [5, 8],[11, 8],
      ].map(([c, r]) => hold(grid(c, r), { color: GREEN })),
    ],
  },
  {
    id: 2,
    name: 'Ghost Blinky',
    description: 'Red Pac-Man ghost with eyes',
    holds: [
      // Red body — dome, face, body, 3-hump wavy bottom
      ...[
        [6,15],[7,15],[8,15],[9,15],[10,15],            // dome top (5)
        [5,14],[6,14],[7,14],[8,14],[9,14],[10,14],[11,14],  // dome wider (7)
        [5,13],[7,13],[8,13],[9,13],[11,13],            // face row, eye slots at cols 6,10 (5)
        [5,12],[7,12],[8,12],[9,12],[11,12],            // face row below, pupil slots at cols 6,10 (5)
        [5,11],[6,11],[7,11],[8,11],[9,11],[10,11],[11,11], // body (7)
        [5,10],[6,10],[8,10],[10,10],[11,10],           // 3-hump wave: XX.X.XX (5)
      ].map(([c, r]) => hold(grid(c, r), { color: RED })),
      // Eye whites
      hold(grid(6,13), { color: WHITE }),
      hold(grid(10,13), { color: WHITE }),
      // Cyan pupils
      hold(grid(6,12), { color: CYAN }),
      hold(grid(10,12), { color: CYAN }),
    ],
  },
  {
    id: 3,
    name: 'Zelda Heart',
    description: 'Pure-red 8-bit heart container',
    holds: [
      // Mono-red 8-bit heart — two humps at top tapering to a single point.
      ...[
        [6,14],[10,14],              // top sides of the two humps (2)
        [6,13],[7,13],[9,13],[10,13],// hump tops with valley between (4)
        [6,12],[7,12],[8,12],[9,12],[10,12], // widest row (5)
        [7,11],[8,11],[9,11],        // narrowing (3)
        [8,10],                      // bottom point (1)
      ].map(([c, r]) => hold(grid(c, r), { color: RED })),
    ],
  },
  {
    id: 4,
    name: 'Star',
    description: 'Yellow five-point star',
    holds: [
      // Filled 5-pointed star — top point, horizontal arms at row 12, V-legs.
      ...[
        [8,14],                            // top point (1)
        [7,13],[8,13],[9,13],              // crown (3)
        [5,12],[6,12],[7,12],[8,12],[9,12],[10,12],[11,12], // horizontal arms (7)
        [6,11],[7,11],[8,11],[9,11],[10,11],// body (5)
        [6,10],[8,10],[10,10],              // V-split (3)
        [5, 9],[11, 9],                     // lower point tips (2)
      ].map(([c, r]) => hold(grid(c, r), { color: YELLOW })),
    ],
  },
  {
    id: 5,
    name: 'Sun',
    description: 'Orange sun with yellow rays',
    holds: [
      // Orange centre circle (11 LEDs)
      ...[
        [7,11],[8,11],[9,11],                          // top of circle (3)
        [6,10],[7,10],[8,10],[9,10],[10,10],           // middle (5)
        [7, 9],[8, 9],[9, 9],                          // bottom (3)
      ].map(([c, r]) => hold(grid(c, r), { color: ORANGE })),
      // Yellow rays — 4 cardinal (3 LED each) + 4 diagonal (2 LED each) = 20 LEDs
      ...[
        // N
        [8,12],[8,13],[8,14],
        // S
        [8, 8],[8, 7],[8, 6],
        // E
        [11,10],[12,10],[13,10],
        // W
        [5,10],[4,10],[3,10],
        // NE
        [10,12],[11,13],
        // SE
        [10, 8],[11, 7],
        // NW
        [6,12],[5,13],
        // SW
        [6, 8],[5, 7],
      ].map(([c, r]) => hold(grid(c, r), { color: YELLOW })),
    ],
  },
  // ─── Creative presets (B014) ──────────────────────────────────────────
  // Hand-authored pixel art on the 17×18 main climbing-hold grid.
  // See grid() above for the (col, row) → LED position mapping.

  {
    id: 6,
    name: 'DANI',
    description: '"DANI" lettering in red LEDs',
    holds: [
      // D (cols 0-3, rows 6-10): XXX. / X..X / X..X / X..X / XXX.
      grid(0,10), grid(1,10), grid(2,10),
      grid(0, 9), grid(3, 9),
      grid(0, 8), grid(3, 8),
      grid(0, 7), grid(3, 7),
      grid(0, 6), grid(1, 6), grid(2, 6),
      // A (cols 5-8): .XX. / X..X / XXXX / X..X / X..X
      grid(6,10), grid(7,10),
      grid(5, 9), grid(8, 9),
      grid(5, 8), grid(6, 8), grid(7, 8), grid(8, 8),
      grid(5, 7), grid(8, 7),
      grid(5, 6), grid(8, 6),
      // N (cols 10-13): X..X / XX.X / X.XX / X..X / X..X
      grid(10,10), grid(13,10),
      grid(10, 9), grid(11, 9), grid(13, 9),
      grid(10, 8), grid(12, 8), grid(13, 8),
      grid(10, 7), grid(13, 7),
      grid(10, 6), grid(13, 6),
      // I (col 15, rows 6-10)
      grid(15,10), grid(15, 9), grid(15, 8), grid(15, 7), grid(15, 6),
    ].map((pos) => hold(pos, { color: RED })),
  },
  {
    id: 7,
    name: 'Climber',
    description: 'Climber figure — dynamic pose',
    holds: [
      // Body (asymmetric reaching pose, white)
      ...[
        [7,15],                                        // head
        [7,14],                                        // neck
        [7,13],[7,12],[7,11],                          // torso
        [7,10],                                        // hips
        [8,14],[9,15],[10,16],[11,17],                 // left arm reaching up-right (hand at top)
        [6,13],[5,12],                                 // right arm bent across chest
        [8,11],[9,12],[10,11],[11,10],                 // right leg bent — knee high at (9,12)
        [6, 9],[5, 8],[4, 7],                          // left leg extended down-left
      ].map(([c, r]) => hold(grid(c, r), { color: WHITE })),
      // Holds the climber is touching (green)
      ...[
        [12,17],                                       // jug near reaching hand
        [4,12],                                        // hold near bent right hand
        [12,10],                                       // foothold near bent-leg foot
        [3, 7],                                        // foothold near extended left foot
      ].map(([c, r]) => hold(grid(c, r), { color: GREEN })),
    ],
  },
  {
    id: 8,
    name: 'Heart',
    description: 'Red and magenta heart',
    holds: [
      // Red outline
      ...[
        [6,11],[7,11],[9,11],[10,11],                  // top bumps
        [5,10],[11,10],                                // row 10 sides
        [5, 9],[11, 9],                                // row 9 sides
        [6, 8],[10, 8],                                // narrowing
        [7, 7],[ 9, 7],                                // narrower
        [8, 6],                                        // bottom tip
      ].map(([c, r]) => hold(grid(c, r), { color: RED })),
      // Magenta fill (solid — no white shine)
      ...[
        [6,10],[7,10],[8,10],[9,10],[10,10],           // row 10 inside
        [6, 9],[7, 9],[8, 9],[9, 9],[10, 9],           // row 9 inside
        [7, 8],[8, 8],[9, 8],                          // row 8 inside
        [8, 7],                                        // row 7 inside
      ].map(([c, r]) => hold(grid(c, r), { color: MAGENTA })),
    ],
  },
  {
    id: 9,
    name: 'Lightning',
    description: 'Full-height yellow bolt',
    holds: [
      ...[
        // Top segment — top-right corner diagonal going down-left (rows 17→13)
        [12,17],[13,17],
        [11,16],[12,16],
        [10,15],[11,15],
        [ 9,14],[10,14],
        [ 8,13],[ 9,13],
        // Horizontal bar at the elbow (rows 12, 11)
        [3,12],[4,12],[5,12],[6,12],[7,12],[8,12],
        [3,11],[4,11],[5,11],[6,11],[7,11],[8,11],
        // Bottom segment — diagonal from bar going down-left to bottom (rows 10→2)
        [6,10],[7,10],
        [5, 9],[6, 9],
        [4, 8],[5, 8],
        [3, 7],[4, 7],
        [2, 6],[3, 6],
        [1, 5],[2, 5],
        [1, 4],
        [0, 3],[1, 3],
        [0, 2],                                        // bottom-left tip
      ].map(([c, r]) => hold(grid(c, r), { color: YELLOW })),
    ],
  },
  {
    id: 10,
    name: 'Smile',
    description: 'Big smiling face',
    holds: [
      ...[
        // Face outline — 11×11 circle (cols 3-13, rows 4-14)
        [6,14],[7,14],[8,14],[9,14],[10,14],           // top arc
        [5,13],[11,13],
        [4,12],[12,12],
        [3,11],[13,11],
        [3,10],[13,10],
        [3, 9],[13, 9],
        [3, 8],[13, 8],
        [3, 7],[13, 7],
        [4, 6],[12, 6],
        [5, 5],[11, 5],
        [6, 4],[7, 4],[8, 4],[9, 4],[10, 4],           // bottom arc
        // Eyes (upper quadrant, symmetric)
        [6,11],[10,11],
        // Smile — U-shape curving up at corners, dipping in the middle
        [5, 8],[11, 8],                                // smile corners (up)
        [6, 7],[10, 7],
        [7, 6],[8, 6],[9, 6],                          // bottom of smile
      ].map(([c, r]) => hold(grid(c, r), { color: YELLOW })),
    ],
  },
  // ─── Stress test (B014-iter-2) ────────────────────────────────────────
  {
    id: 11,
    name: 'All LEDs Diagnostic',
    description: 'Stress test — all LEDs, rainbow stripes from the bottom',
    holds: buildAllLedsStressTest(),
  },
  // ─── Max brightness (A028) ────────────────────────────────────────────
  {
    id: 12,
    name: 'All White (max)',
    description: 'All LEDs at full white — maximum brightness',
    holds: buildAllLedsWhite(),
  },
];
