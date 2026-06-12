import fs from 'fs';
import path from 'path';

// B036 — guard the dual-source safe-area insets. On Android (targetSdk 35+,
// enforced edge-to-edge) the WebView's env(safe-area-inset-*) is unreliable
// (0 on Samsung S22/S24 → header under the status bar). Capacitor 8's built-in
// SystemBars plugin injects the real insets as `--safe-area-inset-*` custom
// properties on <html>, so every safe-area rule MUST max() both sources.
// jsdom can't evaluate env()/max(), so — like the B034 hero guard — we assert
// on the stylesheet source: the exact regression is someone "simplifying" the
// rules back to env()-only, which silently re-breaks Android.
const globalsCss = fs.readFileSync(
  path.join(__dirname, '..', 'globals.css'),
  'utf8'
);
const safeAreaCss = fs.readFileSync(
  path.join(__dirname, '..', 'safe-area.css'),
  'utf8'
);
// Comments stripped before asserting — prose mentioning env() is fine, rules aren't.
const safeAreaRules = safeAreaCss.replace(/\/\*[\s\S]*?\*\//g, '');

describe('safe-area insets (B036)', () => {
  it('--safe-top reads BOTH env() and the Capacitor-injected Android var', () => {
    const decl = globalsCss.match(/--safe-top:\s*([^;]+);/)?.[1] ?? '';
    expect(decl).toContain('env(safe-area-inset-top');
    expect(decl).toContain('var(--safe-area-inset-top');
    expect(decl.trim().startsWith('max(')).toBe(true);
  });

  it('.pt-safe reads the --safe-top token, not env() directly', () => {
    // B034 — direct env() here would bypass the native-iOS inline override.
    expect(safeAreaRules).toContain('var(--safe-top)');
    expect(safeAreaRules).not.toContain('env(safe-area-inset-top');
  });

  it('bottom utilities max() direct env() with the Android var (NO token)', () => {
    // B036 — bottom stays env()-direct at the usage site (B034 field notes
    // suspect env()-through-custom-property fails on some iOS WebKit builds,
    // and .pb-safe/.pb-nav work on iOS today). Each bottom rule must carry
    // both sources inline; a --safe-bottom token would re-add the indirection.
    const bottomRules = safeAreaRules.match(/max\([^)]*safe-area-inset-bottom[^;]*/g) ?? [];
    expect(bottomRules.length).toBe(2); // .pb-safe + .pb-nav
    for (const rule of bottomRules) {
      expect(rule).toContain('env(safe-area-inset-bottom');
      expect(rule).toContain('var(--safe-area-inset-bottom');
    }
    expect(globalsCss).not.toContain('--safe-bottom:');
  });
});
