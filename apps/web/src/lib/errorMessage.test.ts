import { describe, expect, it } from 'vitest';
import { errorMessage } from './errorMessage.ts';

describe('errorMessage', () => {
  it('turns idea_archived into an explanation the user can act on', () => {
    expect(errorMessage(new Error('idea_archived'), 'fallback')).toMatch(/unarchive it/i);
  });

  it('turns idea_not_archived into an explanation the user can act on', () => {
    expect(errorMessage(new Error('idea_not_archived'), 'fallback')).toMatch(/archive this idea/i);
  });

  it('passes an unrecognised error message through rather than swallowing it', () => {
    expect(errorMessage(new Error('kaboom'), 'fallback')).toBe('kaboom');
  });

  it('falls back when there is no message to show', () => {
    expect(errorMessage(undefined, 'fallback')).toBe('fallback');
    expect(errorMessage(new Error(''), 'fallback')).toBe('fallback');
  });
});
