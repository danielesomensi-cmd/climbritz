'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/**
 * Legacy dynamic route — redirects to /videos/detail?id=xxx
 * Kept for backward compatibility with shared Vercel URLs.
 */
export default function VideoDetailRedirect() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  useEffect(() => {
    if (!id || id === '_') return;
    router.replace(`/videos/detail?id=${id}`);
  }, [id, router]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500">
      Redirecting…
    </div>
  );
}
