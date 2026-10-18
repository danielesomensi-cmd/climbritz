// API level resolution on connect + level-aware LED writes.
// Regression: iOS returned the cached GAP name "Kilter Board" (no "@3") on
// reconnect → the app treated an API 3 board as API 2 and refused every write.

const requestDeviceMock = jest.fn();
const scanForLocalNameMock = jest.fn();
const connectMock = jest.fn();
const writeMock = jest.fn();

jest.mock('../transport', () => ({
  initialize: jest.fn(() => Promise.resolve()),
  requestDevice: (...args: unknown[]) => requestDeviceMock(...args),
  scanForLocalName: (...args: unknown[]) => scanForLocalNameMock(...args),
  connect: (...args: unknown[]) => connectMock(...args),
  disconnect: jest.fn(() => Promise.resolve()),
  writeWithoutResponse: (...args: unknown[]) => writeMock(...args),
}));

import { connectToKilterBoard, sendLEDPreset } from '../kilter-board-service';

/** Packet marker of the first written chunk (byte after the 4-byte header). */
function firstMarker(): number {
  const view = writeMock.mock.calls[0][3] as DataView;
  return view.getUint8(4);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  connectMock.mockResolvedValue(undefined);
  writeMock.mockResolvedValue(undefined);
});

test('name with @3 suffix → API 3, no extra scan', async () => {
  requestDeviceMock.mockResolvedValue({ deviceId: 'a', name: 'Gym Board@3' });
  const board = await connectToKilterBoard(() => {});
  expect(board).toEqual({ deviceId: 'a', name: 'Gym Board@3', apiLevel: 3 });
  expect(scanForLocalNameMock).not.toHaveBeenCalled();
});

test('cached GAP name without suffix → advertised name wins (iOS reconnect)', async () => {
  requestDeviceMock.mockResolvedValue({ deviceId: 'b', name: 'Kilter Board' });
  scanForLocalNameMock.mockResolvedValue('Kilter Board#123@3');
  const board = await connectToKilterBoard(() => {});
  expect(board.apiLevel).toBe(3);
  expect(board.name).toBe('Kilter Board#123@3');
  // The scan must finish before the connect (connected devices are not scanned).
  expect(scanForLocalNameMock.mock.invocationCallOrder[0]).toBeLessThan(
    connectMock.mock.invocationCallOrder[0],
  );

  await sendLEDPreset('b', [{ position: 1, role_id: 12 }]);
  expect(firstMarker()).toBe(84); // 'T' — API 3
});

test('advertised name without suffix → genuine API 2 board, v2 packets', async () => {
  requestDeviceMock.mockResolvedValue({ deviceId: 'c', name: 'Old Board' });
  scanForLocalNameMock.mockResolvedValue('Old Board');
  const board = await connectToKilterBoard(() => {});
  expect(board.apiLevel).toBe(2);

  await expect(sendLEDPreset('c', [{ position: 1, role_id: 12 }])).resolves.toBeUndefined();
  expect(firstMarker()).toBe(80); // 'P' — API 2
});

test('no name anywhere → defaults to API 3 instead of blocking', async () => {
  requestDeviceMock.mockResolvedValue({ deviceId: 'd' });
  scanForLocalNameMock.mockResolvedValue(null);
  const board = await connectToKilterBoard(() => {});
  expect(board).toEqual({ deviceId: 'd', name: 'Kilter Board', apiLevel: 3 });

  await sendLEDPreset('d', [{ position: 1, role_id: 12 }]);
  expect(firstMarker()).toBe(84);
});
