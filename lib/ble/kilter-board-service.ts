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

// Pacing delay between consecutive BLE chunk writes (ms), without-response
// path. writeWithoutResponse has no flow control: firing all chunks
// back-to-back overruns the board's UART buffer on large payloads (e.g. the
// 476-LED diagnostic ≈ 78 chunks) → the board silently drops packets and only
// half the board lights up, or a congested write trips the plugin's 5s
// timeout. A short gap lets the board drain between writes. ~6 chunks for a
// normal climb → imperceptible (~110ms); the full board → ~1.5s.
const CHUNK_PACING_MS = 18;

// Pacing on the with-response path: the official Kilter app writes every
// chunk with response, 100 ms apart (Boardsesh does the same for the
// Kilter-built box). A climb is 2–3 chunks → still well under half a second.
const WITH_RESPONSE_PACING_MS = 100;

// Upper bound for the advertised-name scan run when the picked device's name
// has no "@<apiLevel>" suffix. Stops as soon as the board is seen (usually
// well under a second).
const ADVERTISED_NAME_SCAN_MS = 2500;

// Used only when the board exposes no name at all. A name without "@<level>"
// is API level 2 — the official app's rule, and the signature of the newer
// Kilter-built LED box, which advertises a bare "Kilter Board" (no serial, no
// level).
const DEFAULT_API_LEVEL = 3;

// How LED chunks are written. The Kilter-built box's write characteristic
// supports only write-with-response; iOS silently DROPS a write-without-
// response to such a characteristic (no error), so nothing lights. Picked per
// device from the characteristic's properties on connect.
type WriteMode = 'withResponse' | 'withoutResponse';

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
const writeModeCache = new Map<string, WriteMode>();

/**
 * Without-response only when the write characteristic advertises it; any
 * doubt → with-response, which every box accepts (the official app uses it
 * unconditionally).
 */
async function detectWriteMode(deviceId: string): Promise<WriteMode> {
  try {
    const services = await transport.getServices(deviceId);
    const uart = services.find((s) => s.uuid.toLowerCase() === KILTER_BOARD_UART_SERVICE_UUID);
    const char = uart?.characteristics.find(
      (c) => c.uuid.toLowerCase() === KILTER_BOARD_WRITE_CHARACTERISTIC_UUID,
    );
    return char?.properties.writeWithoutResponse ? 'withoutResponse' : 'withResponse';
  } catch {
    return 'withResponse';
  }
}

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
    // Bare name (no "@N") → level 2: official-app rule, Kilter-built box.
    if (resolvedName) apiLevel = parseApiLevel(resolvedName);
  }

  await transport.connect(device.deviceId, onDisconnect);
  const writeMode = await detectWriteMode(device.deviceId);

  const name = resolvedName ?? 'Kilter Board';
  apiLevelCache.set(device.deviceId, apiLevel);
  nameCache.set(device.deviceId, name);
  writeModeCache.set(device.deviceId, writeMode);
  console.log(`[BLE] connected → device="${name}" apiLevel=${apiLevel} write=${writeMode}`);

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
  writeModeCache.delete(deviceId);
  await transport.disconnect(deviceId);
}

/**
 * Write chunks to the board's UART TX characteristic with the device's write
 * mode, pacing consecutive writes so large payloads don't overrun the board.
 */
async function writeChunks(deviceId: string, chunks: Uint8Array[]): Promise<void> {
  const withResponse = (writeModeCache.get(deviceId) ?? 'withResponse') === 'withResponse';
  const write = withResponse ? transport.write : transport.writeWithoutResponse;
  const pacing = withResponse ? WITH_RESPONSE_PACING_MS : CHUNK_PACING_MS;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const dataView = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    await write(
      deviceId,
      KILTER_BOARD_UART_SERVICE_UUID,
      KILTER_BOARD_WRITE_CHARACTERISTIC_UUID,
      dataView,
    );
    if (i < chunks.length - 1) await delay(pacing);
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
