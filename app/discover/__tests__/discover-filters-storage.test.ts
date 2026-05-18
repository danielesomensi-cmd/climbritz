import {
  saveDiscoverFilters,
  loadDiscoverFilters,
  clearDiscoverFilters,
  type DiscoverFilters,
} from '../discover-filters-storage';

const KEY = 'climbritz:discover:filters';

beforeEach(() => {
  window.sessionStorage.clear();
});

const sampleInput: Omit<DiscoverFilters, 'timestamp'> = {
  query: 'overhang',
  angle: 45,
  filters: {
    gradeMin: 20,
    gradeMax: 28,
    minAscents: 100,
    minQuality: 3,
    sort: 'quality',
  },
};

describe('discover-filters-storage', () => {
  it('saveDiscoverFilters + loadDiscoverFilters round-trip', () => {
    saveDiscoverFilters(sampleInput);
    const loaded = loadDiscoverFilters();
    expect(loaded).not.toBeNull();
    expect(loaded).toMatchObject(sampleInput);
    expect(typeof loaded!.timestamp).toBe('number');
  });

  it('loadDiscoverFilters returns null when nothing saved', () => {
    expect(loadDiscoverFilters()).toBeNull();
  });

  it('clearDiscoverFilters removes the entry', () => {
    saveDiscoverFilters(sampleInput);
    clearDiscoverFilters();
    expect(loadDiscoverFilters()).toBeNull();
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it('returns null for a stale entry (>24h) and clears it', () => {
    const stale: DiscoverFilters = {
      ...sampleInput,
      timestamp: Date.now() - 25 * 60 * 60 * 1000,
    };
    window.sessionStorage.setItem(KEY, JSON.stringify(stale));
    expect(loadDiscoverFilters()).toBeNull();
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it('returns null and clears on corrupt JSON', () => {
    window.sessionStorage.setItem(KEY, '{ not json');
    expect(loadDiscoverFilters()).toBeNull();
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it('returns null and clears when shape is wrong (query is not a string)', () => {
    window.sessionStorage.setItem(
      KEY,
      JSON.stringify({
        query: 42,
        angle: 40,
        filters: { sort: 'popularity' },
        timestamp: Date.now(),
      }),
    );
    expect(loadDiscoverFilters()).toBeNull();
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it('returns null and clears when sort is not a valid SortField', () => {
    window.sessionStorage.setItem(
      KEY,
      JSON.stringify({
        query: '',
        angle: 40,
        filters: { sort: 'definitely-not-a-sort' },
        timestamp: Date.now(),
      }),
    );
    expect(loadDiscoverFilters()).toBeNull();
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it('accepts state without optional filter fields', () => {
    const minimal: Omit<DiscoverFilters, 'timestamp'> = {
      query: '',
      angle: 40,
      filters: { sort: 'popularity' },
    };
    saveDiscoverFilters(minimal);
    const loaded = loadDiscoverFilters();
    expect(loaded).not.toBeNull();
    expect(loaded).toMatchObject(minimal);
  });

  it('saveDiscoverFilters overwrites the previous entry', () => {
    saveDiscoverFilters({ ...sampleInput, angle: 40 });
    saveDiscoverFilters({ ...sampleInput, angle: 65 });
    const loaded = loadDiscoverFilters();
    expect(loaded?.angle).toBe(65);
  });
});
