/**
 * A021.3.1 — every authenticated request carries the X-User-Timezone
 * header pulled from Intl.DateTimeFormat().resolvedOptions().timeZone.
 *
 * Centralized in apiFetch so individual API helpers don't have to opt
 * in — this test asserts that opt-in is automatic for createLog,
 * getUserClimb, patchUserClimbProject, deleteLog AND the existing
 * climb search/detail helpers (so the backend search overlay can use
 * the JWT consistently with the tz context).
 */

describe('apiFetch — X-User-Timezone header', () => {
  let originalIntl: typeof Intl;

  beforeEach(() => {
    jest.resetModules();
    originalIntl = Intl;
    // Pin the timezone so we can assert on the exact value.
    (global as { Intl: typeof Intl }).Intl = {
      ...originalIntl,
      DateTimeFormat: function () {
        return {
          resolvedOptions: () => ({ timeZone: 'Europe/Rome' }),
        };
      },
    } as unknown as typeof Intl;

    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({}),
    });

    // No Clerk session in this test — we only care about the tz header.
    delete (window as unknown as { Clerk?: unknown }).Clerk;
  });

  afterEach(() => {
    (global as { Intl: typeof Intl }).Intl = originalIntl;
  });

  function getCallHeaders(call: number = 0): Record<string, string> {
    const args = (global.fetch as jest.Mock).mock.calls[call];
    if (!args) throw new Error('fetch not called');
    const init = args[1] as RequestInit;
    return (init.headers ?? {}) as Record<string, string>;
  }

  it('createLog attaches X-User-Timezone', async () => {
    const { createLog } = await import('../api');
    await createLog('uuid-1', 40, 'send');
    expect(getCallHeaders()['X-User-Timezone']).toBe('Europe/Rome');
  });

  it('getUserClimb attaches X-User-Timezone', async () => {
    const { getUserClimb } = await import('../api');
    await getUserClimb('uuid-1', 40);
    expect(getCallHeaders()['X-User-Timezone']).toBe('Europe/Rome');
  });

  it('patchUserClimbProject attaches X-User-Timezone', async () => {
    const { patchUserClimbProject } = await import('../api');
    await patchUserClimbProject('uuid-1', 40, true);
    expect(getCallHeaders()['X-User-Timezone']).toBe('Europe/Rome');
  });

  it('deleteLog attaches X-User-Timezone', async () => {
    const { deleteLog } = await import('../api');
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      status: 204,
      ok: true,
      json: async () => ({}),
    });
    await deleteLog('log-1');
    expect(getCallHeaders()['X-User-Timezone']).toBe('Europe/Rome');
  });

  it('searchClimbs attaches X-User-Timezone (drives the user_state overlay)', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({ climbs: [], total_count: 0 }),
    });
    const { searchClimbs } = await import('../api');
    await searchClimbs({ angle: 40 });
    expect(getCallHeaders()['X-User-Timezone']).toBe('Europe/Rome');
  });

  it('getClimbDetail attaches X-User-Timezone', async () => {
    const { getClimbDetail } = await import('../api');
    await getClimbDetail('uuid-1', 40);
    expect(getCallHeaders()['X-User-Timezone']).toBe('Europe/Rome');
  });

  it('header is omitted when Intl is unavailable (defensive)', async () => {
    // Older WebView without Intl — header should be dropped silently
    // and the backend will fall back to UTC.
    (global as { Intl: unknown }).Intl = {
      DateTimeFormat: function () {
        throw new Error('Intl not available');
      },
    };
    const { createLog } = await import('../api');
    await createLog('uuid-1', 40, 'send');
    expect(getCallHeaders()['X-User-Timezone']).toBeUndefined();
  });
});
