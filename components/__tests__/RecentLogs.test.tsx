import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import RecentLogs from '../RecentLogs';
import type { ClimbLogResponse } from '@/app/lib/api';

function mkLog(overrides: Partial<ClimbLogResponse>): ClimbLogResponse {
  return {
    id: 'log-id',
    user_id: 'user-1',
    climb_uuid: 'uuid-1',
    angle: 40,
    local_date: '2026-05-11',
    result_type: 'send',
    attempts_count: 1,
    created_at: '2026-05-11T18:30:00Z',
    updated_at: '2026-05-11T18:30:00Z',
    ...overrides,
  };
}

describe('RecentLogs', () => {
  it('renders the empty state when there are no logs', () => {
    render(<RecentLogs logs={[]} />);
    expect(screen.getByTestId('recent-logs-empty')).toBeInTheDocument();
  });

  it('renders each log row with the right icon', () => {
    const logs = [
      mkLog({ id: 'a', result_type: 'flash' }),
      mkLog({ id: 'b', result_type: 'send' }),
      mkLog({ id: 'c', result_type: 'attempt' }),
    ];
    render(<RecentLogs logs={logs} />);
    expect(screen.getByTestId('recent-log-a')).toHaveTextContent('Flash');
    expect(screen.getByTestId('recent-log-b')).toHaveTextContent('Send');
    expect(screen.getByTestId('recent-log-c')).toHaveTextContent('Attempt');
  });

  it('shows attempts_count when > 1', () => {
    render(
      <RecentLogs
        logs={[mkLog({ id: 'a', result_type: 'attempt', attempts_count: 3 })]}
      />,
    );
    expect(screen.getByTestId('recent-log-a')).toHaveTextContent('×3');
  });

  it('respects the limit prop', () => {
    const logs = Array.from({ length: 20 }, (_, i) =>
      mkLog({ id: `log-${i}` }),
    );
    render(<RecentLogs logs={logs} limit={5} />);
    expect(screen.getAllByTestId(/^recent-log-/)).toHaveLength(5);
  });
});
