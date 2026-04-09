import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ClimbBoardView, { ROLE_COLORS } from '../ClimbBoardView';
import type { HoldPosition } from '@/app/lib/api';

// Mock the full placements set so the test is fast and deterministic.
jest.mock('@/app/data/placements_12x12.json', () => [
  { placement_id: 1001, hole_id: 2001, x: 0,  y: 152, hole_name: '0,152', default_role: 'middle', set_name: 'Bolt Ons', set_id: 1, role_id: 13 },
  { placement_id: 1002, hole_id: 2002, x: 8,  y: 144, hole_name: '1,144', default_role: 'start',  set_name: 'Bolt Ons', set_id: 1, role_id: 12 },
  { placement_id: 1003, hole_id: 2003, x: 16, y: 136, hole_name: '2,136', default_role: 'finish', set_name: 'Bolt Ons', set_id: 1, role_id: 14 },
  { placement_id: 1004, hole_id: 2004, x: 24, y: 128, hole_name: '3,128', default_role: 'middle', set_name: 'Bolt Ons', set_id: 1, role_id: 13 },
]);

const HOLDS: HoldPosition[] = [
  { placement_id: 1001, role: 'start', x: 0, y: 152, set_id: 1 },
  { placement_id: 1002, role: 'middle', x: 8, y: 144, set_id: 1 },
  { placement_id: 1003, role: 'finish', x: 16, y: 136, set_id: 1 },
];

describe('ClimbBoardView', () => {
  it('renders the BoardMap wrapper', () => {
    render(<ClimbBoardView holds={HOLDS} />);
    expect(screen.getByTestId('climb-board-view')).toBeInTheDocument();
    expect(screen.getByTestId('board-map')).toBeInTheDocument();
  });

  it('draws active holds as hollow colored rings (border, not fill)', () => {
    render(<ClimbBoardView holds={HOLDS} />);
    const start = screen.getByTestId('hold-1001') as HTMLElement;
    const middle = screen.getByTestId('hold-1002') as HTMLElement;
    const finish = screen.getByTestId('hold-1003') as HTMLElement;
    // B016: hollow rings — borderColor carries the role color, no solid fill.
    expect(start.style.borderColor).toBe(ROLE_COLORS.start);
    expect(middle.style.borderColor).toBe(ROLE_COLORS.middle);
    expect(finish.style.borderColor).toBe(ROLE_COLORS.finish);
    // And the fill is transparent (class-based), not a solid color.
    expect(start.style.backgroundColor).toBe('');
    expect(start.className).toMatch(/bg-transparent/);
  });

  it('leaves inactive holds uncolored (base gray look)', () => {
    render(<ClimbBoardView holds={HOLDS} />);
    const inactive = screen.getByTestId('hold-1004');
    // No inline borderColor means BoardMap's base class applies
    expect(inactive.style.borderColor).toBe('');
  });

  it('silently ignores unknown roles', () => {
    const mixed: HoldPosition[] = [
      { placement_id: 1001, role: 'weird_role', x: 0, y: 152, set_id: 1 },
    ];
    render(<ClimbBoardView holds={mixed} />);
    const hold = screen.getByTestId('hold-1001');
    expect(hold.style.borderColor).toBe('');
  });
});
