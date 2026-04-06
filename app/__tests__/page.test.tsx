import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Home from '../page';

describe('Home Page', () => {
  it('renders the KILTER UP heading', () => {
    render(<Home />);
    const heading = screen.getByText('KILTER UP');
    expect(heading).toBeInTheDocument();
  });

  it('renders the subtitle', () => {
    render(<Home />);
    const subtitle = screen.getByText(/AI-Powered Circuit Generation/);
    expect(subtitle).toBeInTheDocument();
  });

  it('renders the Kilterboard image', () => {
    render(<Home />);
    const image = screen.getByAltText('Kilterboard climbing wall');
    expect(image).toBeInTheDocument();
  });

  it('renders the CTA button', () => {
    render(<Home />);
    const button = screen.getByText(/Inizia/);
    expect(button).toBeInTheDocument();
  });

  it('renders feature hints', () => {
    render(<Home />);
    expect(screen.getByText('Video Analysis')).toBeInTheDocument();
    expect(screen.getByText('AI Circuits')).toBeInTheDocument();
    expect(screen.getByText('Training Plans')).toBeInTheDocument();
  });
});
