import { Suspense } from 'react';
import ClientPage from './Client';

export function generateStaticParams() {
  return [{ climb_uuid: '_' }];
}

export default function ClimbDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <ClientPage />
    </Suspense>
  );
}
