'use client';

// A-STORE-PROD-001 Phase 2 — Settings, and specifically account deletion.
//
// App Store Guideline 5.1.1(v) requires an app that supports account creation
// to support account deletion from inside the app. App Review actively looks
// for it: a hidden entry point is treated as an absent one, and "we couldn't
// find it" is indistinguishable from "it isn't there" in a rejection notice.
// So this is a real route with a plain `Delete account` label, one tap from
// the home screen via the gear icon (not an item buried in the avatar popover).
//
// Capacitor-safe: static route (no dynamic segment), SPA nav, no next/image.

import { useState } from 'react';
import Link from 'next/link';
import { deleteAccount } from '@/app/lib/api';
import AuthGuard from '@/components/AuthGuard';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';

const CONFIRM_WORD = 'DELETE';

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsPageInner />
    </AuthGuard>
  );
}

function SettingsPageInner() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canConfirm = typed.trim().toUpperCase() === CONFIRM_WORD && !deleting;

  function closeModal() {
    if (deleting) return; // never let a tap dismiss an in-flight delete
    setConfirmOpen(false);
    setTyped('');
    setError(null);
  }

  async function handleDelete() {
    if (!canConfirm) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount();

      // Order matters: the account is already gone server-side, so clear
      // every local trace before handing off to Clerk. Board filters, the
      // generate draft and the classification cache all live in web storage
      // and would otherwise greet the next user of this device.
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        // Private mode / storage disabled — nothing cached to leak anyway.
      }

      // Hard redirect, not router.push: after signOut the React tree still
      // holds state for a user that no longer exists, and a SPA transition
      // would let AuthGuard race the sign-out. A full navigation guarantees
      // a clean boot at /sign-in.
      try {
        await window.Clerk?.signOut?.();
      } catch {
        // Clerk already invalidated the session server-side — proceed.
      }
      window.location.href = '/sign-in';
    } catch (e) {
      setDeleting(false);
      setError(
        e instanceof Error
          ? e.message
          : 'Could not delete your account. Please try again.',
      );
    }
  }

  return (
    <div className="min-h-screen bg-surface-base pb-nav">
      <PageHeader title="Settings" back={{ href: '/', label: 'Home' }} />

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-tertiary">
            About
          </h2>
          <ul className="mt-3 divide-y divide-border-default rounded-card border border-border-default">
            <li>
              <Link
                href="/privacy"
                data-testid="settings-privacy-link"
                className="flex items-center justify-between px-4 py-4 text-text-primary hover:bg-surface-overlay"
              >
                Privacy policy
                <span aria-hidden className="text-text-tertiary">
                  ›
                </span>
              </Link>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-tertiary">
            Account
          </h2>
          <div className="mt-3 rounded-card border border-feedback-error/40 p-4">
            <p className="text-sm text-text-secondary">
              Deleting your account permanently removes your climbs, logs, hold
              classifications, generated problems and video analyses. This
              cannot be undone.
            </p>
            <Button
              variant="destructive"
              className="mt-4 w-full"
              data-testid="delete-account-button"
              onClick={() => setConfirmOpen(true)}
            >
              Delete account
            </Button>
          </div>
        </section>
      </main>

      {confirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
          data-testid="delete-account-modal"
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-sm rounded-card border border-border-strong bg-surface-base p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="delete-account-title"
              className="font-display text-page-title text-text-primary"
            >
              Delete account?
            </h2>
            <p className="mt-3 text-sm text-text-secondary">
              This permanently deletes:
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-text-secondary space-y-1">
              <li>your logged climbs and attempt history</li>
              <li>your hold classifications</li>
              <li>your saved generated problems</li>
              <li>your uploaded videos and their analyses</li>
            </ul>
            <p className="mt-3 text-sm text-text-secondary">
              Your data cannot be recovered afterwards.
            </p>

            <label
              htmlFor="delete-confirm-input"
              className="mt-4 block text-sm text-text-secondary"
            >
              Type <span className="font-bold text-text-primary">{CONFIRM_WORD}</span>{' '}
              to confirm:
            </label>
            <input
              id="delete-confirm-input"
              data-testid="delete-confirm-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={deleting}
              autoComplete="off"
              autoCapitalize="characters"
              className="mt-2 w-full min-h-[48px] rounded-card border border-border-strong bg-surface-overlay px-3 text-base text-text-primary focus:border-orange-500 focus:outline-none"
            />

            {error && (
              <p
                data-testid="delete-account-error"
                role="alert"
                className="mt-3 text-sm text-feedback-error"
              >
                {error}
              </p>
            )}

            <div className="mt-5 flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                data-testid="delete-cancel-button"
                onClick={closeModal}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                data-testid="delete-confirm-button"
                onClick={handleDelete}
                disabled={!canConfirm}
                loading={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete forever'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
