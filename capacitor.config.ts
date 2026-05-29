import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.climbritz',
  appName: 'Climbritz',
  webDir: 'out', // Next.js static export output
  server: {
    // B021: serve the WebView from a climbritz.app subdomain so the WebView
    // origin (https://app.climbritz.app) is SAME-SITE with the Clerk Frontend
    // API (clerk.climbritz.app). Clerk production sets its session cookie as
    // SameSite=Lax on Domain=climbritz.app, which a cross-site origin like
    // https://localhost / capacitor://localhost cannot send → "You are signed
    // out". A same-site origin sends it fine. This hostname is NOT resolved via
    // DNS — Capacitor serves the local bundled assets under it; it only changes
    // the WebView's origin label. Applies to both Android and iOS.
    hostname: 'app.climbritz.app',
    androidScheme: 'https',
    iosScheme: 'https',
    allowNavigation: [
      'web-production-cea9.up.railway.app',
      // B021: Clerk Production instance on the custom domain clerk.climbritz.app.
      // Email-code-only login → no OAuth redirect in the WebView, so this list is
      // hygiene (widget/asset hosts), not a hard auth dependency. The dev shared
      // domain (*.clerk.accounts.dev) is gone now that we're on pk_live.
      'clerk.climbritz.app',
      'accounts.climbritz.app',
      '*.clerk.com',
    ],
  },
  plugins: {
    BluetoothLe: {
      displayStrings: {
        scanning: 'Cerco Kilter Board...',
        cancel: 'Annulla',
        availableDevices: 'Dispositivi trovati',
        noDeviceFound: 'Nessun dispositivo trovato',
      },
    },
  },
};

export default config;
