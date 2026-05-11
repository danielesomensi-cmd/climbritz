'use client';

import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useKilterBle, type BleStatus } from '@/app/ble-test/use-kilter-ble';
import type { EncoderHold } from '@/lib/ble/kilter-protocol';

// A014 — delay between a climbKey change and the auto-send, so rapid
// Next/Prev taps coalesce into a single BLE packet on the last climb.
const AUTO_SEND_DEBOUNCE_MS = 300;

const STATUS_COLORS: Record<BleStatus, string> = {
  idle: 'bg-gray-500',
  requesting: 'bg-yellow-400 animate-pulse',
  scanning: 'bg-yellow-400 animate-pulse',
  connecting: 'bg-yellow-400 animate-pulse',
  connected: 'bg-green-500',
  disconnecting: 'bg-yellow-400 animate-pulse',
  sending: 'bg-blue-400 animate-pulse',
  error: 'bg-red-500',
};

const STATUS_LABELS: Record<BleStatus, string> = {
  idle: 'Disconnected',
  requesting: 'Requesting…',
  scanning: 'Scanning…',
  connecting: 'Connecting…',
  connected: 'Connected',
  disconnecting: 'Disconnecting…',
  sending: 'Sending…',
  error: 'Error',
};

const BUSY_STATUSES: BleStatus[] = ['requesting', 'scanning', 'connecting', 'disconnecting'];

interface ClimbBleControlsProps {
  ledCommands: EncoderHold[];
  /** Stable identifier for the current ledCommands (climb uuid). Used only
   *  to detect when the displayed climb has changed. */
  climbKey?: string;
  /** When true, the component auto-sends ledCommands (debounced) whenever
   *  climbKey changes AND the board is connected. Parent flips this to true
   *  after a Next/Prev tap. Does NOT auto-send on the initial render. */
  autoSendOnKeyChange?: boolean;
}

/**
 * BLE control bar for the Discover climb detail page. Reuses the same
 * BLE hook as /ble-test so connect/send/disconnect behaviour is identical.
 */
export default function ClimbBleControls({
  ledCommands,
  climbKey,
  autoSendOnKeyChange = false,
}: ClimbBleControlsProps) {
  const {
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
  } = useKilterBle();

  // Capacitor.isNativePlatform() is stable across the hook lifetime, but we
  // hydrate-mount the UI in a client-only way to avoid SSR mismatches.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // A014 — auto-send on climbKey change when parent enabled it (Next/Prev
  // nav). Seeds lastSentKey with the first climbKey we ever see so the
  // initial render never auto-sends.
  const lastSentKeyRef = useRef<string | undefined>(undefined);
  const hasSeenKeyRef = useRef(false);
  useEffect(() => {
    if (!hasSeenKeyRef.current && climbKey !== undefined) {
      // First climbKey we see — treat as "already sent" so we don't fire
      // on the initial page load even if autoSendOnKeyChange is true.
      lastSentKeyRef.current = climbKey;
      hasSeenKeyRef.current = true;
      return;
    }
    if (!autoSendOnKeyChange) return;
    if (!climbKey) return;
    if (climbKey === lastSentKeyRef.current) return;
    if (ledCommands.length === 0) return;
    // Only send when actually connected. 'sending' is treated as connected
    // because the hook's write-chain serializes overlapping sends cleanly.
    if (status !== 'connected' && status !== 'sending') return;

    const timer = setTimeout(() => {
      lastSentKeyRef.current = climbKey;
      sendLEDs(ledCommands);
    }, AUTO_SEND_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [autoSendOnKeyChange, climbKey, ledCommands, status, sendLEDs]);

  if (!mounted) return null;

  const busy = BUSY_STATUSES.includes(status);
  const isSending = status === 'sending';
  const isConnected = status === 'connected' || isSending;
  const canIlluminate = status === 'connected' && ledCommands.length > 0;

  const handleIlluminate = () => sendLEDs(ledCommands);
  const handleReset = () => sendAllOffLEDs();

  // Browser / non-Capacitor — render a disabled notice so the UI is still
  // visible in the Vercel preview but doesn't pretend BLE works there.
  if (!isCapacitorNative && !Capacitor.isNativePlatform()) {
    return (
      <div className="mb-4 p-3 bg-amber-900/30 border border-amber-700/60 rounded text-sm text-amber-200">
        💡 Light up LEDs: only available in the installed Kilter-Up app.
      </div>
    );
  }

  return (
    <div className="mb-4 space-y-2" data-testid="climb-ble-controls">
      {/* Status bar */}
      <div className="flex items-center gap-3 p-2.5 bg-zinc-900 rounded-lg border border-zinc-800">
        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${STATUS_COLORS[status]}`} />
        <div className="flex-1 min-w-0 text-sm">
          <div className="font-medium text-zinc-200">{STATUS_LABELS[status]}</div>
          {connectedDevice && (
            <div className="text-xs text-zinc-500 truncate">
              {connectedDevice.name}
              {connectedDevice.apiLevel != null && (
                <span className="ml-1 text-zinc-600">API v{connectedDevice.apiLevel}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="p-2.5 bg-red-900/40 border border-red-700 rounded text-sm text-red-300">
          {errorMessage}
        </div>
      )}

      {lastError && (
        <div className="p-2.5 bg-red-900/40 border border-red-700 rounded text-sm text-red-300 flex items-start gap-2">
          <span className="flex-1">{lastError}</span>
          <button
            onClick={clearError}
            className="text-red-400 hover:text-red-200 font-bold text-lg leading-none flex-shrink-0"
            aria-label="Dismiss error"
          >
            &times;
          </button>
        </div>
      )}

      {/* Connect / Disconnect */}
      {isConnected ? (
        <button
          onClick={disconnect}
          disabled={isSending}
          className="w-full py-2.5 rounded-lg font-semibold text-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="ble-disconnect-btn"
        >
          Disconnect
        </button>
      ) : busy ? (
        <button
          disabled
          className="w-full py-2.5 rounded-lg font-semibold text-sm bg-zinc-800 cursor-not-allowed opacity-75"
        >
          {STATUS_LABELS[status]}
        </button>
      ) : (
        <button
          onClick={connect}
          className="w-full py-2.5 rounded-lg font-semibold text-sm bg-blue-600 hover:bg-blue-500 transition-colors"
          data-testid="ble-connect-btn"
        >
          Connect to board
        </button>
      )}

      {/* Illumina + Reset — only shown while connected */}
      {isConnected && (
        <div className="flex gap-2">
          <button
            onClick={handleIlluminate}
            disabled={!canIlluminate || isSending}
            className={[
              'flex-1 py-2.5 rounded-lg font-semibold text-sm transition-colors',
              canIlluminate && !isSending
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed',
            ].join(' ')}
            data-testid="ble-illuminate-btn"
          >
            {isSending ? 'Sending…' : '💡 Light up board'}
          </button>
          <button
            onClick={handleReset}
            disabled={isSending}
            className="flex-1 py-2.5 rounded-lg font-semibold text-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="ble-reset-btn"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
