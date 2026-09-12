import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Idea } from '@idea-garden/shared';
import { IdeaCard } from './IdeaCard.tsx';

const NOW = 1746783402000;

const makeIdea = (overrides: Partial<Idea> = {}): Idea => {
  const idea: Idea = {
    id: '01J9YX0G6Q1A8C5XKHQ2N3R7VB',
    title: 'Build an idea garden',
    description: 'A playful CRUD app dressed up as a garden.',
    species: 'oak',
    stage: 1,
    created_at: NOW,
    updated_at: NOW,
    last_watered_at: NOW,
    ms_since_watered: 0,
    wilted: false,
    effective_stage: 1,
    ...overrides,
  };
  // effective_stage is derived server-side; keep the fixture honest so a
  // test that only sets `stage` still gets a coherent idea back.
  if (overrides.effective_stage === undefined) {
    idea.effective_stage = idea.wilted ? Math.max(idea.stage - 1, 1) : idea.stage;
  }
  return idea;
};

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

describe('<IdeaCard> — wilting', () => {
  const WEEK = 7 * 24 * 60 * 60 * 1000;

  it('shows a Wilted chip when the idea is wilted', () => {
    render(
      <IdeaCard
        idea={makeIdea({ wilted: true, last_watered_at: NOW - WEEK })}
        now={NOW}
      />,
    );
    expect(screen.getByText('Wilted')).toBeInTheDocument();
  });

  it('shows no Wilted chip on a healthy idea', () => {
    render(<IdeaCard idea={makeIdea()} now={NOW} />);
    expect(screen.queryByText('Wilted')).not.toBeInTheDocument();
  });

  it('uses colors.wilted for the chip, never an error color', () => {
    render(<IdeaCard idea={makeIdea({ wilted: true })} now={NOW} />);
    const chip = screen.getByText('Wilted');
    expect(chip.className).toMatch(/text-wilted/);
    expect(chip.className).toMatch(/bg-wilted-soft/);
    expect(chip.className).not.toMatch(/error/);
  });

  it('renders the badge, the counter and the plant from effective_stage, not stage', () => {
    render(
      <IdeaCard idea={makeIdea({ stage: 5, wilted: true, effective_stage: 4 })} now={NOW} />,
    );
    expect(screen.getByText('Level 4')).toBeInTheDocument();
    expect(screen.queryByText('Level 5')).not.toBeInTheDocument();
    expect(screen.getByText('04/16')).toBeInTheDocument();
    const img = screen.getByRole('img', { name: /oak/i });
    expect(img.getAttribute('src')).toBe('/plants/oak/stage-04.png');
  });

  it('is not "Bloomed" at stage 16 while wilted, because effective_stage is 15', () => {
    render(
      <IdeaCard idea={makeIdea({ stage: 16, wilted: true, effective_stage: 15 })} now={NOW} />,
    );
    expect(screen.queryByText('Bloomed')).not.toBeInTheDocument();
    expect(screen.getByText('Level 15')).toBeInTheDocument();
  });

  it('times the "Watered" caption from last_watered_at, not created_at', () => {
    // Planted three days ago, watered a moment ago. The old card read
    // created_at here and would have claimed "Watered 3d ago".
    render(
      <IdeaCard
        idea={makeIdea({ created_at: NOW - 3 * 24 * 60 * 60 * 1000, last_watered_at: NOW })}
        now={NOW}
      />,
    );
    expect(screen.getByText('Watered just now')).toBeInTheDocument();
    expect(screen.queryByText(/Watered 3d ago/)).not.toBeInTheDocument();
  });

  it('says "Planted" rather than "Watered" when the idea has never been watered', () => {
    render(
      <IdeaCard
        idea={makeIdea({ created_at: NOW - 2 * 24 * 60 * 60 * 1000, last_watered_at: null })}
        now={NOW}
      />,
    );
    expect(screen.getByText('Planted 2d ago')).toBeInTheDocument();
    expect(screen.queryByText(/Watered/)).not.toBeInTheDocument();
  });
});
