import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EmptyArchive } from './EmptyArchive.tsx';
import { EmptyGarden } from './EmptyGarden.tsx';

describe('<EmptyArchive>', () => {
  it('explains that archived ideas will appear here', () => {
    render(
      <MemoryRouter>
        <EmptyArchive />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /archive is empty/i })).toBeInTheDocument();
    expect(screen.getByText(/ideas you archive will rest here/i)).toBeInTheDocument();
  });

  it('offers a way back to the garden', () => {
    render(
      <MemoryRouter>
        <EmptyArchive />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /back to the garden/i })).toHaveAttribute(
      'href',
      '/app',
    );
  });

  it('reads differently from the empty-garden state (FR-015)', () => {
    const { unmount } = render(
      <MemoryRouter>
        <EmptyArchive />
      </MemoryRouter>,
    );
    const archiveHeading = screen.getByRole('heading', { level: 2 }).textContent;
    unmount();

    render(<EmptyGarden onPlant={() => {}} />);
    const gardenHeading = screen.getByRole('heading', { level: 2 }).textContent;

    expect(archiveHeading).not.toBe(gardenHeading);
  });
});
