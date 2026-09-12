import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Idea } from '@idea-garden/shared';
import { Garden } from './Garden.tsx';

const NOW = 1746783402000;

const makeIdea = (overrides: Partial<Idea> = {}): Idea => {
  const idea: Idea = {
    id: '01J9YX0G6Q1A8C5XKHQ2N3R7VB',
    title: 'Build an idea garden',
    description: 'A playful CRUD app.',
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

describe('<Garden>', () => {
  it('shows the error state when status is error', () => {
    render(
      <Garden
        status="error"
        ideas={[]}
        error="Network failed"
        onPlant={vi.fn()}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Network failed/)).toBeInTheDocument();
  });

  it('shows the loading state when status is loading', () => {
    render(<Garden status="loading" ideas={[]} onPlant={vi.fn()} onOpen={vi.fn()} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the empty garden when ready with no ideas', () => {
    render(<Garden status="ready" ideas={[]} onPlant={vi.fn()} onOpen={vi.fn()} />);
    expect(screen.getByRole('button', { name: /plant your first seed/i })).toBeInTheDocument();
  });

  it('renders an IdeaCard per idea and routes onOpen', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(
      <Garden
        status="ready"
        ideas={[makeIdea()]}
        onPlant={vi.fn()}
        onOpen={onOpen}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Build an idea garden' })).toBeInTheDocument();
    await user.click(screen.getByRole('button'));
    expect(onOpen).toHaveBeenCalledWith('01J9YX0G6Q1A8C5XKHQ2N3R7VB');
  });
});
