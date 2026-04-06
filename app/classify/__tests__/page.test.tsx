import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ClassifyPage from '../page';
import {
  buildExportData,
  nextUnvisited,
  currentHoldForState,
  CATEGORIES,
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
});

// ─── Helper ──────────────────────────────────────────────────────────────────
function makeState(overrides: Partial<ClassifyState> = {}): ClassifyState {
  return {
    version: 1,
    visitedOrder: [],
    cursor: 0,
    classifications: {},
    skipped: [],
    ...overrides,
  };
}

// ─── Pure function tests ──────────────────────────────────────────────────────

describe('nextUnvisited()', () => {
  it('returns first unclassified, unskipped hold when nothing visited', () => {
    const state = makeState();
    const hold = nextUnvisited(state);
    // Mock data sorted: 1001 (y=152), 1002 (y=144), 1003 (y=136)
    expect(hold?.placement_id).toBe(1001);
  });

  it('skips classified holds', () => {
    const state = makeState({ classifications: { 1001: 'jug' }, visitedOrder: [1001], cursor: 1 });
    const hold = nextUnvisited(state);
    expect(hold?.placement_id).toBe(1002);
  });

  it('places skipped holds after pending ones', () => {
    const state = makeState({ skipped: [1001], visitedOrder: [1001], cursor: 1 });
    // 1002 and 1003 are unclassified/unskipped → comes first
    const hold = nextUnvisited(state);
    expect(hold?.placement_id).toBe(1002);
  });

  it('returns null when all holds are classified', () => {
    const state = makeState({
      classifications: { 1001: 'jug', 1002: 'crimp', 1003: 'sloper' },
      visitedOrder: [1001, 1002, 1003],
      cursor: 3,
    });
    expect(nextUnvisited(state)).toBeNull();
  });
});

describe('currentHoldForState()', () => {
  it('returns first unvisited hold at frontier (cursor === visitedOrder.length)', () => {
    const state = makeState();
    const hold = currentHoldForState(state);
    expect(hold?.placement_id).toBe(1001);
  });

  it('returns visitedOrder[cursor] when reviewing history', () => {
    const state = makeState({
      visitedOrder: [1001, 1002],
      cursor: 0,
      classifications: { 1001: 'jug', 1002: 'crimp' },
    });
    expect(currentHoldForState(state)?.placement_id).toBe(1001);
  });
});

describe('buildExportData()', () => {
  it('returns correct total count', () => {
    const state = makeState({ classifications: { 1001: 'jug', 1002: 'crimp' } });
    const data = buildExportData(state);
    expect(data.total).toBe(3);
    expect(data.classified).toBe(2);
  });

  it('includes all classified holds in classifications array', () => {
    const state = makeState({ classifications: { 1001: 'jug' } });
    const data = buildExportData(state);
    expect(data.classifications).toHaveLength(1);
    expect(data.classifications[0]).toMatchObject({ placement_id: 1001, category: 'jug' });
  });

  it('counts each category correctly', () => {
    const state = makeState({ classifications: { 1001: 'jug', 1002: 'jug', 1003: 'crimp' } });
    const data = buildExportData(state);
    expect(data.categories.jug).toBe(2);
    expect(data.categories.crimp).toBe(1);
  });

  it('includes board metadata', () => {
    const data = buildExportData(makeState());
    expect(data.board).toBe('kilter_original_12x12');
    expect(data.version).toBe(1);
  });
});

// ─── Component tests ──────────────────────────────────────────────────────────

describe('ClassifyPage', () => {
  it('renders all 6 category buttons', () => {
    render(<ClassifyPage />);
    CATEGORIES.forEach((cat) => {
      expect(screen.getByTestId(`btn-${cat.value}`)).toBeInTheDocument();
    });
  });

  it('shows progress counter 0 / 3 initially', () => {
    render(<ClassifyPage />);
    expect(screen.getByText('0 / 3')).toBeInTheDocument();
  });

  it('shows progress bar', () => {
    render(<ClassifyPage />);
    expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
  });

  it('clicking a category button advances classified count', () => {
    render(<ClassifyPage />);
    fireEvent.click(screen.getByTestId('btn-jug'));
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('back button is disabled at the start', () => {
    render(<ClassifyPage />);
    expect(screen.getByTestId('btn-back')).toBeDisabled();
  });

  it('back button is enabled after classifying one hold', () => {
    render(<ClassifyPage />);
    fireEvent.click(screen.getByTestId('btn-jug'));
    expect(screen.getByTestId('btn-back')).not.toBeDisabled();
  });

  it('skip button skips current hold', () => {
    render(<ClassifyPage />);
    fireEvent.click(screen.getByTestId('btn-skip'));
    expect(screen.getByText(/1 skipped/)).toBeInTheDocument();
  });

  it('export button is always present', () => {
    render(<ClassifyPage />);
    expect(screen.getByTestId('btn-export')).toBeInTheDocument();
  });

  it('persists state to localStorage after classification', () => {
    render(<ClassifyPage />);
    fireEvent.click(screen.getByTestId('btn-jug'));
    const saved = JSON.parse(localStorageMock.getItem('kilter_hold_classifications')!);
    expect(Object.keys(saved.classifications).length).toBe(1);
  });

  it('restores state from localStorage on mount', () => {
    localStorageMock.setItem(
      'kilter_hold_classifications',
      JSON.stringify(makeState({
        classifications: { 1001: 'jug' },
        visitedOrder: [1001],
        cursor: 1,
      })),
    );
    render(<ClassifyPage />);
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('shows done state when all holds are classified', () => {
    render(<ClassifyPage />);
    fireEvent.click(screen.getByTestId('btn-jug'));   // hold 1001
    fireEvent.click(screen.getByTestId('btn-crimp')); // hold 1002
    fireEvent.click(screen.getByTestId('btn-sloper')); // hold 1003
    expect(screen.getByText('All done!')).toBeInTheDocument();
  });

  it('shows Export JSON button in done state', () => {
    render(<ClassifyPage />);
    fireEvent.click(screen.getByTestId('btn-jug'));
    fireEvent.click(screen.getByTestId('btn-crimp'));
    fireEvent.click(screen.getByTestId('btn-sloper'));
    expect(screen.getByText('Export JSON')).toBeInTheDocument();
  });

  it('reset button shows confirmation modal', () => {
    render(<ClassifyPage />);
    fireEvent.click(screen.getByText('Reset'));
    expect(screen.getByText('Reset all progress?')).toBeInTheDocument();
  });

  it('cancel in reset modal closes it without resetting', () => {
    render(<ClassifyPage />);
    fireEvent.click(screen.getByTestId('btn-jug'));
    fireEvent.click(screen.getByText('Reset'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Reset all progress?')).not.toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('confirming reset clears all progress', () => {
    render(<ClassifyPage />);
    fireEvent.click(screen.getByTestId('btn-jug'));
    fireEvent.click(screen.getByText('Reset'));
    fireEvent.click(screen.getByTestId('btn-confirm-reset'));
    expect(screen.getByText('0 / 3')).toBeInTheDocument();
  });

  it('all 6 category labels are present', () => {
    render(<ClassifyPage />);
    expect(screen.getByText('Jug')).toBeInTheDocument();
    expect(screen.getByText('Good Crimp')).toBeInTheDocument();
    expect(screen.getByText('Crimp')).toBeInTheDocument();
    expect(screen.getByText('Sloper')).toBeInTheDocument();
    expect(screen.getByText('Undercling')).toBeInTheDocument();
    expect(screen.getByText('Pinch')).toBeInTheDocument();
  });

  it('back button goes to previous hold after advancing', () => {
    render(<ClassifyPage />);
    fireEvent.click(screen.getByTestId('btn-jug'));   // classify 1001, now showing 1002
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('btn-back'));  // back to 1001
    // Classified count stays at 1, but we're reviewing 1001
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    // Category buttons still present (can reclassify)
    expect(screen.getByTestId('btn-crimp')).toBeInTheDocument();
  });
});

// ─── Integration tests ────────────────────────────────────────────────────────

describe('Classification flow integration', () => {
  it('classify 3 holds → export JSON has correct structure', () => {
    render(<ClassifyPage />);
    fireEvent.click(screen.getByTestId('btn-jug'));
    fireEvent.click(screen.getByTestId('btn-crimp'));
    fireEvent.click(screen.getByTestId('btn-sloper'));

    const saved = JSON.parse(localStorageMock.getItem('kilter_hold_classifications')!);
    const exportData = buildExportData(saved);

    expect(exportData.version).toBe(1);
    expect(exportData.board).toBe('kilter_original_12x12');
    expect(exportData.classified).toBe(3);
    expect(exportData.classifications).toHaveLength(3);
    expect(exportData.categories.jug).toBe(1);
    expect(exportData.categories.crimp).toBe(1);
    expect(exportData.categories.sloper).toBe(1);

    for (const c of exportData.classifications) {
      expect(c).toHaveProperty('placement_id');
      expect(c).toHaveProperty('category');
      expect(c).toHaveProperty('x');
      expect(c).toHaveProperty('y');
    }
  });

  it('resume flow: classify 1, remount, verify restored at 1/3', () => {
    const { unmount } = render(<ClassifyPage />);
    fireEvent.click(screen.getByTestId('btn-jug'));
    unmount();

    render(<ClassifyPage />);
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });
});
