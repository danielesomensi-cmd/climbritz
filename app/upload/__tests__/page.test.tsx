import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  usePathname: () => '/upload',
}));

jest.mock('@/app/lib/api', () => ({
  uploadVideo: jest.fn(),
  ApiError: class ApiError extends Error {},
}));

import UploadPage from '../page';

describe('Upload page', () => {
  it('has a back link to the Videos tab and phone-first picker copy', () => {
    render(<UploadPage />);
    expect(screen.getByRole('link', { name: 'Back to Videos' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('heading', { level: 1, name: 'Upload a video' })).toBeInTheDocument();
    expect(screen.getByText('Tap to choose a video')).toBeInTheDocument();
    expect(screen.queryByText(/drag your video/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/click to select/i)).not.toBeInTheDocument();
  });
});
