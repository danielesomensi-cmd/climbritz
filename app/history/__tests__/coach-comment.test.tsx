/**
 * A025 — CoachComment card: on-tap generation, no fetch on mount, error retry,
 * ephemeral reset on range change.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const getCoachSummaryMock = jest.fn();
jest.mock('@/app/lib/api', () => {
  const actual = jest.requireActual('@/app/lib/api');
  return {
    ...actual,
    getCoachSummary: (...args: unknown[]) => getCoachSummaryMock(...args),
  };
});

import CoachComment from '../coach-comment';

beforeEach(() => {
  jest.clearAllMocks();
  getCoachSummaryMock.mockResolvedValue({ summary: 'Strong work — 3 flashes!' });
});

describe('CoachComment', () => {
  it('does NOT fetch on mount (on-tap only)', () => {
    render(<CoachComment dateFrom="2026-01-01" dateTo="2026-03-01" />);
    expect(getCoachSummaryMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('coach-comment-generate')).toHaveTextContent(
      'Generate comment',
    );
  });

  it('generates a comment on tap and switches the button to Regenerate', async () => {
    render(<CoachComment dateFrom="2026-01-01" dateTo="2026-03-01" />);
    fireEvent.click(screen.getByTestId('coach-comment-generate'));
    await waitFor(() =>
      expect(screen.getByTestId('coach-comment-text')).toHaveTextContent(
        'Strong work — 3 flashes!',
      ),
    );
    expect(getCoachSummaryMock).toHaveBeenCalledWith('2026-01-01', '2026-03-01');
    expect(screen.getByTestId('coach-comment-generate')).toHaveTextContent(
      'Regenerate',
    );
  });

  it('shows an inline error on failure and keeps a retry button', async () => {
    const { ApiError } = jest.requireActual('@/app/lib/api');
    getCoachSummaryMock.mockRejectedValueOnce(new ApiError(502, 'boom'));
    render(<CoachComment dateFrom="2026-01-01" dateTo="2026-03-01" />);
    fireEvent.click(screen.getByTestId('coach-comment-generate'));
    await waitFor(() =>
      expect(screen.getByTestId('coach-comment-error')).toHaveTextContent(
        'boom',
      ),
    );
    expect(screen.getByTestId('coach-comment-generate')).toHaveTextContent(
      'Regenerate',
    );
  });

  it('resets to the default button when the range changes (ephemeral)', async () => {
    const { rerender } = render(
      <CoachComment dateFrom="2026-01-01" dateTo="2026-03-01" />,
    );
    fireEvent.click(screen.getByTestId('coach-comment-generate'));
    await waitFor(() =>
      expect(screen.getByTestId('coach-comment-text')).toBeInTheDocument(),
    );

    rerender(<CoachComment dateFrom="2026-02-01" dateTo="2026-03-01" />);
    expect(screen.queryByTestId('coach-comment-text')).not.toBeInTheDocument();
    expect(screen.getByTestId('coach-comment-generate')).toHaveTextContent(
      'Generate comment',
    );
  });
});
