import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter_Tight } from "next/font/google";
import ClerkSpaProvider from "@/components/ClerkSpaProvider";
import { BleProvider } from "@/components/BleProvider";
import IosSafeArea from "@/components/IosSafeArea";
import "./globals.css";
import "./safe-area.css";

// B033 Phase 5 (D18-9 / B030). next/font self-hosts both faces at BUILD time
// (downloaded once, served from the static export) — no runtime web-font fetch,
// so the Capacitor build stays offline-friendly. `adjustFontFallback` (default)
// emits a metric-matched fallback so there's no layout shift while the face
// loads. Space Grotesk = display (wordmark + page titles); Inter Tight = body.
const fontDisplay = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-display",
  display: "swap",
});

const fontBody = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Climbritz - AI Training for Climbing",
  description: "AI-powered circuit generation and training planning for the Kilter Board",
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fontDisplay.variable} ${fontBody.variable}`}>
      <body>
        {/* B034 — native-iOS safe-area probe; sets --safe-top fallback when the
            WKWebView fails to resolve env(safe-area-inset-top). No-op on web. */}
        <IosSafeArea />
        <ClerkSpaProvider>
          {/* B035 — BLE state lives at the root so the Kilter Board stays
              connected across SPA navigation; pages consume it via useBle(). */}
          <BleProvider>{children}</BleProvider>
        </ClerkSpaProvider>
      </body>
    </html>
  );
}
