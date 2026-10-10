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
});
