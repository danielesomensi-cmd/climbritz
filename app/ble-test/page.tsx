'use client';

import { useState } from 'react';
import { useKilterBle } from './use-kilter-ble';
import { PRESETS } from './presets';
import { BoardPreview } from './board-preview';
import type { BleStatus } from './use-kilter-ble';
import type { LedHold } from './presets';

const STATUS_COLORS: Record<BleStatus, string> = {
  disconnected: 'bg-gray-500',
  scanning: 'bg-yellow-400 animate-pulse',
  connected: 'bg-green-500',
  error: 'bg-red-500',
};

const STATUS_LABELS: Record<BleStatus, string> = {
  disconnected: 'Disconnesso',
  scanning: 'Scansione...',
  connected: 'Connesso',
  error: 'Errore',
};

export default function BleTestPage() {
  const { status, errorMessage, connect, disconnect, sendLeds, allOff } = useKilterBle();
  const [activePreset, setActivePreset] = useState<number | null>(null);
  const [activeHolds, setActiveHolds] = useState<LedHold[]>([]);
  const [sending, setSending] = useState(false);

  const handlePreset = async (id: number) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    // Always update visual preview immediately (no BLE required)
    setActivePreset(id);
    setActiveHolds(preset.holds);
    // Send via BLE only when connected
    if (status === 'connected') {
      setSending(true);
      await sendLeds(preset.holds);
      setSending(false);
    }
  };

  const handleAllOff = async () => {
    setSending(true);
    setActivePreset(null);
    setActiveHolds([]);
    await allOff();
    setSending(false);
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold mb-1">BLE LED Test</h1>
        <p className="text-gray-400 text-sm mb-6">
          Kilter Board Original 12x12 — layout_id=1
        </p>

        {/* Connection status bar */}
        <div className="flex items-center gap-3 mb-4 p-3 bg-gray-800 rounded-lg">
          <div className={`w-3 h-3 rounded-full flex-shrink-0 ${STATUS_COLORS[status]}`} />
          <span className="font-medium">{STATUS_LABELS[status]}</span>
          <div className="ml-auto flex gap-2">
            {status === 'disconnected' || status === 'error' ? (
              <button
                onClick={connect}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium"
              >
                Connetti
              </button>
            ) : status === 'scanning' ? (
              <button
                disabled
                className="px-4 py-1.5 bg-gray-600 rounded text-sm font-medium cursor-not-allowed"
              >
                Scansione...
              </button>
            ) : (
              <button
                onClick={disconnect}
                className="px-4 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-sm font-medium"
              >
                Disconnetti
              </button>
            )}
          </div>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-600 rounded text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        {/* All Off button */}
        <button
          onClick={handleAllOff}
          disabled={status !== 'connected' || sending}
          className="w-full mb-4 py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-semibold text-lg tracking-wide"
        >
          Spegni tutto (All Off)
        </button>

        {/* Preset grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {PRESETS.map((preset) => {
            const isActive = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => handlePreset(preset.id)}
                disabled={sending}
                className={[
                  'p-3 rounded-lg text-left transition-all',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                  isActive
                    ? 'bg-blue-700 ring-2 ring-blue-400'
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
          Richiede Web Bluetooth (Chrome Android / Capacitor)
        </p>
      </div>
    </main>
  );
}
