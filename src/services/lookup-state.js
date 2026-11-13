/**
 * What Define and Search remember between visits and launches.
 *
 * Stored under `lookupState` as { term, query }: `term` is the Tibetan term
 * Define selected last, `query` the last query Search searched. (A former
 * `mode`, from when one page held both, is ignored.)
 */
import Storage from './storage';
import { MAX_PREVIOUS_QUERIES } from '../config/constants';

const STORAGE_KEY = 'lookupState';

export function readLookupState() {
  const stored = Storage.get(STORAGE_KEY);
  // Before Define (then called Lookup) stored anything, it opens on the term the former page showed last
  // (its `selectedTerm`), so the first launch after the update starts there
  const term = stored ? stored.term : Storage.get('selectedTerm');
  return {
    term: typeof term === 'string' ? term : '',
    query: typeof stored?.query === 'string' ? stored.query : '',
  };
}

export function writeLookupState(partial) {
  Storage.set(STORAGE_KEY, { ...readLookupState(), ...partial });
}

// The queries searched before, most recent first, shared with what the
// former Search page kept under `previousQueries`
const PREVIOUS_QUERIES_KEY = 'previousQueries';

export function readPreviousQueries() {
  const stored = Storage.get(PREVIOUS_QUERIES_KEY, []);
  return Array.isArray(stored) ? stored : [];
}

/** The query goes first, once, and the list is cut at MAX_PREVIOUS_QUERIES. */
export function storePreviousQuery(query) {
  if (!query) return;
  const queries = [query, ...readPreviousQueries().filter((previous) => previous !== query)];
  Storage.set(PREVIOUS_QUERIES_KEY, queries.slice(0, MAX_PREVIOUS_QUERIES));
}

export function clearPreviousQueries() {
  Storage.set(PREVIOUS_QUERIES_KEY, []);
}
