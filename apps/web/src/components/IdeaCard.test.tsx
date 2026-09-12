import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Idea } from '@idea-garden/shared';
import { IdeaCard } from './IdeaCard.tsx';

const NOW = 1746783402000;

const makeIdea = (overrides: Partial<Idea> = {}): Idea => ({
  id: '01J9YX0G6Q1A8C5XKHQ2N3R7VB',
  title: 'Build an idea garden',
  description: 'A playful CRUD app dressed up as a garden.',
  species: 'oak',
  stage: 1,
  created_at: NOW,
  updated_at: NOW,
  archived_at: null,
  ...overrides,
});

describe('<IdeaCard>', () => {
  it('renders the full title', () => {
    render(<IdeaCard idea={makeIdea()} now={NOW} />);
    expect(screen.getByRole('heading')).toHaveTextContent('Build an idea garden');
  });

  it('renders the description with line-clamp class', () => {
    render(<IdeaCard idea={makeIdea()} now={NOW} />);
    const desc = screen.getByText(/playful CRUD app/i);
    expect(desc.className).toMatch(/line-clamp-2/);
  });

  it('omits the description block when description is null', () => {
    render(<IdeaCard idea={makeIdea({ description: null })} now={NOW} />);
    expect(screen.queryByText(/playful CRUD app/i)).not.toBeInTheDocument();
  });

  it('renders a Level 1 stage badge', () => {
    render(<IdeaCard idea={makeIdea()} now={NOW} />);
    expect(screen.getByText('Level 1')).toBeInTheDocument();
  });

  it('renders a "just now" caption when created at the reference time', () => {
    render(<IdeaCard idea={makeIdea()} now={NOW} />);
    expect(screen.getByText(/just now/i)).toBeInTheDocument();
  });

  it('renders the PlantImage with the correct src and alt for the species', () => {
    render(<IdeaCard idea={makeIdea()} now={NOW} />);
    const img = screen.getByRole('img', { name: /oak/i }) as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/plants/oak/stage-01.png');
  });

  it('renders <script> and emoji in the title as plain text (no HTML injection)', () => {
    const tricky = '🌱 idea <script>alert(1)</script>';
    render(<IdeaCard idea={makeIdea({ title: tricky })} now={NOW} />);
    const heading = screen.getByRole('heading');
    expect(heading.textContent).toBe(tricky);
    // The literal characters are present in textContent and no <script> child was created.
    expect(heading.querySelector('script')).toBeNull();
  });

  it('invokes onOpen with the idea id when clicked', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<IdeaCard idea={makeIdea()} now={NOW} onOpen={onOpen} />);
    await user.click(screen.getByRole('button'));
    expect(onOpen).toHaveBeenCalledWith('01J9YX0G6Q1A8C5XKHQ2N3R7VB');
  });

  it('invokes onOpen on Enter keypress when focused', () => {
    const onOpen = vi.fn();
    render(<IdeaCard idea={makeIdea()} now={NOW} onOpen={onOpen} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledWith('01J9YX0G6Q1A8C5XKHQ2N3R7VB');
  });

  it('renders baseline content unchanged when onOpen is provided', () => {
    render(<IdeaCard idea={makeIdea()} now={NOW} onOpen={vi.fn()} />);
    expect(screen.getByRole('heading')).toHaveTextContent('Build an idea garden');
    expect(screen.getByText(/playful CRUD app/i)).toBeInTheDocument();
  });
});

describe('<IdeaCard> — archived (004 US2)', () => {
  it('shows the stage the idea was frozen at instead of a live level', () => {
    render(
      <IdeaCard
        idea={makeIdea({ stage: 7, archived_at: NOW - 86_400_000 })}
        now={NOW}
      />,
    );
    expect(screen.getByText(/frozen at level 7/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Level 7$/)).not.toBeInTheDocument();
  });

  it('labels a stage-16 archived idea as frozen at bloom', () => {
    render(
      <IdeaCard idea={makeIdea({ stage: 16, archived_at: NOW })} now={NOW} />,
    );
    expect(screen.getByText(/frozen at bloom/i)).toBeInTheDocument();
  });

  it('dates the card by when it was archived, not when it was planted', () => {
    render(
      <IdeaCard
        idea={makeIdea({ created_at: NOW - 30 * 86_400_000, archived_at: NOW - 2 * 86_400_000 })}
        now={NOW}
      />,
    );
    expect(screen.getByText(/^Archived /)).toBeInTheDocument();
    expect(screen.queryByText(/^Watered /)).not.toBeInTheDocument();
  });

  it('an active idea is unchanged — still watered, still levelled', () => {
    render(<IdeaCard idea={makeIdea({ stage: 4 })} now={NOW} />);
    expect(screen.getByText('Level 4')).toBeInTheDocument();
    expect(screen.getByText(/^Watered /)).toBeInTheDocument();
  });
});

describe('<IdeaCard> — description placeholder', () => {
  it('does not invite watering on an archived card', () => {
    render(<IdeaCard idea={makeIdea({ description: null, archived_at: NOW })} now={NOW} />);
    expect(screen.getByText(/no notes were ever added/i)).toBeInTheDocument();
    expect(screen.queryByText(/water it to grow/i)).not.toBeInTheDocument();
  });

  it('still invites watering on an active card', () => {
    render(<IdeaCard idea={makeIdea({ description: null })} now={NOW} />);
    expect(screen.getByText(/water it to grow/i)).toBeInTheDocument();
  });
});
