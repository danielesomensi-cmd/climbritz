/**
 * Regression test for the A019 redirect loop (P0 hotfix).
 *
 * Symptom: post-login the user oscillated between /sign-in and /dashboard
 * because the backend on Railway lacked Clerk env vars, returned 401 on
 * every authenticated request, and the frontend's redirect-to-/sign-in
 * fallback fired even though Clerk reported an active session.
 *
 * Fix: only redirect to /sign-in when Clerk has hydrated AND confirms
 * the user is signed out (window.Clerk.user === null). Otherwise throw
 * the ApiError so the page can surface the misconfiguration instead of
 * cycling through the auth flow.
 */

describe('apiFetch — 401 handling (A019 redirect-loop hotfix)', () => {
  const originalLocation = window.location;
  let hrefSetter: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    // Replace window.location with a mock so we can detect redirects
    // without actually navigating in jsdom.
    hrefSetter = jest.fn();
    delete (window as unknown as { location?: Location }).location;
    (window as unknown as { location: Partial<Location> }).location = {
      ...originalLocation,
      get href() {
        return originalLocation.href;
      },
      set href(v: string) {
        hrefSetter(v);
      },
    } as Location;

    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete (window as unknown as { location?: Location }).location;
    (window as unknown as { location: Location }).location = originalLocation;
    delete (window as unknown as { Clerk?: unknown }).Clerk;
  });

  function mock401(): void {
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 401,
      ok: false,
      json: async () => ({ detail: 'unauthorized' }),
    });
  }

  it('redirects to /sign-in when Clerk reports user is signed out', async () => {
    // Clerk hydrated, no user → genuinely signed out.
    (window as unknown as { Clerk: { user: null } }).Clerk = { user: null };
    mock401();

    const { getVideos } = await import('../api');

    await expect(getVideos()).rejects.toThrow(/Sessione scaduta/);
    expect(hrefSetter).toHaveBeenCalledWith('/sign-in');
  });

  it('does NOT redirect when Clerk session is active (regression: no /sign-in ↔ /dashboard loop)', async () => {
    // Clerk hydrated, active user. A 401 here means the backend is
    // misconfigured — redirecting would loop because Clerk would just
    // bounce the active user back to a protected page.
    (window as unknown as { Clerk: { user: { id: string } } }).Clerk = {
      user: { id: 'user_test_123' },
    };
    mock401();

    const { getVideos } = await import('../api');

    await expect(getVideos()).rejects.toThrow(/sessione attiva/i);
    expect(hrefSetter).not.toHaveBeenCalled();
  });

  it('does NOT redirect when Clerk has not hydrated yet (window.Clerk undefined)', async () => {
    // Clerk hasn't loaded — we don't know auth state. Surfacing the
    // error is safer than redirecting (avoids racing the Clerk hydrate).
    delete (window as unknown as { Clerk?: unknown }).Clerk;
    mock401();

    const { getVideos } = await import('../api');

    await expect(getVideos()).rejects.toThrow(/sessione attiva/i);
    expect(hrefSetter).not.toHaveBeenCalled();
  });

  it('retries once on first 401 before deciding', async () => {
    (window as unknown as { Clerk: { user: null } }).Clerk = { user: null };
    mock401();

    const { getVideos } = await import('../api');

    await expect(getVideos()).rejects.toThrow();
    // Two fetches: initial + retry. Then redirect logic fires.
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(hrefSetter).toHaveBeenCalledWith('/sign-in');
  });
});
