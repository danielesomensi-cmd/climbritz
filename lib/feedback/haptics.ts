// NATIVE-001 — haptic feedback layer.
//
// Thin wrapper over @capacitor/haptics. The plugin is loaded with a dynamic
// import (same pattern LogSection uses for @capacitor/app) so the web bundle
// and the Jest env never hard-depend on it. Every call is fire-and-forget:
// a haptic must never throw into UI code or delay a state update.
//
// On the web (or anywhere Capacitor reports a non-native platform) all
// functions are no-ops — we deliberately do NOT fall back to
// navigator.vibrate, which is inconsistent across browsers.

export type HapticKind = 'light' | 'medium' | 'success' | 'error';

/** True only inside the Capacitor iOS/Android shell. */
export async function isNativePlatform(): Promise<boolean> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function run(kind: HapticKind): Promise<void> {
  try {
    if (!(await isNativePlatform())) return;
    const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
    switch (kind) {
      case 'light':
        await Haptics.impact({ style: ImpactStyle.Light });
        return;
      case 'medium':
        await Haptics.impact({ style: ImpactStyle.Medium });
        return;
      case 'success':
        await Haptics.notification({ type: NotificationType.Success });
        return;
      case 'error':
        await Haptics.notification({ type: NotificationType.Error });
        return;
    }
  } catch {
    // Plugin missing, permission denied, device without a motor — ignore.
  }
}

/** Fire a haptic. Never throws, never needs awaiting. */
export function haptic(kind: HapticKind = 'light'): Promise<void> {
  return run(kind);
}
