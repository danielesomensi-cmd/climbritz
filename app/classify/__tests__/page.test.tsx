import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// A019.16: ClassifyPage is AuthGuard-wrapped — mock signed-in.
// A023: page also reads useUser() for the Send-my-export email.
jest.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true }),
  useUser: () => ({
    user: { primaryEmailAddress: { emailAddress: 'climber@example.com' } },
  }),
}));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  usePathname: () => '/classify',
}));

// A023: /classify now syncs through the backend. Mock the API client so the
// mount-time listClassifications() call (and tap-time writes) don't hit the
// network. Default: empty backend → the localStorage cache stands in, which
// keeps the pre-A023 localStorage tests valid.
jest.mock('@/app/lib/api', () => ({
  listClassifications: jest.fn(() => Promise.resolve([])),
  upsertClassification: jest.fn(() => Promise.resolve({})),
  deleteClassification: jest.fn(() => Promise.resolve()),
  bulkImportClassifications: jest.fn(() => Promise.resolve({ total: 0 })),
}));

import ClassifyPage from '../page';
import {
  listClassifications,
  bulkImportClassifications,
} from '@/app/lib/api';
import {
  buildExportData,
  firstUnclassified,
  initialState,
  reducer,
  CATEGORIES,
  CATEGORY_FILL,
  type ClassifyState,
} from '../state';

// ─── Mock localStorage ────────────────────────────────────────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// ─── Mock placements (3 holds for speed) ────────────────────────────────────
jest.mock('@/app/data/placements_12x12.json', () => [
  { placement_id: 1001, hole_id: 2001, x: 0,  y: 152, hole_name: '0,152', default_role: 'middle', set_name: 'Bolt Ons', set_id: 1, role_id: 13 },
  { placement_id: 1002, hole_id: 2002, x: 8,  y: 144, hole_name: '1,144', default_role: 'start',  set_name: 'Bolt Ons', set_id: 1, role_id: 12 },
  { placement_id: 1003, hole_id: 2003, x: 16, y: 136, hole_name: '2,136', default_role: 'finish', set_name: 'Bolt Ons', set_id: 1, role_id: 14 },
]);

// ─── Mock navigator.share ────────────────────────────────────────────────────
Object.assign(navigator, { canShare: jest.fn(() => false) });

beforeEach(() => {
  localStorageMock.clear();
  jest.clearAllMocks();
});

function makeState(overrides: Partial<ClassifyState> = {}): ClassifyState {
  return { version: 2, classifications: {}, skipped: [], ...overrides };
}

// ─── Pure function tests ──────────────────────────────────────────────────────

describe('firstUnclassified()', () => {
  it('returns first hold in sorted order when nothing is classified', () => {
    // Sorted: 1001 (y=152), 1002 (y=144), 1003 (y=136)
    expect(firstUnclassified(makeState())?.placement_id).toBe(1001);
  });

  it('skips already-classified holds', () => {
    const state = makeState({ classifications: { 1001: 'jug' } });
    expect(firstUnclassified(state)?.placement_id).toBe(1002);
  });

  it('skips skipped holds', () => {
    const state = makeState({ skipped: [1001] });
    expect(firstUnclassified(state)?.placement_id).toBe(1002);
  });

  it('returns null when all holds are accounted for', () => {
    const state = makeState({
      classifications: { 1001: 'jug', 1002: 'crimp', 1003: 'sloper' },
    });
    expect(firstUnclassified(state)).toBeNull();
  });
});

describe('reducer()', () => {
  it('CLASSIFY stores the category under placement_id', () => {
    const next = reducer(initialState(), { type: 'CLASSIFY', placementId: 1001, category: 'jug' });
    expect(next.classifications[1001]).toBe('jug');
  });

  it('CLASSIFY removes the hold from the skipped list', () => {
    const state = makeState({ skipped: [1001] });
    const next = reducer(state, { type: 'CLASSIFY', placementId: 1001, category: 'pinch' });
    expect(next.skipped).not.toContain(1001);
    expect(next.classifications[1001]).toBe('pinch');
  });

  it('CLASSIFY can overwrite an existing classification (reclassify)', () => {
    const state = makeState({ classifications: { 1001: 'jug' } });
    const next = reducer(state, { type: 'CLASSIFY', placementId: 1001, category: 'crimp' });
    expect(next.classifications[1001]).toBe('crimp');
  });

  it('SKIP removes any existing classification', () => {
    const state = makeState({ classifications: { 1001: 'jug' } });
    const next = reducer(state, { type: 'SKIP', placementId: 1001 });
    expect(next.classifications[1001]).toBeUndefined();
    expect(next.skipped).toContain(1001);
  });

  it('SKIP is idempotent', () => {
    const state = makeState({ skipped: [1001] });
    const next = reducer(state, { type: 'SKIP', placementId: 1001 });
    expect(next.skipped).toEqual([1001]);
  });

  it('UNSKIP removes the hold from the skipped list', () => {
    const state = makeState({ skipped: [1001, 1002] });
    const next = reducer(state, { type: 'UNSKIP', placementId: 1001 });
    expect(next.skipped).toEqual([1002]);
  });

  it('RESET returns the initial state', () => {
    const state = makeState({ classifications: { 1001: 'jug' }, skipped: [1002] });
    expect(reducer(state, { type: 'RESET' })).toEqual(initialState());
  });
});

describe('buildExportData()', () => {
  it('returns correct totals and classified count', () => {
    const state = makeState({ classifications: { 1001: 'jug', 1002: 'crimp' } });
    const data = buildExportData(state);
    expect(data.total).toBe(3);
    expect(data.classified).toBe(2);
  });

  it('counts each category correctly', () => {
    const state = makeState({ classifications: { 1001: 'jug', 1002: 'jug', 1003: 'crimp' } });
    const data = buildExportData(state);
    expect(data.categories.jug).toBe(2);
    expect(data.categories.crimp).toBe(1);
  });

  it('includes x/y coordinates in each classification entry', () => {
    const data = buildExportData(makeState({ classifications: { 1001: 'jug' } }));
    expect(data.classifications[0]).toMatchObject({ placement_id: 1001, category: 'jug', x: 0, y: 152 });
  });

  it('includes board metadata and version', () => {
    const data = buildExportData(makeState());
    expect(data.board).toBe('kilter_original_12x12');
    expect(data.version).toBe(2);
  });
});

describe('CATEGORY_FILL', () => {
  it('has a hex color for every category', () => {
    for (const cat of CATEGORIES) {
      expect(CATEGORY_FILL[cat.value]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

// ─── Component tests ──────────────────────────────────────────────────────────

describe('ClassifyPage', () => {
  it('renders header, progress, and legend', () => {
    render(<ClassifyPage />);
    expect(screen.getByText('Hold Classification')).toBeInTheDocument();
    expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
    expect(screen.getByTestId('progress-text').textContent).toBe('0 / 3');
  });

  it('shows the "click a hold" hint when nothing is selected', () => {
    render(<ClassifyPage />);
    expect(screen.getByText(/Click a hold on the board/)).toBeInTheDocument();
  });

  it('clicking a hold on the board opens the detail panel with its crop', () => {
    render(<ClassifyPage />);
    fireEvent.click(screen.getByTestId('hold-1001'));
    expect(screen.getByText('Hold #1001')).toBeInTheDocument();
    expect(screen.getByAltText('Hold 1001')).toBeInTheDocument();
  });

  it('classifying a selected hold advances the progress counter', () => {
    render(<ClassifyPage />);
    fireEvent.click(screen.getByTestId('hold-1001'));
    fireEvent.click(screen.getByTestId('btn-jug'));
    expect(screen.getByTestId('progress-text').textContent).toBe('1 / 3');
  });

  it('shows the current category in the panel after classifying', () => {
    render(<ClassifyPage />);
    fireEvent.click(screen.getByTestId('hold-1002'));
    fireEvent.click(screen.getByTestId('btn-crimp'));
    const currentlyLabel = screen.getByText(/Currently:/);
    expect(currentlyLabel).toBeInTheDocument();
    expect(currentlyLabel.textContent).toMatch(/Crimp/);
  });

  it('clicking a different category reclassifies the hold in place', () => {
    render(<ClassifyPage />);
    fireEvent.click(screen.getByTestId('hold-1001'));
    fireEvent.click(screen.getByTestId('btn-jug'));
    fireEvent.click(screen.getByTestId('btn-crimp'));
    // Still 1 classified — reclassification, not a new one
    expect(screen.getByTestId('progress-text').textContent).toBe('1 / 3');
    // Panel still open, Crimp now shown as current
    expect(screen.getByText(/Currently:/)).toBeInTheDocument();
  });

  it('"Prossima non classificata" jumps to the first unclassified hold', () => {
    render(<ClassifyPage />);
    fireEvent.click(screen.getByTestId('hold-1001'));
    fireEvent.click(screen.getByTestId('btn-jug'));
    // Now click the header Next button
    fireEvent.click(screen.getByTestId('btn-next'));
    // Should open 1002 (first unclassified)
    expect(screen.getByText('Hold #1002')).toBeInTheDocument();
  });

  it('skip button marks the hold as skipped', () => {
    render(<ClassifyPage />);
    fireEvent.click(screen.getByTestId('hold-1001'));
    fireEvent.click(screen.getByTestId('btn-skip'));
    expect(screen.getByText(/1 skipped/)).toBeInTheDocument();
    expect(screen.getByText(/Currently skipped/)).toBeInTheDocument();
  });

  it('shows "All holds classified" message when everything is done', () => {
    render(<ClassifyPage />);
    fireEvent.click(screen.getByTestId('hold-1001'));
    fireEvent.click(screen.getByTestId('btn-jug'));
    fireEvent.click(screen.getByTestId('hold-1002'));
    fireEvent.click(screen.getByTestId('btn-crimp'));
    fireEvent.click(screen.getByTestId('hold-1003'));
    fireEvent.click(screen.getByTestId('btn-sloper'));
    expect(screen.getByTestId('progress-text').textContent).toBe('3 / 3');
    // Close the panel and verify the done hint
    fireEvent.click(screen.getByLabelText('Close'));
    expect(screen.getByText(/All 3 holds classified/)).toBeInTheDocument();
  });

  it('export button is always present in the header', () => {
    render(<ClassifyPage />);
    expect(screen.getByTestId('btn-export')).toBeInTheDocument();
  });

  it('persists state to localStorage after classification', () => {
    render(<ClassifyPage />);
    fireEvent.click(screen.getByTestId('hold-1001'));
    fireEvent.click(screen.getByTestId('btn-jug'));
    const saved = JSON.parse(localStorageMock.getItem('kilter_hold_classifications')!);
    expect(saved.version).toBe(2);
    expect(Object.keys(saved.classifications).length).toBe(1);
  });

  it('restores state from localStorage on mount', () => {
    localStorageMock.setItem(
      'kilter_hold_classifications',
      JSON.stringify(makeState({ classifications: { 1001: 'jug' } })),
    );
    render(<ClassifyPage />);
    expect(screen.getByTestId('progress-text').textContent).toBe('1 / 3');
  });

  it('reset button shows confirmation modal, cancel keeps state', () => {
    render(<ClassifyPage />);
    fireEvent.click(screen.getByTestId('hold-1001'));
    fireEvent.click(screen.getByTestId('btn-jug'));
    fireEvent.click(screen.getByText('Reset'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Reset all progress?')).not.toBeInTheDocument();
    expect(screen.getByTestId('progress-text').textContent).toBe('1 / 3');
  });

  it('confirming reset clears all progress', () => {
    render(<ClassifyPage />);
    fireEvent.click(screen.getByTestId('hold-1001'));
    fireEvent.click(screen.getByTestId('btn-jug'));
    fireEvent.click(screen.getByText('Reset'));
    fireEvent.click(screen.getByTestId('btn-confirm-reset'));
    expect(screen.getByTestId('progress-text').textContent).toBe('0 / 3');
  });

  it('all 6 category labels are present after selecting a hold', () => {
    render(<ClassifyPage />);
    fireEvent.click(screen.getByTestId('hold-1001'));
    expect(screen.getByTestId('btn-jug')).toBeInTheDocument();
    expect(screen.getByTestId('btn-good_crimp')).toBeInTheDocument();
    expect(screen.getByTestId('btn-crimp')).toBeInTheDocument();
    expect(screen.getByTestId('btn-sloper')).toBeInTheDocument();
    expect(screen.getByTestId('btn-undercling')).toBeInTheDocument();
    expect(screen.getByTestId('btn-pinch')).toBeInTheDocument();
  });
});

// ─── Integration test ────────────────────────────────────────────────────────

describe('Classification flow integration', () => {
  it('classify 3 holds → export JSON has correct structure (v2)', () => {
    render(<ClassifyPage />);
    fireEvent.click(screen.getByTestId('hold-1001'));
    fireEvent.click(screen.getByTestId('btn-jug'));
    fireEvent.click(screen.getByTestId('hold-1002'));
    fireEvent.click(screen.getByTestId('btn-crimp'));
    fireEvent.click(screen.getByTestId('hold-1003'));
    fireEvent.click(screen.getByTestId('btn-sloper'));

    const saved = JSON.parse(localStorageMock.getItem('kilter_hold_classifications')!);
    const exportData = buildExportData(saved);

    expect(exportData.version).toBe(2);
    expect(exportData.board).toBe('kilter_original_12x12');
    expect(exportData.classified).toBe(3);
    expect(exportData.classifications).toHaveLength(3);
    expect(exportData.categories.jug).toBe(1);
    expect(exportData.categories.crimp).toBe(1);
    expect(exportData.categories.sloper).toBe(1);
  });

  it('resume flow: classify 1, remount, verify restored at 1/3', () => {
    const { unmount } = render(<ClassifyPage />);
    fireEvent.click(screen.getByTestId('hold-1001'));
    fireEvent.click(screen.getByTestId('btn-jug'));
    unmount();

    render(<ClassifyPage />);
    expect(screen.getByTestId('progress-text').textContent).toBe('1 / 3');
  });
});

// ─── A023: cloud sync + growth ─────────────────────────────────────────────

describe('A023 — growth messages, Send/Import, backend hydration', () => {
  it('renders both growth messages with the exact English copy', () => {
    render(<ClassifyPage />);
    expect(
      screen.getByText('Propose your classification of the holds'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Help us build the world's first hold-type database for the Kilter Board/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /The first 10 climbers to complete a full board classification will receive a prize\./,
      ),
    ).toBeInTheDocument();
  });

  it('"Send my export" copies JSON to clipboard and opens a mailto to Daniele', async () => {
    const writeText = jest.fn((_text: string) => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    const originalLocation = window.location;
    delete (window as { location?: Location }).location;
    (window as unknown as { location: { href: string } }).location = { href: '' };

    render(<ClassifyPage />);
    fireEvent.click(screen.getByTestId('btn-send-export'));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(window.location.href).toMatch(/^mailto:daniele\.somensi@gmail\.com/);
    // The copied payload is valid JSON with the classifier email baked in.
    const copied = JSON.parse(writeText.mock.calls[0][0] as string);
    expect(copied.classifier).toBe('climber@example.com');

    (window as unknown as { location: Location }).location = originalLocation;
  });

  it('"Import JSON" accepts a valid file and calls bulkImportClassifications', async () => {
    render(<ClassifyPage />);
    const json = JSON.stringify({
      version: 2,
      classifications: [
        { placement_id: 1001, category: 'jug', x: 0, y: 152 },
        { placement_id: 1002, category: 'crimp', x: 8, y: 144 },
      ],
    });
    const file = new File([json], 'classify.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: () => Promise.resolve(json) });

    fireEvent.change(screen.getByTestId('import-file-input'), {
      target: { files: [file] },
    });

    await waitFor(() => expect(bulkImportClassifications).toHaveBeenCalledTimes(1));
    expect(bulkImportClassifications).toHaveBeenCalledWith([
      { placement_id: 1001, category: 'jug' },
      { placement_id: 1002, category: 'crimp' },
    ]);
  });

  it('"Import JSON" rejects malformed JSON with a toast and makes no API call', async () => {
    render(<ClassifyPage />);
    const bad = 'not json {';
    const file = new File([bad], 'bad.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: () => Promise.resolve(bad) });

    fireEvent.change(screen.getByTestId('import-file-input'), {
      target: { files: [file] },
    });

    await waitFor(() =>
      expect(screen.getByTestId('toast')).toHaveTextContent('Invalid JSON file.'),
    );
    expect(bulkImportClassifications).not.toHaveBeenCalled();
  });

  it('hydrates from listClassifications() on mount', async () => {
    (listClassifications as jest.Mock).mockResolvedValueOnce([
      { placement_id: 1001, category: 'jug', id: 'a', created_at: '', updated_at: '' },
      { placement_id: 1002, category: 'crimp', id: 'b', created_at: '', updated_at: '' },
      { placement_id: 1003, category: 'sloper', id: 'c', created_at: '', updated_at: '' },
    ]);

    render(<ClassifyPage />);

    expect(listClassifications).toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByTestId('progress-text').textContent).toBe('3 / 3'),
    );
  });
});
