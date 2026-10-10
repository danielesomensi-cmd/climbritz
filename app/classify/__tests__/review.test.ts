import type { Placement } from '@/components/BoardMap';

jest.mock('@/app/data/hold_suggestions.json', () => ({ version: 1, suggestions: {} }));

import { buildReviewQueue, type HoldSuggestion } from '../review';

const hold = (id: number, x: number, y: number): Placement =>
  ({ placement_id: id, x, y, hole_id: id, hole_name: `${x},${y}`, default_role: 'middle', set_name: 'Bolt Ons', set_id: 1, role_id: 13 }) as Placement;

const sug = (c: HoldSuggestion['category']): HoldSuggestion => ({ category: c, confidence: 'medium', why: '' });

const HOLDS = [hold(1, 0, 0), hold(2, 8, 0), hold(3, 100, 100), hold(4, 108, 100), hold(5, 16, 0)];
const ALL = { 1: sug('jug'), 2: sug('crimp'), 3: sug('sloper'), 4: sug('pinch'), 5: sug('jug') };

describe('buildReviewQueue', () => {
  it('starts next to the holds already classified', () => {
    const q = buildReviewQueue(HOLDS, { 3: 'sloper' }, [], ALL, 2);
    expect(q).toEqual([4, 5]);
  });

  it('never queues classified, skipped or unsuggested holds', () => {
    const q = buildReviewQueue(HOLDS, { 1: 'jug' }, [2], { ...ALL, 5: undefined as never }, 10);
    expect(q).not.toContain(1);
    expect(q).not.toContain(2);
    expect(q).not.toContain(5);
    expect(q.sort()).toEqual([3, 4]);
  });

  it('starts mid-board when nothing is classified, then walks to neighbours', () => {
    expect(buildReviewQueue(HOLDS, {}, [], ALL, 2)).toEqual([3, 4]);
  });

  it('walks to the nearest neighbour each step', () => {
    expect(buildReviewQueue(HOLDS, { 1: 'jug' }, [], ALL, 3)).toEqual([2, 5, 3]);
  });

  it('caps the batch size', () => {
    expect(buildReviewQueue(HOLDS, {}, [], ALL, 2)).toHaveLength(2);
  });
});
