const isMobile = process.env.NEXT_PUBLIC_MOBILE === 'true'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export for Capacitor mobile builds (NEXT_PUBLIC_MOBILE=true npm run build:mobile)
  ...(isMobile ? { output: 'export' } : {}),
  // Web build only (static export does not support rewrites): climbritz.app/gioco serves
  // Deadpoint, a browser game built and hosted from its own repo on GitHub Pages
  // (danielesomensi-cmd/deadpoint). The game is one self-contained HTML file, so a single
  // proxy rule is enough. The mobile apps are not affected.
  ...(isMobile
    ? {}
    : {
        async rewrites() {
          return [{ source: '/gioco', destination: 'https://danielesomensi-cmd.github.io/deadpoint/' }]
        },
      }),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
}

module.exports = nextConfig
