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

  it('renders all holds from the 12x12-with-kickboard real data', async () => {
    const data = await import('@/app/data/placements_12x12.json');
    const placements = data.default as Placement[];
    render(<BoardMap placements={placements} />);
    expect(screen.getByTestId('board-map')).toBeInTheDocument();
    const holdElements = placements.map((p) => screen.getByTestId(`hold-${p.placement_id}`));
    // B016: 514 total = 361 bolt-ons + 153 screw-ons (product_size 10)
    expect(holdElements).toHaveLength(514);
    const boltOns = placements.filter((p) => p.set_id === 1);
    const screwOns = placements.filter((p) => p.set_id === 20);
    expect(boltOns).toHaveLength(361);
    expect(screwOns).toHaveLength(153);
  });

  it('highlights the specified hold', () => {
    render(<BoardMap placements={SAMPLE} highlightId={1003} />);
    const highlighted = screen.getByTestId('hold-1003');
    expect(highlighted.className).toMatch(/ring-yellow-300/);
  });

  it('does not highlight other holds', () => {
    render(<BoardMap placements={SAMPLE} highlightId={1003} />);
    const other = screen.getByTestId('hold-1001');
    expect(other.className).not.toMatch(/ring-yellow-300/);
  });

  it('renders a single composite board background image', () => {
    render(<BoardMap placements={SAMPLE} size="full" />);
    const imgs = screen.getAllByRole('img');
    // Only the composite board background — no per-hold thumbnails
    expect(imgs.length).toBe(1);
    expect((imgs[0] as HTMLImageElement).src).toContain('/holds/board_original_12x12.png');
  });

  it('renders the composite background in mini mode as well', () => {
    render(<BoardMap placements={SAMPLE} size="mini" />);
    const imgs = screen.getAllByRole('img');
    expect(imgs.length).toBe(1);
    expect((imgs[0] as HTMLImageElement).src).toContain('/holds/board_original_12x12.png');
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
      // B016: with kickboard → y∈[0,156]
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(156);
    }
  });

  it('draws screw-on footholds smaller than bolt-on handholds', () => {
    const bolt: Placement = {
      placement_id: 2001,
      hole_id: 3001,
      x: 40,
      y: 80,
      hole_name: 'bolt',
      default_role: 'middle',
      set_name: 'Bolt Ons',
      set_id: 1,
      role_id: 13,
    };
    const screw: Placement = {
      placement_id: 2002,
      hole_id: 3002,
      x: 60,
      y: 80,
      hole_name: 'screw',
      default_role: 'foot',
      set_name: 'Screw Ons',
      set_id: 20,
      role_id: 15,
    };
    render(<BoardMap placements={[bolt, screw]} />);
    const boltEl = screen.getByTestId('hold-2001');
    const screwEl = screen.getByTestId('hold-2002');
    const boltWidth = parseFloat((boltEl as HTMLElement).style.width);
    const screwWidth = parseFloat((screwEl as HTMLElement).style.width);
    expect(screwWidth).toBeLessThan(boltWidth);
  });

  it('handles empty placements array gracefully', () => {
    render(<BoardMap placements={[]} />);
    expect(screen.getByTestId('board-map')).toBeInTheDocument();
  });

  it('renders with size="full" by default', () => {
    render(<BoardMap placements={SAMPLE} />);
    // Default (full) renders the composite background
    expect(screen.getAllByRole('img').length).toBe(1);
  });
});
