// Server component wrapper for Next.js static export (Capacitor mobile build).
// A dummy path is required — Next.js needs at least one pre-rendered route.
// Real video IDs are resolved by client-side routing (no static file needed).
import ClientPage from './Client';

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function VideoPage() {
  return <ClientPage />;
}
