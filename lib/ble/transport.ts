// Generic BLE transport over @capacitor-community/bluetooth-le.
// Knows nothing about the Kilter Board — only concepts: device, service UUID,
// characteristic UUID, connect, disconnect. Kilter-specific logic lives in
// kilter-board-service.ts.

import { BleClient, type BleDevice } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';

let initialized = false;

export async function initialize(): Promise<void> {
  if (initialized) return;
  await BleClient.initialize({ androidNeverForLocation: true });
  initialized = true;
}

export async function requestDevice(serviceUUIDs: string[]): Promise<BleDevice> {
  return BleClient.requestDevice({ services: serviceUUIDs });
}

export async function connect(
  deviceId: string,
  onDisconnect?: (deviceId: string) => void,
): Promise<void> {
  await BleClient.connect(deviceId, onDisconnect);
}

export async function disconnect(deviceId: string): Promise<void> {
  await BleClient.disconnect(deviceId);
}

export async function isAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    await initialize();
    return true;
  } catch {
    return false;
  }
}

export type { BleDevice };
