import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Idea, IdeaUpdate } from '@idea-garden/shared';
import { Archive } from './Archive.tsx';

// The plant viewport pulls in react-three-fiber; the archive only needs a stub.
vi.mock('../components/PlantViewport.tsx', () => {
  const React = require('react');
  return {
    PlantViewport: React.forwardRef((_props: unknown, ref: unknown) => {
      React.useImperativeHandle(ref, () => ({ playGrowth: () => Promise.resolve() }));
      return React.createElement('div', { 'data-testid': 'plant-viewport-mock' });
    }),
  };
});

const idA = 'A'.repeat(26);
const idB = 'B'.repeat(26);

const buildIdea = (overrides: Partial<Idea> = {}): Idea => ({
  id: idA,
  title: 'A dead idea',
  description: 'left to rest',
  species: 'oak',
  stage: 7,
  created_at: 1746783402000,
  updated_at: 1746783402000,
  archived_at: 1746790000000,
  ...overrides,
});

const buildUpdate = (overrides: Partial<IdeaUpdate> = {}): IdeaUpdate => ({
  id: 'U'.repeat(26),
  idea_id: idA,
  note: 'the last watering',
  stage_after: 7,
  created_at: 1746783402000,
  ...overrides,
});

const okJson = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function renderArchive() {
  return render(
    <MemoryRouter initialEntries={['/app/archive']}>
      <Archive />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('<Archive> — listing (004 US2)', () => {
  it('lists archived ideas with the stage each was frozen at', async () => {
    const ideas = [
      buildIdea({ id: idA, title: 'First archived', stage: 7 }),
      buildIdea({ id: idB, title: 'Second archived', stage: 16 }),
    ];
    vi.stubGlobal('fetch', vi.fn(async () => okJson(200, ideas)));
    renderArchive();

    await waitFor(() => expect(screen.getByText('First archived')).toBeInTheDocument());
    expect(screen.getByText('Second archived')).toBeInTheDocument();
    expect(screen.getByText(/frozen at level 7/i)).toBeInTheDocument();
    expect(screen.getByText(/frozen at bloom/i)).toBeInTheDocument();
  });

  it('shows the archive empty state when nothing is archived', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okJson(200, [])));
    renderArchive();

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /archive is empty/i })).toBeInTheDocument(),
    );
  });

  it('surfaces a load error rather than a false empty archive', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okJson(500, { error: 'internal_error' })));
    renderArchive();

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent(/internal_error/);
  });

  it('offers a way back to the garden (FR-013)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okJson(200, [buildIdea()])));
    renderArchive();

    await waitFor(() => expect(screen.getByText('A dead idea')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /back to the garden/i })).toHaveAttribute(
      'href',
      '/app',
    );
  });
});

describe('<Archive> — read-only detail (004 US2 scenario 3)', () => {
  it('opens an archived idea with its timeline and no mutating affordance', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/api/ideas/archived')) return okJson(200, [buildIdea()]);
        return okJson(200, { idea: buildIdea(), updates: [buildUpdate()] });
      }),
    );
    renderArchive();

    await waitFor(() => expect(screen.getByText('A dead idea')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /a dead idea/i }));

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(screen.getByText('the last watering')).toBeInTheDocument();
    expect(screen.queryByTestId('update-form-region')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});

describe('<Archive> — unarchive and delete (004 US3, US4)', () => {
  it('unarchiving removes the idea from the archive listing', async () => {
    const user = userEvent.setup();
    const idea = buildIdea();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit | undefined) => {
        if (init?.method === 'POST' && url.endsWith('/unarchive')) {
          return okJson(200, { ...idea, archived_at: null });
        }
        if (url.endsWith('/api/ideas/archived')) return okJson(200, [idea]);
        return okJson(200, { idea, updates: [] });
      }),
    );
    renderArchive();

    await waitFor(() => expect(screen.getByText('A dead idea')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /a dead idea/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    await user.click(screen.getAllByRole('button', { name: /more options/i })[0]!);
    await user.click(screen.getByRole('menuitem', { name: /unarchive idea/i }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /archive is empty/i })).toBeInTheDocument(),
    );
  });

  it('deleting forever removes the idea after the confirmation dialog', async () => {
    const user = userEvent.setup();
    const idea = buildIdea();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit | undefined) => {
        if (init?.method === 'DELETE') return new Response(null, { status: 204 });
        if (url.endsWith('/api/ideas/archived')) return okJson(200, [idea]);
        return okJson(200, { idea, updates: [] });
      }),
    );
    renderArchive();

    await waitFor(() => expect(screen.getByText('A dead idea')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /a dead idea/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    await user.click(screen.getAllByRole('button', { name: /more options/i })[0]!);
    await user.click(screen.getByRole('menuitem', { name: /delete forever/i }));
    await user.click(screen.getByRole('button', { name: /yes, delete forever/i }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /archive is empty/i })).toBeInTheDocument(),
    );
  });
});
