'use client';

import { SignIn } from "@clerk/clerk-react";

// A019: Clerk widget for static-export builds.
// We deliberately import from @clerk/clerk-react (not @clerk/nextjs) —
// the @clerk/nextjs <SignIn> uses Server Actions internally, which Next
// rejects when output: 'export' is set. The SPA component renders
// against the same ClerkProvider context but is purely client-side.
//
// routing="hash" avoids needing a [[...sign-in]] catch-all (incompatible
// with static export anyway). All multi-step Clerk flows live on the
// fragment of /sign-in.
export default function SignInPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center pt-safe pb-4 px-4">
      <SignIn routing="hash" />
    </div>
  );
}
