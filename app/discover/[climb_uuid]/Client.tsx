'use client';

import { useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';

/**
 * Legacy dynamic route — redirects to /discover/detail?id=xxx&angle=xxx
 * Kept for backward compatibility with shared Vercel URLs.
 */
export default function ClimbDetailRedirect() {
  const router = useRouter();
  const params = useParams<{ climb_uuid: string }>();
  const searchParams = useSearchParams();
  const uuid = params?.climb_uuid ?? '';
  const angle = searchParams?.get('angle');

  useEffect(() => {
    if (!uuid || uuid === '_') return;
    const qs = new URLSearchParams();
    qs.set('id', uuid);
    if (angle) qs.set('angle', angle);
    router.replace(`/discover/detail?${qs.toString()}`);
  }, [uuid, angle, router]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500">
      Redirecting…
    </div>
  );
}
