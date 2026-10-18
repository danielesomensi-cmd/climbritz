import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

const sendLEDs = jest.fn(() => Promise.resolve());
const setProtocol = jest.fn();
jest.mock('@/components/BleProvider', () => ({
  useBle: () => ({
    connectedDevice: { deviceId: 'dev-1', name: 'Kilter Board', apiLevel: 2 },
    sendLEDs,
    setProtocol,
  }),
}));

const setWriteModeMock = jest.fn();
let mockDiag: unknown = null;
jest.mock('@/lib/ble/kilter-board-service', () => ({
  getBleDiagnostics: () => mockDiag,
  setWriteMode: (...args: unknown[]) => setWriteModeMock(...args),
}));

import { COMBOS, DiagnosticsPanel } from '../diagnostics-panel';

const HOLDS = [{ position: 1, role_id: 12 }];

beforeEach(() => {
  jest.clearAllMocks();
  mockDiag = {
    pickedName: 'Kilter Board',
    advertisedName: 'Kilter Board',
    apiLevel: 2,
    writeMode: 'withResponse',
    writeProps: 'write',
    lastWrite: { ok: false, apiLevel: 2, writeMode: 'withResponse', chunks: 2, ms: 40, error: 'Write timeout' },
  };
});

describe('BLE diagnostics panel', () => {
  it('shows what the app detected and the last write outcome', () => {
    render(<DiagnosticsPanel holds={HOLDS} />);
    expect(screen.getByTestId('ble-diag-props')).toHaveTextContent('write');
    expect(screen.getByTestId('ble-diag-last')).toHaveTextContent('FAILED');
    expect(screen.getByTestId('ble-diag-last')).toHaveTextContent('Write timeout');
  });

  it('Try all sends the pattern once per combo and restores the detected settings', async () => {
    jest.useFakeTimers();
    render(<DiagnosticsPanel holds={HOLDS} />);
    fireEvent.click(screen.getByTestId('ble-diag-try-all'));
    for (let i = 0; i < COMBOS.length; i++) {
      await act(async () => {
        await Promise.resolve();
        jest.advanceTimersByTime(5000);
      });
    }
    await act(async () => {
      await Promise.resolve();
    });
    expect(sendLEDs).toHaveBeenCalledTimes(COMBOS.length);
    expect(setProtocol.mock.calls.map((c) => c[0])).toEqual([2, 3, 2, 3, 2]);
    expect(setWriteModeMock.mock.calls.map((c) => c[1])).toEqual([
      'withResponse',
      'withResponse',
      'withoutResponse',
      'withoutResponse',
      'withResponse',
    ]);
    jest.useRealTimers();
  });
});
