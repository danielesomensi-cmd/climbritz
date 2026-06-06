import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

// B034 — drive Capacitor.getPlatform()/isNativePlatform() per test.
let mockPlatform = 'web';
let mockNative = false;

jest.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => mockPlatform,
    isNativePlatform: () => mockNative,
  },
}));

import IosSafeArea from '../IosSafeArea';

beforeEach(() => {
  mockPlatform = 'web';
  mockNative = false;
  const root = document.documentElement;
  root.classList.remove('ios-native');
  root.style.removeProperty('--safe-top');
  delete root.dataset.safeTop;
});

describe('IosSafeArea', () => {
  it('renders nothing and touches no globals on web', () => {
    const { container } = render(<IosSafeArea />);
    expect(container).toBeEmptyDOMElement();
    expect(document.documentElement.classList.contains('ios-native')).toBe(false);
    expect(document.documentElement.style.getPropertyValue('--safe-top')).toBe('');
  });

  it('is a no-op on iOS when not running natively (browser on iOS)', () => {
    mockPlatform = 'ios';
    mockNative = false;
    render(<IosSafeArea />);
    expect(document.documentElement.classList.contains('ios-native')).toBe(false);
  });

  it('flags native iOS and pins a Dynamic-Island-safe floor on --safe-top', () => {
    // B034 v3: on native iOS we ALWAYS floor the inset, and resolve it to a
    // PLAIN px value in JS (no env() left inside the CSS custom property — that
    // indirection broke env() evaluation in some iOS WebKit builds and left the
    // hero clipped). jsdom never lays out, so the probe measures 0 → max(0,62).
    mockPlatform = 'ios';
    mockNative = true;
    render(<IosSafeArea />);
    const root = document.documentElement;
    expect(root.classList.contains('ios-native')).toBe(true);
    expect(root.dataset.safeTop).toBe('0');
    // Pure px, no env() — calc(var(--safe-top) + 2.5rem) can never fail to resolve.
    expect(root.style.getPropertyValue('--safe-top')).toBe('62px');
  });
});
