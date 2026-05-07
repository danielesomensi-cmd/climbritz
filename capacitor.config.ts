import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kilterup.app',
  appName: 'Kilter Up',
  webDir: 'out', // Next.js static export output
  server: {
    allowNavigation: [
      'web-production-cea9.up.railway.app',
      // A019: Clerk's hosted widget assets and OAuth handshake URLs.
      // Wildcard covers any Clerk subdomain on the dev instance.
      // Replace/append on production-Clerk promotion.
      '*.clerk.accounts.dev',
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
