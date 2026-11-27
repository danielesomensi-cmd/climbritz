// B-AUTH-PERSIST — remember the last email used on this device so /sign-in can
// prefill it. Only the email address is stored; the password is never kept by
// the app (that is the OS password manager's job).
//
// Lives in localStorage on purpose: a normal sign-out keeps it (that is the
// point), while Delete account wipes it with the rest of web storage
// (`localStorage.clear()` in app/settings/page.tsx).

export const LAST_EMAIL_KEY = 'climbritz:auth:last-email';

/** Last email signed in on this device, or `undefined`. Never throws. */
export function getLastEmail(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const value = window.localStorage.getItem(LAST_EMAIL_KEY)?.trim();
    return value ? value : undefined;
  } catch {
    // Private mode / storage disabled — just don't prefill.
    return undefined;
  }
}

/** Store the email of the signed-in user. Blank values are ignored. Never throws. */
export function saveLastEmail(email: string | null | undefined): void {
  if (typeof window === 'undefined') return;
  const value = email?.trim();
  if (!value) return;
  try {
    window.localStorage.setItem(LAST_EMAIL_KEY, value);
  } catch {
    // Storage full / disabled — prefill is a nicety, never block sign-in.
  }
}
