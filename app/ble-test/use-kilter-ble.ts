'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  connectToKilterBoard,
  disconnectFromKilterBoard,
  sendLEDPreset,
  sendAllOff,
  type ConnectedKilterBoard,
} from '../../lib/ble/kilter-board-service';
import type { EncoderHold } from '../../lib/ble/kilter-protocol';

export type BleStatus =
  | 'idle'
  | 'requesting'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'sending'
  | 'error';

export interface UseKilterBle {
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

export function useKilterBle(): UseKilterBle {
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

  const handleDisconnected = useCallback(() => {
    deviceIdRef.current = null;
    setConnectedDevice(null);
    setStatus('idle');
  }, []);

  const connect = useCallback(async () => {
    if (!isCapacitorNative) {
      setErrorMessage('Questa funzione richiede l\u2019app Climbritz installata.');
      setStatus('error');
      return;
    }
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
  }, [isCapacitorNative, handleDisconnected]);

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

  useEffect(() => {
    return () => {
      const id = deviceIdRef.current;
      if (id) {
        disconnectFromKilterBoard(id).catch(() => {});
      }
    };
  }, []);

  return {
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
  };
}
