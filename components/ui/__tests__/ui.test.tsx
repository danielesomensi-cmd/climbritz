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

  // UX-002 / QW1 — loading keeps the label next to a spinner.
  it('is disabled, aria-busy and keeps its label beside a spinner while loading', () => {
    render(<Button loading>Save</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn).toHaveTextContent('Save');
    expect(screen.getByTestId('button-spinner')).toBeInTheDocument();
  });

  it('shows loadingLabel instead of children while loading', () => {
    render(
      <Button loading loadingLabel="Saving…">
        Save
      </Button>,
    );
    expect(screen.getByRole('button')).toHaveTextContent('Saving…');
    expect(screen.getByRole('button')).not.toHaveTextContent(/^Save$/);
  });

  it('has no spinner or aria-busy when idle', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-busy');
    expect(screen.queryByTestId('button-spinner')).not.toBeInTheDocument();
  });

  // UX-002 / QW2
  it('carries the shared press feel (scale, touch-manipulation, select-none)', () => {
    render(<Button>Go</Button>);
    const cls = screen.getByRole('button').className;
    expect(cls).toMatch(/active:scale-\[0\.97\]/);
    expect(cls).toMatch(/touch-manipulation/);
    expect(cls).toMatch(/select-none/);
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

  it('carries the shared press feel', () => {
    render(<Chip>x</Chip>);
    const cls = screen.getByRole('button').className;
    expect(cls).toMatch(/active:scale-\[0\.97\]/);
    expect(cls).toMatch(/touch-manipulation/);
    expect(cls).toMatch(/select-none/);
  });
});

describe('Card', () => {
  it('adds the interactive hover border only when interactive', () => {
    const { rerender, container } = render(<Card>body</Card>);
    expect(container.firstChild).not.toHaveClass('hover:border-orange-500/50');
    rerender(<Card interactive>body</Card>);
    expect((container.firstChild as HTMLElement).className).toMatch(/hover:border-orange-500\/50/);
  });

  it('adds the press feel only when interactive', () => {
    const { rerender, container } = render(<Card>body</Card>);
    expect((container.firstChild as HTMLElement).className).not.toMatch(/active:scale/);
    rerender(<Card interactive>body</Card>);
    expect((container.firstChild as HTMLElement).className).toMatch(/active:scale-\[0\.97\]/);
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

// UX-002 / QW3 — the back link is the most-tapped control on nested pages.
import PageHeader from '../PageHeader';

describe('PageHeader', () => {
  it('gives the back link a >=44pt tap target', () => {
    render(<PageHeader title="Detail" back={{ href: '/discover', label: 'Discover', testid: 'back' }} />);
    const link = screen.getByTestId('back');
    expect(link.className).toMatch(/min-h-\[44px\]/);
    expect(link.className).toMatch(/min-w-\[44px\]/);
    expect(link).toHaveAttribute('aria-label', 'Back to Discover');
  });
});
