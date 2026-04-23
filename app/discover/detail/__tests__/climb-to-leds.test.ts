import { climbToLedCommands } from '../climb-to-leds';
import type { HoldPosition } from '@/app/lib/api';

// Mock the static LED map so the test doesn't depend on the real 476-entry
// JSON (keeps fixtures readable). Keys are stringified placement_ids.
jest.mock('@/app/data/leds_12x12.json', () => ({
  '1001': 100,
  '1002': 200,
  '1003': 300,
  '1004': 400,
}), { virtual: true });

const mkHold = (placement_id: number, role: string): HoldPosition => ({
  placement_id,
  role,
  x: 0,
  y: 0,
  set_id: 1,
});

describe('climbToLedCommands', () => {
  let warnSpy: jest.SpyInstance;
  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('maps a climb with start/middle/finish/foot roles to encoder holds', () => {
    const out = climbToLedCommands([
      mkHold(1001, 'start'),
      mkHold(1002, 'middle'),
      mkHold(1003, 'finish'),
      mkHold(1004, 'foot_only'),
    ]);
    expect(out).toEqual([
      { position: 100, role_id: 12 },
      { position: 200, role_id: 13 },
      { position: 300, role_id: 14 },
      { position: 400, role_id: 15 },
    ]);
  });

  it('returns an empty array for a climb with no holds', () => {
    expect(climbToLedCommands([])).toEqual([]);
  });

  it('skips holds with an unknown role and warns', () => {
    const out = climbToLedCommands([
      mkHold(1001, 'start'),
      mkHold(1002, 'bogus_role'),
      mkHold(1003, 'finish'),
    ]);
    expect(out).toEqual([
      { position: 100, role_id: 12 },
      { position: 300, role_id: 14 },
    ]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('unknown role "bogus_role"'),
    );
  });

  it('skips holds whose placement has no LED mapping and warns', () => {
    const out = climbToLedCommands([
      mkHold(1001, 'start'),
      mkHold(9999, 'middle'), // not in mocked map
    ]);
    expect(out).toEqual([{ position: 100, role_id: 12 }]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('placement 9999 has no LED mapping'),
    );
  });

  it('emits only { position, role_id } — never color hex', () => {
    const out = climbToLedCommands([mkHold(1001, 'start')]);
    for (const h of out) {
      expect(h).not.toHaveProperty('color');
      expect(Object.keys(h).sort()).toEqual(['position', 'role_id']);
    }
  });
});
