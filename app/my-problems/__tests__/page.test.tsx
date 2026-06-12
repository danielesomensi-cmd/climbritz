import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/my-problems',
}));

jest.mock('@/app/lib/api', () => {
  const actual = jest.requireActual('@/app/lib/api');
  return { ...actual, listMyClimbs: jest.fn() };
});

jest.mock('@/components/BottomNav', () => ({
  __esModule: true,
  default: () => <nav data-testid="mock-bottomnav" />,
}));

import MyProblemsPage from '../page';
import { listMyClimbs } from '@/app/lib/api';

const listMock = listMyClimbs as jest.MockedFunction<typeof listMyClimbs>;

const PROBLEMS = [
  {
    uuid: 'GEN-1',
    name: 'Sneaky Gaston',
    description: null,
    frames: 'p1001r12p1004r14',
    angle: 40,
    grade: '6a/V3',
    difficulty: 16,
    seed_climb_uuid: 'SEED-1',
    ascent_count: 2,
    created_at: '2026-06-12T10:00:00Z',
    updated_at: '2026-06-12T10:00:00Z',
  },
  {
    uuid: 'GEN-2',
    name: 'Velvet Crux',
    description: null,
    frames: 'p2001r12p2004r14',
    angle: 45,
    grade: null,
    difficulty: null,
    seed_climb_uuid: null,
    ascent_count: 0,
    created_at: '2026-06-11T10:00:00Z',
    updated_at: '2026-06-11T10:00:00Z',
  },
];

beforeEach(() => listMock.mockReset());

describe('MyProblemsPage', () => {
  it('renders a card per problem with name, grade, angle, ascents', async () => {
    listMock.mockResolvedValue(PROBLEMS);
    render(<MyProblemsPage />);
    await waitFor(() =>
      expect(screen.getByTestId('my-problem-card-GEN-1')).toBeInTheDocument(),
    );
    expect(screen.getByText('Sneaky Gaston')).toBeInTheDocument();
    expect(screen.getByText('2 ascents')).toBeInTheDocument();
    expect(screen.getByText('40°')).toBeInTheDocument();
    // Cards link to the My Problems detail route, not the BoardLib one.
    expect(screen.getByTestId('my-problem-card-GEN-1')).toHaveAttribute(
      'href',
      '/my-problems/detail?id=GEN-1',
    );
  });

  it('renders the empty state with a create link', async () => {
    listMock.mockResolvedValue([]);
    render(<MyProblemsPage />);
    await waitFor(() =>
      expect(screen.getByText('No saved problems yet')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('empty-create-link')).toHaveAttribute(
      'href',
      '/generate',
    );
  });

  it('surfaces a load error', async () => {
    listMock.mockRejectedValue(new Error('nope'));
    render(<MyProblemsPage />);
    await waitFor(() =>
      expect(screen.getByTestId('my-problems-error')).toHaveTextContent('nope'),
    );
  });
});
