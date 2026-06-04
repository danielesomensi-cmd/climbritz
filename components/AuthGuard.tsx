'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/clerk-react';

// A019: client-side route gate.
//
// We deliberately do NOT use clerkMiddleware. Clerk's middleware needs a
// Next server runtime, which `output: 'export'` (Capacitor builds) does
// not provide — middleware would be silently dropped from the bundle and
// the entire app would become unprotected on Android/iOS. See Clerk
// issue #4647 (closed "not planned"):
// https://github.com/clerk/javascript/issues/4647
//
// Per-page useAuth() gating works on both Vercel and Capacitor, so we
// use it as the single protection mechanism for both. Backend JWT
// verification (deps.get_current_user_id) is the actual security
// boundary; this component is the UX glue.
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace('/sign-in');
    }
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return <>{children}</>;
}
