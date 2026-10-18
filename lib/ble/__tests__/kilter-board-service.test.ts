// API level resolution + write mode on connect, level-aware LED writes.
// Regressions: (1) iOS returns the cached GAP name on reconnect → read the
// advertised name; (2) the Kilter-built LED box (bare name "Kilter Board",
// API 2) only supports write-with-response, and iOS silently drops
// write-without-response to it → nothing lit with either encoding.

const requestDeviceMock = jest.fn();
const scanForLocalNameMock = jest.fn();
const connectMock = jest.fn();
const writeMock = jest.fn();
const writeNoRespMock = jest.fn();
const getServicesMock = jest.fn();

jest.mock('../transport', () => ({
  initialize: jest.fn(() => Promise.resolve()),
  requestDevice: (...args: unknown[]) => requestDeviceMock(...args),
  scanForLocalName: (...args: unknown[]) => scanForLocalNameMock(...args),
  connect: (...args: unknown[]) => connectMock(...args),
  disconnect: jest.fn(() => Promise.resolve()),
  write: (...args: unknown[]) => writeMock(...args),
  writeWithoutResponse: (...args: unknown[]) => writeNoRespMock(...args),
  getServices: (...args: unknown[]) => getServicesMock(...args),
}));

const UART = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const WRITE_CHAR = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
/** GATT table with the UART write characteristic and the given properties. */
function servicesWith(props: { write: boolean; writeWithoutResponse: boolean }) {
  return [
    {
      uuid: UART.toUpperCase(),
      characteristics: [{ uuid: WRITE_CHAR.toUpperCase(), properties: props, descriptors: [] }],
    },
  ];
}

import { connectToKilterBoard, sendLEDPreset } from '../kilter-board-service';

/** Packet marker of the first written chunk (byte after the 4-byte header). */
function firstMarker(mock: jest.Mock = writeMock): number {
  const view = mock.mock.calls[0][3] as DataView;
  return view.getUint8(4);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  connectMock.mockResolvedValue(undefined);
  writeMock.mockResolvedValue(undefined);
  writeNoRespMock.mockResolvedValue(undefined);
  // Default: Kilter-built box — write-with-response only.
  getServicesMock.mockResolvedValue(servicesWith({ write: true, writeWithoutResponse: false }));
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

test('Kilter-built box: bare "Kilter Board" → API 2 + write WITH response', async () => {
  requestDeviceMock.mockResolvedValue({ deviceId: 'e', name: 'Kilter Board' });
  scanForLocalNameMock.mockResolvedValue('Kilter Board');
  const board = await connectToKilterBoard(() => {});
  expect(board).toEqual({ deviceId: 'e', name: 'Kilter Board', apiLevel: 2 });

  await sendLEDPreset('e', [{ position: 1, role_id: 12 }]);
  expect(writeNoRespMock).not.toHaveBeenCalled();
  expect(firstMarker()).toBe(80); // 'P' — API 2
});

test('characteristic with write-without-response → keeps the no-response path', async () => {
  requestDeviceMock.mockResolvedValue({ deviceId: 'f', name: 'Gym Board#42@3' });
  getServicesMock.mockResolvedValue(servicesWith({ write: true, writeWithoutResponse: true }));
  await connectToKilterBoard(() => {});

  await sendLEDPreset('f', [{ position: 1, role_id: 12 }]);
  expect(writeMock).not.toHaveBeenCalled();
  expect(firstMarker(writeNoRespMock)).toBe(84); // 'T' — API 3
});

test('GATT lookup failing → falls back to write with response', async () => {
  requestDeviceMock.mockResolvedValue({ deviceId: 'g', name: 'Gym Board@3' });
  getServicesMock.mockRejectedValue(new Error('not discovered'));
  await connectToKilterBoard(() => {});

  await sendLEDPreset('g', [{ position: 1, role_id: 12 }]);
  expect(writeMock).toHaveBeenCalled();
  expect(writeNoRespMock).not.toHaveBeenCalled();
});

test('explicit @2 in the advertised name → API 2 board, v2 packets', async () => {
  requestDeviceMock.mockResolvedValue({ deviceId: 'c', name: 'Old Board' });
  scanForLocalNameMock.mockResolvedValue('Old Board@2');
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
