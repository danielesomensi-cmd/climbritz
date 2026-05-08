// A019: ambient type for the window.Clerk global injected by ClerkProvider.
// Used by app/lib/api.ts to fetch a fresh JWT for each backend request
// without pulling Clerk's runtime API into the type-check graph.

declare global {
  interface Window {
    Clerk?: {
      session?: {
        getToken: () => Promise<string | null>;
      };
    };
  }
}

export {};
