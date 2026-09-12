import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { Idea } from '@idea-garden/shared';
import { useArchivedIdeas } from './useArchivedIdeas.ts';

const ULID = 'A'.repeat(26);

const buildIdea = (overrides: Partial<Idea> = {}): Idea => ({
  id: ULID,
  title: 'Archived idea',
  description: null,
  species: 'oak',
  stage: 5,
  created_at: 1746783402000,
  updated_at: 1746783402000,
  archived_at: 1746790000000,
  ...overrides,
});

const okJson = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useArchivedIdeas', () => {
  it('loads the archive listing from GET /api/ideas/archived', async () => {
    const idea = buildIdea();
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(url);
        return okJson(200, [idea]);
      }),
    );

    const { result } = renderHook(() => useArchivedIdeas());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(urls).toEqual(['/api/ideas/archived']);
    expect(result.current.ideas).toEqual([idea]);
  });

  it('surfaces a load failure instead of showing a false empty archive', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okJson(500, { error: 'internal_error' })));

    const { result } = renderHook(() => useArchivedIdeas());
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('internal_error');
  });

  it('drops the idea from the archive once an unarchive succeeds', async () => {
    const idea = buildIdea();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit | undefined) => {
        if (init?.method === 'POST' && url.endsWith('/unarchive')) {
          return okJson(200, { ...idea, archived_at: null });
        }
        return okJson(200, [idea]);
      }),
    );

    const { result } = renderHook(() => useArchivedIdeas());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => {
      await result.current.unarchiveIdea(idea.id);
    });
    expect(result.current.ideas).toEqual([]);
  });

  it('keeps the idea in the archive when an unarchive is rejected', async () => {
    const idea = buildIdea();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit | undefined) => {
        if (init?.method === 'POST' && url.endsWith('/unarchive')) {
          return okJson(500, { error: 'internal_error' });
        }
        return okJson(200, [idea]);
      }),
    );

    const { result } = renderHook(() => useArchivedIdeas());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => {
      await expect(result.current.unarchiveIdea(idea.id)).rejects.toThrow();
    });
    expect(result.current.ideas).toEqual([idea]);
  });

  it('drops the idea once a permanent delete succeeds', async () => {
    const idea = buildIdea();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit | undefined) => {
        if (init?.method === 'DELETE') return new Response(null, { status: 204 });
        return okJson(200, [idea]);
      }),
    );

    const { result } = renderHook(() => useArchivedIdeas());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => {
      await result.current.deleteIdea(idea.id);
    });
    expect(result.current.ideas).toEqual([]);
  });
});
