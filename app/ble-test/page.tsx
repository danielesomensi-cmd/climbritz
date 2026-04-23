'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useKilterBle } from './use-kilter-ble';
import { PRESETS } from './presets';
import { BoardPreview } from './board-preview';
import type { BleStatus } from './use-kilter-ble';
import type { LedHold } from './presets';

// Debounce window for auto-applying a preset to the board after a tap.
// Preview updates instantly; only the BLE send is debounced.
const AUTO_APPLY_DEBOUNCE_MS = 200;

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
  idle: 'Disconnesso',
  requesting: 'Richiesta...',
  scanning: 'Scansione...',
  connecting: 'Connessione...',
  connected: 'Connesso',
  disconnecting: 'Disconnessione...',
  sending: 'Invio...',
  error: 'Errore',
};

const BUSY_STATUSES: BleStatus[] = ['requesting', 'scanning', 'connecting', 'disconnecting'];

export default function BleTestPage() {
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
  const [activePreset, setActivePreset] = useState<number | null>(null);
  const [activeHolds, setActiveHolds] = useState<LedHold[]>([]);
  const autoApplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A send is still "allowed" during the brief 'sending' transition — the hook's
  // promise chain serializes writes, so a queued send will run after the in-flight one.
  const canAutoApply = status === 'connected' || status === 'sending';

  const handlePreset = (id: number) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setActivePreset(id);
    setActiveHolds(preset.holds);

    if (autoApplyTimerRef.current !== null) {
      clearTimeout(autoApplyTimerRef.current);
      autoApplyTimerRef.current = null;
    }
    if (canAutoApply && preset.holds.length > 0) {
      autoApplyTimerRef.current = setTimeout(() => {
        autoApplyTimerRef.current = null;
        sendLEDs(preset.holds);
      }, AUTO_APPLY_DEBOUNCE_MS);
    }
  };

  const handleResetPreview = async () => {
    if (autoApplyTimerRef.current !== null) {
      clearTimeout(autoApplyTimerRef.current);
      autoApplyTimerRef.current = null;
    }
    setActivePreset(null);
    setActiveHolds([]);
    if (canAutoApply) {
      await sendAllOffLEDs();
    }
  };

  useEffect(() => {
    return () => {
      if (autoApplyTimerRef.current !== null) {
        clearTimeout(autoApplyTimerRef.current);
        autoApplyTimerRef.current = null;
      }
    };
  }, []);

  const handleIllumina = async () => {
    if (activeHolds.length === 0) return;
    await sendLEDs(activeHolds);
  };

  const busy = BUSY_STATUSES.includes(status);
  const isSending = status === 'sending';
  const isConnected = status === 'connected' || isSending;
  const canSend = status === 'connected' && activePreset !== null;

  return (
    <main className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-lg mx-auto">
        <Link href="/" className="inline-flex items-center text-sm text-zinc-400 hover:text-zinc-200 mb-3">
          &larr; Home
        </Link>
        <h1 className="text-2xl font-bold mb-1">BLE LED Test</h1>
        <p className="text-gray-400 text-sm mb-6">
          Kilter Board Original 12x12 — layout_id=1
        </p>

        {/* Connection status bar */}
        <div className="flex items-center gap-3 mb-3 p-3 bg-gray-800 rounded-lg">
          <div className={`w-3 h-3 rounded-full flex-shrink-0 ${STATUS_COLORS[status]}`} />
          <div className="flex-1 min-w-0">
            <div className="font-medium">{STATUS_LABELS[status]}</div>
            {connectedDevice && (
              <div className="text-xs text-gray-400 truncate">
                {connectedDevice.name}
                {connectedDevice.apiLevel && (
                  <span className="ml-1 text-gray-500">API v{connectedDevice.apiLevel}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Connect / Disconnect — card-sized action button */}
        {isCapacitorNative && (
          <div className="mb-4">
            {isConnected ? (
              <button
                onClick={disconnect}
                disabled={isSending}
                className="w-full p-3 rounded-lg font-semibold text-base bg-gray-700 hover:bg-gray-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Disconnetti
              </button>
            ) : busy ? (
              <button
                disabled
                className="w-full p-3 rounded-lg font-semibold text-base bg-gray-700 cursor-not-allowed opacity-75"
              >
                {STATUS_LABELS[status]}
              </button>
            ) : (
              <button
                onClick={connect}
                className="w-full p-3 rounded-lg font-semibold text-base bg-blue-600 hover:bg-blue-500 transition-all"
              >
                Connetti
              </button>
            )}
          </div>
        )}

        {!isCapacitorNative && (
          <div className="mb-4 p-3 bg-amber-900/40 border border-amber-600 rounded text-sm text-amber-200">
            Questa funzione richiede l&apos;app Kilter-Up installata.
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-600 rounded text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        {/* Dismissible inline error banner for send errors */}
        {lastError && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-600 rounded text-sm text-red-300 flex items-start gap-2">
            <span className="flex-1">{lastError}</span>
            <button
              onClick={clearError}
              className="text-red-400 hover:text-red-200 font-bold text-lg leading-none flex-shrink-0"
              aria-label="Chiudi errore"
            >
              &times;
            </button>
          </div>
        )}

        {/* Illumina board button */}
        {isConnected && (
          <button
            onClick={handleIllumina}
            disabled={!canSend || isSending}
            className={[
              'w-full mb-4 py-3 rounded-lg font-semibold text-lg tracking-wide transition-colors',
              canSend && !isSending
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed',
            ].join(' ')}
          >
            {isSending ? 'Invio...' : 'Illumina board'}
          </button>
        )}

        {/* Reset preview — clears preview + physical board when connected */}
        <button
          onClick={handleResetPreview}
          disabled={isSending}
          className="w-full mb-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold text-lg tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSending ? 'Invio...' : 'Reset anteprima'}
        </button>

        {/* Preset grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {PRESETS.map((preset) => {
            const isActive = activePreset === preset.id;
            const isStressTest = preset.id === 11;
            return (
              <button
                key={preset.id}
                onClick={() => handlePreset(preset.id)}
                className={[
                  'p-3 rounded-lg text-left transition-all',
                  isStressTest ? 'col-span-2 border border-amber-600/60' : '',
                  isActive
                    ? 'bg-blue-700 ring-2 ring-blue-400'
                    : isStressTest
                      ? 'bg-amber-950/40 hover:bg-amber-900/60'
                      : 'bg-gray-800 hover:bg-gray-700',
                ].join(' ')}
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="text-xs text-gray-400">#{preset.id}</span>
                  <span className="text-xs text-gray-500">{preset.holds.length} LED</span>
                </div>
                <p className="font-semibold text-sm leading-tight">{preset.name}</p>
                <p className="text-xs text-gray-400 mt-1 leading-tight">{preset.description}</p>
              </button>
            );
          })}
        </div>

        {/* Board visual preview */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
            Anteprima visiva
            {activePreset !== null && (
              <span className="ml-2 text-blue-400 normal-case font-normal">
                — Preset #{activePreset}: {PRESETS.find(p => p.id === activePreset)?.name}
              </span>
            )}
          </p>
          <BoardPreview holds={activeHolds} />
        </div>

        {/* Legend */}
        <div className="p-3 bg-gray-800 rounded-lg">
          <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Colori ruolo</p>
          <div className="grid grid-cols-2 gap-1 text-xs">
            {[
              { label: 'Start (12)', color: '#00FF00' },
              { label: 'Middle (13)', color: '#00FFFF' },
              { label: 'Finish (14)', color: '#FF00FF' },
              { label: 'Foot (15)', color: '#FFB600' },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="text-gray-300">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          Richiede l&apos;app Kilter-Up (BLE via Capacitor)
        </p>
      </div>
    </main>
  );
}
