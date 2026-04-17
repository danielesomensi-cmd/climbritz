// Kilter Board API level 3 — BLE LED packet encoder
//
// Target: Kilter Board with API level 3 (device name contains "@3").
// Packet format (per body):
//   [marker, ...placements]  where each placement = [posLow, posHigh, colorByte]
// Wrapped packet:
//   [0x01, bodyLength, checksum, 0x02, ...body, 0x03]
// Chunked into 20-byte BLE writes.
//
// Color compression: 24-bit RGB → 8-bit 0bRRRGGGBB (3R + 3G + 2B).
//
// Reference: @hangtime/grip-connect kilterboard.model.js (not imported at runtime)
// Protocol docs: https://github.com/1-max-1/fake_kilter_board

// --- Placement roles (from placement_roles DB table) ---
// Source: @hangtime/grip-connect KilterBoardPlacementRoles

export const PLACEMENT_ROLES: Record<number, string> = {
  12: '00FF00', // Start  — green
  13: '00FFFF', // Middle — cyan
  14: 'FF00FF', // Finish — magenta
  15: 'FFB600', // Foot   — orange
};

// --- Packet markers (API level 3) ---

const V3_MIDDLE = 81; // 'Q'
const V3_FIRST = 82;  // 'R'
const V3_LAST = 83;   // 'S'
const V3_ONLY = 84;   // 'T'

const MESSAGE_BODY_MAX_LENGTH = 255;
const BLE_CHUNK_SIZE = 20;

// --- Public types ---

export interface EncoderHold {
  position: number;
  role_id?: number;
  color?: string; // hex without '#', e.g. "FF0000"
}

// --- Pure functions ---

/**
 * Compress 24-bit hex RGB to 8-bit 0bRRRGGGBB.
 * R and G: 3 bits each (divide by 32). B: 2 bits (divide by 64).
 */
export function encodeColor(hex: string): number {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const rBits = Math.floor(r / 32); // 0-7
  const gBits = Math.floor(g / 32); // 0-7
  const bBits = Math.floor(b / 64); // 0-3
  return (rBits << 5) | (gBits << 2) | bBits;
}

/** Encode a 16-bit position as little-endian [low, high]. */
function encodePosition(position: number): [number, number] {
  return [position & 0xFF, (position >> 8) & 0xFF];
}

/** Resolve a hold's LED color hex from either direct color or role_id lookup. */
function resolveColorHex(hold: EncoderHold): string {
  if (hold.color != null && hold.color.trim() !== '') {
    return hold.color.replace('#', '').toUpperCase();
  }
  if (hold.role_id != null) {
    const hex = PLACEMENT_ROLES[hold.role_id];
    if (!hex) throw new Error(`Unknown role_id ${hold.role_id}`);
    return hex;
  }
  throw new Error(`Hold at position ${hold.position} has neither color nor role_id`);
}

/** Checksum: sum all bytes mod 256, then bitwise NOT mod 256. */
function checksum(data: number[]): number {
  let sum = 0;
  for (const byte of data) {
    sum = (sum + byte) & 0xFF;
  }
  return ~sum & 0xFF;
}

/** Wrap a message body with header/footer: [0x01, len, checksum, 0x02, ...body, 0x03]. */
function wrapBytes(data: number[]): number[] {
  if (data.length > MESSAGE_BODY_MAX_LENGTH) return [];
  return [0x01, data.length, checksum(data), 0x02, ...data, 0x03];
}

/** Split a flat byte array into 20-byte Uint8Array chunks. */
function splitIntoChunks(buffer: number[]): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < buffer.length; i += BLE_CHUNK_SIZE) {
    chunks.push(new Uint8Array(buffer.slice(i, i + BLE_CHUNK_SIZE)));
  }
  return chunks;
}

/**
 * Encode an array of holds into BLE-ready chunks (Uint8Array[]).
 * Each hold becomes 3 bytes: [posLow, posHigh, colorByte].
 * Bodies are capped at 255 bytes and split across multiple wrapped packets
 * with appropriate V3 markers (R/Q/S/T).
 */
export function encodePreset(holds: EncoderHold[]): Uint8Array[] {
  const valid = holds.filter(
    (h) => (h.color != null && h.color.trim() !== '') || (h.role_id != null),
  );

  const bodies: number[][] = [];
  let current: number[] = [V3_MIDDLE];

  for (const hold of valid) {
    if (current.length + 3 > MESSAGE_BODY_MAX_LENGTH) {
      bodies.push(current);
      current = [V3_MIDDLE];
    }
    const [posLow, posHigh] = encodePosition(hold.position);
    const colorByte = encodeColor(resolveColorHex(hold));
    current.push(posLow, posHigh, colorByte);
  }
  bodies.push(current);

  // Fix markers
  if (bodies.length === 1) {
    bodies[0][0] = V3_ONLY;
  } else if (bodies.length > 1) {
    bodies[0][0] = V3_FIRST;
    bodies[bodies.length - 1][0] = V3_LAST;
  }

  // Wrap each body and flatten
  const flat: number[] = [];
  for (const body of bodies) {
    flat.push(...wrapBytes(body));
  }

  return splitIntoChunks(flat);
}

/**
 * Encode an "all LEDs off" packet — empty placement list.
 * Produces a single V3_ONLY body with just the marker byte, wrapped and chunked.
 * This is the primary "all off" approach (zero holds).
 */
export function encodeAllOffEmpty(): Uint8Array[] {
  const body = [V3_ONLY];
  const flat = wrapBytes(body);
  return splitIntoChunks(flat);
}

/**
 * Encode an "all LEDs off" packet — blackout variant.
 * Sends every known LED position with color 0x00 (black).
 * Fallback if encodeAllOffEmpty doesn't clear the board on some firmware.
 */
export function encodeAllOffBlackout(positions: number[]): Uint8Array[] {
  const holds: EncoderHold[] = positions.map((position) => ({
    position,
    color: '000000',
  }));
  return encodePreset(holds);
}

/**
 * Parse API level from a Kilter Board device name.
 * Format: "name[@apiLevel]" — e.g. "mykilterboard@3" → 3.
 * No "@" suffix → returns 2 (legacy default).
 */
export function parseApiLevel(deviceName: string): number {
  const match = deviceName.match(/@(\d+)$/);
  return match ? parseInt(match[1], 10) : 2;
}
