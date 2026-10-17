import {
  ANDROID_GROUP_URL,
  ANDROID_INSTALL_URL,
  INVITE_URL,
  IOS_INSTALL_URL,
  detectPlatform,
  installUrlFor,
} from '../installLinks';

// A032 — platform detection behind the climbritz.app/get redirect.
const UA = {
  iPhone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  iPad:
    'Mozilla/5.0 (iPad; CPU OS 12_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1.2 Mobile/15E148 Safari/604.1',
  // iPadOS 13+ Safari requests the desktop site with a Macintosh UA.
  iPadOSDesktop:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  android:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  desktopChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  desktopSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
};

describe('detectPlatform', () => {
  it('detects iPhone', () => {
    expect(detectPlatform(UA.iPhone, 5)).toBe('ios');
  });

  it('detects iPad (mobile UA)', () => {
    expect(detectPlatform(UA.iPad, 5)).toBe('ios');
  });

  it('detects iPadOS sending a desktop Macintosh UA, via touch points', () => {
    expect(detectPlatform(UA.iPadOSDesktop, 5)).toBe('ios');
  });

  it('detects Android', () => {
    expect(detectPlatform(UA.android, 5)).toBe('android');
  });

  it('treats desktop Chrome as other', () => {
    expect(detectPlatform(UA.desktopChrome, 0)).toBe('other');
  });

  it('treats desktop Safari on a Mac (no touch) as other', () => {
    expect(detectPlatform(UA.desktopSafari, 0)).toBe('other');
    // maxTouchPoints defaults to 0 when the caller omits it
    expect(detectPlatform(UA.desktopSafari)).toBe('other');
  });
});

describe('installUrlFor', () => {
  it('auto-redirects iOS only; Android stays on /get for the group step', () => {
    expect(installUrlFor('ios')).toBe(IOS_INSTALL_URL);
    expect(installUrlFor('android')).toBeNull();
  });

  it('pins the verified Android URLs', () => {
    expect(ANDROID_GROUP_URL).toBe('https://groups.google.com/g/climbritz-testers');
    expect(ANDROID_INSTALL_URL).toBe('https://play.google.com/apps/testing/app.climbritz');
  });

  it('returns null for other (no redirect on desktop)', () => {
    expect(installUrlFor('other')).toBeNull();
  });

  it('pins the stable invite URL and the iOS target', () => {
    expect(INVITE_URL).toBe('https://climbritz.app/get');
    expect(IOS_INSTALL_URL).toBe('https://testflight.apple.com/join/m61nAQ53');
  });
});
