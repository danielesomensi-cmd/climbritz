import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import BoardMap, { Placement } from '../BoardMap';

const makePlacement = (id: number, x: number, y: number): Placement => ({
  placement_id: id,
  hole_id: id + 1000,
  x,
  y,
  hole_name: `${x / 8},${y / 8}`,
  default_role: 'middle',
  set_name: 'Bolt Ons',
  set_id: 1,
  role_id: 13,
});

const SAMPLE: Placement[] = [
  makePlacement(1001, 0,   152),
  makePlacement(1002, 8,   144),
  makePlacement(1003, 16,  136),
  makePlacement(1004, 72,  84),
  makePlacement(1005, 144, 16),
];

describe('BoardMap component', () => {
  it('renders without crashing', () => {
    render(<BoardMap placements={SAMPLE} />);
    expect(screen.getByTestId('board-map')).toBeInTheDocument();
  });

  it('renders the correct number of hold markers', () => {
    render(<BoardMap placements={SAMPLE} />);
    SAMPLE.forEach((p) => {
      expect(screen.getByTestId(`hold-${p.placement_id}`)).toBeInTheDocument();
    });
  });

  it('renders all 336 holds from real data', async () => {
    const data = await import('@/app/data/placements_12x12.json');
    const placements = data.default as Placement[];
    render(<BoardMap placements={placements} />);
    expect(screen.getByTestId('board-map')).toBeInTheDocument();
    const holdElements = placements.map((p) => screen.getByTestId(`hold-${p.placement_id}`));
    expect(holdElements).toHaveLength(336);
  });

  it('highlights the specified hold in mini mode', () => {
    render(<BoardMap placements={SAMPLE} highlightId={1003} size="mini" />);
    const highlighted = screen.getByTestId('hold-1003').firstChild as HTMLElement;
    expect(highlighted).toHaveClass('bg-yellow-400');
  });

  it('does not highlight other holds in mini mode', () => {
    render(<BoardMap placements={SAMPLE} highlightId={1003} size="mini" />);
    const other = screen.getByTestId('hold-1001').firstChild as HTMLElement;
    expect(other).not.toHaveClass('bg-yellow-400');
  });

  it('renders img tags in full size mode', () => {
    render(<BoardMap placements={SAMPLE} size="full" />);
    const imgs = screen.getAllByRole('img');
    expect(imgs.length).toBe(SAMPLE.length);
  });

  it('renders dot divs (no img) in mini mode', () => {
    render(<BoardMap placements={SAMPLE} size="mini" />);
    const imgs = screen.queryAllByRole('img');
    expect(imgs.length).toBe(0);
  });

  it('calls onHoldClick when a hold is clicked', () => {
    const onClick = jest.fn();
    render(<BoardMap placements={SAMPLE} onHoldClick={onClick} />);
    fireEvent.click(screen.getByTestId('hold-1002'));
    expect(onClick).toHaveBeenCalledWith(SAMPLE[1]);
  });

  it('hold positions stay within board coordinate range', () => {
    const data = require('@/app/data/placements_12x12.json') as Placement[];
    for (const p of data) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(144);
      expect(p.y).toBeGreaterThanOrEqual(16);
      expect(p.y).toBeLessThanOrEqual(152);
    }
  });

  it('handles empty placements array gracefully', () => {
    render(<BoardMap placements={[]} />);
    expect(screen.getByTestId('board-map')).toBeInTheDocument();
  });

  it('renders with size="full" by default', () => {
    render(<BoardMap placements={SAMPLE} />);
    // Full size renders img tags
    expect(screen.getAllByRole('img').length).toBeGreaterThan(0);
  });
});
