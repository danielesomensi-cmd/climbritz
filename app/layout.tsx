import type { Metadata, Viewport } from "next";
import ClerkSpaProvider from "@/components/ClerkSpaProvider";
import "./globals.css";
import "./safe-area.css";

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
    <html lang="en">
      <body>
        <ClerkSpaProvider>{children}</ClerkSpaProvider>
      </body>
    </html>
  );
}
