import { describe, it, expect } from 'vitest';
import { normalizeTerm, prepareEntry } from '../src/services/lexicon.js';

describe('normalizeTerm', () => {
  it('appends a tsheg when the term has no trailing punctuation', () => {
    expect(normalizeTerm('ཞི་བདེ')).toBe('ཞི་བདེ་');
  });

  it('replaces a trailing shad with a tsheg so the global lookup finds it', () => {
    // GlobalLookupPopup queries with withTrailingTshek(); storing a shad would
    // make the entry invisible to the hotkey.
    expect(normalizeTerm('ཞི་བདེ།')).toBe('ཞི་བདེ་');
  });

  it('leaves an already-normalized term untouched', () => {
    expect(normalizeTerm('ཞི་བདེ་')).toBe('ཞི་བདེ་');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeTerm('  ཞི་བདེ་  ')).toBe('ཞི་བདེ་');
  });

  it('returns an empty string for input with no usable content', () => {
    expect(normalizeTerm('')).toBe('');
    expect(normalizeTerm('   ')).toBe('');
    expect(normalizeTerm('།')).toBe('');
  });
});

describe('prepareEntry', () => {
  it('returns null when the term is unusable', () => {
    expect(prepareEntry('', 'peace')).toBeNull();
    expect(prepareEntry('   ', 'peace')).toBeNull();
  });

  it('returns null when the definition is empty', () => {
    expect(prepareEntry('ཞི་བདེ་', '   ')).toBeNull();
  });

  it('normalizes the term and fills all six columns', () => {
    const entry = prepareEntry('ཞི་བདེ།', '  peace  ');
    expect(entry.term).toBe('ཞི་བདེ་');
    expect(entry.definition).toBe('peace');
    expect(typeof entry.termPhoneticsStrict).toBe('string');
    expect(typeof entry.termPhoneticsLoose).toBe('string');
    expect(typeof entry.definitionPhoneticsWordsStrict).toBe('string');
    expect(typeof entry.definitionPhoneticsWordsLoose).toBe('string');
  });

  it('produces the same phonetics the pack build pipeline would', async () => {
    const { strictAndLoosePhoneticsFor } = await import('../src/utils.js');
    const entry = prepareEntry('ཞི་བདེ་', 'peace');
    const [strict, loose] = strictAndLoosePhoneticsFor('ཞི་བདེ་');
    expect(entry.termPhoneticsStrict).toBe(strict);
    expect(entry.termPhoneticsLoose).toBe(loose);
  });
});
