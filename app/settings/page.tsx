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

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { deleteAccount } from '@/app/lib/api';
import AuthGuard from '@/components/AuthGuard';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import { isSoundEnabled, playCue, setSoundEnabled, unlockAudio } from '@/lib/feedback/sound';
import { INVITE_URL } from '@/lib/installLinks';

const CONFIRM_WORD = 'DELETE';

// A032 — shown under the QR; the copy button copies the full https URL.
const INVITE_LABEL = INVITE_URL.replace(/^https:\/\//, '');

// A032 — Invite a friend. The QR is a static asset (public/invite/get-qr.svg,
// generated once from INVITE_URL) so there is no runtime QR dependency. It sits
// on a white card in every theme so phone cameras can read it.
// Copy stays store-neutral (App Store Guideline 2.2): where /get sends people
// is a web-side decision, never described in the app.
function InviteSection() {
  const [copied, setCopied] = useState(false);
  const linkRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(INVITE_URL);
      setCopied(true);
    } catch {
      // No clipboard (insecure context / permission denied / old WebView):
      // select the link text so a long-press copy is one step away.
      const el = linkRef.current;
      const selection = typeof window !== 'undefined' ? window.getSelection() : null;
      if (el && selection) {
        const range = document.createRange();
        range.selectNodeContents(el);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  }

  return (
    <section data-testid="settings-invite">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-text-tertiary">
        Invite a friend
      </h2>
      <div className="mt-3 flex flex-col items-center rounded-card border border-border-default p-4">
        <div className="rounded-card bg-white p-4">
          {/* Plain <img> instead of next/image — works in Capacitor static export */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/invite/get-qr.svg"
            alt="QR code to get Climbritz"
            width={220}
            height={220}
            data-testid="settings-invite-qr"
            className="block h-[220px] w-[220px]"
          />
        </div>
        <p className="mt-4 text-center text-sm text-text-secondary">
          Scan with your phone camera to get Climbritz.
        </p>
        <div className="mt-3 flex w-full items-center justify-between gap-3">
          <span
            ref={linkRef}
            data-testid="settings-invite-link"
            className="select-text font-medium text-text-primary"
          >
            {INVITE_LABEL}
          </span>
          <Button
            variant="secondary"
            data-testid="settings-invite-copy"
            onClick={copyLink}
          >
            {copied ? 'Copied' : 'Copy link'}
          </Button>
        </div>
        <span aria-live="polite" className="sr-only">
          {copied ? 'Link copied' : ''}
        </span>
      </div>
    </section>
  );
}

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

  // NATIVE-001: per-device sound toggle, default off. Read after mount so
  // the static export never renders a storage-dependent value.
  const [soundOn, setSoundOn] = useState(false);
  useEffect(() => {
    setSoundOn(isSoundEnabled());
  }, []);

  function toggleSound() {
    const next = !soundOn;
    setSoundEnabled(next);
    setSoundOn(next);
    if (next) {
      // This is a user tap — the right moment to unlock Web Audio on iOS.
      unlockAudio();
      playCue('turn');
    }
  }

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
            Preferences
          </h2>
          <div className="mt-3 rounded-card border border-border-default">
            <button
              type="button"
              role="switch"
              aria-checked={soundOn}
              data-testid="settings-sound-toggle"
              onClick={toggleSound}
              className="flex w-full min-h-[44px] items-center justify-between px-4 py-4 text-left text-text-primary hover:bg-surface-overlay"
            >
              <span>
                <span className="block">Sounds</span>
                <span className="block text-sm text-text-tertiary">
                  Game cues on this device
                </span>
              </span>
              <span
                aria-hidden
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                  soundOn ? 'bg-orange-500' : 'bg-zinc-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    soundOn ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </span>
            </button>
          </div>
        </section>

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

        <InviteSection />

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
