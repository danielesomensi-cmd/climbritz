const impact = jest.fn().mockResolvedValue(undefined);
const notification = jest.fn().mockResolvedValue(undefined);
let native = false;

jest.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => native },
}));
jest.mock('@capacitor/haptics', () => ({
  Haptics: { impact: (...a: unknown[]) => impact(...a), notification: (...a: unknown[]) => notification(...a) },
  ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM' },
  NotificationType: { Success: 'SUCCESS', Error: 'ERROR' },
}));
const keepAwakeFn = jest.fn().mockResolvedValue(undefined);
const allowSleepFn = jest.fn().mockResolvedValue(undefined);
jest.mock('@capacitor-community/keep-awake', () => ({
  KeepAwake: { keepAwake: () => keepAwakeFn(), allowSleep: () => allowSleepFn() },
}));

import { haptic } from '../haptics';
import { allowSleep, keepAwake } from '../keep-awake';

beforeEach(() => {
  impact.mockClear();
  notification.mockClear();
  keepAwakeFn.mockClear();
  allowSleepFn.mockClear();
});

describe('haptic', () => {
  it('is a no-op on web', async () => {
    native = false;
    await haptic('light');
    await haptic('success');
    expect(impact).not.toHaveBeenCalled();
    expect(notification).not.toHaveBeenCalled();
  });

  it('maps kinds to the plugin on native', async () => {
    native = true;
    await haptic('light');
    expect(impact).toHaveBeenCalledWith({ style: 'LIGHT' });
    await haptic('success');
    expect(notification).toHaveBeenCalledWith({ type: 'SUCCESS' });
    await haptic('error');
    expect(notification).toHaveBeenCalledWith({ type: 'ERROR' });
  });

  it('swallows plugin errors', async () => {
    native = true;
    impact.mockRejectedValueOnce(new Error('no motor'));
    await expect(haptic('light')).resolves.toBeUndefined();
  });
});

describe('keep-awake', () => {
  it('uses the plugin on native', async () => {
    native = true;
    await expect(keepAwake()).resolves.toBe(true);
    await allowSleep();
    expect(keepAwakeFn).toHaveBeenCalled();
    expect(allowSleepFn).toHaveBeenCalled();
  });

  it('returns false on web without wakeLock and never throws', async () => {
    native = false;
    await expect(keepAwake()).resolves.toBe(false);
    await expect(allowSleep()).resolves.toBeUndefined();
    expect(keepAwakeFn).not.toHaveBeenCalled();
  });
});
