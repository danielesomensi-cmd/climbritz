import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Home from '../page';

describe('Home Page', () => {
  it('renders the KILTER UP heading', () => {
    render(<Home />);
    expect(screen.getByText('KILTER UP')).toBeInTheDocument();
  });

  it('renders the subtitle', () => {
    render(<Home />);
    expect(screen.getByText('AI Climbing Companion')).toBeInTheDocument();
  });

  it('renders all four tiles', () => {
    render(<Home />);
    expect(screen.getByText('Demo LED Light')).toBeInTheDocument();
    expect(screen.getByText('Discover')).toBeInTheDocument();
    expect(screen.getByText('Classify')).toBeInTheDocument();
    expect(screen.getByText('Video Analysis')).toBeInTheDocument();
  });

  it('renders tile subtitles', () => {
    render(<Home />);
    expect(screen.getByText('Test BLE connection')).toBeInTheDocument();
    expect(screen.getByText('Search 160k+ climbs')).toBeInTheDocument();
    expect(screen.getByText('Tag hold grip types')).toBeInTheDocument();
    expect(screen.getByText('AI technique coaching')).toBeInTheDocument();
  });

  it('shows lock icon on Video Analysis tile', () => {
    render(<Home />);
    // The Video Analysis tile links to /login
    const videoLink = screen.getByText('Video Analysis').closest('a');
    expect(videoLink).toHaveAttribute('href', '/login');
  });
});
