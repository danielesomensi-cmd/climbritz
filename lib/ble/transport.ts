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

/**
 * Short scan that returns the name the device is advertising right now
 * (`localName`), or null if it isn't seen within `timeoutMs`. On iOS
 * `BleDevice.name` from requestDevice is the GAP name iOS cached after the
 * first connection, which can differ from the advertised one; the scan
 * result's `localName` is read from the live advertisement.
 * Always stops the scan before resolving, so a connect can follow directly.
 */
export async function scanForLocalName(
  deviceId: string,
  serviceUUIDs: string[],
  timeoutMs: number,
): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (name: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      BleClient.stopLEScan()
        .catch(() => {})
        .finally(() => resolve(name));
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    // allowDuplicates: keep receiving the device until an advertisement
    // carrying the local name arrives (it can be in the scan response).
    BleClient.requestLEScan({ services: serviceUUIDs, allowDuplicates: true }, (result) => {
      if (result.device.deviceId === deviceId && result.localName) finish(result.localName);
    }).catch(() => finish(null));
  });
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

// Read-only query of the OS's currently connected devices matching the given
// services. Used by the app-resume state sync (B035) — never connects.
export async function getConnectedDevices(serviceUUIDs: string[]): Promise<BleDevice[]> {
  return BleClient.getConnectedDevices(serviceUUIDs);
}

export async function writeWithoutResponse(
  deviceId: string,
  service: string,
  characteristic: string,
  value: DataView,
): Promise<void> {
  await BleClient.writeWithoutResponse(deviceId, service, characteristic, value);
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
