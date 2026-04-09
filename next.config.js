/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export for Capacitor mobile builds (NEXT_PUBLIC_MOBILE=true npm run build:mobile)
  ...(process.env.NEXT_PUBLIC_MOBILE === 'true' ? { output: 'export' } : {}),
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
