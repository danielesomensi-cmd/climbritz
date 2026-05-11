/**
 * A021.4.5 — StateIcons unit tests.
 *
 * The component is the single source of truth for "what does this user
 * have on this climb" visuals on Discovery. Each test pins one state
 * combination so behaviour is regression-proof.
 */

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import StateIcons from '../StateIcons';
import type { UserClimbState } from '@/app/lib/api';

function mk(overrides: Partial<UserClimbState>): UserClimbState {
  return {
    climb_uuid: 'uuid-1',
    angle: 40,
    is_project: false,
    best_result: null,
    last_logged_at: null,
    ...overrides,
  };
}

describe('StateIcons', () => {
  it('renders nothing when userState is null', () => {
    const { container } = render(<StateIcons userState={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when userState is undefined', () => {
    const { container } = render(<StateIcons userState={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when user has no history and no project flag', () => {
    const { container } = render(
      <StateIcons userState={mk({ is_project: false, best_result: null })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders ⚡ when best_result is flash', () => {
    render(<StateIcons userState={mk({ best_result: 'flash' })} />);
    expect(screen.getByTestId('state-icon-flash')).toBeInTheDocument();
    expect(screen.queryByTestId('state-icon-send')).not.toBeInTheDocument();
    expect(screen.queryByTestId('state-icon-project')).not.toBeInTheDocument();
  });

  it('renders ✓ when best_result is send (and not flash)', () => {
    render(<StateIcons userState={mk({ best_result: 'send' })} />);
    expect(screen.queryByTestId('state-icon-flash')).not.toBeInTheDocument();
    expect(screen.getByTestId('state-icon-send')).toBeInTheDocument();
    expect(screen.queryByTestId('state-icon-project')).not.toBeInTheDocument();
  });

  it('renders ★ when is_project is true (no history)', () => {
    render(<StateIcons userState={mk({ is_project: true })} />);
    expect(screen.queryByTestId('state-icon-flash')).not.toBeInTheDocument();
    expect(screen.queryByTestId('state-icon-send')).not.toBeInTheDocument();
    expect(screen.getByTestId('state-icon-project')).toBeInTheDocument();
  });

  it('renders ⚡ + ★ together for a flashed climb still flagged as project', () => {
    // Real case: user flashed a project climb and answered "No, mantienilo"
    // on the project-removal modal.
    render(
      <StateIcons
        userState={mk({ best_result: 'flash', is_project: true })}
      />,
    );
    expect(screen.getByTestId('state-icon-flash')).toBeInTheDocument();
    expect(screen.getByTestId('state-icon-project')).toBeInTheDocument();
    expect(screen.queryByTestId('state-icon-send')).not.toBeInTheDocument();
  });

  it('renders ✓ + ★ together for a sent climb still flagged as project', () => {
    render(
      <StateIcons
        userState={mk({ best_result: 'send', is_project: true })}
      />,
    );
    expect(screen.getByTestId('state-icon-send')).toBeInTheDocument();
    expect(screen.getByTestId('state-icon-project')).toBeInTheDocument();
  });

  it('builds an aria-label describing the combined state', () => {
    render(
      <StateIcons
        userState={mk({ best_result: 'send', is_project: true })}
      />,
    );
    const strip = screen.getByTestId('state-icons');
    expect(strip).toHaveAttribute('aria-label', 'sent, project');
  });
});
