'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// A019: legacy /login route kept as a redirect alias to Clerk's hosted
// /sign-in page. Anything still linking to /login (external bookmarks,
// stale Play Store metadata, etc.) lands on the Clerk widget instead of
// 404'ing. Delete once we're confident no inbound link points here.
export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/sign-in');
  }, [router]);

  return null;
}
