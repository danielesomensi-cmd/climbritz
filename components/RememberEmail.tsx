'use client';

import { useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { saveLastEmail } from '@/lib/auth/last-email';

// B-AUTH-PERSIST — whenever a user is signed in, remember their primary email
// on this device so the next /sign-in is prefilled. Renders nothing.
export default function RememberEmail() {
  const { isSignedIn, user } = useUser();
  const email = isSignedIn ? user?.primaryEmailAddress?.emailAddress : undefined;

  useEffect(() => {
    saveLastEmail(email);
  }, [email]);

  return null;
}
