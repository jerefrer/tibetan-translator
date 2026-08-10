import { describe, it, expect } from 'vitest';
import { tibetanLookupKey } from '../src/utils.js';

// TibetanRegExps.endPunctuation is /([༄༅་༈།༎༑༔]+)$/giu — eight characters.
// tibetanLookupKey() must collapse a trailing run of ANY of them to a single
// tsheg, because it's the canonical lookup key shared by normalizeTerm(),
// GlobalLookupWindow.vue, and SelectedTibetanEntriesPopup.vue.
const END_PUNCTUATION_CHARS = ['༄', '༅', '་', '༈', '།', '༎', '༑', '༔'];

describe('tibetanLookupKey', () => {
  it('leaves the key untouched when there is no trailing punctuation', () => {
    expect(tibetanLookupKey('ཞི་བདེ')).toBe('ཞི་བདེ་');
  });

  it('collapses a run of several trailing punctuation characters to one tsheg', () => {
    expect(tibetanLookupKey('ཞི་བདེ།༎༄')).toBe('ཞི་བདེ་');
  });

  for (const char of END_PUNCTUATION_CHARS) {
    it(`collapses a single trailing ${char} to one tsheg`, () => {
      expect(tibetanLookupKey(`ཞི་བདེ${char}`)).toBe('ཞི་བདེ་');
    });
  }

  describe('regression: the hand-rolled expression GlobalLookupWindow.vue used before delegating here', () => {
    // GlobalLookupWindow.vue's old cleanTibetanText ended with
    // `cleaned.replace(/[་།༑༔]*$/, '་')` — four characters, not the eight
    // TibetanRegExps.endPunctuation covers. For a term ending in one of the
    // missing four (༄ ༅ ༈ ༎), that expression left the punctuation in place
    // and appended a tsheg after it, producing a lookup key no stored term
    // could ever match — the exact bug that motivated delegating to
    // tibetanLookupKey() instead of hand-rolling the trailing-punctuation
    // class again.
    const oldHandRolledExpression = (text) => text.replace(/[་།༑༔]*$/, '་');

    const missingFromOldClass = ['༄', '༅', '༈', '༎'];
    for (const char of missingFromOldClass) {
      it(`gives a different (wrong) answer than tibetanLookupKey for trailing ${char}`, () => {
        const raw = `ཞི་བདེ${char}`;
        expect(oldHandRolledExpression(raw)).not.toBe(tibetanLookupKey(raw));
      });
    }

    const presentInOldClass = ['་', '།', '༑', '༔'];
    for (const char of presentInOldClass) {
      it(`happens to agree with tibetanLookupKey for trailing ${char} (already in its class)`, () => {
        const raw = `ཞི་བདེ${char}`;
        expect(oldHandRolledExpression(raw)).toBe(tibetanLookupKey(raw));
      });
    }
  });
});
