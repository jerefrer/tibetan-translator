/**
 * What Lookup remembers between visits and launches, and what its field shows
 * when the བོད / EN switch is used.
 *
 * Stored under `lookupState` as { mode: 'bo' | 'en', term, query }: `term` is
 * the Tibetan term last selected, `query` the last English query.
 */
import Storage from './storage';
import { wylieToTibetan } from './quick-lookup';

const STORAGE_KEY = 'lookupState';
export const LOOKUP_MODES = ['bo', 'en'];
const LATIN = /[A-Za-z]/;

export function isLookupMode(value) {
  return LOOKUP_MODES.includes(value);
}

export function readLookupState() {
  const stored = Storage.get(STORAGE_KEY);
  // Before Lookup stored anything, it opens on the term Define showed last
  // (its `selectedTerm`), so the first launch after the update starts there
  const term = stored ? stored.term : Storage.get('selectedTerm');
  return {
    mode: isLookupMode(stored?.mode) ? stored.mode : 'bo',
    term: typeof term === 'string' ? term : '',
    query: typeof stored?.query === 'string' ? stored.query : '',
  };
}

export function writeLookupState(partial) {
  Storage.set(STORAGE_KEY, { ...readLookupState(), ...partial });
}

/**
 * The text the field shows after switching from `mode` to `newMode`.
 * To English: the Latin the user typed when it is known (the field turned
 * it into Tibetan), else the text as it is. To Tibetan: text holding Latin
 * is read as Wylie, as the Tibetan field would on a space; Tibetan stays.
 */
export function switchLookupMode({ mode, text, typedWylie }, newMode) {
  const value = text || '';
  if (newMode === mode) return value;
  if (newMode === 'en') return typedWylie || value;
  return LATIN.test(value) ? wylieToTibetan(value) : value;
}

