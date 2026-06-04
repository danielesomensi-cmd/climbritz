'use client';

import { useEffect, useState } from 'react';
import { ApiError, getCoachSummary } from '@/app/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface CoachCommentProps {
  /** Current date range — same params the rest of /history fetches with.
   *  Changing either value resets the card to its default (ephemeral). */
  dateFrom?: string;
  dateTo?: string;
}

/**
 * A025 — on-tap AI progress comment (FREE tier).
 *
 * No call on mount: the user taps "Generate comment" → POST /api/coach/summary
 * for the current range → renders a 2–3 sentence coach narrative. Result is
 * ephemeral (component state only); re-tap regenerates, and a range change
 * resets back to the default button.
 */
export default function CoachComment({ dateFrom, dateTo }: CoachCommentProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ephemeral: a new range invalidates any previously generated comment.
  useEffect(() => {
    setSummary(null);
    setError(null);
    setLoading(false);
  }, [dateFrom, dateTo]);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await getCoachSummary(dateFrom, dateTo);
      setSummary(res.summary);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : 'Could not generate your comment. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card data-testid="coach-comment" className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-base leading-none">✨</span>
        <h2 className="text-sm font-semibold text-zinc-200">
          Your progress
        </h2>
      </div>

      {summary ? (
        <p
          data-testid="coach-comment-text"
          className="text-sm leading-relaxed text-zinc-300"
        >
          {summary}
        </p>
      ) : (
        <p className="text-sm text-zinc-400">
          Get a quick AI read on how you&apos;re progressing over this range.
        </p>
      )}

      {error && (
        <p
          data-testid="coach-comment-error"
          role="alert"
          className="text-sm text-red-400"
        >
          {error}
        </p>
      )}

      <Button
        data-testid="coach-comment-generate"
        variant="primary"
        loading={loading}
        onClick={generate}
        className="w-full"
      >
        {loading
          ? 'Generating…'
          : summary || error
            ? 'Regenerate'
            : 'Generate comment'}
      </Button>
    </Card>
  );
}
