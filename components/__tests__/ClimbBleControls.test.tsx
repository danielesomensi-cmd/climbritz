import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';

import type { BleStatus } from '@/app/ble-test/use-kilter-ble';
import type { EncoderHold } from '@/lib/ble/kilter-protocol';

// Controllable mocks for the BLE hook + Capacitor so we can drive status and
// spy on sendLEDs / force the "native" code path in jsdom.
const sendLEDsMock = jest.fn().mockResolvedValue(undefined);
const sendAllOffMock = jest.fn().mockResolvedValue(undefined);
const connectMock = jest.fn();
const disconnectMock = jest.fn();
const clearErrorMock = jest.fn();

let mockStatus: BleStatus = 'connected';
let mockIsCapacitorNative = true;

jest.mock('@/app/ble-test/use-kilter-ble', () => ({
  useKilterBle: () => ({
    status: mockStatus,
    errorMessage: null,
    lastError: null,
    connectedDevice: { deviceId: 'dev-1', name: 'mykilterboard@3', apiLevel: 3 },
    connect: connectMock,
    disconnect: disconnectMock,
    sendLEDs: sendLEDsMock,
    sendAllOffLEDs: sendAllOffMock,
    clearError: clearErrorMock,
    isCapacitorNative: mockIsCapacitorNative,
  }),
}));

jest.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => mockIsCapacitorNative },
}));

import ClimbBleControls from '../ClimbBleControls';

const mkHold = (position: number, role_id = 13): EncoderHold => ({ position, role_id });

beforeEach(() => {
  jest.clearAllMocks();
  mockStatus = 'connected';
  mockIsCapacitorNative = true;
});

describe('ClimbBleControls — auto-send on climbKey change (A014)', () => {
  it('does NOT auto-send on the first render, even with autoSendOnKeyChange=true', () => {
    jest.useFakeTimers();
    const holds = [mkHold(10), mkHold(20)];
    render(<ClimbBleControls ledCommands={holds} climbKey="uuid-A" autoSendOnKeyChange />);
    act(() => { jest.advanceTimersByTime(1000); });
    expect(sendLEDsMock).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('auto-sends 300ms after climbKey changes when connected', () => {
    jest.useFakeTimers();
    const { rerender } = render(
      <ClimbBleControls ledCommands={[mkHold(10)]} climbKey="uuid-A" autoSendOnKeyChange />,
    );
    // First render does not send — seeds lastSentKey = 'uuid-A'
    expect(sendLEDsMock).not.toHaveBeenCalled();

    // New climb arrives
    rerender(
      <ClimbBleControls ledCommands={[mkHold(20)]} climbKey="uuid-B" autoSendOnKeyChange />,
    );
    act(() => { jest.advanceTimersByTime(299); });
    expect(sendLEDsMock).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(1); });
    expect(sendLEDsMock).toHaveBeenCalledTimes(1);
    expect(sendLEDsMock).toHaveBeenCalledWith([mkHold(20)]);
    jest.useRealTimers();
  });

  it('rapid key changes coalesce into one send carrying the last climb', () => {
    jest.useFakeTimers();
    const { rerender } = render(
      <ClimbBleControls ledCommands={[mkHold(10)]} climbKey="uuid-A" autoSendOnKeyChange />,
    );
    rerender(<ClimbBleControls ledCommands={[mkHold(20)]} climbKey="uuid-B" autoSendOnKeyChange />);
    act(() => { jest.advanceTimersByTime(150); });
    rerender(<ClimbBleControls ledCommands={[mkHold(30)]} climbKey="uuid-C" autoSendOnKeyChange />);
    act(() => { jest.advanceTimersByTime(150); });
    rerender(<ClimbBleControls ledCommands={[mkHold(40)]} climbKey="uuid-D" autoSendOnKeyChange />);
    // None has fired yet because each re-render reset the timer
    expect(sendLEDsMock).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(300); });
    expect(sendLEDsMock).toHaveBeenCalledTimes(1);
    expect(sendLEDsMock).toHaveBeenCalledWith([mkHold(40)]);
    jest.useRealTimers();
  });

  it('does NOT auto-send when BLE is disconnected (status=idle)', () => {
    jest.useFakeTimers();
    mockStatus = 'idle';
    const { rerender } = render(
      <ClimbBleControls ledCommands={[mkHold(10)]} climbKey="uuid-A" autoSendOnKeyChange />,
    );
    rerender(<ClimbBleControls ledCommands={[mkHold(20)]} climbKey="uuid-B" autoSendOnKeyChange />);
    act(() => { jest.advanceTimersByTime(1000); });
    expect(sendLEDsMock).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('ignores auto-send when autoSendOnKeyChange=false (initial page load / deep link)', () => {
    jest.useFakeTimers();
    const { rerender } = render(
      <ClimbBleControls ledCommands={[mkHold(10)]} climbKey="uuid-A" autoSendOnKeyChange={false} />,
    );
    rerender(
      <ClimbBleControls ledCommands={[mkHold(20)]} climbKey="uuid-B" autoSendOnKeyChange={false} />,
    );
    act(() => { jest.advanceTimersByTime(1000); });
    expect(sendLEDsMock).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('does not send when ledCommands is empty', () => {
    jest.useFakeTimers();
    const { rerender } = render(
      <ClimbBleControls ledCommands={[mkHold(10)]} climbKey="uuid-A" autoSendOnKeyChange />,
    );
    rerender(<ClimbBleControls ledCommands={[]} climbKey="uuid-B" autoSendOnKeyChange />);
    act(() => { jest.advanceTimersByTime(1000); });
    expect(sendLEDsMock).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('browser (non-Capacitor) falls back to the "only in app" notice — no BLE UI', () => {
    mockIsCapacitorNative = false;
    render(<ClimbBleControls ledCommands={[mkHold(10)]} climbKey="uuid-A" autoSendOnKeyChange />);
    expect(screen.queryByTestId('climb-ble-controls')).not.toBeInTheDocument();
    expect(screen.getByText(/Kilter-Up installata/)).toBeInTheDocument();
  });
});
