'use client';

import { SignUp } from "@clerk/clerk-react";
import AuthShell, { clerkAppearance } from "@/components/AuthShell";

// See app/sign-in/page.tsx for why @clerk/clerk-react and routing="hash".
// B033 Phase 2.6: branded shell + shared Clerk appearance.
export default function SignUpPage() {
  return (
    <AuthShell>
      <SignUp routing="hash" appearance={clerkAppearance} />
    </AuthShell>
  );
}
