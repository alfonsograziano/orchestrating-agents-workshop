import { useCallback, useEffect, useState } from 'react';
import type { Idea } from '@idea-garden/shared';
import {
  ApiClientError,
  deleteIdea as apiDeleteIdea,
  listArchivedIdeas,
  unarchiveIdea as apiUnarchiveIdea,
} from '../api/ideas.ts';

export type UseArchivedIdeasState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  ideas: Idea[];
  error?: string;
};

export type UseArchivedIdeasResult = UseArchivedIdeasState & {
  refresh: () => Promise<void>;
  unarchiveIdea: (ideaId: string) => Promise<void>;
  deleteIdea: (ideaId: string) => Promise<void>;
};

export function useArchivedIdeas(): UseArchivedIdeasResult {
  const [state, setState] = useState<UseArchivedIdeasState>({ status: 'idle', ideas: [] });

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading' }));
    try {
      const ideas = await listArchivedIdeas();
      setState({ status: 'ready', ideas });
    } catch (err) {
      setState({
        status: 'error',
        ideas: [],
        error: err instanceof ApiClientError ? err.message : 'Failed to load the archive',
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Both of these drop the row only after the server confirms, so a rejected
  // request leaves the archive exactly as the user last saw it.
  const unarchiveIdea = useCallback(async (ideaId: string): Promise<void> => {
    await apiUnarchiveIdea(ideaId);
    setState((s) => ({ ...s, ideas: s.ideas.filter((i) => i.id !== ideaId) }));
  }, []);

  const deleteIdea = useCallback(async (ideaId: string): Promise<void> => {
    await apiDeleteIdea(ideaId);
    setState((s) => ({ ...s, ideas: s.ideas.filter((i) => i.id !== ideaId) }));
  }, []);

  return { ...state, refresh, unarchiveIdea, deleteIdea };
}
