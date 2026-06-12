'use client';

// B035 — global BLE provider. The Kilter Board connection used to live inside
// page-level components (each `useKilterBle()` call owned its own state
// machine), so navigating away unmounted the hook and dropped the connection.
// The provider lifts the single state machine to the root layout (stable
// across SPA navigation, same pattern that keeps ClerkProvider alive) so the
// board stays connected anywhere in the app.
//
// Behavior contract (agreed with Daniele — do not deviate):
// 1. NEVER actively disconnect except on an explicit user "Disconnect" tap.
//    No disconnect on route change / unmount / app background.
// 2. NEVER auto-reconnect. If the OS or another user drops the connection,
//    reconnection is always a manual tap (gym etiquette — auto-reconnect
//    would kick off whoever connected to the board in the meantime).
// 3. UI always reflects true state: the transport-level onDisconnect callback
//    updates this shared state, and on app resume we run a READ-ONLY check of
//    the plugin's actual connection list to re-sync (never a connect call).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import {
  connectToKilterBoard,
  disconnectFromKilterBoard,
  sendLEDPreset,
  sendAllOff,
  KILTER_BOARD_SERVICE_UUID,
  type ConnectedKilterBoard,
} from '@/lib/ble/kilter-board-service';
import { getConnectedDevices } from '@/lib/ble/transport';
import type { EncoderHold } from '@/lib/ble/kilter-protocol';

export type BleStatus =
  | 'idle'
  | 'requesting'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'sending'
  | 'error';

export interface BleContextValue {
  status: BleStatus;
  errorMessage: string | null;
  lastError: string | null;
  connectedDevice: ConnectedKilterBoard | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendLEDs: (holds: EncoderHold[]) => Promise<void>;
  sendAllOffLEDs: () => Promise<void>;
  clearError: () => void;
  isCapacitorNative: boolean;
}

const BleContext = createContext<BleContextValue | null>(null);

export function BleProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<BleStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [connectedDevice, setConnectedDevice] = useState<ConnectedKilterBoard | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  // Serialize BLE writes — each new send chains after the previous one settles.
  // Prevents chunk interleaving when auto-apply taps arrive during an in-flight send.
  const sendChainRef = useRef<Promise<void>>(Promise.resolve());
  const isCapacitorNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();

  const clearError = useCallback(() => {
    setLastError(null);
  }, []);

  // Wired as the transport-level onDisconnect callback: fires when the OS or
  // another user (board takeover) drops the link → every page flips to
  // "Disconnected". Per contract, no reconnect is ever attempted from here.
  const handleDisconnected = useCallback(() => {
    deviceIdRef.current = null;
    setConnectedDevice(null);
    setStatus('idle');
  }, []);

  const connect = useCallback(async () => {
    if (!isCapacitorNative) {
      setErrorMessage('Questa funzione richiede l’app Climbritz installata.');
      setStatus('error');
      return;
    }
    // Single shared connection — ignore a connect tap while another surface
    // already connected or a connect/disconnect is in flight.
    if (deviceIdRef.current !== null || (status !== 'idle' && status !== 'error')) return;
    setErrorMessage(null);
    setLastError(null);
    setStatus('requesting');
    try {
      setStatus('scanning');
      const device = await connectToKilterBoard(handleDisconnected);
      setStatus('connecting');
      deviceIdRef.current = device.deviceId;
      setConnectedDevice(device);
      setStatus('connected');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setStatus('error');
      deviceIdRef.current = null;
      setConnectedDevice(null);
    }
  }, [isCapacitorNative, status, handleDisconnected]);

  // The ONLY place that actively tears the connection down — reached
  // exclusively from the user's explicit "Disconnect" tap.
  const disconnect = useCallback(async () => {
    const id = deviceIdRef.current;
    if (!id) {
      setStatus('idle');
      return;
    }
    setStatus('disconnecting');
    try {
      await disconnectFromKilterBoard(id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setStatus('error');
      return;
    }
    deviceIdRef.current = null;
    setConnectedDevice(null);
    setStatus('idle');
  }, []);

  const sendLEDs = useCallback(async (holds: EncoderHold[]) => {
    const next = sendChainRef.current.catch(() => {}).then(async () => {
      const id = deviceIdRef.current;
      if (!id) return;
      setStatus('sending');
      setLastError(null);
      try {
        await sendLEDPreset(id, holds);
        setStatus('connected');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setLastError(msg);
        setStatus('connected');
      }
    });
    sendChainRef.current = next;
    return next;
  }, []);

  const sendAllOffLEDs = useCallback(async () => {
    const next = sendChainRef.current.catch(() => {}).then(async () => {
      const id = deviceIdRef.current;
      if (!id) return;
      setStatus('sending');
      setLastError(null);
      try {
        await sendAllOff(id);
        setStatus('connected');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setLastError(msg);
        setStatus('connected');
      }
    });
    sendChainRef.current = next;
    return next;
  }, []);

  // App-resume sync — STRICTLY READ-ONLY. iOS can silently kill the link
  // while the app is suspended without delivering onDisconnect until later;
  // on resume we ask the plugin which devices are actually connected and flip
  // the UI to Disconnected if ours is gone. Never issues a connect call.
  const syncConnectionState = useCallback(async () => {
    const id = deviceIdRef.current;
    if (!id) return;
    try {
      const devices = await getConnectedDevices([KILTER_BOARD_SERVICE_UUID]);
      const stillConnected = devices.some((d) => d.deviceId === id);
      // Re-check the ref: a user disconnect may have raced the async query.
      if (!stillConnected && deviceIdRef.current === id) {
        handleDisconnected();
      }
    } catch {
      // Best-effort check — if the plugin can't answer, keep current state
      // and rely on the onDisconnect listener.
    }
  }, [handleDisconnected]);

  useEffect(() => {
    if (!isCapacitorNative) return;
    let handle: PluginListenerHandle | null = null;
    let cancelled = false;
    (async () => {
      try {
        const { App } = await import('@capacitor/app');
        const h = await App.addListener('resume', () => {
          void syncConnectionState();
        });
        if (cancelled) {
          void h.remove();
        } else {
          handle = h;
        }
      } catch {
        // @capacitor/app unavailable (web build, test env) — resume sync is
        // best-effort; the onDisconnect listener still covers live drops.
      }
    })();
    return () => {
      cancelled = true;
      if (handle) void handle.remove();
    };
  }, [isCapacitorNative, syncConnectionState]);

  const value = useMemo<BleContextValue>(
    () => ({
      status,
      errorMessage,
      lastError,
      connectedDevice,
      connect,
      disconnect,
      sendLEDs,
      sendAllOffLEDs,
      clearError,
      isCapacitorNative,
    }),
    [
      status,
      errorMessage,
      lastError,
      connectedDevice,
      connect,
      disconnect,
      sendLEDs,
      sendAllOffLEDs,
      clearError,
      isCapacitorNative,
    ],
  );

  return <BleContext.Provider value={value}>{children}</BleContext.Provider>;
}

export function useBle(): BleContextValue {
  const ctx = useContext(BleContext);
  if (!ctx) {
    throw new Error('useBle must be used within <BleProvider> (mounted in the root layout)');
  }
  return ctx;
}
