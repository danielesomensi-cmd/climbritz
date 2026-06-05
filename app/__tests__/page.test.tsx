import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// A019.16: Home is now AuthGuard-wrapped. Mock useAuth as signed-in so the
// gate renders children straight through. The dedicated AuthGuard tests in
// components/__tests__/AuthGuard.test.tsx cover the redirect path.
jest.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true }),
  // B032: homepage now renders Clerk's <UserButton> as the account /
  // sign-out entry point. Stub it so the component tree renders without a
  // ClerkProvider in jsdom.
  UserButton: () => <div data-testid="user-button" />,
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  usePathname: () => '/',
}));

import Home from '../page';

describe('Home Page', () => {
  it('renders the CLIMBRITZ heading', () => {
    render(<Home />);
    expect(screen.getByText('CLIMBRITZ')).toBeInTheDocument();
  });

  it('renders the subtitle', () => {
    render(<Home />);
    expect(screen.getByText('AI Climbing Companion')).toBeInTheDocument();
  });

  it('renders the five product tiles', () => {
    render(<Home />);
    expect(screen.getByText('Demo LED Light')).toBeInTheDocument();
    expect(screen.getByText('Discover')).toBeInTheDocument();
    expect(screen.getByText('Classify')).toBeInTheDocument();
    expect(screen.getByText('Video Analysis')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
  });

  // A026 — new top tile: AI problem generator.
  it('renders the Create with AI tile pointing at /generate', () => {
    render(<Home />);
    const link = screen.getByText('Create with AI').closest('a');
    expect(link).toHaveAttribute('href', '/generate');
    expect(screen.getByText('Generate a problem')).toBeInTheDocument();
  });

  // A027 — Contact tile opens the native mail composer via mailto: (no backend).
  it('renders the Contact tile with a mailto: href (correct to + subject)', () => {
    render(<Home />);
    const link = screen.getByTestId('tile-contact');
    expect(link).toHaveTextContent('Contact');
    expect(link).toHaveTextContent('Send feedback');
    const href = link.getAttribute('href') ?? '';
    expect(href.startsWith('mailto:daniele.somensi@gmail.com')).toBe(true);
    expect(href).toContain('subject=Climbritz%20feedback');
  });

  it('renders tile subtitles', () => {
    render(<Home />);
    expect(screen.getByText('Test BLE connection')).toBeInTheDocument();
    expect(screen.getByText('Search & light up climbs')).toBeInTheDocument();
    expect(screen.getByText('Tag hold grip types')).toBeInTheDocument();
    expect(screen.getByText('AI technique coaching')).toBeInTheDocument();
    expect(screen.getByText('Sessions, pyramid, trend')).toBeInTheDocument();
  });

  // A021 follow-up — Debug tile is dev-only. In jest (NODE_ENV='test')
  // the production guard is false, so Debug renders. The corresponding
  // production-hide behaviour is exercised by `npm run build:mobile` →
  // visual check on Vercel preview, not a unit test.
  it('renders Debug tile in dev/test environment', () => {
    render(<Home />);
    expect(screen.getByText('Debug')).toBeInTheDocument();
  });

  // B021 (2026-05-19): Coach tier not production-ready; the Video Analysis
  // tile carries a COMING SOON pill instead of the previous 🔒 lock. Tile
  // stays clickable so /upload remains URL-reachable for power users.
  it('shows COMING SOON badge on Video Analysis tile', () => {
    render(<Home />);
    const badge = screen.getByTestId('tile-video-analysis-coming-soon');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent(/coming soon/i);
  });

  it('Video Analysis tile remains clickable and points at /upload', () => {
    render(<Home />);
    const videoLink = screen.getByText('Video Analysis').closest('a');
    expect(videoLink).toHaveAttribute('href', '/upload');
  });
});
