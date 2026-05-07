import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const replaceMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: jest.fn() }),
}));

const mockUseAuth = jest.fn();
jest.mock('@clerk/clerk-react', () => ({
  useAuth: () => mockUseAuth(),
}));

import AuthGuard from '../AuthGuard';

describe('AuthGuard (A019)', () => {
  beforeEach(() => {
    replaceMock.mockClear();
    mockUseAuth.mockReset();
  });

  it('renders a spinner while Clerk is loading', () => {
    mockUseAuth.mockReturnValue({ isLoaded: false, isSignedIn: false });
    render(
      <AuthGuard>
        <div data-testid="protected">secret</div>
      </AuthGuard>,
    );
    expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('redirects to /sign-in when loaded but not signed in', async () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: false });
    render(
      <AuthGuard>
        <div data-testid="protected">secret</div>
      </AuthGuard>,
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/sign-in');
    });
    expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
  });

  it('renders children when signed in', () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: true });
    render(
      <AuthGuard>
        <div data-testid="protected">secret</div>
      </AuthGuard>,
    );
    expect(screen.getByTestId('protected')).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
