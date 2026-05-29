import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.climbritz',
  appName: 'Climbritz',
  webDir: 'out', // Next.js static export output
  server: {
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
