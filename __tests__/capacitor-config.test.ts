import config from '../capacitor.config';

// UX-001 — the native BLE scan dialog is user-visible copy: English only.
describe('capacitor.config BluetoothLe displayStrings', () => {
  it('uses English strings for the scan dialog', () => {
    const ble = (config.plugins as Record<string, { displayStrings?: Record<string, string> }>)
      .BluetoothLe;
    expect(ble.displayStrings).toEqual({
      scanning: 'Searching for Kilter Board…',
      cancel: 'Cancel',
      availableDevices: 'Devices found',
      noDeviceFound: 'No device found',
    });
  });
});
