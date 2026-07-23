// A019: ambient type for the window.Clerk global injected by ClerkProvider.
// Used by app/lib/api.ts to fetch a fresh JWT for each backend request
// without pulling Clerk's runtime API into the type-check graph.

declare global {
  interface Window {
    Clerk?: {
      // null when Clerk has hydrated and the user is signed out;
      // an object when signed in; undefined while Clerk is still loading.
      // api.ts uses this trichotomy to avoid redirect loops on 401 from
      // a misconfigured backend (e.g. Railway missing CLERK_JWKS_URL).
      user?: { id: string } | null;
      session?: {
        getToken: () => Promise<string | null>;
      };
      // A-STORE-PROD-001: the Settings delete-account flow signs out through
      // the global rather than <UserButton>, so the redirect happens only
      // after the backend confirms the erasure.
      signOut?: () => Promise<void>;
    };
  }
}

export {};
