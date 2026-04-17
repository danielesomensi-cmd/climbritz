'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  connectToKilterBoard,
  disconnectFromKilterBoard,
  type ConnectedKilterBoard,
} from '../../lib/ble/kilter-board-service';

export type BleStatus =
  | 'idle'
  | 'requesting'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error';

export interface UseKilterBle {
  status: BleStatus;
  errorMessage: string | null;
  connectedDevice: ConnectedKilterBoard | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  isCapacitorNative: boolean;
}

export function useKilterBle(): UseKilterBle {
  const [status, setStatus] = useState<BleStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connectedDevice, setConnectedDevice] = useState<ConnectedKilterBoard | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const isCapacitorNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();

  const handleDisconnected = useCallback(() => {
    deviceIdRef.current = null;
    setConnectedDevice(null);
    setStatus('idle');
  }, []);

  const connect = useCallback(async () => {
    if (!isCapacitorNative) {
      setErrorMessage('Questa funzione richiede l’app Kilter-Up installata.');
      setStatus('error');
      return;
    }
    setErrorMessage(null);
    setStatus('requesting');
    try {
      // requestDevice spawns the native picker — treat that phase as "scanning"
      // so the UI can show the yellow indicator while the dialog is open.
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
    connectedDevice,
    connect,
    disconnect,
    isCapacitorNative,
  };
}
