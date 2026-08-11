/**
 * messageForError maps the `code` on a Rust LexiconError to something the user
 * can act on. Before this, every failure collapsed into one generic sentence:
 * a name collision on create reported "Could not create this dictionary."
 * with no hint that the name was the problem.
 *
 * The codes under test are the ones declared in src-tauri/src/lexicon.rs.
 */

import { describe, it, expect } from 'vitest';
import { messageForError } from '../src/services/lexicon.js';

const FALLBACK = 'Could not do the thing.';

describe('messageForError', () => {
  it('tells the user what to do about a name collision', () => {
    const message = messageForError({ code: 'conflict', message: 'custom-x exists' }, FALLBACK);
    expect(message).toContain('already exists');
    expect(message).toContain('another name');
  });

  it('has a distinct message for every code the Rust side declares', () => {
    const codes = ['conflict', 'notFound', 'notCustom', 'corrupt', 'path'];
    const messages = codes.map((code) => messageForError({ code }, FALLBACK));

    // None may silently fall through to the generic sentence...
    for (const message of messages) expect(message).not.toBe(FALLBACK);
    // ...and none may be mistaken for another.
    expect(new Set(messages).size).toBe(codes.length);
  });

  it('falls back for an unknown code', () => {
    expect(messageForError({ code: 'somethingNew' }, FALLBACK)).toBe(FALLBACK);
  });

  it('falls back for errors that are not LexiconErrors at all', () => {
    expect(messageForError(new Error('boom'), FALLBACK)).toBe(FALLBACK);
    expect(messageForError('a bare string', FALLBACK)).toBe(FALLBACK);
    expect(messageForError(null, FALLBACK)).toBe(FALLBACK);
    expect(messageForError(undefined, FALLBACK)).toBe(FALLBACK);
  });

  it('never leaks a raw Rust message to the user', () => {
    // The `message` field carries developer detail like "mkdir: permission
    // denied" — useful in a console, not in a dialog.
    const raw = 'insert dictionary: database is locked';
    expect(messageForError({ code: 'corrupt', message: raw }, FALLBACK)).not.toContain(raw);
  });
});
