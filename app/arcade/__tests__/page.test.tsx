import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ArcadePage from '../page';

// ARCADE-001 — /arcade embeds the bundled Deadpoint mini-game.
describe('ArcadePage', () => {
  it('renders the game iframe with the English, embedded src', () => {
    render(<ArcadePage />);
    const frame = screen.getByTitle('Deadpoint mini-game');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame).toHaveAttribute('src', '/arcade/deadpoint.html?lang=en&embed=1');
    expect(frame).toHaveAttribute('allow', 'autoplay; fullscreen');
  });

  it('has an SPA back link to Home and the Deadpoint title', () => {
    render(<ArcadePage />);
    const back = screen.getByTestId('arcade-back');
    expect(back).toHaveAttribute('href', '/');
    expect(back).toHaveAttribute('aria-label', 'Back to Home');
    expect(screen.getByRole('heading', { name: 'Deadpoint' })).toBeInTheDocument();
  });

  it('gives the game the whole screen: no BottomNav, safe-area aware', () => {
    render(<ArcadePage />);
    expect(screen.queryByTestId('bottom-nav')).not.toBeInTheDocument();
    expect(screen.getByTestId('arcade-page')).toHaveClass('pb-safe');
  });
});
