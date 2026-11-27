'use client';

import { SignUp } from "@clerk/clerk-react";
import AuthShell, { clerkAppearance } from "@/components/AuthShell";

// See app/sign-in/page.tsx for why @clerk/clerk-react and routing="hash".
// B033 Phase 2.6: branded shell + shared Clerk appearance.
//
// The hint under the widget states the two password rules up front: Clerk
// rejects short passwords and (HIBP check) ones found in a data breach, and a
// new user otherwise only learns that after submitting.
export default function SignUpPage() {
  return (
    <AuthShell>
      <SignUp routing="hash" appearance={clerkAppearance} />
      <p className="mt-4 max-w-sm text-xs text-zinc-400 text-center">
        Password: at least 8 characters. Very common passwords (like
        &quot;password123&quot;) are rejected — pick one you don&apos;t use elsewhere.
        We&apos;ll email you a 6-digit code to confirm.
      </p>
    </AuthShell>
  );
}
