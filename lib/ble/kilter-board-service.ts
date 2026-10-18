// Kilter Board BLE service — orchestrates Kilter-specific connect / disconnect / LED writes
// on top of the generic transport.

import * as transport from './transport';
import {
  encodePreset,
  encodeAllOffEmpty,
  encodeAllOffBlackout,
  hasApiLevelSuffix,
  parseApiLevel,
  type EncoderHold,
} from './kilter-protocol';

// Aurora Climbing advertisement service UUID (filter for requestDevice).
// Source: @hangtime/grip-connect kilterboard.model.ts
export const KILTER_BOARD_SERVICE_UUID = '4488b571-7806-4df6-bcff-a2897e4953ff';

// Nordic UART GATT service — hosts the TX characteristic used for LED writes.
export const KILTER_BOARD_UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';

// Nordic UART TX characteristic — write target for LED packets.
export const KILTER_BOARD_WRITE_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

// Pacing delay between consecutive BLE chunk writes (ms).
// writeWithoutResponse has no flow control: firing all chunks back-to-back
// overruns the board's UART buffer on large payloads (e.g. the 476-LED
// diagnostic ≈ 78 chunks) → the board silently drops packets and only half
// the board lights up, or a congested write trips the plugin's 5s timeout.
// A short gap lets the board drain between writes. ~6 chunks for a normal
// climb → imperceptible (~110ms); the full board → ~1.5s.
const CHUNK_PACING_MS = 18;

// Upper bound for the advertised-name scan run when the picked device's name
// has no "@<apiLevel>" suffix. Stops as soon as the board is seen (usually
// well under a second).
const ADVERTISED_NAME_SCAN_MS = 2500;

// Used whenever no name carries an explicit "@<level>" suffix. The official app
// reads a missing suffix as level 2, but level 3 is what boards speak in
// practice (Climbdex / Boardsesh send only v3), and a suffix-less name on iOS
// is usually just the cached GAP name of an API 3 board. Only an explicit
// "@2" / "@1" selects the v2 encoding.
const DEFAULT_API_LEVEL = 3;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ConnectedKilterBoard {
  deviceId: string;
  name: string;
  apiLevel: number;
}

// Per-device caches (keyed by deviceId)
const apiLevelCache = new Map<string, number>();
const nameCache = new Map<string, string>();

export async function connectToKilterBoard(
  onDisconnect: () => void,
): Promise<ConnectedKilterBoard> {
  await transport.initialize();
  const device = await transport.requestDevice([KILTER_BOARD_SERVICE_UUID]);

  // The API level lives in the advertised name ("board@3"). iOS hands back the
  // cached GAP name after the first connection (e.g. "Kilter Board", no
  // suffix) → read the live advertisement. Must run before connecting: the
  // plugin's scan skips peripherals that are already connected.
  let resolvedName = device.name ?? null;
  let apiLevel = DEFAULT_API_LEVEL;
  if (resolvedName && hasApiLevelSuffix(resolvedName)) {
    apiLevel = parseApiLevel(resolvedName);
  } else {
    const advertised = await transport.scanForLocalName(
      device.deviceId,
      [KILTER_BOARD_SERVICE_UUID],
      ADVERTISED_NAME_SCAN_MS,
    );
    if (advertised) resolvedName = advertised;
    if (advertised && hasApiLevelSuffix(advertised)) apiLevel = parseApiLevel(advertised);
  }

  await transport.connect(device.deviceId, onDisconnect);

  const name = resolvedName ?? 'Kilter Board';
  apiLevelCache.set(device.deviceId, apiLevel);
  nameCache.set(device.deviceId, name);

  return { deviceId: device.deviceId, name, apiLevel };
}

/**
 * Manual protocol override (user toggle): the API level is inferred from the
 * board name, and a wrong guess makes the board silently ignore every packet.
 * Applies to the next writes.
 */
export function setApiLevel(deviceId: string, apiLevel: number): void {
  apiLevelCache.set(deviceId, apiLevel);
}

export async function disconnectFromKilterBoard(deviceId: string): Promise<void> {
  apiLevelCache.delete(deviceId);
  nameCache.delete(deviceId);
  await transport.disconnect(deviceId);
}

/**
 * Write chunks to the board's UART TX characteristic, pacing consecutive
 * writes so large payloads don't overrun the board (see CHUNK_PACING_MS).
 */
async function writeChunks(deviceId: string, chunks: Uint8Array[]): Promise<void> {
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const dataView = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    await transport.writeWithoutResponse(
      deviceId,
      KILTER_BOARD_UART_SERVICE_UUID,
      KILTER_BOARD_WRITE_CHARACTERISTIC_UUID,
      dataView,
    );
    if (i < chunks.length - 1) await delay(CHUNK_PACING_MS);
  }
}

/** Send LED placement data to the connected board. */
export async function sendLEDPreset(
  deviceId: string,
  holds: EncoderHold[],
): Promise<void> {
  const name = nameCache.get(deviceId) ?? deviceId;
  const apiLevel = apiLevelCache.get(deviceId) ?? DEFAULT_API_LEVEL;
  console.log(`[BLE] sendLEDPreset → device="${name}" apiLevel=${apiLevel} holds=${holds.length}`);
  const chunks = encodePreset(holds, apiLevel);
  await writeChunks(deviceId, chunks);
}

/** Turn off all LEDs on the connected board (empty packet, primary approach). */
export async function sendAllOff(deviceId: string): Promise<void> {
  const name = nameCache.get(deviceId) ?? deviceId;
  const apiLevel = apiLevelCache.get(deviceId) ?? DEFAULT_API_LEVEL;
  console.log(`[BLE] sendAllOff (empty) → device="${name}" apiLevel=${apiLevel}`);
  const chunks = encodeAllOffEmpty(apiLevel);
  await writeChunks(deviceId, chunks);
}

/** Turn off all LEDs — blackout fallback (sends color 0x00 to every position). */
export async function sendAllOffBlackout(deviceId: string, positions: number[]): Promise<void> {
  const name = nameCache.get(deviceId) ?? deviceId;
  const apiLevel = apiLevelCache.get(deviceId) ?? DEFAULT_API_LEVEL;
  console.log(`[BLE] sendAllOff (blackout) → device="${name}" apiLevel=${apiLevel} positions=${positions.length}`);
  const chunks = encodeAllOffBlackout(positions, apiLevel);
  await writeChunks(deviceId, chunks);
}
