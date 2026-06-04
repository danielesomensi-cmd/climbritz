import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Button from '../Button';
import Chip from '../Chip';
import Card from '../Card';
import EmptyState from '../EmptyState';
import LoadingState from '../LoadingState';
import StatusDot from '../StatusDot';

describe('Button', () => {
  it('renders children and fires onClick', () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Connect</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('primary variant uses near-black text on brand orange (D18-8 contrast)', () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole('button').className).toMatch(/bg-orange-500/);
    expect(screen.getByRole('button').className).toMatch(/text-zinc-950/);
  });

  it('is disabled and shows the spinner glyph while loading', () => {
    render(<Button loading>Save</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent('…');
  });
});

describe('Chip', () => {
  it('reflects selected via aria-pressed and the soft-active style', () => {
    const { rerender } = render(<Chip>5+</Chip>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
    rerender(<Chip selected>5+</Chip>);
    const chip = screen.getByRole('button');
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(chip.className).toMatch(/bg-orange-500\/15/);
  });

  it('keeps a 44px minimum tap target', () => {
    render(<Chip>x</Chip>);
    expect(screen.getByRole('button').className).toMatch(/min-h-\[44px\]/);
  });
});

describe('Card', () => {
  it('adds the interactive hover border only when interactive', () => {
    const { rerender, container } = render(<Card>body</Card>);
    expect(container.firstChild).not.toHaveClass('hover:border-orange-500/50');
    rerender(<Card interactive>body</Card>);
    expect((container.firstChild as HTMLElement).className).toMatch(/hover:border-orange-500\/50/);
  });
});

describe('EmptyState', () => {
  it('renders title, hint and action', () => {
    render(<EmptyState icon="🪨" title="No climbs" hint="Widen filters" action={<button>Reset</button>} />);
    expect(screen.getByText('No climbs')).toBeInTheDocument();
    expect(screen.getByText('Widen filters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
  });
});

describe('LoadingState', () => {
  it('defaults to the single "Loading…" verb and exposes a status role', () => {
    render(<LoadingState />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
  });
});

describe('StatusDot', () => {
  it('maps status to the shared colour map', () => {
    const { rerender } = render(<StatusDot status="connected" />);
    expect(screen.getByTestId('ble-status-dot').className).toMatch(/bg-emerald-500/);
    rerender(<StatusDot status="idle" />);
    expect(screen.getByTestId('ble-status-dot').className).toMatch(/bg-zinc-500/);
  });
});
