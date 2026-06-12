// A031 — pure hold-editor transitions (palette + paint), validation, and
// frames serialization.

import {
  draftToFrames,
  paintHold,
  validateDraft,
} from '../editor-state';
import type { DraftHold } from '../draft-storage';

const BOLT = 1; // set_id — bolt-on handhold
const SCREW = 20; // set_id — screw-on foothold

describe('paintHold', () => {
  it('paints an empty hold with the selected role', () => {
    const next = paintHold([], 100, BOLT, 'start');
    expect(next).toEqual([{ placement_id: 100, role: 'start' }]);
  });

  it('replaces the role when a different one is painted', () => {
    const holds: DraftHold[] = [{ placement_id: 100, role: 'start' }];
    const next = paintHold(holds, 100, BOLT, 'middle');
    expect(next).toEqual([{ placement_id: 100, role: 'middle' }]);
  });

  it('tapping with the same role toggles the hold off', () => {
    const holds: DraftHold[] = [{ placement_id: 100, role: 'finish' }];
    expect(paintHold(holds, 100, BOLT, 'finish')).toEqual([]);
  });

  it('erase removes any role', () => {
    const holds: DraftHold[] = [{ placement_id: 100, role: 'middle' }];
    expect(paintHold(holds, 100, BOLT, 'erase')).toEqual([]);
  });

  it('erase on an empty hold is a no-op (same reference)', () => {
    const holds: DraftHold[] = [{ placement_id: 1, role: 'start' }];
    expect(paintHold(holds, 999, BOLT, 'erase')).toBe(holds);
  });

  it('screw-on footholds accept only the Foot role', () => {
    const holds: DraftHold[] = [];
    // Hand roles on a screw-on are no-ops (same reference → no BLE re-send).
    expect(paintHold(holds, 200, SCREW, 'start')).toBe(holds);
    expect(paintHold(holds, 200, SCREW, 'middle')).toBe(holds);
    expect(paintHold(holds, 200, SCREW, 'finish')).toBe(holds);
    expect(paintHold(holds, 200, SCREW, 'foot_only')).toEqual([
      { placement_id: 200, role: 'foot_only' },
    ]);
  });

  it('bolt-ons accept every role including Foot (real-corpus semantics)', () => {
    expect(paintHold([], 100, BOLT, 'foot_only')).toEqual([
      { placement_id: 100, role: 'foot_only' },
    ]);
  });

  it('does not disturb other holds', () => {
    const holds: DraftHold[] = [
      { placement_id: 1, role: 'start' },
      { placement_id: 2, role: 'middle' },
    ];
    const next = paintHold(holds, 2, BOLT, 'erase');
    expect(next).toEqual([{ placement_id: 1, role: 'start' }]);
  });
});

describe('validateDraft', () => {
  const valid: DraftHold[] = [
    { placement_id: 1, role: 'start' },
    { placement_id: 2, role: 'middle' },
    { placement_id: 3, role: 'finish' },
  ];

  it('accepts a minimal valid problem', () => {
    expect(validateDraft(valid)).toEqual({ valid: true, errors: [] });
  });

  it('requires a start hold', () => {
    const res = validateDraft(valid.map((h) =>
      h.role === 'start' ? { ...h, role: 'middle' } : h,
    ));
    expect(res.valid).toBe(false);
    expect(res.errors).toContain('Add a start hold');
  });

  it('requires a finish hold', () => {
    const res = validateDraft(valid.map((h) =>
      h.role === 'finish' ? { ...h, role: 'middle' } : h,
    ));
    expect(res.errors).toContain('Add a finish hold');
  });

  it('caps starts at 2 and finishes at 2', () => {
    const threeStarts: DraftHold[] = [
      { placement_id: 1, role: 'start' },
      { placement_id: 2, role: 'start' },
      { placement_id: 3, role: 'start' },
      { placement_id: 4, role: 'finish' },
    ];
    expect(validateDraft(threeStarts).errors).toContain(
      'Max 2 start holds (3 painted)',
    );
    const threeFinishes: DraftHold[] = [
      { placement_id: 1, role: 'start' },
      { placement_id: 2, role: 'finish' },
      { placement_id: 3, role: 'finish' },
      { placement_id: 4, role: 'finish' },
    ];
    expect(validateDraft(threeFinishes).errors).toContain(
      'Max 2 finish holds (3 painted)',
    );
  });

  it('requires at least 3 holds', () => {
    const res = validateDraft([
      { placement_id: 1, role: 'start' },
      { placement_id: 2, role: 'finish' },
    ]);
    expect(res.valid).toBe(false);
    expect(res.errors).toContain('At least 3 holds (2 so far)');
  });
});

describe('draftToFrames', () => {
  it('serializes the exact BoardLib encoding', () => {
    expect(
      draftToFrames([
        { placement_id: 1001, role: 'start' },
        { placement_id: 1002, role: 'middle' },
        { placement_id: 1003, role: 'finish' },
        { placement_id: 1004, role: 'foot_only' },
      ]),
    ).toBe('p1001r12p1002r13p1003r14p1004r15');
  });
});
