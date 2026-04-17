// Kilter Board BLE service — orchestrates Kilter-specific connect / disconnect / LED writes
// on top of the generic transport.

import * as transport from './transport';
import { encodePreset, encodeAllOff, parseApiLevel, type EncoderHold } from './kilter-protocol';

// Aurora Climbing advertisement service UUID (filter for requestDevice).
// Source: @hangtime/grip-connect kilterboard.model.ts
export const KILTER_BOARD_SERVICE_UUID = '4488b571-7806-4df6-bcff-a2897e4953ff';

// Nordic UART GATT service — hosts the TX characteristic used for LED writes.
export const KILTER_BOARD_UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';

// Nordic UART TX characteristic — write target for LED packets.
export const KILTER_BOARD_WRITE_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

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

// Per-device API level cache
const apiLevelCache = new Map<string, number>();

export async function connectToKilterBoard(
  onDisconnect: () => void,
): Promise<ConnectedKilterBoard> {
  await transport.initialize();
  const device = await transport.requestDevice([KILTER_BOARD_SERVICE_UUID]);
  await transport.connect(device.deviceId, onDisconnect);

  const name = device.name ?? 'Kilter Board';
  const apiLevel = parseApiLevel(name);
  apiLevelCache.set(device.deviceId, apiLevel);

  return { deviceId: device.deviceId, name, apiLevel };
}

export async function disconnectFromKilterBoard(deviceId: string): Promise<void> {
  apiLevelCache.delete(deviceId);
  await transport.disconnect(deviceId);
}

/** Send LED placement data to the connected board. */
export async function sendLEDPreset(
  deviceId: string,
  holds: EncoderHold[],
): Promise<void> {
  const apiLevel = apiLevelCache.get(deviceId);
  if (apiLevel !== undefined && apiLevel < 3) {
    throw new UnsupportedBoardError(
      'Kilter Board API level 2 is not supported. Update your board firmware to API level 3.',
    );
  }

  const chunks = encodePreset(holds);
  for (const chunk of chunks) {
    const dataView = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    await transport.writeWithoutResponse(
      deviceId,
      KILTER_BOARD_UART_SERVICE_UUID,
      KILTER_BOARD_WRITE_CHARACTERISTIC_UUID,
      dataView,
    );
  }
}

/** Turn off all LEDs on the connected board. */
export async function sendAllOff(deviceId: string): Promise<void> {
  const apiLevel = apiLevelCache.get(deviceId);
  if (apiLevel !== undefined && apiLevel < 3) {
    throw new UnsupportedBoardError(
      'Kilter Board API level 2 is not supported. Update your board firmware to API level 3.',
    );
  }

  const chunks = encodeAllOff();
  for (const chunk of chunks) {
    const dataView = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    await transport.writeWithoutResponse(
      deviceId,
      KILTER_BOARD_UART_SERVICE_UUID,
      KILTER_BOARD_WRITE_CHARACTERISTIC_UUID,
      dataView,
    );
  }
}
