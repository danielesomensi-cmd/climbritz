'use client';

import { useEffect, useState } from "react";
import { SignIn } from "@clerk/clerk-react";
import AuthShell, { clerkAppearance } from "@/components/AuthShell";
import { getLastEmail } from "@/lib/auth/last-email";

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
//
// B-AUTH-PERSIST: the last email used on this device is prefilled. Clerk reads
// `initialValues` only when the widget mounts, and localStorage does not exist
// during the static prerender — so the widget is rendered after the first
// client effect, once the stored email is known.
export default function SignInPage() {
  const [ready, setReady] = useState(false);
  const [lastEmail, setLastEmail] = useState<string | undefined>(undefined);

  useEffect(() => {
    setLastEmail(getLastEmail());
    setReady(true);
  }, []);

  return (
    <AuthShell>
      {ready && (
        <SignIn
          routing="hash"
          appearance={clerkAppearance}
          initialValues={lastEmail ? { emailAddress: lastEmail } : undefined}
        />
      )}
    </AuthShell>
  );
}
