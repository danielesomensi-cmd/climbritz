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

  // A026 — top tile: AI problem generator. A031 renamed it "AI Create".
  it('renders the AI Create tile pointing at /generate', () => {
    render(<Home />);
    const link = screen.getByText('AI Create').closest('a');
    expect(link).toHaveAttribute('href', '/generate');
    expect(screen.getByText('Generate a problem')).toBeInTheDocument();
  });

  // B034 v4 — the hero's top safe-area padding MUST come from an inline style,
  // NEVER a Tailwind `pt-*` utility. globals.css has an unlayered
  // `* { padding: 0 }` reset that beats `@layer utilities` in the CSS cascade,
  // so ANY pt-* class computes to padding-top:0 → the wordmark clips behind the
  // iOS Dynamic Island regardless of --safe-top. Do NOT "simplify" the inline
  // style back into a className — it silently re-breaks iOS.
  // (jsdom's CSSOM rejects the inline `calc(var(--safe-top) + 2.5rem)` value, so
  // we can't read it back; instead we assert no pt-* utility is present — the
  // exact regression — on the verified-correct hero element.)
  it('keeps the hero top safe-area padding off Tailwind pt-* utilities (B034 v4)', () => {
    render(<Home />);
    const hero = screen.getByText('CLIMBRITZ').parentElement as HTMLElement;
    // Sanity: this is the hero (carries the gradient bg), not some other wrapper.
    expect(hero.className).toMatch(/var\(--hero-gradient\)/);
    // The regression guard: top padding must not be a utility class.
    expect(hero.className).not.toMatch(/\bpt-/);
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

  // A-STORE-PROD-001 Phase 2 — inverted from the B021 assertion. Coach L1
  // analysis is live, so the COMING SOON pill was factually wrong and a
  // placeholder in a shipping build trips App Store Guideline 2.1.
  it('shows no COMING SOON placeholder anywhere on the home screen', () => {
    render(<Home />);
    expect(
      screen.queryByTestId('tile-video-analysis-coming-soon'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
  });

  it('Video Analysis tile is an active link to /upload', () => {
    render(<Home />);
    const videoLink = screen.getByText('Video Analysis').closest('a');
    expect(videoLink).toHaveAttribute('href', '/upload');
  });

  // Guideline 5.1.1(v): App Review must reach account deletion quickly. The
  // gear is a sibling of the avatar, not an item inside its popover menu.
  it('exposes a Settings entry point one tap from the home screen', () => {
    render(<Home />);
    const gear = screen.getByTestId('home-settings-link');
    expect(gear).toHaveAttribute('href', '/settings');
    expect(gear).toHaveAccessibleName('Settings');
  });
});
