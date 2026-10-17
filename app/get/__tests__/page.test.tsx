import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ANDROID_INSTALL_URL, IOS_INSTALL_URL } from '@/lib/installLinks';

let mockNative = false;
jest.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => mockNative,
  },
}));

import GetPage from '../page';

const UA = {
  iPhone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  android:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  desktop:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
};

const replaceMock = jest.fn();
const realLocation = window.location;

function setDevice(ua: string, maxTouchPoints = 0) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
  Object.defineProperty(window.navigator, 'maxTouchPoints', {
    value: maxTouchPoints,
    configurable: true,
  });
}

beforeEach(() => {
  mockNative = false;
  replaceMock.mockReset();
  // jsdom refuses a real navigation; swap in a stub so replace() is observable.
  delete (window as unknown as { location?: unknown }).location;
  (window as unknown as { location: { replace: jest.Mock } }).location = {
    replace: replaceMock,
  };
});

afterAll(() => {
  (window as unknown as { location: Location }).location = realLocation;
});

describe('/get — smart install link (A032)', () => {
  it('redirects an iPhone to the iOS install page', () => {
    setDevice(UA.iPhone, 5);
    render(<GetPage />);
    expect(replaceMock).toHaveBeenCalledWith(IOS_INSTALL_URL);
  });

  it('redirects an Android phone to the Android install page', () => {
    setDevice(UA.android, 5);
    render(<GetPage />);
    expect(replaceMock).toHaveBeenCalledWith(ANDROID_INSTALL_URL);
  });

  it('stays on the page on desktop', () => {
    setDevice(UA.desktop, 0);
    render(<GetPage />);
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('never redirects inside the native app', () => {
    mockNative = true;
    setDevice(UA.iPhone, 5);
    render(<GetPage />);
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('always renders both install links and the iPhone hint', () => {
    setDevice(UA.desktop, 0);
    render(<GetPage />);
    expect(screen.getByRole('heading', { name: 'CLIMBRITZ' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get it on iPhone' })).toHaveAttribute(
      'href',
      IOS_INSTALL_URL,
    );
    expect(screen.getByRole('link', { name: 'Get it on Android' })).toHaveAttribute(
      'href',
      ANDROID_INSTALL_URL,
    );
    expect(
      screen.getByText('Install the free TestFlight app first, then tap Accept → Install.'),
    ).toBeInTheDocument();
  });
});
