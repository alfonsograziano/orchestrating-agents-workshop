import { z } from 'zod';
import { ulid } from 'ulid';
import {
  ARCHIVED_IDEA_ERROR,
  NOT_ARCHIVED_IDEA_ERROR,
  EditIdeaInputSchema,
  EditIdeaUpdateInputSchema,
  IdeaDetailResponseSchema,
  IdeaListSchema,
  IdeaSchema,
  MutationResponseSchema,
  NewIdeaInputSchema,
  NewIdeaUpdateInputSchema,
} from '@idea-garden/shared';
import type { FastifyTypedInstance } from '../app.ts';
import type { AppDb, IdeaRow, IdeaUpdateRow } from '../db.ts';
import { randomSpecies } from '../species.ts';

const IdParamsSchema = z.object({ id: z.string().length(26) });
const IdAndUpdateIdParamsSchema = z.object({
  id: z.string().length(26),
  updateId: z.string().length(26),
});

type HttpError = Error & { statusCode: number; code: string };

function httpError(statusCode: number, code: string): HttpError {
  const err = new Error(code) as HttpError;
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

/**
 * Loads an idea and refuses to hand it to a mutating handler while it is
 * archived. Every write path that touches an idea — or anything belonging to
 * it — goes through here, so "frozen" is enforced in one place (FR-006).
 */
function loadActiveIdea(db: AppDb, id: string): IdeaRow {
  const idea = db.selectIdeaById.get(id);
  if (!idea) throw httpError(404, 'idea_not_found');
  if (idea.archived_at !== null) throw httpError(409, ARCHIVED_IDEA_ERROR);
  return idea;
}

export function registerIdeasRoutes(app: FastifyTypedInstance, db: AppDb): void {
  app.route({
    method: 'GET',
    url: '/api/ideas',
    schema: {
      response: {
        200: IdeaListSchema,
      },
    },
    handler: async (_request, reply) => {
      const rows = db.selectAllIdeas.all();
      reply.status(200);
      return rows;
    },
  });

  app.route({
    method: 'GET',
    url: '/api/ideas/archived',
    schema: {
      response: {
        200: IdeaListSchema,
      },
    },
    handler: async (_request, reply) => {
      const rows = db.selectArchivedIdeas.all();
      reply.status(200);
      return rows;
    },
  });

  app.route({
    method: 'POST',
    url: '/api/ideas',
    schema: {
      body: NewIdeaInputSchema,
      response: {
        201: IdeaSchema,
      },
    },
    handler: async (request, reply) => {
      const { title, description } = request.body;
      const now = Date.now();
      const row: IdeaRow = {
        id: ulid(),
        title,
        description: description ?? null,
        species: randomSpecies(),
        stage: 1,
        created_at: now,
        updated_at: now,
        archived_at: null,
      };
      db.insertIdea.run(row);
      reply.header('Location', `/api/ideas/${row.id}`);
      reply.status(201);
      return row;
    },
  });

  app.route({
    method: 'GET',
    url: '/api/ideas/:id',
    schema: {
      params: IdParamsSchema,
      response: {
        200: IdeaDetailResponseSchema,
      },
    },
    handler: async (request) => {
      const { id } = request.params;
      const idea = db.selectIdeaById.get(id);
      if (!idea) throw httpError(404, 'idea_not_found');
      const updates = db.selectUpdatesForIdea.all(id);
      return { idea, updates };
    },
  });

  app.route({
    method: 'PATCH',
    url: '/api/ideas/:id',
    schema: {
      params: IdParamsSchema,
      body: EditIdeaInputSchema,
      response: {
        200: MutationResponseSchema,
      },
    },
    handler: async (request) => {
      const { id } = request.params;
      const current = loadActiveIdea(db, id);
      const prev_stage = current.stage;
      const input = request.body;
      const nextTitle = input.title ?? current.title;
      const nextDescription =
        input.description === undefined
          ? current.description
          : input.description === '' || input.description === null
            ? null
            : input.description;
      db.updateIdeaMeta.run({
        id,
        title: nextTitle,
        description: nextDescription,
        updated_at: Date.now(),
      });
      const idea = db.selectIdeaById.get(id);
      if (!idea) throw httpError(404, 'idea_not_found');
      return { idea, prev_stage };
    },
  });

  app.route({
    method: 'DELETE',
    url: '/api/ideas/:id',
    schema: {
      params: IdParamsSchema,
    },
    handler: async (request, reply) => {
      const { id } = request.params;
      const current = db.selectIdeaById.get(id);
      if (!current) throw httpError(404, 'idea_not_found');
      // Permanent deletion is reachable only from the archive; the garden
      // clears cards by archiving (FR-019).
      if (current.archived_at === null) throw httpError(409, NOT_ARCHIVED_IDEA_ERROR);
      db.deleteIdea.run(id);
      reply.code(204);
      return reply.send();
    },
  });

  app.route({
    method: 'POST',
    url: '/api/ideas/:id/updates',
    schema: {
      params: IdParamsSchema,
      body: NewIdeaUpdateInputSchema,
      response: {
        201: MutationResponseSchema,
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params;
      const current = loadActiveIdea(db, id);
      const prev_stage = current.stage;
      const { note } = request.body;

      const updateRow = db.runUpdateMutation(id, (tx) => {
        // Stage progression rule: an unwatered idea is Level 1. The first
        // watering takes it to Level 2, second to Level 3, etc., capped at 16.
        // Implementation: baseline 1 when no prior updates exist.
        const maxRow = tx.selectMaxStageAfter.get(id);
        const baseline = maxRow?.max_stage ?? 1;
        const row: IdeaUpdateRow = {
          id: ulid(),
          idea_id: id,
          note,
          stage_after: Math.min(baseline + 1, 16),
          created_at: Date.now(),
        };
        tx.insertUpdate.run(row);
        return row;
      });

      const idea = db.selectIdeaById.get(id);
      if (!idea) throw httpError(404, 'idea_not_found');

      reply.header('Location', `/api/ideas/${id}/updates/${updateRow.id}`);
      reply.status(201);
      return { idea, prev_stage, update: updateRow };
    },
  });

  app.route({
    method: 'PATCH',
    url: '/api/ideas/:id/updates/:updateId',
    schema: {
      params: IdAndUpdateIdParamsSchema,
      body: EditIdeaUpdateInputSchema,
      response: {
        200: MutationResponseSchema,
      },
    },
    handler: async (request) => {
      const { id, updateId } = request.params;
      const existing = db.selectUpdateById.get(updateId);
      if (!existing || existing.idea_id !== id) throw httpError(404, 'update_not_found');
      const current = loadActiveIdea(db, id);
      const prev_stage = current.stage;
      const { note } = request.body;

      const updated = db.runUpdateMutation(id, (tx) => {
        tx.updateUpdateNote.run({ id: updateId, note });
        return tx.selectUpdateById.get(updateId);
      });
      const idea = db.selectIdeaById.get(id);
      if (!idea || !updated) throw httpError(404, 'update_not_found');
      return { idea, prev_stage, update: updated };
    },
  });

  app.route({
    method: 'DELETE',
    url: '/api/ideas/:id/updates/:updateId',
    schema: {
      params: IdAndUpdateIdParamsSchema,
      response: {
        200: MutationResponseSchema,
      },
    },
    handler: async (request) => {
      const { id, updateId } = request.params;
      const existing = db.selectUpdateById.get(updateId);
      if (!existing || existing.idea_id !== id) throw httpError(404, 'update_not_found');
      const current = loadActiveIdea(db, id);
      const prev_stage = current.stage;

      db.runUpdateMutation(id, (tx) => {
        tx.deleteUpdate.run(updateId);
      });
      const idea = db.selectIdeaById.get(id);
      if (!idea) throw httpError(404, 'idea_not_found');
      return { idea, prev_stage };
    },
  });

  app.route({
    method: 'POST',
    url: '/api/ideas/:id/archive',
    schema: {
      params: IdParamsSchema,
      response: {
        200: IdeaSchema,
      },
    },
    handler: async (request) => {
      const { id } = request.params;
      const current = db.selectIdeaById.get(id);
      if (!current) throw httpError(404, 'idea_not_found');
      db.archiveIdea.run({ id, archived_at: Date.now() });
      const idea = db.selectIdeaById.get(id);
      if (!idea) throw httpError(404, 'idea_not_found');
      return idea;
    },
  });

  app.route({
    method: 'POST',
    url: '/api/ideas/:id/unarchive',
    schema: {
      params: IdParamsSchema,
      response: {
        200: IdeaSchema,
      },
    },
    handler: async (request) => {
      const { id } = request.params;
      const current = db.selectIdeaById.get(id);
      if (!current) throw httpError(404, 'idea_not_found');
      db.unarchiveIdea.run(id);
      const idea = db.selectIdeaById.get(id);
      if (!idea) throw httpError(404, 'idea_not_found');
      return idea;
    },
  });
}
