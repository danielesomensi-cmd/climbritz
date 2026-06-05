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

  it('flags native iOS and applies the fallback inset when env resolves to 0', () => {
    // jsdom never lays out, so the env() probe measures 0 height → the broken-env
    // branch (exactly the Dynamic-Island case this component exists to fix).
    mockPlatform = 'ios';
    mockNative = true;
    render(<IosSafeArea />);
    const root = document.documentElement;
    expect(root.classList.contains('ios-native')).toBe(true);
    expect(root.dataset.safeTop).toBe('0');
    expect(root.style.getPropertyValue('--safe-top')).toBe('59px');
  });
});
