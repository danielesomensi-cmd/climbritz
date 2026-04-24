import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import FilterPanel, { countActiveFilters, type Filters } from '../FilterPanel';

const DEFAULT: Filters = { sort: 'popularity' };

describe('FilterPanel', () => {
  it('renders nothing when expanded=false', () => {
    render(<FilterPanel value={DEFAULT} onChange={() => {}} expanded={false} />);
    expect(screen.queryByTestId('filter-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('filter-grade-min')).not.toBeInTheDocument();
  });

  it('renders its content when expanded=true', () => {
    render(<FilterPanel value={DEFAULT} onChange={() => {}} expanded={true} />);
    expect(screen.getByTestId('filter-panel')).toBeInTheDocument();
    expect(screen.getByTestId('filter-grade-min')).toBeInTheDocument();
    expect(screen.getByTestId('filter-grade-max')).toBeInTheDocument();
  });

  it('calls onChange with gradeMin when selected', () => {
    const onChange = jest.fn();
    render(<FilterPanel value={DEFAULT} onChange={onChange} expanded={true} />);
    fireEvent.change(screen.getByTestId('filter-grade-min'), { target: { value: '18' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ gradeMin: 18 }));
  });

  it('toggles ascent preset on click', () => {
    const onChange = jest.fn();
    render(<FilterPanel value={DEFAULT} onChange={onChange} expanded={true} />);
    fireEvent.click(screen.getByTestId('filter-ascents-100+'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ minAscents: 100 }));
  });

  it('toggles min quality filter (click to set, click again to clear)', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <FilterPanel value={DEFAULT} onChange={onChange} expanded={true} />,
    );
    fireEvent.click(screen.getByTestId('filter-quality-4'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ minQuality: 4 }));

    rerender(
      <FilterPanel
        value={{ ...DEFAULT, minQuality: 4 }}
        onChange={onChange}
        expanded={true}
      />,
    );
    fireEvent.click(screen.getByTestId('filter-quality-4'));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ minQuality: undefined }),
    );
  });

  it('emits all four sort options', () => {
    const onChange = jest.fn();
    render(<FilterPanel value={DEFAULT} onChange={onChange} expanded={true} />);
    for (const sort of ['popularity', 'quality', 'grade_asc', 'grade_desc'] as const) {
      fireEvent.click(screen.getByTestId(`filter-sort-${sort}`));
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sort }));
    }
  });

  it('renders grip-type chips as disabled', () => {
    render(<FilterPanel value={DEFAULT} onChange={() => {}} expanded={true} />);
    expect(screen.getByTestId('filter-grip-Jug')).toBeDisabled();
  });

  it('reset clears all filters and resets sort to popularity', () => {
    const onChange = jest.fn();
    render(
      <FilterPanel
        value={{ sort: 'quality', gradeMin: 18, minAscents: 100 }}
        onChange={onChange}
        expanded={true}
      />,
    );
    fireEvent.click(screen.getByTestId('filter-reset'));
    expect(onChange).toHaveBeenCalledWith({
      sort: 'popularity',
      gradeMin: undefined,
      gradeMax: undefined,
      minAscents: undefined,
      minQuality: undefined,
    });
  });
});

describe('countActiveFilters', () => {
  it('returns 0 for default filters', () => {
    expect(countActiveFilters({ sort: 'popularity' })).toBe(0);
  });

  it('counts each non-default field', () => {
    expect(
      countActiveFilters({
        sort: 'popularity',
        gradeMin: 18,
        gradeMax: 24,
        minAscents: 50,
        minQuality: 4,
      }),
    ).toBe(4);
  });

  it('counts a non-default sort', () => {
    expect(countActiveFilters({ sort: 'quality' })).toBe(1);
  });

  it('counts non-default sort alongside other active filters', () => {
    expect(
      countActiveFilters({ sort: 'grade_asc', gradeMin: 18, minAscents: 50 }),
    ).toBe(3);
  });
});
