import { PRESETS } from '../presets';

describe('PRESETS', () => {
  it('contains exactly 12 presets', () => {
    expect(PRESETS).toHaveLength(12);
    expect(PRESETS.map((p) => p.id)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });

  it('every hold in every preset has either role_id or color', () => {
    for (const preset of PRESETS) {
      for (const h of preset.holds) {
        const hasRole = typeof h.role_id === 'number';
        const hasColor = typeof h.color === 'string' && h.color.length > 0;
        expect(hasRole || hasColor).toBe(true);
      }
    }
  });

  describe('creative presets (B014)', () => {
    const cases = [
      { id: 6,  name: 'DANI',      minHolds: 30, color: 'FF0000' },
      { id: 7,  name: 'Climber',   minHolds: 15, color: undefined },
      { id: 8,  name: 'Heart',     minHolds: 20, color: undefined },
      { id: 9,  name: 'Lightning', minHolds: 15, color: undefined },
      { id: 10, name: 'Smile',     minHolds: 20, color: 'FFFF00' },
    ];

    it.each(cases)('#$id $name has the expected shape', ({ id, name, minHolds, color }) => {
      const preset = PRESETS.find((p) => p.id === id);
      expect(preset).toBeDefined();
      expect(preset!.name).toBe(name);
      expect(preset!.holds.length).toBeGreaterThanOrEqual(minHolds);
      expect(preset!.description).toMatch(/\S/); // non-empty description
      if (color) {
        // Uniform-color presets: every hold uses that exact color.
        for (const h of preset!.holds) expect(h.color).toBe(color);
      }
    });

    it('every creative preset hold has a valid preview coordinate', () => {
      for (const id of [6, 7, 8, 9, 10]) {
        const preset = PRESETS.find((p) => p.id === id)!;
        for (const h of preset.holds) {
          expect(h.x).not.toBeNull();
          expect(h.y).not.toBeNull();
          expect(h.x!).toBeGreaterThanOrEqual(0);
          expect(h.x!).toBeLessThanOrEqual(144);
          expect(h.y!).toBeGreaterThanOrEqual(0);
          expect(h.y!).toBeLessThanOrEqual(156);
        }
      }
    });

    it('DANI uses only red (FF0000)', () => {
      const dani = PRESETS.find((p) => p.id === 6)!;
      for (const h of dani.holds) expect(h.color).toBe('FF0000');
    });

    it('Heart uses only red outline + magenta fill (no white)', () => {
      const heart = PRESETS.find((p) => p.id === 8)!;
      const colors = heart.holds.map((h) => h.color);
      const whites = colors.filter((c) => c === 'FFFFFF').length;
      const reds = colors.filter((c) => c === 'FF0000').length;
      const magentas = colors.filter((c) => c === 'FF00FF').length;
      expect(whites).toBe(0);
      expect(reds).toBeGreaterThan(0);
      expect(magentas).toBeGreaterThan(0);
      expect(reds + magentas).toBe(heart.holds.length);
    });
  });

  describe('stress test (B014-iter-2)', () => {
    it('#11 All LEDs Diagnostic lights every position in POSITION_COORDS', () => {
      const stress = PRESETS.find((p) => p.id === 11)!;
      expect(stress.name).toBe('All LEDs Diagnostic');
      // Every hold has a colour (no role_id fallback)
      for (const h of stress.holds) {
        expect(typeof h.color).toBe('string');
      }
      // Positions are unique
      const positions = stress.holds.map((h) => h.position);
      expect(new Set(positions).size).toBe(positions.length);
      // At least 400 LEDs — the real board has ~476 mapped positions
      expect(stress.holds.length).toBeGreaterThan(400);
      // Uses multiple colours from the rainbow palette
      const distinctColors = new Set(stress.holds.map((h) => h.color));
      expect(distinctColors.size).toBeGreaterThanOrEqual(4);
    });
  });

  describe('max brightness (A028)', () => {
    it('#12 All White lights all 476 LEDs at full white (FFFFFF)', () => {
      const white = PRESETS.find((p) => p.id === 12)!;
      expect(white.name).toBe('All White (max)');
      expect(white.holds).toHaveLength(476);
      for (const h of white.holds) expect(h.color).toBe('FFFFFF');
      // Same position set as the rainbow stress test (#11), only colour differs.
      const stress = PRESETS.find((p) => p.id === 11)!;
      expect(new Set(white.holds.map((h) => h.position))).toEqual(
        new Set(stress.holds.map((h) => h.position)),
      );
    });
  });
});
