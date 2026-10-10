import ledsMap from '@/app/data/leds_12x12.json';
import {
  blinkFrames,
  finalLedCommands,
  hasLed,
  ledPosition,
  sequenceToLedCommands,
} from '../led-commands';

const LEDS = ledsMap as Record<string, number>;
const ids = Object.keys(LEDS).slice(0, 5).map(Number);
const [a, b, c, d, e] = ids;
const pos = (id: number) => LEDS[String(id)];

describe('led-commands', () => {
  it('hasLed / ledPosition read the LED map', () => {
    expect(hasLed(a)).toBe(true);
    expect(ledPosition(a)).toBe(pos(a));
    expect(hasLed(999_999)).toBe(false);
  });

  it('sequence: starts r12, added r13, new hold white', () => {
    expect(sequenceToLedCommands([a], [b, c], d)).toEqual([
      { position: pos(a), role_id: 12 },
      { position: pos(b), role_id: 13 },
      { position: pos(c), role_id: 13 },
      { position: pos(d), color: 'FFFFFF' },
    ]);
  });

  it('skips placements without LED and a newId already in the sequence', () => {
    expect(sequenceToLedCommands([a, 999_999], [b], b)).toEqual([
      { position: pos(a), role_id: 12 },
      { position: pos(b), role_id: 13 },
    ]);
  });

  it('final frame turns the last 1 or 2 added holds into finishes', () => {
    expect(finalLedCommands([a], [b, c], 1).map((h) => h.role_id)).toEqual([12, 13, 14]);
    expect(finalLedCommands([a], [b, c], 2).map((h) => h.role_id)).toEqual([12, 14, 14]);
    expect(finalLedCommands([a], [], 2).map((h) => h.role_id)).toEqual([12]);
  });

  it('blink alternates without/with the new hold and ends lit', () => {
    const frames = blinkFrames([a], [b], e, 2);
    expect(frames).toHaveLength(4);
    expect(frames[0].some((h) => h.position === pos(e))).toBe(false);
    expect(frames[1].some((h) => h.position === pos(e) && h.color === 'FFFFFF')).toBe(true);
    expect(frames[3]).toEqual(sequenceToLedCommands([a], [b], e));
  });

  it('feet: sequence feet r15, new foot white, never duplicated', () => {
    expect(sequenceToLedCommands([a], [b], c, { feet: [d], newFootId: e })).toEqual([
      { position: pos(a), role_id: 12 },
      { position: pos(b), role_id: 13 },
      { position: pos(d), role_id: 15 },
      { position: pos(c), color: 'FFFFFF' },
      { position: pos(e), color: 'FFFFFF' },
    ]);
    // A new foot already used (or equal to the new hand) is ignored.
    expect(sequenceToLedCommands([a], [], c, { feet: [d], newFootId: d })).toHaveLength(3);
    expect(sequenceToLedCommands([a], [], c, { newFootId: c })).toHaveLength(2);
    // Feet off → GAME-001 frame unchanged.
    expect(sequenceToLedCommands([a], [b], c, {})).toEqual(sequenceToLedCommands([a], [b], c));
  });

  it('final frame keeps feet as r15 and finishes only on hand holds', () => {
    expect(finalLedCommands([a], [b, c], 1, [d, e]).map((h) => h.role_id)).toEqual([
      12, 13, 14, 15, 15,
    ]);
  });

  it('blink toggles both the new hand and the new foot, feet stay lit', () => {
    const frames = blinkFrames([a], [b], c, 2, { feet: [d], newFootId: e });
    expect(frames).toHaveLength(4);
    expect(frames[0].some((h) => h.position === pos(c) || h.position === pos(e))).toBe(false);
    expect(frames[0].some((h) => h.position === pos(d) && h.role_id === 15)).toBe(true);
    expect(frames[1].filter((h) => h.color === 'FFFFFF').map((h) => h.position)).toEqual([
      pos(c),
      pos(e),
    ]);
    expect(frames[3]).toEqual(sequenceToLedCommands([a], [b], c, { feet: [d], newFootId: e }));
  });
});
