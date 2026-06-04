'use client';

import { SignIn } from "@clerk/clerk-react";
import AuthShell, { clerkAppearance } from "@/components/AuthShell";

// A019: Clerk widget for static-export builds.
// We deliberately import from @clerk/clerk-react (not @clerk/nextjs) —
// the @clerk/nextjs <SignIn> uses Server Actions internally, which Next
// rejects when output: 'export' is set. The SPA component renders
// against the same ClerkProvider context but is purely client-side.
//
// routing="hash" avoids needing a [[...sign-in]] catch-all (incompatible
// with static export anyway). All multi-step Clerk flows live on the
// fragment of /sign-in.
//
// B033 Phase 2.6: wrapped in <AuthShell> (wordmark + brand) and given the
// shared brand `appearance` so the first-impression screen is on-brand.
export default function SignInPage() {
  return (
    <AuthShell>
      <SignIn routing="hash" appearance={clerkAppearance} />
    </AuthShell>
  );
}
