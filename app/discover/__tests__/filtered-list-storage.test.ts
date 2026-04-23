import {
  saveFilteredList,
  readFilteredList,
  clearFilteredList,
  resolvePosition,
  type FilteredList,
} from '../filtered-list-storage';

// Use the real sessionStorage provided by jsdom; reset between tests.
beforeEach(() => {
  window.sessionStorage.clear();
});

const sample: FilteredList = {
  climbIds: ['uuid-a', 'uuid-b', 'uuid-c'],
  angle: 40,
  timestamp: Date.now(),
};

describe('filtered-list-storage', () => {
  it('saveFilteredList + readFilteredList round-trip', () => {
    saveFilteredList(sample);
    expect(readFilteredList()).toEqual(sample);
  });

  it('readFilteredList returns null when nothing saved', () => {
    expect(readFilteredList()).toBeNull();
  });

  it('clearFilteredList removes the entry', () => {
    saveFilteredList(sample);
    clearFilteredList();
    expect(readFilteredList()).toBeNull();
  });

  it('returns null for a stale entry (>24h) and clears it', () => {
    const stale: FilteredList = {
      ...sample,
      timestamp: Date.now() - 25 * 60 * 60 * 1000,
    };
    saveFilteredList(stale);
    expect(readFilteredList()).toBeNull();
    // And the stale entry is wiped so we don't keep re-parsing it
    expect(window.sessionStorage.getItem('kilter-up:discover:filtered-list')).toBeNull();
  });

  it('returns null and clears on corrupt JSON', () => {
    window.sessionStorage.setItem('kilter-up:discover:filtered-list', '{ not json');
    expect(readFilteredList()).toBeNull();
    expect(window.sessionStorage.getItem('kilter-up:discover:filtered-list')).toBeNull();
  });

  it('returns null and clears when shape is wrong', () => {
    window.sessionStorage.setItem(
      'kilter-up:discover:filtered-list',
      JSON.stringify({ climbIds: 'not-an-array', angle: 40, timestamp: Date.now() }),
    );
    expect(readFilteredList()).toBeNull();
    expect(window.sessionStorage.getItem('kilter-up:discover:filtered-list')).toBeNull();
  });

  describe('resolvePosition', () => {
    it('returns list + index when uuid is in the saved list', () => {
      saveFilteredList(sample);
      expect(resolvePosition('uuid-b')).toEqual({ list: sample, index: 1 });
    });

    it('returns null when uuid is NOT in the saved list (deep link)', () => {
      saveFilteredList(sample);
      expect(resolvePosition('uuid-z')).toBeNull();
    });

    it('returns null when no list saved at all', () => {
      expect(resolvePosition('uuid-a')).toBeNull();
    });
  });
});
