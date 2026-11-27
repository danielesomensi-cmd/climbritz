import { render } from '@testing-library/react';

const mockUseUser = jest.fn();
jest.mock('@clerk/clerk-react', () => ({
  useUser: () => mockUseUser(),
}));

import RememberEmail from '../RememberEmail';
import { LAST_EMAIL_KEY } from '@/lib/auth/last-email';

describe('RememberEmail (B-AUTH-PERSIST)', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUseUser.mockReset();
  });

  it('stores the primary email once the user is signed in', () => {
    mockUseUser.mockReturnValue({
      isSignedIn: true,
      user: { primaryEmailAddress: { emailAddress: 'climber@example.com' } },
    });
    render(<RememberEmail />);
    expect(localStorage.getItem(LAST_EMAIL_KEY)).toBe('climber@example.com');
  });

  it('stores nothing while signed out', () => {
    mockUseUser.mockReturnValue({ isSignedIn: false, user: null });
    render(<RememberEmail />);
    expect(localStorage.getItem(LAST_EMAIL_KEY)).toBeNull();
  });

  it('keeps the remembered email across a sign-out', () => {
    mockUseUser.mockReturnValue({
      isSignedIn: true,
      user: { primaryEmailAddress: { emailAddress: 'climber@example.com' } },
    });
    const { rerender } = render(<RememberEmail />);
    mockUseUser.mockReturnValue({ isSignedIn: false, user: null });
    rerender(<RememberEmail />);
    expect(localStorage.getItem(LAST_EMAIL_KEY)).toBe('climber@example.com');
  });
});
