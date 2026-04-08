import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import FilterPanel, { type Filters } from '../FilterPanel';

const DEFAULT: Filters = { sort: 'popularity' };

describe('FilterPanel', () => {
  it('starts collapsed', () => {
    render(<FilterPanel value={DEFAULT} onChange={() => {}} />);
    expect(screen.queryByTestId('filter-grade-min')).not.toBeInTheDocument();
  });

  it('expands when the toggle is clicked', () => {
    render(<FilterPanel value={DEFAULT} onChange={() => {}} />);
    fireEvent.click(screen.getByTestId('filter-toggle'));
    expect(screen.getByTestId('filter-grade-min')).toBeInTheDocument();
    expect(screen.getByTestId('filter-grade-max')).toBeInTheDocument();
  });

  it('calls onChange with gradeMin when selected', () => {
    const onChange = jest.fn();
    render(<FilterPanel value={DEFAULT} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('filter-toggle'));
    fireEvent.change(screen.getByTestId('filter-grade-min'), { target: { value: '18' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ gradeMin: 18 }));
  });

  it('toggles ascent preset on click', () => {
    const onChange = jest.fn();
    render(<FilterPanel value={DEFAULT} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('filter-toggle'));
    fireEvent.click(screen.getByTestId('filter-ascents-100+'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ minAscents: 100 }));
  });

  it('toggles min quality filter (click to set, click again to clear)', () => {
    const onChange = jest.fn();
    const { rerender } = render(<FilterPanel value={DEFAULT} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('filter-toggle'));
    fireEvent.click(screen.getByTestId('filter-quality-4'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ minQuality: 4 }));

    // Simulate parent updating state. The panel keeps its expanded local
    // state across rerender, so we can click the chip again to clear.
    rerender(<FilterPanel value={{ ...DEFAULT, minQuality: 4 }} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('filter-quality-4'));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ minQuality: undefined }),
    );
  });

  it('emits all four sort options', () => {
    const onChange = jest.fn();
    render(<FilterPanel value={DEFAULT} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('filter-toggle'));
    for (const sort of ['popularity', 'quality', 'grade_asc', 'grade_desc'] as const) {
      fireEvent.click(screen.getByTestId(`filter-sort-${sort}`));
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sort }));
    }
  });

  it('renders grip-type chips as disabled', () => {
    render(<FilterPanel value={DEFAULT} onChange={() => {}} />);
    fireEvent.click(screen.getByTestId('filter-toggle'));
    const jug = screen.getByTestId('filter-grip-Jug');
    expect(jug).toBeDisabled();
  });

  it('shows active filter count badge', () => {
    render(
      <FilterPanel
        value={{ sort: 'popularity', gradeMin: 18, minAscents: 100 }}
        onChange={() => {}}
      />,
    );
    // 2 active filters → badge text "2"
    expect(screen.getByTestId('filter-toggle').textContent).toContain('2');
  });

  it('reset clears all filters but preserves sort', () => {
    const onChange = jest.fn();
    render(
      <FilterPanel
        value={{ sort: 'quality', gradeMin: 18, minAscents: 100 }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByTestId('filter-toggle'));
    fireEvent.click(screen.getByTestId('filter-reset'));
    expect(onChange).toHaveBeenCalledWith({
      sort: 'quality',
      gradeMin: undefined,
      gradeMax: undefined,
      minAscents: undefined,
      minQuality: undefined,
    });
  });
});
