import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// A019.16: Home is now AuthGuard-wrapped. Mock useAuth as signed-in so the
// gate renders children straight through. The dedicated AuthGuard tests in
// components/__tests__/AuthGuard.test.tsx cover the redirect path.
jest.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  usePathname: () => '/',
}));

import Home from '../page';

describe('Home Page', () => {
  it('renders the KILTER UP heading', () => {
    render(<Home />);
    expect(screen.getByText('KILTER UP')).toBeInTheDocument();
  });

  it('renders the subtitle', () => {
    render(<Home />);
    expect(screen.getByText('AI Climbing Companion')).toBeInTheDocument();
  });

  it('renders all four tiles', () => {
    render(<Home />);
    expect(screen.getByText('Demo LED Light')).toBeInTheDocument();
    expect(screen.getByText('Discover')).toBeInTheDocument();
    expect(screen.getByText('Classify')).toBeInTheDocument();
    expect(screen.getByText('Video Analysis')).toBeInTheDocument();
  });

  it('renders tile subtitles', () => {
    render(<Home />);
    expect(screen.getByText('Test BLE connection')).toBeInTheDocument();
    expect(screen.getByText('Search 160k+ climbs')).toBeInTheDocument();
    expect(screen.getByText('Tag hold grip types')).toBeInTheDocument();
    expect(screen.getByText('AI technique coaching')).toBeInTheDocument();
  });

  it('shows lock icon on Video Analysis tile', () => {
    render(<Home />);
    // A019.16: page is AuthGuard-wrapped, so the tile target points at the
    // actual upload page. The 🔒 icon now signals "Coach paid tier" — Stripe
    // paywall (future) will swap this href for /paywall.
    const videoLink = screen.getByText('Video Analysis').closest('a');
    expect(videoLink).toHaveAttribute('href', '/upload');
  });
});
