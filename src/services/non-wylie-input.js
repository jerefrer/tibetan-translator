/**
 * Lookup's Tibetan mode (བོད) only looks up Tibetan, and its field turns
 * whatever is typed into Tibetan script. Wylie is plain ASCII, so a letter with
 * a diacritic (kāka, śūnyatā) is a reliable sign the user is typing Sanskrit or
 * another language that the English mode (EN), searching the definitions, can
 * find.
 */

// Latin-1 Supplement letters through Latin Extended-B, plus Latin Extended
// Additional (ṇ, ṣ, ṃ ...). Excludes the plain ASCII range.
const LATIN_WITH_DIACRITICS = /[À-ɏḀ-ỿ]/;

export function hasLatinDiacritics(text) {
  return LATIN_WITH_DIACRITICS.test(String(text || ''));
}
