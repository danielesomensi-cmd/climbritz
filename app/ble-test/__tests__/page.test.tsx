import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

import type { BleStatus } from '../use-kilter-ble';

// Controllable mock for the BLE hook so we can drive status + spy on sends.
const sendLEDsMock = jest.fn().mockResolvedValue(undefined);
const sendAllOffMock = jest.fn().mockResolvedValue(undefined);
const connectMock = jest.fn();
const disconnectMock = jest.fn();
const clearErrorMock = jest.fn();

let mockStatus: BleStatus = 'connected';
let mockIsCapacitorNative = true;

jest.mock('../use-kilter-ble', () => ({
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

import BleTestPage from '../page';
import { PRESETS } from '../presets';

beforeEach(() => {
  jest.clearAllMocks();
  mockStatus = 'connected';
  mockIsCapacitorNative = true;
});

describe('BleTestPage — auto-apply with debounce', () => {
  it('tapping a preset updates the preview header immediately', () => {
    jest.useFakeTimers();
    render(<BleTestPage />);
    // Preset #1 is "Space Invader"
    fireEvent.click(screen.getByRole('button', { name: /Space Invader/i }));
    expect(screen.getByText(/Preset #1: Space Invader/i)).toBeInTheDocument();
    jest.useRealTimers();
  });

  it('when connected, schedules sendLEDs 200ms after a tap (not sooner)', () => {
    jest.useFakeTimers();
    render(<BleTestPage />);
    fireEvent.click(screen.getByRole('button', { name: /Space Invader/i }));

    // Nothing sent yet — debounce in flight.
    expect(sendLEDsMock).not.toHaveBeenCalled();

    act(() => { jest.advanceTimersByTime(199); });
    expect(sendLEDsMock).not.toHaveBeenCalled();

    act(() => { jest.advanceTimersByTime(1); });
    expect(sendLEDsMock).toHaveBeenCalledTimes(1);
    // Called with the preset's holds
    const preset1 = PRESETS.find((p) => p.id === 1)!;
    expect(sendLEDsMock).toHaveBeenCalledWith(preset1.holds);
    jest.useRealTimers();
  });

  it('a rapid second tap cancels the first pending send and only fires once', () => {
    jest.useFakeTimers();
    render(<BleTestPage />);
    fireEvent.click(screen.getByRole('button', { name: /Space Invader/i }));
    act(() => { jest.advanceTimersByTime(100); });
    fireEvent.click(screen.getByRole('button', { name: /Ghost Blinky/i }));
    act(() => { jest.advanceTimersByTime(199); });
    expect(sendLEDsMock).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(1); });
    expect(sendLEDsMock).toHaveBeenCalledTimes(1);
    // Last tap wins — should carry preset #2's holds
    const preset2 = PRESETS.find((p) => p.id === 2)!;
    expect(sendLEDsMock).toHaveBeenCalledWith(preset2.holds);
    jest.useRealTimers();
  });

  it('when not connected, tapping a preset does NOT schedule a send', () => {
    jest.useFakeTimers();
    mockStatus = 'idle';
    render(<BleTestPage />);
    fireEvent.click(screen.getByRole('button', { name: /Space Invader/i }));
    act(() => { jest.advanceTimersByTime(500); });
    expect(sendLEDsMock).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('tapping Reset cancels any pending send and, when connected, sends all-off', () => {
    jest.useFakeTimers();
    render(<BleTestPage />);
    fireEvent.click(screen.getByRole('button', { name: /Space Invader/i }));
    // Reset before the debounce fires
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Reset anteprima/i }));
    });
    act(() => { jest.advanceTimersByTime(500); });
    // The scheduled auto-apply was cancelled — no sendLEDs ever ran
    expect(sendLEDsMock).not.toHaveBeenCalled();
    // But sendAllOff did
    expect(sendAllOffMock).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
