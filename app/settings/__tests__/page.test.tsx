import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/settings',
}));

jest.mock('@/app/lib/api', () => {
  const actual = jest.requireActual('@/app/lib/api');
  return { ...actual, deleteAccount: jest.fn() };
});

jest.mock('@/components/BottomNav', () => ({
  __esModule: true,
  default: () => <nav data-testid="mock-bottomnav" />,
}));

import SettingsPage from '../page';
import { deleteAccount } from '@/app/lib/api';

const deleteMock = deleteAccount as jest.MockedFunction<typeof deleteAccount>;

const signOutMock = jest.fn().mockResolvedValue(undefined);

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem('climbritz:discover:filters', '{"angle":40}');
  sessionStorage.setItem('climbritz:create:draft', '{"frames":"x"}');
  (window as unknown as { Clerk?: unknown }).Clerk = { signOut: signOutMock };
  // jsdom refuses a real navigation; swap in a settable stub so the
  // component's hard redirect is observable.
  delete (window as unknown as { location?: unknown }).location;
  (window as unknown as { location: { href: string } }).location = { href: '' };
});

/** Render and get past the first (non-destructive) tap. */
function openModal() {
  render(<SettingsPage />);
  fireEvent.click(screen.getByTestId('delete-account-button'));
}

function typeConfirm(value: string) {
  fireEvent.change(screen.getByTestId('delete-confirm-input'), {
    target: { value },
  });
}

describe('Settings — account deletion (Guideline 5.1.1(v))', () => {
  it('labels the action plainly as "Delete account"', () => {
    render(<SettingsPage />);
    expect(screen.getByTestId('delete-account-button')).toHaveTextContent(
      'Delete account',
    );
  });

  it('does not delete on the first tap — it opens a confirm step', () => {
    openModal();
    expect(screen.getByTestId('delete-account-modal')).toBeInTheDocument();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('spells out exactly what is destroyed and that it is permanent', () => {
    openModal();
    const modal = screen.getByTestId('delete-account-modal');
    expect(modal).toHaveTextContent(/logged climbs/i);
    expect(modal).toHaveTextContent(/hold classifications/i);
    expect(modal).toHaveTextContent(/generated problems/i);
    expect(modal).toHaveTextContent(/videos/i);
    expect(modal).toHaveTextContent(/cannot be recovered/i);
  });

  it('keeps confirm disabled until DELETE is typed exactly', () => {
    openModal();
    const confirm = screen.getByTestId('delete-confirm-button');
    expect(confirm).toBeDisabled();

    typeConfirm('delet');
    expect(confirm).toBeDisabled();

    typeConfirm('DELETE');
    expect(confirm).toBeEnabled();
  });

  it('clears web storage, signs out and hard-redirects on success', async () => {
    deleteMock.mockResolvedValue(undefined);
    openModal();

    typeConfirm('DELETE');
    fireEvent.click(screen.getByTestId('delete-confirm-button'));

    await waitFor(() => expect(deleteMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(window.location.href).toBe('/sign-in'));

    expect(signOutMock).toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('surfaces the error and keeps the user signed in on failure', async () => {
    deleteMock.mockRejectedValue(new Error('Server unreachable'));
    openModal();

    typeConfirm('DELETE');
    fireEvent.click(screen.getByTestId('delete-confirm-button'));

    const err = await screen.findByTestId('delete-account-error');
    expect(err).toHaveTextContent('Server unreachable');
    // No silent failure: still on the page, not redirected, not signed out.
    expect(window.location.href).toBe('');
    expect(signOutMock).not.toHaveBeenCalled();
    // Local caches survive — the account still exists.
    expect(localStorage.length).toBeGreaterThan(0);
  });

  it('lets the user back out via Cancel', () => {
    openModal();
    fireEvent.click(screen.getByTestId('delete-cancel-button'));
    expect(screen.queryByTestId('delete-account-modal')).not.toBeInTheDocument();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('links to the privacy policy', () => {
    render(<SettingsPage />);
    expect(screen.getByTestId('settings-privacy-link')).toHaveAttribute(
      'href',
      '/privacy',
    );
  });
});
