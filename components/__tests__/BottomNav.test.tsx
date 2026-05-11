import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import BottomNav from '../BottomNav';

let mockPath = '/';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPath,
}));

describe('BottomNav', () => {
  it('renders all five nav items (Home / Discover / History / Coach / Profile)', () => {
    mockPath = '/';
    render(<BottomNav />);
    expect(screen.getByTestId('nav-home')).toBeInTheDocument();
    expect(screen.getByTestId('nav-discover')).toBeInTheDocument();
    expect(screen.getByTestId('nav-history')).toBeInTheDocument();
    expect(screen.getByTestId('nav-coach')).toBeInTheDocument();
    expect(screen.getByTestId('nav-profile')).toBeInTheDocument();
  });

  it('marks the home tab active on /', () => {
    mockPath = '/';
    render(<BottomNav />);
    expect(screen.getByTestId('nav-home').className).toMatch(/text-orange-400/);
    expect(screen.getByTestId('nav-discover').className).not.toMatch(/text-orange-400/);
  });

  it('marks the discover tab active on /discover and nested routes', () => {
    mockPath = '/discover/abc-123';
    render(<BottomNav />);
    expect(screen.getByTestId('nav-discover').className).toMatch(/text-orange-400/);
    expect(screen.getByTestId('nav-home').className).not.toMatch(/text-orange-400/);
  });

  // A021 follow-up
  it('marks the history tab active on /history', () => {
    mockPath = '/history';
    render(<BottomNav />);
    expect(screen.getByTestId('nav-history').className).toMatch(/text-orange-400/);
    expect(screen.getByTestId('nav-home').className).not.toMatch(/text-orange-400/);
    expect(screen.getByTestId('nav-discover').className).not.toMatch(/text-orange-400/);
  });
});
