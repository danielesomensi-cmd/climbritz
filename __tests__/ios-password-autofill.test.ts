import fs from 'fs';
import path from 'path';

// B-AUTH-PERSIST (C) — iOS Password AutoFill. The app declares the
// `webcredentials:climbritz.app` associated domain and the website answers with
// an apple-app-site-association naming the app. All three pieces must agree or
// iOS silently offers no saved password in the sign-in form.
const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

describe('iOS password AutoFill wiring', () => {
  it('serves an AASA that names the app (TeamID.bundleId)', () => {
    const aasa = JSON.parse(read('public/.well-known/apple-app-site-association'));
    expect(aasa.webcredentials.apps).toEqual(['KSD2RSAZP2.app.climbritz']);
  });

  it('serves the extensionless AASA as JSON on Vercel', () => {
    const vercel = JSON.parse(read('vercel.json'));
    const rule = vercel.headers.find(
      (h: { source: string }) => h.source === '/.well-known/apple-app-site-association',
    );
    expect(rule.headers).toContainEqual({ key: 'Content-Type', value: 'application/json' });
  });

  // The entitlement file is ready but NOT wired into the build yet: the wildcard
  // provisioning profile lacks Associated Domains and Xcode has no signed-in
  // account to regenerate it (build 31 archive failed on exactly this). Wire
  // `CODE_SIGN_ENTITLEMENTS = App/App.entitlements` back in once the capability
  // is enabled for the App ID — then flip this expectation to 2.
  it('keeps the webcredentials entitlement file ready, not yet wired into signing', () => {
    expect(read('ios/App/App/App.entitlements')).toContain('webcredentials:climbritz.app');
    const pbx = read('ios/App/App.xcodeproj/project.pbxproj');
    expect(pbx.match(/CODE_SIGN_ENTITLEMENTS/g)).toBeNull();
  });
});
