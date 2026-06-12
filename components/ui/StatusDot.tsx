import type { BleStatus } from '@/components/BleProvider';
import { STATUS_COLORS } from '@/lib/ble/status';

// B033 Phase 3 — BLE status indicator dot (D18-11). Colour comes from the single
// source in lib/ble/status.ts so the two BLE surfaces can't drift.
export default function StatusDot({
  status,
  className = '',
}: {
  status: BleStatus;
  className?: string;
}) {
  return (
    <span
      className={`w-3 h-3 rounded-full flex-shrink-0 ${STATUS_COLORS[status]} ${className}`}
      data-testid="ble-status-dot"
    />
  );
}
