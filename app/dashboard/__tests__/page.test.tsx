import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  usePathname: () => '/dashboard',
}));

const getVideosMock = jest.fn();
jest.mock('@/app/lib/api', () => ({
  getVideos: () => getVideosMock(),
}));

import DashboardPage from '../page';

describe('Videos tab (/dashboard)', () => {
  beforeEach(() => getVideosMock.mockReset());

  it('uses the shared PageHeader titled "Videos" with an Upload action', async () => {
    getVideosMock.mockResolvedValue([]);
    render(<DashboardPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Videos' })).toBeInTheDocument();
    expect(screen.getByTestId('upload-video-link')).toHaveAttribute('href', '/upload');
    expect(screen.queryByText('CLIMBRITZ')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('No videos yet')).toBeInTheDocument());
  });
});
