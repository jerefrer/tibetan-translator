import { describe, it, expect } from 'vitest';
import TibetanRegExps from 'tibetan-regexps';
import { withTrailingTshek } from '../src/utils.js';
import { normalizeTerm, prepareEntry } from '../src/services/lexicon.js';

// Mirrors what GlobalLookupWindow.vue and SelectedTibetanEntriesPopup.vue do
// before querying (strip non-Tibetan characters, drop leading punctuation,
// end with exactly one tsheg) — computed here from the raw regexes rather
// than via the lexicon service or the strippedTibetanText/tibetanLookupKey
// helpers it shares with those components, so these tests prove normalizeTerm
// actually matches the lookup path instead of just restating its
// implementation.
function lookupPathKey(raw) {
  const stripped = raw
    .replace(TibetanRegExps.anythingNonTibetan, '')
    .replace(TibetanRegExps.beginningPunctuation, '');
  return withTrailingTshek(stripped);
}

describe('normalizeTerm', () => {
  it('appends a tsheg when the term has no trailing punctuation', () => {
    expect(normalizeTerm('ཞི་བདེ')).toBe('ཞི་བདེ་');
  });

  it('replaces a trailing shad with a tsheg so the global lookup finds it', () => {
    // GlobalLookupWindow queries with tibetanLookupKey(); storing a shad would
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

  describe('matches what the lookup path queries with', () => {
    // GlobalLookupWindow.vue and SelectedTibetanEntriesPopup.vue delete every
    // non-Tibetan character rather than substituting it. A term stored with
    // an embedded hyphen/quote/newline replaced by a space (as cleanTerm()
    // would do) is a different string, so `WHERE entries.term = ?` never
    // matches and the entry becomes silently invisible to the hotkey lookup.
    const cases = {
      'an embedded hyphen': 'ཤེས་རིག-དཔེ་མཛོད',
      'an embedded double quote': 'ཞི"བདེ',
      'an embedded newline': 'ཞི\nབདེ',
      'a Latin word mixed in': 'ཞི་བདེ world',
      'a leading tsheg': '་ཡི་སྒྲ་',
      'a trailing shad': 'ཞི་བདེ།',
      'trailing whitespace': '  ཞི་བདེ་  ',
      'an already-normalized term': 'ཞི་བདེ་',
    };

    for (const [description, raw] of Object.entries(cases)) {
      it(`for ${description}`, () => {
        expect(normalizeTerm(raw)).toBe(lookupPathKey(raw));
      });
    }
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
    const [definitionStrict, definitionLoose] = strictAndLoosePhoneticsFor('peace');
    expect(entry.definitionPhoneticsWordsStrict).toBe(definitionStrict);
    expect(entry.definitionPhoneticsWordsLoose).toBe(definitionLoose);
  });
});
