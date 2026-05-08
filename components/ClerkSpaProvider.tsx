'use client';

import { ClerkProvider } from '@clerk/clerk-react';
import { useRouter } from 'next/navigation';

// A019: client-only ClerkProvider for static-export builds.
//
// We can't use ClerkProvider from @clerk/nextjs because it transitively
// references server-actions.js and keyless-actions.js, which Next refuses
// to include in `output: 'export'` builds. The @clerk/clerk-react variant
// is purely client-side and its component API (useAuth, SignIn, SignUp,
// UserButton) is identical, so all consumers continue to work unchanged.
//
// We also wire routerPush/routerReplace to next/navigation so Clerk's
// internal redirects (after sign-in, after sign-up) keep using SPA-style
// navigation instead of full page reloads.
export default function ClerkSpaProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    throw new Error(
      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not set. Copy it from your '
      + 'Clerk dashboard into .env.local (see .env.example).',
    );
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      routerPush={(url) => router.push(url)}
      routerReplace={(url) => router.replace(url)}
      signInUrl={process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || '/sign-in'}
      signUpUrl={process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || '/sign-up'}
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      {children}
    </ClerkProvider>
  );
}
