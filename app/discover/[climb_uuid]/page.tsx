// Server component wrapper for Next.js static export (Capacitor mobile build).
// A dummy path is required — Next.js needs at least one pre-rendered route.
// Real climb UUIDs are resolved by client-side routing (no static file needed).
import ClientPage from './Client';

export function generateStaticParams() {
  return [{ climb_uuid: '_' }];
}

export default function ClimbDetailPage() {
  return <ClientPage />;
}
