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
  { placement_id: 1001, role: 'start', x: 0, y: 152 },
  { placement_id: 1002, role: 'middle', x: 8, y: 144 },
  { placement_id: 1003, role: 'finish', x: 16, y: 136 },
];

describe('ClimbBoardView', () => {
  it('renders the BoardMap wrapper', () => {
    render(<ClimbBoardView holds={HOLDS} />);
    expect(screen.getByTestId('climb-board-view')).toBeInTheDocument();
    expect(screen.getByTestId('board-map')).toBeInTheDocument();
  });

  it('applies role colors to active holds', () => {
    render(<ClimbBoardView holds={HOLDS} />);
    // BoardMap puts holdColors on the inline background-color.
    const start = screen.getByTestId('hold-1001');
    const middle = screen.getByTestId('hold-1002');
    const finish = screen.getByTestId('hold-1003');
    expect(start).toHaveStyle({ backgroundColor: ROLE_COLORS.start });
    expect(middle).toHaveStyle({ backgroundColor: ROLE_COLORS.middle });
    expect(finish).toHaveStyle({ backgroundColor: ROLE_COLORS.finish });
  });

  it('leaves inactive holds uncolored (base gray look)', () => {
    render(<ClimbBoardView holds={HOLDS} />);
    const inactive = screen.getByTestId('hold-1004');
    // No inline backgroundColor means BoardMap's base style applies
    expect(inactive.style.backgroundColor).toBe('');
  });

  it('silently ignores unknown roles', () => {
    const mixed: HoldPosition[] = [
      { placement_id: 1001, role: 'weird_role', x: 0, y: 152 },
    ];
    render(<ClimbBoardView holds={mixed} />);
    const hold = screen.getByTestId('hold-1001');
    expect(hold.style.backgroundColor).toBe('');
  });
});
