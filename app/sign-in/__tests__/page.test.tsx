import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

const signInProps = jest.fn();
jest.mock('@clerk/clerk-react', () => ({
  SignIn: (props: Record<string, unknown>) => {
    signInProps(props);
    return <div data-testid="clerk-sign-in" />;
  },
}));

import SignInPage from '../page';
import { LAST_EMAIL_KEY } from '@/lib/auth/last-email';

describe('Sign-in page — remember email (B-AUTH-PERSIST)', () => {
  beforeEach(() => {
    localStorage.clear();
    signInProps.mockClear();
  });

  it('prefills the last email used on this device', () => {
    localStorage.setItem(LAST_EMAIL_KEY, 'climber@example.com');
    render(<SignInPage />);
    expect(screen.getByTestId('clerk-sign-in')).toBeInTheDocument();
    // A returning user does not need the "create an account" nudge.
    expect(screen.queryByRole('link', { name: 'Create an account' })).toBeNull();
    // Clerk reads initialValues only at mount — it must never mount without it.
    for (const [props] of signInProps.mock.calls) {
      expect(props.initialValues).toEqual({ emailAddress: 'climber@example.com' });
    }
  });

  it('renders an empty form on a device with no remembered email', () => {
    render(<SignInPage />);
    expect(screen.getByTestId('clerk-sign-in')).toBeInTheDocument();
    expect(signInProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ initialValues: undefined, routing: 'hash' }),
    );
  });

  it('offers a clear way to register on a device with no remembered email', () => {
    render(<SignInPage />);
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/sign-up',
    );
  });
});
