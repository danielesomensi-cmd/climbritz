import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import BottomNav from '../BottomNav';

let mockPath = '/';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPath,
}));

describe('BottomNav', () => {
  it('renders all four nav items (Home / Discover / History / Videos)', () => {
    mockPath = '/';
    render(<BottomNav />);
    expect(screen.getByTestId('nav-home')).toBeInTheDocument();
    expect(screen.getByTestId('nav-discover')).toBeInTheDocument();
    expect(screen.getByTestId('nav-history')).toBeInTheDocument();
    expect(screen.getByTestId('nav-videos')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-profile')).not.toBeInTheDocument();
    expect(screen.getByTestId('nav-videos')).toHaveTextContent('Videos');
  });

  // B021: Coach slot removed pending Coach tier production readiness.
  it('does not render the Coach nav slot', () => {
    mockPath = '/';
    render(<BottomNav />);
    expect(screen.queryByTestId('nav-coach')).not.toBeInTheDocument();
  });

  it('renders exactly 4 nav items', () => {
    mockPath = '/';
    const { container } = render(<BottomNav />);
    const links = container.querySelectorAll('[data-testid^="nav-"]');
    expect(links).toHaveLength(4);
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

  // UX-002 / QW8
  it('marks only the active tab with aria-current="page" and the indicator bar', () => {
    mockPath = '/history';
    render(<BottomNav />);
    expect(screen.getByTestId('nav-history')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('nav-home')).not.toHaveAttribute('aria-current');
    expect(screen.getAllByTestId('bottom-nav-active-indicator')).toHaveLength(1);
  });

  it('marks the videos tab active on /dashboard, /videos/* and /upload', () => {
    for (const path of ['/dashboard', '/videos/detail', '/upload']) {
      mockPath = path;
      const { unmount } = render(<BottomNav />);
      expect(screen.getByTestId('nav-videos')).toHaveAttribute('aria-current', 'page');
      expect(screen.getByTestId('nav-videos').className).toMatch(/text-orange-400/);
      unmount();
    }
  });

  it('gives every tab a >=44pt tap target', () => {
    mockPath = '/';
    const { container } = render(<BottomNav />);
    container.querySelectorAll('a[data-testid^="nav-"]').forEach((el) => {
      expect(el.className).toMatch(/min-h-\[52px\]/);
    });
  });
});
