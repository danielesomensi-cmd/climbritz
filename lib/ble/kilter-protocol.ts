// Kilter Board BLE LED packet encoder — API level 3 and API level 2.
//
// The API level comes from the advertised device name ("name@3"; no suffix →
// level 2, same rule as the official app). Level 3 is the common one.
// Packet format (per body):
//   [marker, ...placements]
//   API 3: placement = [posLow, posHigh, colorByte]  (0bRRRGGGBB, 3R + 3G + 2B)
//   API 2: placement = [posLow, posHigh2 | colorBits] (10-bit position; 2 bits
//          per channel in the upper 6 bits: 0bRRGGBBpp)
// Wrapped packet:
//   [0x01, bodyLength, checksum, 0x02, ...body, 0x03]
// Chunked into 20-byte BLE writes.
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

// --- Packet markers ---

interface PacketMarkers {
  middle: number;
  first: number;
  last: number;
  only: number;
}

const V3_MARKERS: PacketMarkers = { middle: 81, first: 82, last: 83, only: 84 }; // Q R S T
const V2_MARKERS: PacketMarkers = { middle: 77, first: 78, last: 79, only: 80 }; // M N O P

// API level 2 packs the position into 10 bits.
const V2_MAX_POSITION = 0x3FF;

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

/**
 * Compress 24-bit hex RGB to the API level 2 colour bits: 2 bits per channel
 * (divide by 64) in the upper 6 bits of the byte — 0bRRGGBB00. The low 2 bits
 * are left free for the position's high bits.
 * Source: fake_kilter_board DataDecoder.scaledColorToFullColorV2.
 */
export function encodeColorV2(hex: string): number {
  const clean = hex.replace('#', '');
  const r = Math.floor(parseInt(clean.substring(0, 2), 16) / 64); // 0-3
  const g = Math.floor(parseInt(clean.substring(2, 4), 16) / 64); // 0-3
  const b = Math.floor(parseInt(clean.substring(4, 6), 16) / 64); // 0-3
  return (r << 6) | (g << 4) | (b << 2);
}

/** API level 3 placement: 16-bit little-endian position + 8-bit colour. */
function encodePlacementV3(position: number, hex: string): number[] {
  return [position & 0xFF, (position >> 8) & 0xFF, encodeColor(hex)];
}

/** API level 2 placement: 10-bit position, colour in the second byte's upper 6 bits. */
function encodePlacementV2(position: number, hex: string): number[] {
  if (position < 0 || position > V2_MAX_POSITION) {
    throw new Error(`LED position ${position} does not fit API level 2 (max ${V2_MAX_POSITION})`);
  }
  return [position & 0xFF, ((position >> 8) & 0b11) | encodeColorV2(hex)];
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
 * API level 3 (default): each hold is 3 bytes, markers R/Q/S/T.
 * API level 2 and below: each hold is 2 bytes, markers N/M/O/P.
 * Bodies are capped at 255 bytes and split across multiple wrapped packets.
 */
export function encodePreset(holds: EncoderHold[], apiLevel = 3): Uint8Array[] {
  const markers = apiLevel >= 3 ? V3_MARKERS : V2_MARKERS;
  const encodePlacement = apiLevel >= 3 ? encodePlacementV3 : encodePlacementV2;
  const valid = holds.filter(
    (h) => (h.color != null && h.color.trim() !== '') || (h.role_id != null),
  );

  const bodies: number[][] = [];
  let current: number[] = [markers.middle];

  for (const hold of valid) {
    const placement = encodePlacement(hold.position, resolveColorHex(hold));
    if (current.length + placement.length > MESSAGE_BODY_MAX_LENGTH) {
      bodies.push(current);
      current = [markers.middle];
    }
    current.push(...placement);
  }
  bodies.push(current);

  // Fix markers
  if (bodies.length === 1) {
    bodies[0][0] = markers.only;
  } else if (bodies.length > 1) {
    bodies[0][0] = markers.first;
    bodies[bodies.length - 1][0] = markers.last;
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
 * Produces a single "only" body with just the marker byte, wrapped and chunked.
 * This is the primary "all off" approach (zero holds).
 */
export function encodeAllOffEmpty(apiLevel = 3): Uint8Array[] {
  const body = [(apiLevel >= 3 ? V3_MARKERS : V2_MARKERS).only];
  const flat = wrapBytes(body);
  return splitIntoChunks(flat);
}

/**
 * Encode an "all LEDs off" packet — blackout variant.
 * Sends every known LED position with color 0x00 (black).
 * Fallback if encodeAllOffEmpty doesn't clear the board on some firmware.
 */
export function encodeAllOffBlackout(positions: number[], apiLevel = 3): Uint8Array[] {
  const holds: EncoderHold[] = positions.map((position) => ({
    position,
    color: '000000',
  }));
  return encodePreset(holds, apiLevel);
}

const API_LEVEL_SUFFIX = /@(\d+)$/;

/** True when the device name carries an explicit "@<apiLevel>" suffix. */
export function hasApiLevelSuffix(deviceName: string): boolean {
  return API_LEVEL_SUFFIX.test(deviceName);
}

/**
 * Parse API level from a Kilter Board device name.
 * Format: "name[@apiLevel]" — e.g. "mykilterboard@3" → 3.
 * No "@" suffix → returns 2 (legacy default).
 */
export function parseApiLevel(deviceName: string): number {
  const match = deviceName.match(API_LEVEL_SUFFIX);
  return match ? parseInt(match[1], 10) : 2;
}
