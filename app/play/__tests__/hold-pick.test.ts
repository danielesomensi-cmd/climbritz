import { nearestHold, pointToPct } from '../hold-pick';

// Board is 144 x 156 units; overlay % → board units: x = pct*1.44,
// y = 156 - pct*1.56.
const holds = [
  { id: 'a', x: 72, y: 78, set_id: 1 }, // centre → (50%, 50%)
  { id: 'b', x: 80, y: 78, set_id: 1 }, // 8 units right
  { id: 'c', x: 0, y: 156, set_id: 20 }, // top-left corner, screw-on
];

describe('pointToPct', () => {
  it('maps client px to overlay percentages', () => {
    expect(pointToPct(150, 300, { left: 100, top: 200, width: 100, height: 200 })).toEqual({
      xPct: 50,
      yPct: 50,
    });
  });

  it('returns null for an empty rect', () => {
    expect(pointToPct(1, 1, { left: 0, top: 0, width: 0, height: 0 })).toBeNull();
  });
});

describe('nearestHold', () => {
  it('snaps to the closest hold', () => {
    expect(nearestHold(50, 50, holds)?.id).toBe('a');
    // 53.5% x ≈ 77 units → closer to b (80) than a (72).
    expect(nearestHold(53.5, 50, holds)?.id).toBe('b');
  });

  it('returns null when nothing is inside the radius', () => {
    // 6% of 144 = 8.64 units; (25%, 75%) is far from every hold.
    expect(nearestHold(25, 75, holds)).toBeNull();
  });

  it('respects a custom radius', () => {
    // a is 7.2 units from (45%, 50%).
    expect(nearestHold(45, 50, holds, 4)).toBeNull();
    expect(nearestHold(45, 50, holds, 6)?.id).toBe('a');
  });

  it('skips ineligible holds and falls back to the next closest', () => {
    expect(nearestHold(0, 0, holds)?.id).toBe('c');
    expect(nearestHold(0, 0, holds, 6, (h) => h.set_id !== 20)).toBeNull();
    expect(nearestHold(50, 50, holds, 6, (h) => h.id !== 'a')?.id).toBe('b');
  });
});
