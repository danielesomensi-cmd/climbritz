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

describe('Settings — Sounds toggle (NATIVE-001)', () => {
  it('is off by default', () => {
    render(<SettingsPage />);
    expect(screen.getByTestId('settings-sound-toggle')).toHaveAttribute('aria-checked', 'false');
  });

  it('persists the choice per device and reflects it on next render', () => {
    const { unmount } = render(<SettingsPage />);
    fireEvent.click(screen.getByTestId('settings-sound-toggle'));
    expect(screen.getByTestId('settings-sound-toggle')).toHaveAttribute('aria-checked', 'true');
    expect(localStorage.getItem('climbritz.sound.enabled')).toBe('1');
    unmount();
    render(<SettingsPage />);
    expect(screen.getByTestId('settings-sound-toggle')).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByTestId('settings-sound-toggle'));
    expect(localStorage.getItem('climbritz.sound.enabled')).toBeNull();
  });
});

describe('Settings — Invite a friend (A032)', () => {
  const realClipboard = navigator.clipboard;

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: realClipboard,
      configurable: true,
    });
  });

  function mockClipboard(writeText: jest.Mock) {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
  }

  it('renders the invite section with the static QR asset', () => {
    render(<SettingsPage />);
    const section = screen.getByTestId('settings-invite');
    expect(section).toHaveTextContent('Invite a friend');
    expect(section).toHaveTextContent('Scan with your phone camera to get Climbritz.');
    const qr = screen.getByAltText('QR code to get Climbritz');
    expect(qr.tagName).toBe('IMG');
    expect(qr).toHaveAttribute('src', '/invite/get-qr.svg');
    expect(screen.getByTestId('settings-invite-link')).toHaveTextContent('climbritz.app/get');
  });

  it('sits above the Account section', () => {
    render(<SettingsPage />);
    const invite = screen.getByTestId('settings-invite');
    const del = screen.getByTestId('delete-account-button');
    expect(
      invite.compareDocumentPosition(del) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('keeps the copy store-neutral (Guideline 2.2)', () => {
    render(<SettingsPage />);
    expect(screen.getByTestId('settings-invite').textContent).not.toMatch(
      /beta|testflight|testing/i,
    );
  });

  it('copies the full invite URL and confirms inline', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);
    render(<SettingsPage />);
    fireEvent.click(screen.getByTestId('settings-invite-copy'));
    expect(writeText).toHaveBeenCalledWith('https://climbritz.app/get');
    await waitFor(() =>
      expect(screen.getByTestId('settings-invite-copy')).toHaveTextContent('Copied'),
    );
  });

  it('selects the link text when the clipboard is unavailable', async () => {
    mockClipboard(jest.fn().mockRejectedValue(new Error('denied')));
    render(<SettingsPage />);
    fireEvent.click(screen.getByTestId('settings-invite-copy'));
    await waitFor(() => expect(window.getSelection()?.toString()).toBe('climbritz.app/get'));
    expect(screen.getByTestId('settings-invite-copy')).toHaveTextContent('Copy link');
  });

  it('hides Share where the Web Share API is missing (Android WebView)', () => {
    render(<SettingsPage />);
    expect(screen.queryByTestId('settings-invite-share')).not.toBeInTheDocument();
    expect(screen.getByTestId('settings-invite-copy')).toBeInTheDocument();
  });

  it('opens the native share sheet with the invite URL when available', async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    try {
      render(<SettingsPage />);
      fireEvent.click(await screen.findByTestId('settings-invite-share'));
      await waitFor(() =>
        expect(share).toHaveBeenCalledWith(
          expect.objectContaining({ url: 'https://climbritz.app/get' }),
        ),
      );
    } finally {
      delete (navigator as unknown as { share?: unknown }).share;
    }
  });

  it('swallows a dismissed share sheet', async () => {
    const share = jest.fn().mockRejectedValue(new DOMException('x', 'AbortError'));
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    try {
      render(<SettingsPage />);
      fireEvent.click(await screen.findByTestId('settings-invite-share'));
      await waitFor(() => expect(share).toHaveBeenCalled());
      expect(screen.getByTestId('settings-invite')).toBeInTheDocument();
    } finally {
      delete (navigator as unknown as { share?: unknown }).share;
    }
  });
});
