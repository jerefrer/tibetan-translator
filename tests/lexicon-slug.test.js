import { describe, it, expect } from 'vitest';
import { slugForName } from '../src/services/lexicon.js';

describe('slugForName', () => {
  it('lowercases and hyphenates a plain name', () => {
    expect(slugForName('My Lexicon', [])).toBe('my-lexicon');
  });

  it('strips accents so French names produce valid ids', () => {
    expect(slugForName('Médecine tibétaine', [])).toBe('medecine-tibetaine');
  });

  it('collapses punctuation runs into single hyphens', () => {
    expect(slugForName('Dzogchen -- notes!!', [])).toBe('dzogchen-notes');
  });

  it('falls back to "lexicon" when the name has no ASCII letters', () => {
    expect(slugForName('ཆོས་སྐད་', [])).toBe('lexicon');
  });

  it('pads one-character slugs so they satisfy the id regex', () => {
    // The pack id regex requires at least two characters.
    expect(slugForName('A', [])).toBe('a-lexicon');
  });

  it('deduplicates against ids already installed', () => {
    expect(slugForName('My Lexicon', ['custom-my-lexicon'])).toBe('my-lexicon-2');
    expect(slugForName('My Lexicon', ['custom-my-lexicon', 'custom-my-lexicon-2']))
      .toBe('my-lexicon-3');
  });

  it('always produces an id matching the pack id regex', () => {
    const regex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
    for (const name of ['My Lexicon', 'Médecine', 'A', '  ', '2024', '---']) {
      expect(slugForName(name, [])).toMatch(regex);
    }
  });
});
