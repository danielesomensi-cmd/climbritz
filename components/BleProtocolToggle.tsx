'use client';

// Escape hatch for the board protocol: the API level is inferred from the
// board's name, and a wrong guess makes the board silently ignore every
// packet. One tap switches v3 ⇄ v2 (persisted per device by BleProvider);
// the next Light up uses the new encoding.

import { useBle } from '@/components/BleProvider';
import { PRESSABLE_CLASSES } from '@/components/ui/pressable';

export default function BleProtocolToggle({ className = '' }: { className?: string }) {
  const { connectedDevice, setProtocol } = useBle();
  if (!connectedDevice) return null;
  const level = connectedDevice.apiLevel >= 3 ? 3 : 2;
  const next = level === 3 ? 2 : 3;
  return (
    <button
      type="button"
      data-testid="ble-protocol-toggle"
      aria-label={`Board protocol API v${level}. Tap to switch to v${next}`}
      onClick={() => setProtocol(next)}
      className={`ml-1 inline-flex items-center rounded border border-border-strong px-1.5 py-0.5 text-zinc-400 ${PRESSABLE_CLASSES} ${className}`}
    >
      API v{level} ⇄
    </button>
  );
}
