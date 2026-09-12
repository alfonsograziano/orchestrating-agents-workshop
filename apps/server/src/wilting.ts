import type { Idea } from '@idea-garden/shared';
import type { IdeaReadRow } from './db.ts';

/**
 * How long an idea may go unwatered before it wilts. Seven days: long enough
 * that a normal week of neglect is forgiven, short enough that the garden
 * notices an idea you have actually walked away from.
 */
export const WILT_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Attach the read-time wilting view to a stored idea row.
 *
 * `now` is a parameter rather than a `Date.now()` call so the whole rule is a
 * pure function of (row, now) and a test can decide what "now" is.
 *
 * Nothing here is written back: wilting is re-derived on every read. That is
 * forced by the model — `ideas.stage` is recomputed from MAX(stage_after) on
 * every mutation, so a stored penalty would be erased by the next write, and
 * no write happens at all when time simply passes.
 */
export function withWilting(row: IdeaReadRow, now: number): Idea {
  // An idea that has never been watered is measured from when it was planted:
  // a seed nobody came back to is the most neglected thing in the garden.
  const since = Math.max(0, now - (row.last_watered_at ?? row.created_at));
  const wilted = since >= WILT_AFTER_MS;
  return {
    ...row,
    ms_since_watered: since,
    wilted,
    // One stage lost, however long the neglect lasts, and never below Level 1 —
    // a seed has no ground left to lose. `stage` itself is untouched, so the
    // moment the idea is watered again it recovers everything it appeared to
    // lose (and gains the stage the watering itself is worth).
    effective_stage: wilted ? Math.max(row.stage - 1, 1) : row.stage,
  };
}
