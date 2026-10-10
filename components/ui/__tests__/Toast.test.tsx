import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Toast from '../Toast';

describe('Toast (UX-003)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('renders the message with a polite live region', () => {
    render(<Toast message="Logged Send" onDismiss={jest.fn()} />);
    const toast = screen.getByTestId('toast');
    expect(toast).toHaveTextContent('Logged Send');
    expect(toast).toHaveAttribute('aria-live', 'polite');
    expect(screen.queryByTestId('toast-action')).not.toBeInTheDocument();
  });

  it('calls onAction when the action is tapped', () => {
    const onAction = jest.fn();
    render(<Toast message="m" actionLabel="Undo" onAction={onAction} onDismiss={jest.fn()} />);
    fireEvent.click(screen.getByTestId('toast-action'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('auto-dismisses after durationMs', () => {
    const onDismiss = jest.fn();
    render(<Toast message="m" onDismiss={onDismiss} durationMs={1000} />);
    act(() => jest.advanceTimersByTime(999));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('pauses the timer and disables the action while busy', () => {
    const onDismiss = jest.fn();
    render(
      <Toast message="m" actionLabel="Undo" onAction={jest.fn()} onDismiss={onDismiss} durationMs={1000} busy />,
    );
    act(() => jest.advanceTimersByTime(5000));
    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByTestId('toast-action')).toBeDisabled();
  });

  it('restarts the timer when toastKey changes', () => {
    const onDismiss = jest.fn();
    const { rerender } = render(<Toast message="m" onDismiss={onDismiss} durationMs={1000} toastKey={1} />);
    act(() => jest.advanceTimersByTime(800));
    rerender(<Toast message="m" onDismiss={onDismiss} durationMs={1000} toastKey={2} />);
    act(() => jest.advanceTimersByTime(800));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(200));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
