'use client';

import { useEffect, useRef, useState } from 'react';
import { useBle } from '@/components/BleProvider';
import { PRESETS } from './presets';
import { BoardPreview } from './board-preview';
import BottomNav from '@/components/BottomNav';
import AuthGuard from '@/components/AuthGuard';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import StatusDot from '@/components/ui/StatusDot';
import { STATUS_LABELS, BUSY_STATUSES } from '@/lib/ble/status';
import type { LedHold } from './presets';

// Debounce window for auto-applying a preset to the board after a tap.
// Preview updates instantly; only the BLE send is debounced.
const AUTO_APPLY_DEBOUNCE_MS = 200;

function BleTestContent() {
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
  } = useBle();
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
    <main className="min-h-screen bg-surface-base text-white pb-nav">
      <PageHeader title="BLE LED Test" widthClass="max-w-lg">
        <p className="text-text-tertiary text-sm mt-1">
          Kilter Board Original 12x12 — layout_id=1
        </p>
      </PageHeader>
      <div className="max-w-lg mx-auto px-4 pt-4">

        {/* Connection status bar */}
        <Card className="flex items-center gap-3 mb-3 p-3">
          <StatusDot status={status} />
          <div className="flex-1 min-w-0">
            <div className="font-medium">{STATUS_LABELS[status]}</div>
            {connectedDevice && (
              <div className="text-xs text-text-tertiary truncate">
                {connectedDevice.name}
                {connectedDevice.apiLevel && (
                  <span className="ml-1 text-text-muted">API v{connectedDevice.apiLevel}</span>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Connect / Disconnect — card-sized action button */}
        {isCapacitorNative && (
          <div className="mb-4">
            {isConnected ? (
              <Button variant="secondary" size="lg" className="w-full" onClick={disconnect} disabled={isSending}>
                Disconnect
              </Button>
            ) : busy ? (
              <Button variant="secondary" size="lg" className="w-full" disabled>
                {STATUS_LABELS[status]}
              </Button>
            ) : (
              <Button variant="primary" size="lg" className="w-full" onClick={connect}>
                Connect
              </Button>
            )}
          </div>
        )}

        {!isCapacitorNative && (
          <div className="mb-4 p-3 bg-amber-900/40 border border-amber-600 rounded text-sm text-amber-200">
            This feature requires the installed Climbritz app.
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
              aria-label="Dismiss error"
            >
              &times;
            </button>
          </div>
        )}

        {/* Illumina board button */}
        {isConnected && (
          <Button
            variant="primary"
            size="lg"
            className="w-full mb-4 tracking-wide"
            onClick={handleIllumina}
            disabled={!canSend || isSending}
          >
            {isSending ? 'Sending…' : 'Light up board'}
          </Button>
        )}

        {/* Reset preview — clears preview + physical board when connected */}
        <Button
          variant="secondary"
          size="lg"
          className="w-full mb-4 tracking-wide"
          onClick={handleResetPreview}
          disabled={isSending}
        >
          {isSending ? 'Sending…' : 'Reset preview'}
        </Button>

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
                    ? 'bg-orange-500/20 ring-2 ring-orange-500'
                    : isStressTest
                      ? 'bg-amber-950/40 hover:bg-amber-900/60'
                      : 'bg-zinc-800 hover:bg-zinc-700',
                ].join(' ')}
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="text-xs text-zinc-400">#{preset.id}</span>
                  <span className="text-xs text-zinc-500">{preset.holds.length} LED</span>
                </div>
                <p className="font-semibold text-sm leading-tight">{preset.name}</p>
                <p className="text-xs text-zinc-400 mt-1 leading-tight">{preset.description}</p>
              </button>
            );
          })}
        </div>

        {/* Board visual preview */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">
            Visual preview
            {activePreset !== null && (
              <span className="ml-2 text-orange-300 normal-case font-normal">
                — Preset #{activePreset}: {PRESETS.find(p => p.id === activePreset)?.name}
              </span>
            )}
          </p>
          <BoardPreview holds={activeHolds} />
        </div>

        {/* Legend */}
        <div className="p-3 bg-zinc-800 rounded-lg">
          <p className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">Role colors</p>
          <div className="grid grid-cols-2 gap-1 text-xs">
            {[
              { label: 'Start (12)', color: '#00FF00' },
              { label: 'Middle (13)', color: '#00FFFF' },
              { label: 'Finish (14)', color: '#FF00FF' },
              { label: 'Foot (15)', color: '#FFB600' },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="text-zinc-300">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-zinc-600 mt-6">
          Requires the installed Climbritz app (BLE via Capacitor)
        </p>
      </div>
      <BottomNav />
    </main>
  );
}

export default function BleTestPage() {
  return (
    <AuthGuard>
      <BleTestContent />
    </AuthGuard>
  );
}
