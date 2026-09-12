import type { APIRequestContext } from '@playwright/test';

const SERVER_PORT = process.env.E2E_SERVER_PORT ?? '3030';
const API_BASE = `http://localhost:${SERVER_PORT}`;

/**
 * Empties the garden and the archive through the public API.
 *
 * `globalSetup` deletes the SQLite file once per run, which only guarantees a
 * clean slate to whichever spec file happens to run first. Any spec whose
 * assertions depend on starting empty calls this in a `beforeAll` so it does
 * not silently depend on file ordering.
 *
 * Deletion now goes through the archive — the garden itself no longer offers
 * permanent deletion (spec 004 FR-019).
 */
export async function resetGarden(request: APIRequestContext): Promise<void> {
  for (const listing of ['/api/ideas', '/api/ideas/archived']) {
    const res = await request.get(`${API_BASE}${listing}`);
    const ideas = (await res.json()) as { id: string }[];
    for (const { id } of ideas) {
      await request.post(`${API_BASE}/api/ideas/${id}/archive`);
      await request.delete(`${API_BASE}/api/ideas/${id}`);
    }
  }
}
