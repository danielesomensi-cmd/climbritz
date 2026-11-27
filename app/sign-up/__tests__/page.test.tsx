import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@clerk/clerk-react', () => ({
  SignUp: () => <div data-testid="clerk-sign-up" />,
}));

import SignUpPage from '../page';

describe('Sign-up page', () => {
  it('renders the Clerk widget with the password rules stated up front', () => {
    render(<SignUpPage />);
    expect(screen.getByTestId('clerk-sign-up')).toBeInTheDocument();
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/common passwords/i)).toBeInTheDocument();
    expect(screen.getByText(/6-digit code/i)).toBeInTheDocument();
  });
});
