// Kilter Board BLE service — orchestrates Kilter-specific connect / disconnect / LED writes
// on top of the generic transport.

import * as transport from './transport';
import { encodePreset, encodeAllOffEmpty, encodeAllOffBlackout, parseApiLevel, type EncoderHold } from './kilter-protocol';

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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class UnsupportedBoardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedBoardError';
  }
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
  await transport.connect(device.deviceId, onDisconnect);

  const name = device.name ?? 'Kilter Board';
  const apiLevel = parseApiLevel(name);
  apiLevelCache.set(device.deviceId, apiLevel);
  nameCache.set(device.deviceId, name);

  return { deviceId: device.deviceId, name, apiLevel };
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

function assertApiLevel3(deviceId: string): void {
  const apiLevel = apiLevelCache.get(deviceId);
  if (apiLevel !== undefined && apiLevel < 3) {
    throw new UnsupportedBoardError(
      'Kilter Board API level 2 is not supported. Update your board firmware to API level 3.',
    );
  }
}

/** Send LED placement data to the connected board. */
export async function sendLEDPreset(
  deviceId: string,
  holds: EncoderHold[],
): Promise<void> {
  assertApiLevel3(deviceId);
  const name = nameCache.get(deviceId) ?? deviceId;
  const apiLevel = apiLevelCache.get(deviceId) ?? '?';
  console.log(`[BLE] sendLEDPreset → device="${name}" apiLevel=${apiLevel} holds=${holds.length}`);
  const chunks = encodePreset(holds);
  await writeChunks(deviceId, chunks);
}

/** Turn off all LEDs on the connected board (empty packet, primary approach). */
export async function sendAllOff(deviceId: string): Promise<void> {
  assertApiLevel3(deviceId);
  const name = nameCache.get(deviceId) ?? deviceId;
  const apiLevel = apiLevelCache.get(deviceId) ?? '?';
  console.log(`[BLE] sendAllOff (empty) → device="${name}" apiLevel=${apiLevel}`);
  const chunks = encodeAllOffEmpty();
  await writeChunks(deviceId, chunks);
}

/** Turn off all LEDs — blackout fallback (sends color 0x00 to every position). */
export async function sendAllOffBlackout(deviceId: string, positions: number[]): Promise<void> {
  assertApiLevel3(deviceId);
  const name = nameCache.get(deviceId) ?? deviceId;
  const apiLevel = apiLevelCache.get(deviceId) ?? '?';
  console.log(`[BLE] sendAllOff (blackout) → device="${name}" apiLevel=${apiLevel} positions=${positions.length}`);
  const chunks = encodeAllOffBlackout(positions);
  await writeChunks(deviceId, chunks);
}
