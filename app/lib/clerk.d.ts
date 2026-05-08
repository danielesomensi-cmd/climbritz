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
    };
  }
}

export {};
