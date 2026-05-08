'use client';

import { SignUp } from "@clerk/clerk-react";

// See app/sign-in/page.tsx for why @clerk/clerk-react and routing="hash".
export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center pt-safe pb-4 px-4">
      <SignUp routing="hash" />
    </div>
  );
}
