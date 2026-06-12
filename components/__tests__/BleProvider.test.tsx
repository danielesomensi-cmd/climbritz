import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// B035 — the provider owns the single shared BLE state machine. These tests
// pin the behavior contract: state survives consumer unmount (no disconnect
// on navigation), onDisconnect flips every consumer to idle with NO
// auto-reconnect, and the app-resume sync is a read-only state check.

const connectToKilterBoardMock = jest.fn();
const disconnectFromKilterBoardMock = jest.fn();
const sendLEDPresetMock = jest.fn();
const sendAllOffMock = jest.fn();

jest.mock('@/lib/ble/kilter-board-service', () => ({
  KILTER_BOARD_SERVICE_UUID: 'kilter-service-uuid',
  connectToKilterBoard: (...args: unknown[]) => connectToKilterBoardMock(...args),
  disconnectFromKilterBoard: (...args: unknown[]) => disconnectFromKilterBoardMock(...args),
  sendLEDPreset: (...args: unknown[]) => sendLEDPresetMock(...args),
  sendAllOff: (...args: unknown[]) => sendAllOffMock(...args),
}));

const getConnectedDevicesMock = jest.fn();
jest.mock('@/lib/ble/transport', () => ({
  getConnectedDevices: (...args: unknown[]) => getConnectedDevicesMock(...args),
}));

jest.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
}));

// Capture the 'resume' handler the provider registers so tests can simulate
// the app coming back from background.
let resumeHandler: (() => void) | null = null;
jest.mock('@capacitor/app', () => ({
  App: {
    addListener: (event: string, cb: () => void) => {
      if (event === 'resume') resumeHandler = cb;
      return Promise.resolve({ remove: jest.fn() });
    },
  },
}));

import { BleProvider, useBle } from '../BleProvider';

const DEVICE = { deviceId: 'dev-1', name: 'mykilterboard@3', apiLevel: 3 };

// onDisconnect callback handed to connectToKilterBoard — the transport-level
// disconnect signal (board takeover, OS drop).
let transportOnDisconnect: (() => void) | null = null;

function Consumer({ label }: { label: string }) {
  const { status, connectedDevice, connect, disconnect } = useBle();
  return (
    <div>
      <span data-testid={`${label}-status`}>{status}</span>
      <span data-testid={`${label}-device`}>{connectedDevice?.name ?? 'none'}</span>
      <button onClick={() => void connect()}>connect-{label}</button>
      <button onClick={() => void disconnect()}>disconnect-{label}</button>
    </div>
  );
}

async function connectVia(label: string) {
  fireEvent.click(screen.getByRole('button', { name: `connect-${label}` }));
  await waitFor(() =>
    expect(screen.getByTestId(`${label}-status`)).toHaveTextContent('connected'),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  resumeHandler = null;
  transportOnDisconnect = null;
  connectToKilterBoardMock.mockImplementation(async (onDisconnect: () => void) => {
    transportOnDisconnect = onDisconnect;
    return DEVICE;
  });
  disconnectFromKilterBoardMock.mockResolvedValue(undefined);
  sendLEDPresetMock.mockResolvedValue(undefined);
  sendAllOffMock.mockResolvedValue(undefined);
  getConnectedDevicesMock.mockResolvedValue([DEVICE]);
});

describe('BleProvider — shared connection state (B035)', () => {
  it('connect flows to connected and exposes the device to consumers', async () => {
    render(
      <BleProvider>
        <Consumer label="a" />
      </BleProvider>,
    );
    expect(screen.getByTestId('a-status')).toHaveTextContent('idle');
    await connectVia('a');
    expect(screen.getByTestId('a-device')).toHaveTextContent('mykilterboard@3');
    expect(connectToKilterBoardMock).toHaveBeenCalledTimes(1);
  });

  it('state survives consumer unmount — NO disconnect on navigation', async () => {
    const { rerender } = render(
      <BleProvider>
        <Consumer label="a" />
      </BleProvider>,
    );
    await connectVia('a');

    // Navigate away: the page-level consumer unmounts, provider stays.
    rerender(
      <BleProvider>
        <div data-testid="other-page" />
      </BleProvider>,
    );
    expect(disconnectFromKilterBoardMock).not.toHaveBeenCalled();

    // Navigate to another BLE surface: it sees the live connection.
    rerender(
      <BleProvider>
        <Consumer label="b" />
      </BleProvider>,
    );
    expect(screen.getByTestId('b-status')).toHaveTextContent('connected');
    expect(screen.getByTestId('b-device')).toHaveTextContent('mykilterboard@3');
  });

  it('a second connect tap while already connected is a no-op (single shared connection)', async () => {
    render(
      <BleProvider>
        <Consumer label="a" />
      </BleProvider>,
    );
    await connectVia('a');
    fireEvent.click(screen.getByRole('button', { name: 'connect-a' }));
    await act(async () => {});
    expect(connectToKilterBoardMock).toHaveBeenCalledTimes(1);
  });

  it('explicit Disconnect tap is the only path that tears the link down', async () => {
    render(
      <BleProvider>
        <Consumer label="a" />
      </BleProvider>,
    );
    await connectVia('a');
    fireEvent.click(screen.getByRole('button', { name: 'disconnect-a' }));
    await waitFor(() => expect(screen.getByTestId('a-status')).toHaveTextContent('idle'));
    expect(disconnectFromKilterBoardMock).toHaveBeenCalledWith('dev-1');
  });

  it('transport onDisconnect (board takeover / OS drop) flips state to idle with NO auto-reconnect', async () => {
    render(
      <BleProvider>
        <Consumer label="a" />
      </BleProvider>,
    );
    await connectVia('a');

    act(() => {
      transportOnDisconnect?.();
    });
    expect(screen.getByTestId('a-status')).toHaveTextContent('idle');
    expect(screen.getByTestId('a-device')).toHaveTextContent('none');
    // Contract #2: never reconnect on our own.
    expect(connectToKilterBoardMock).toHaveBeenCalledTimes(1);
  });

  it('app resume: read-only check flips to idle when the device is gone, never reconnects', async () => {
    render(
      <BleProvider>
        <Consumer label="a" />
      </BleProvider>,
    );
    await waitFor(() => expect(resumeHandler).not.toBeNull());
    await connectVia('a');

    // OS silently dropped the link while backgrounded.
    getConnectedDevicesMock.mockResolvedValue([]);
    await act(async () => {
      resumeHandler!();
    });
    expect(getConnectedDevicesMock).toHaveBeenCalledWith(['kilter-service-uuid']);
    expect(screen.getByTestId('a-status')).toHaveTextContent('idle');
    expect(connectToKilterBoardMock).toHaveBeenCalledTimes(1);
  });

  it('app resume: stays connected when the device is still in the OS list', async () => {
    render(
      <BleProvider>
        <Consumer label="a" />
      </BleProvider>,
    );
    await waitFor(() => expect(resumeHandler).not.toBeNull());
    await connectVia('a');

    await act(async () => {
      resumeHandler!();
    });
    expect(screen.getByTestId('a-status')).toHaveTextContent('connected');
  });

  it('app resume while not connected does not query the plugin', async () => {
    render(
      <BleProvider>
        <Consumer label="a" />
      </BleProvider>,
    );
    await waitFor(() => expect(resumeHandler).not.toBeNull());
    await act(async () => {
      resumeHandler!();
    });
    expect(getConnectedDevicesMock).not.toHaveBeenCalled();
  });

  it('app resume: a failing plugin query keeps current state (best-effort)', async () => {
    render(
      <BleProvider>
        <Consumer label="a" />
      </BleProvider>,
    );
    await waitFor(() => expect(resumeHandler).not.toBeNull());
    await connectVia('a');

    getConnectedDevicesMock.mockRejectedValue(new Error('plugin unavailable'));
    await act(async () => {
      resumeHandler!();
    });
    expect(screen.getByTestId('a-status')).toHaveTextContent('connected');
  });

  it('useBle outside the provider throws a clear error', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Consumer label="x" />)).toThrow(/BleProvider/);
    errSpy.mockRestore();
  });
});
