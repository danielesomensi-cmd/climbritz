// Kilter Board BLE service — orchestrates Kilter-specific connect / disconnect
// on top of the generic transport. LED packet encoding is scaffolded but not
// implemented here — that lives in the Phase 3e LED brief.

import * as transport from './transport';

// Aurora Climbing advertisement service UUID (filter for requestDevice).
// Source: node_modules/@hangtime/grip-connect/src/models/device/kilterboard.model.ts:83
export const KILTER_BOARD_SERVICE_UUID = '4488b571-7806-4df6-bcff-a2897e4953ff';

// Nordic UART GATT service — hosts the TX characteristic used for LED writes.
// Source: node_modules/@hangtime/grip-connect/src/models/device/kilterboard.model.ts:118
// Exported but unused in B010 — consumed by the LED brief.
export const KILTER_BOARD_UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';

// Nordic UART TX characteristic — write target for LED packets.
// Source: node_modules/@hangtime/grip-connect/src/models/device/kilterboard.model.ts:123
// Exported but unused in B010 — consumed by the LED brief.
export const KILTER_BOARD_WRITE_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

export interface ConnectedKilterBoard {
  deviceId: string;
  name: string;
}

export async function connectToKilterBoard(
  onDisconnect: () => void,
): Promise<ConnectedKilterBoard> {
  await transport.initialize();
  const device = await transport.requestDevice([KILTER_BOARD_SERVICE_UUID]);
  await transport.connect(device.deviceId, onDisconnect);
  return {
    deviceId: device.deviceId,
    name: device.name ?? 'Kilter Board',
  };
}

export async function disconnectFromKilterBoard(deviceId: string): Promise<void> {
  await transport.disconnect(deviceId);
}

export async function sendLEDPreset(
  _deviceId: string,
  _preset: unknown,
): Promise<void> {
  throw new Error('Not implemented — see Phase 3e LED brief');
}
