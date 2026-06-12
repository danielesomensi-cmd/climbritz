// B033 Phase 3 — single source of truth for BLE connection status presentation
// (D18-11). Previously duplicated verbatim in app/ble-test/page.tsx and
// components/ClimbBleControls.tsx, which let the two surfaces drift (one used
// bg-gray-500 idle). Colours consolidated to the zinc/emerald/amber families
// (D18-2/D18-10): connected = emerald (state-send / "connected"), busy = amber,
// sending = blue (feedback-info), error = red.

import type { BleStatus } from '@/components/BleProvider';

export const STATUS_COLORS: Record<BleStatus, string> = {
  idle: 'bg-zinc-500',
  requesting: 'bg-amber-400 animate-pulse',
  scanning: 'bg-amber-400 animate-pulse',
  connecting: 'bg-amber-400 animate-pulse',
  connected: 'bg-emerald-500',
  disconnecting: 'bg-amber-400 animate-pulse',
  sending: 'bg-blue-400 animate-pulse',
  error: 'bg-red-500',
};

export const STATUS_LABELS: Record<BleStatus, string> = {
  idle: 'Disconnected',
  requesting: 'Requesting…',
  scanning: 'Scanning…',
  connecting: 'Connecting…',
  connected: 'Connected',
  disconnecting: 'Disconnecting…',
  sending: 'Sending…',
  error: 'Error',
};

export const BUSY_STATUSES: BleStatus[] = [
  'requesting',
  'scanning',
  'connecting',
  'disconnecting',
];
