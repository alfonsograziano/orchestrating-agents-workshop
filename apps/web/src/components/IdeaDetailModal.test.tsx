import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Idea, IdeaUpdate, MutationResponse } from '@idea-garden/shared';

const ULID = 'A'.repeat(26);

const buildIdea = (overrides: Partial<Idea> = {}): Idea => ({
  id: ULID,
  title: 'My Idea',
  description: 'a description',
  species: 'oak',
  stage: 3,
  created_at: 1746783402000,
  updated_at: 1746783402000,
  archived_at: null,
  ...overrides,
});

const buildUpdate = (overrides: Partial<IdeaUpdate> = {}): IdeaUpdate => ({
  id: 'U'.repeat(26),
  idea_id: ULID,
  note: 'first watering',
  stage_after: 2,
  created_at: 1746783402000,
  ...overrides,
});

// Mock the detail hook to control the loading flow.
vi.mock('../hooks/useIdeaDetail.ts', () => ({
  useIdeaDetail: vi.fn(),
}));

// Mock the PlantViewport so we can assert on playGrowth without R3F.
const playGrowth = vi.fn();
vi.mock('./PlantViewport.tsx', () => {
  const React = require('react');
  return {
    PlantViewport: React.forwardRef((_props: unknown, ref: unknown) => {
      // Expose handle.
      React.useImperativeHandle(ref, () => ({
        playGrowth: (...args: unknown[]) => {
          playGrowth(...args);
          return Promise.resolve();
        },
      }));
      return React.createElement('div', { 'data-testid': 'plant-viewport-mock' });
    }),
  };
});

import { useIdeaDetail } from '../hooks/useIdeaDetail.ts';
import { IdeaDetailModal } from './IdeaDetailModal.tsx';
const useIdeaDetailMock = useIdeaDetail as unknown as ReturnType<typeof vi.fn>;

function renderModal(overrides: Partial<React.ComponentProps<typeof IdeaDetailModal>> = {}) {
  const onAddUpdate = vi.fn(
    async (_ideaId: string, _input: { note: string }): Promise<MutationResponse> => ({
      idea: buildIdea({ stage: 4 }),
      prev_stage: 3,
      update: buildUpdate({ stage_after: 4 }),
    }),
  );
  const props = {
    ideaId: ULID,
    onClose: vi.fn(),
    onAddUpdate,
    onEditIdea: vi.fn(),
    onEditUpdate: vi.fn(),
    onDeleteUpdate: vi.fn(),
    onArchiveIdea: vi.fn(),
    onUnarchiveIdea: vi.fn(),
    onDeleteIdea: vi.fn(),
    ...overrides,
  } as React.ComponentProps<typeof IdeaDetailModal>;
  return { ...props, ...render(<IdeaDetailModal {...props} />) };
}

beforeEach(() => {
  useIdeaDetailMock.mockReset();
  playGrowth.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('<IdeaDetailModal> — US1', () => {
  it('renders skeleton placeholders while in the loading state', () => {
    useIdeaDetailMock.mockReturnValue({ status: 'loading' });
    renderModal();
    expect(screen.getByTestId('modal-skeleton')).toBeInTheDocument();
  });

  it('renders title, description, LevelBadge, Timeline, and UpdateForm in ready state', () => {
    useIdeaDetailMock.mockReturnValue({
      status: 'ready',
      idea: buildIdea({ stage: 3 }),
      updates: [buildUpdate()],
    });
    renderModal();
    expect(screen.getByRole('heading', { name: 'My Idea' })).toBeInTheDocument();
    expect(screen.getByText('a description')).toBeInTheDocument();
    expect(screen.getByText('Level 3')).toBeInTheDocument();
    expect(screen.getByText('first watering')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^water$/i })).toBeInTheDocument();
  });

  it('closes via X click', async () => {
    const user = userEvent.setup();
    useIdeaDetailMock.mockReturnValue({
      status: 'ready',
      idea: buildIdea(),
      updates: [],
    });
    const onClose = vi.fn();
    renderModal({ onClose });
    await user.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape', () => {
    useIdeaDetailMock.mockReturnValue({
      status: 'ready',
      idea: buildIdea(),
      updates: [],
    });
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on backdrop click', () => {
    useIdeaDetailMock.mockReturnValue({
      status: 'ready',
      idea: buildIdea(),
      updates: [],
    });
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByTestId('idea-detail-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });

  it('submitting a valid update calls onAddUpdate then playGrowth (growth palette)', async () => {
    const user = userEvent.setup();
    useIdeaDetailMock.mockReturnValue({
      status: 'ready',
      idea: buildIdea({ stage: 3 }),
      updates: [],
    });
    const onAddUpdate = vi.fn(
      async (): Promise<MutationResponse> => ({
        idea: buildIdea({ stage: 4 }),
        prev_stage: 3,
        update: buildUpdate({ stage_after: 4 }),
      }),
    );
    renderModal({ onAddUpdate });

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'a watering' } });
    await user.click(screen.getByRole('button', { name: /^water$/i }));

    await waitFor(() => expect(onAddUpdate).toHaveBeenCalled());
    await waitFor(() => expect(playGrowth).toHaveBeenCalled());
    expect(playGrowth).toHaveBeenCalledWith({ from: 3, to: 4, palette: 'growth' });
  });
});

describe('<IdeaDetailModal> — US2 (edit)', () => {
  it('clicking Edit swaps to edit mode', async () => {
    const user = userEvent.setup();
    useIdeaDetailMock.mockReturnValue({
      status: 'ready',
      idea: buildIdea(),
      updates: [],
    });
    renderModal();
    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    expect(screen.getByLabelText(/Title/i)).toBeInTheDocument();
  });

  it('saving valid changes returns to read mode with new values; playGrowth NOT called', async () => {
    const user = userEvent.setup();
    useIdeaDetailMock.mockReturnValue({
      status: 'ready',
      idea: buildIdea({ title: 'old' }),
      updates: [],
    });
    const onEditIdea = vi.fn(
      async (): Promise<MutationResponse> => ({
        idea: buildIdea({ title: 'renamed' }),
        prev_stage: 3,
      }),
    );
    renderModal({ onEditIdea });

    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'renamed' } });
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'renamed' })).toBeInTheDocument(),
    );
    expect(playGrowth).not.toHaveBeenCalled();
  });

  it('clicking Cancel reverts cleanly', async () => {
    const user = userEvent.setup();
    useIdeaDetailMock.mockReturnValue({
      status: 'ready',
      idea: buildIdea({ title: 'untouched' }),
      updates: [],
    });
    const onEditIdea = vi.fn();
    renderModal({ onEditIdea });
    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.getByRole('heading', { name: 'untouched' })).toBeInTheDocument();
    expect(onEditIdea).not.toHaveBeenCalled();
  });
});

describe('<IdeaDetailModal> — US3 (bloom + confetti)', () => {
  it('fires confetti when prev_stage < 16 and idea.stage === 16; plays bloom palette', async () => {
    const user = userEvent.setup();
    useIdeaDetailMock.mockReturnValue({
      status: 'ready',
      idea: buildIdea({ stage: 15 }),
      updates: [],
    });
    const onAddUpdate = vi.fn(
      async (): Promise<MutationResponse> => ({
        idea: buildIdea({ stage: 16 }),
        prev_stage: 15,
        update: buildUpdate({ stage_after: 16 }),
      }),
    );
    renderModal({ onAddUpdate });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'final push' } });
    await user.click(screen.getByRole('button', { name: /^water$/i }));

    await waitFor(() => expect(playGrowth).toHaveBeenCalled());
    expect(playGrowth).toHaveBeenCalledWith({ from: 15, to: 16, palette: 'bloom' });
    await waitFor(() =>
      expect(screen.queryByTestId('confetti-canvas')).toBeInTheDocument(),
    );
  });

  it('does NOT fire confetti when already at stage 16; still plays bloom palette', async () => {
    const user = userEvent.setup();
    useIdeaDetailMock.mockReturnValue({
      status: 'ready',
      idea: buildIdea({ stage: 16 }),
      updates: [],
    });
    const onAddUpdate = vi.fn(
      async (): Promise<MutationResponse> => ({
        idea: buildIdea({ stage: 16 }),
        prev_stage: 16,
        update: buildUpdate({ stage_after: 16 }),
      }),
    );
    renderModal({ onAddUpdate });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'extra watering' } });
    await user.click(screen.getByRole('button', { name: /^water$/i }));

    await waitFor(() => expect(playGrowth).toHaveBeenCalled());
    expect(playGrowth).toHaveBeenCalledWith({ from: 16, to: 16, palette: 'bloom' });
    expect(screen.queryByTestId('confetti-canvas')).not.toBeInTheDocument();
  });

  it('fires confetti on the first watering (1 → 2); uses growth palette', async () => {
    const user = userEvent.setup();
    useIdeaDetailMock.mockReturnValue({
      status: 'ready',
      idea: buildIdea({ stage: 1 }),
      updates: [],
    });
    const onAddUpdate = vi.fn(
      async (): Promise<MutationResponse> => ({
        idea: buildIdea({ stage: 2 }),
        prev_stage: 1,
        update: buildUpdate({ stage_after: 2 }),
      }),
    );
    renderModal({ onAddUpdate });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'first step' } });
    await user.click(screen.getByRole('button', { name: /^water$/i }));

    await waitFor(() => expect(playGrowth).toHaveBeenCalled());
    expect(playGrowth).toHaveBeenCalledWith({ from: 1, to: 2, palette: 'growth' });
    await waitFor(() =>
      expect(screen.queryByTestId('confetti-canvas')).toBeInTheDocument(),
    );
  });

  it('does NOT fire confetti on an intermediate watering (e.g. 5 → 6); uses growth palette', async () => {
    const user = userEvent.setup();
    useIdeaDetailMock.mockReturnValue({
      status: 'ready',
      idea: buildIdea({ stage: 5 }),
      updates: [],
    });
    const onAddUpdate = vi.fn(
      async (): Promise<MutationResponse> => ({
        idea: buildIdea({ stage: 6 }),
        prev_stage: 5,
        update: buildUpdate({ stage_after: 6 }),
      }),
    );
    renderModal({ onAddUpdate });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'mid-growth' } });
    await user.click(screen.getByRole('button', { name: /^water$/i }));

    await waitFor(() => expect(playGrowth).toHaveBeenCalled());
    expect(playGrowth).toHaveBeenCalledWith({ from: 5, to: 6, palette: 'growth' });
    expect(screen.queryByTestId('confetti-canvas')).not.toBeInTheDocument();
  });
});

describe('<IdeaDetailModal> — US4 (timeline curation)', () => {
  it('editing an entry calls onEditUpdate and re-renders with the new note', async () => {
    const user = userEvent.setup();
    useIdeaDetailMock.mockReturnValue({
      status: 'ready',
      idea: buildIdea({ stage: 3 }),
      updates: [buildUpdate({ note: 'before' })],
    });
    const onEditUpdate = vi.fn(
      async (): Promise<MutationResponse> => ({
        idea: buildIdea({ stage: 3 }),
        prev_stage: 3,
        update: buildUpdate({ note: 'after' }),
      }),
    );
    renderModal({ onEditUpdate });

    // Use the entry-level overflow (second more-options button: header has its own).
    const triggers = screen.getAllByRole('button', { name: /more options/i });
    await user.click(triggers[triggers.length - 1]!);
    // Menu Edit item (not the header Edit text button).
    await user.click(screen.getByRole('menuitem', { name: /edit/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /edit note/i }), {
      target: { value: 'after' },
    });
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(onEditUpdate).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('after')).toBeInTheDocument());
  });

  it('deleting an entry that drops the stage updates the idea cache and does NOT call playGrowth', async () => {
    const user = userEvent.setup();
    useIdeaDetailMock.mockReturnValue({
      status: 'ready',
      idea: buildIdea({ stage: 4 }),
      updates: [buildUpdate({ stage_after: 4 })],
    });
    const onDeleteUpdate = vi.fn(
      async (): Promise<MutationResponse> => ({
        idea: buildIdea({ stage: 3 }),
        prev_stage: 4,
      }),
    );
    renderModal({ onDeleteUpdate });

    const triggers = screen.getAllByRole('button', { name: /more options/i });
    await user.click(triggers[triggers.length - 1]!);
    await user.click(screen.getByRole('menuitem', { name: /delete/i }));

    await waitFor(() => expect(onDeleteUpdate).toHaveBeenCalled());
    expect(playGrowth).not.toHaveBeenCalled();
    // Level badge should reflect the new (lower) stage after the recompute.
    await waitFor(() => expect(screen.getByText('Level 3')).toBeInTheDocument());
  });
});

describe('<IdeaDetailModal> — layout (FR-035–FR-038)', () => {
  it('renders the update form region before the timeline region in DOM order', () => {
    useIdeaDetailMock.mockReturnValue({
      status: 'ready',
      idea: buildIdea({ stage: 3 }),
      updates: [buildUpdate({ note: 'older watering' })],
    });
    renderModal();
    const form = screen.getByTestId('update-form-region');
    const timeline = screen.getByTestId('timeline-region');
    expect(form.compareDocumentPosition(timeline) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('places the watering textarea before any timeline list item in DOM order', () => {
    useIdeaDetailMock.mockReturnValue({
      status: 'ready',
      idea: buildIdea({ stage: 3 }),
      updates: [buildUpdate({ note: 'older watering' })],
    });
    renderModal();
    const textarea = screen.getByRole('textbox');
    const items = screen.getAllByRole('listitem');
    expect(items.length).toBeGreaterThan(0);
    expect(
      textarea.compareDocumentPosition(items[0]!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe('<IdeaDetailModal> — confetti portal (FR-043)', () => {
  it('mounts confetti through a portal that escapes the modal subtree', async () => {
    const user = userEvent.setup();
    useIdeaDetailMock.mockReturnValue({
      status: 'ready',
      idea: buildIdea({ stage: 15 }),
      updates: [],
    });
    const onAddUpdate = vi.fn(
      async (): Promise<MutationResponse> => ({
        idea: buildIdea({ stage: 16 }),
        prev_stage: 15,
        update: buildUpdate({ stage_after: 16 }),
      }),
    );
    renderModal({ onAddUpdate });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'final push' } });
    await user.click(screen.getByRole('button', { name: /^water$/i }));

    const canvas = await screen.findByTestId('confetti-canvas');
    expect(canvas).toBeInTheDocument();
    // The portal is mounted at document.body, NOT inside the dialog subtree.
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(canvas)).toBe(false);
  });
});

const ARCHIVED_AT = 1746790000000;
const archivedIdea = (overrides: Partial<Idea> = {}) =>
  buildIdea({ archived_at: ARCHIVED_AT, ...overrides });

async function openHeaderMenu(user: ReturnType<typeof userEvent.setup>) {
  const triggers = screen.getAllByRole('button', { name: /more options/i });
  // The header's menu is the first on screen; timeline entries own the rest.
  await user.click(triggers[0]!);
}

describe('<IdeaDetailModal> — archiving an active idea (004 US1)', () => {
  beforeEach(() => {
    useIdeaDetailMock.mockReturnValue({
      status: 'ready',
      idea: buildIdea(),
      updates: [],
    });
  });

  it('offers Archive idea, and does not offer permanent deletion (FR-019)', async () => {
    const user = userEvent.setup();
    renderModal();
    await openHeaderMenu(user);

    expect(screen.getByRole('menuitem', { name: /archive idea/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('archiving calls onArchiveIdea and closes the modal on success', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onArchiveIdea = vi.fn().mockResolvedValue(undefined);
    renderModal({ onClose, onArchiveIdea });

    await openHeaderMenu(user);
    await user.click(screen.getByRole('menuitem', { name: /archive idea/i }));

    await waitFor(() => expect(onArchiveIdea).toHaveBeenCalledWith(ULID));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('on a rejected archive the modal stays open with a visible reason (US1 scenario 4)', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onArchiveIdea = vi.fn().mockRejectedValue(new Error('boom'));
    renderModal({ onClose, onArchiveIdea });

    await openHeaderMenu(user);
    await user.click(screen.getByRole('menuitem', { name: /archive idea/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('boom'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('<IdeaDetailModal> — an archived idea is read-only (004 US2)', () => {
  beforeEach(() => {
    useIdeaDetailMock.mockReturnValue({
      status: 'ready',
      idea: archivedIdea(),
      updates: [buildUpdate(), buildUpdate({ id: 'V'.repeat(26), note: 'second watering' })],
    });
  });

  it('shows the title, description, level and full timeline', () => {
    renderModal();
    expect(screen.getByRole('heading', { name: 'My Idea' })).toBeInTheDocument();
    expect(screen.getByText('a description')).toBeInTheDocument();
    expect(screen.getByText('Level 3')).toBeInTheDocument();
    expect(screen.getByText('first watering')).toBeInTheDocument();
    expect(screen.getByText('second watering')).toBeInTheDocument();
  });

  it('has no watering form, no Edit button, and no per-entry menus', () => {
    renderModal();
    expect(screen.queryByTestId('update-form-region')).not.toBeInTheDocument();
    expect(screen.getByTestId('archived-notice')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument();
    // Only the header menu survives; timeline entries expose none.
    expect(screen.getAllByRole('button', { name: /more options/i })).toHaveLength(1);
  });

  it('labels the idea as frozen', () => {
    renderModal();
    expect(screen.getByText(/frozen in the archive/i)).toBeInTheDocument();
  });
});

describe('<IdeaDetailModal> — unarchive and permanent delete (004 US3, US4)', () => {
  beforeEach(() => {
    useIdeaDetailMock.mockReturnValue({
      status: 'ready',
      idea: archivedIdea(),
      updates: [],
    });
  });

  it('offers Unarchive idea and Delete forever, but never Archive', async () => {
    const user = userEvent.setup();
    renderModal();
    await openHeaderMenu(user);

    expect(screen.getByRole('menuitem', { name: /unarchive idea/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /delete forever/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /^archive idea$/i })).not.toBeInTheDocument();
  });

  it('unarchiving calls onUnarchiveIdea and closes the modal', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onUnarchiveIdea = vi.fn().mockResolvedValue(undefined);
    renderModal({ onClose, onUnarchiveIdea });

    await openHeaderMenu(user);
    await user.click(screen.getByRole('menuitem', { name: /unarchive idea/i }));

    await waitFor(() => expect(onUnarchiveIdea).toHaveBeenCalledWith(ULID));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('on a rejected unarchive the modal stays open with a visible reason', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onUnarchiveIdea = vi.fn().mockRejectedValue(new Error('nope'));
    renderModal({ onClose, onUnarchiveIdea });

    await openHeaderMenu(user);
    await user.click(screen.getByRole('menuitem', { name: /unarchive idea/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('nope'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Delete forever goes through the existing confirmation dialog', async () => {
    const user = userEvent.setup();
    renderModal();
    await openHeaderMenu(user);
    await user.click(screen.getByRole('menuitem', { name: /delete forever/i }));
    expect(screen.getByText(/Delete "My Idea"\?/)).toBeInTheDocument();
  });

  it('Cancel closes the dialog without calling onDeleteIdea', async () => {
    const user = userEvent.setup();
    const onDeleteIdea = vi.fn();
    renderModal({ onDeleteIdea });

    await openHeaderMenu(user);
    await user.click(screen.getByRole('menuitem', { name: /delete forever/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onDeleteIdea).not.toHaveBeenCalled();
  });

  it('confirming calls onDeleteIdea and (on success) closes both dialog and modal', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onDeleteIdea = vi.fn().mockResolvedValue(undefined);
    renderModal({ onClose, onDeleteIdea });

    await openHeaderMenu(user);
    await user.click(screen.getByRole('menuitem', { name: /delete forever/i }));
    await user.click(screen.getByRole('button', { name: /yes, delete forever/i }));

    await waitFor(() => expect(onDeleteIdea).toHaveBeenCalled());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('on error from onDeleteIdea, the modal stays open and the error is shown', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onDeleteIdea = vi.fn().mockRejectedValue(new Error('boom'));
    renderModal({ onClose, onDeleteIdea });

    await openHeaderMenu(user);
    await user.click(screen.getByRole('menuitem', { name: /delete forever/i }));
    await user.click(screen.getByRole('button', { name: /yes, delete forever/i }));

    await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
  });
});
