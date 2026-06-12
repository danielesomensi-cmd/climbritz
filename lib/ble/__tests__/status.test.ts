import { STATUS_COLORS, STATUS_LABELS, BUSY_STATUSES } from '../status';
import type { BleStatus } from '@/components/BleProvider';

const ALL: BleStatus[] = [
  'idle',
  'requesting',
  'scanning',
  'connecting',
  'connected',
  'disconnecting',
  'sending',
  'error',
];

describe('lib/ble/status', () => {
  it('has a colour + label for every status', () => {
    for (const s of ALL) {
      expect(STATUS_COLORS[s]).toBeTruthy();
      expect(STATUS_LABELS[s]).toBeTruthy();
    }
  });

  it('idle is zinc, not the legacy gray (D18-2)', () => {
    expect(STATUS_COLORS.idle).toContain('zinc-500');
    expect(STATUS_COLORS.idle).not.toContain('gray');
  });

  it('connected reads as connected/disconnected labels', () => {
    expect(STATUS_LABELS.connected).toBe('Connected');
    expect(STATUS_LABELS.idle).toBe('Disconnected');
  });

  it('busy statuses are the transient ones', () => {
    expect(BUSY_STATUSES).toEqual(['requesting', 'scanning', 'connecting', 'disconnecting']);
  });
});
