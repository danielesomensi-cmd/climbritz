'use client';

import { useRef, useState, useCallback } from 'react';
import type { LedHold } from './presets';

export type BleStatus = 'disconnected' | 'scanning' | 'connected' | 'error';

export interface UseKilterBle {
  status: BleStatus;
  errorMessage: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendLeds: (holds: LedHold[]) => Promise<void>;
  allOff: () => Promise<void>;
}

export function useKilterBle(): UseKilterBle {
  const [status, setStatus] = useState<BleStatus>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // KilterBoard instance persists across renders
  const boardRef = useRef<InstanceType<Awaited<typeof import('@hangtime/grip-connect')>['KilterBoard']> | null>(null);

  const connect = useCallback(async () => {
    setStatus('scanning');
    setErrorMessage(null);

    try {
      // Dynamic import avoids SSR issues — KilterBoard uses navigator.bluetooth
      const { KilterBoard } = await import('@hangtime/grip-connect');

      if (!boardRef.current) {
        boardRef.current = new KilterBoard();
      }

      await new Promise<void>((resolve, reject) => {
        boardRef.current!.connect(
          () => {
            setStatus('connected');
            resolve();
          },
          (err: Error) => {
            reject(err);
          }
        );
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setStatus('error');
      boardRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    if (boardRef.current) {
      boardRef.current.disconnect();
      boardRef.current = null;
    }
    setStatus('disconnected');
    setErrorMessage(null);
  }, []);

  const sendLeds = useCallback(async (holds: LedHold[]) => {
    if (!boardRef.current || status !== 'connected') return;
    // Grip Connect only needs position + role_id/color, strip the x/y visual fields
    const payload = holds.map(({ position, role_id, color }) => ({ position, role_id, color }));
    try {
      await boardRef.current.led(payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    }
  }, [status]);

  const allOff = useCallback(async () => {
    if (!boardRef.current || status !== 'connected') return;
    try {
      await boardRef.current.led([]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    }
  }, [status]);

  return { status, errorMessage, connect, disconnect, sendLeds, allOff };
}
