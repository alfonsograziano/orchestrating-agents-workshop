import { ARCHIVED_IDEA_ERROR, NOT_ARCHIVED_IDEA_ERROR } from '@idea-garden/shared';

/**
 * The server answers a refused mutation with a machine-readable code; this is
 * where each one becomes a sentence a gardener can act on (spec 004 FR-007).
 * Anything unrecognised falls through to the raw message so errors still
 * surface rather than getting swallowed (constitution, Principle I).
 */
const MESSAGES: Record<string, string> = {
  [ARCHIVED_IDEA_ERROR]: 'This idea is archived and frozen. Unarchive it to make changes.',
  [NOT_ARCHIVED_IDEA_ERROR]: 'Archive this idea before deleting it for good.',
  idea_not_found: 'That idea is no longer in your garden.',
  update_not_found: 'That watering is no longer on the timeline.',
  validation: "That didn't look right. Check the form and try again.",
};

export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    const known = MESSAGES[err.message];
    if (known) return known;
    if (err.message) return err.message;
  }
  return fallback;
}
