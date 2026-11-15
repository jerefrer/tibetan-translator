/**
 * What Define and Search remember between visits and launches.
 *
 * Stored under `lookupState` as { term, query }: `term` is the Tibetan term
 * Define selected last, `query` the last query Search searched. (A former
 * `mode`, from when one page held both, is ignored.)
 */
import Storage from './storage';
import { MAX_PREVIOUS_QUERIES } from '../config/constants';
import { queryConditions } from './query-conditions';

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

// Set once the list has been through cleanPreviousQueries
const CLEANED_KEY = 'previousQueriesCleaned';

// Whether `earlier` is `later` typed so far: all its conditions but the last
// are the same, and the last is a strict start of the one at its index
function isTypedPartOf(earlier, later) {
  if (!earlier.length || later.length < earlier.length) return false;
  const last = earlier.length - 1;
  for (let i = 0; i < last; i++) {
    if (earlier[i].mode !== later[i].mode || earlier[i].term !== later[i].term) return false;
  }
  return (
    earlier[last].mode === later[last].mode &&
    later[last].term.length > earlier[last].term.length &&
    later[last].term.startsWith(earlier[last].term)
  );
}

/** The list without what typing left behind: queries that are empty or end
 *  on a dangling `&`, and a query that is only the start of a more recent
 *  one (`[sang gye] & enlightenment & sidd` before `... & siddhartha`).
 *  A query whose conditions are all complete stays, even when a more recent
 *  one adds to it (`buddha` before `buddha & dharma`). Order is kept. */
export function cleanPreviousQueries(queries) {
  const conditions = queries.map((query) => queryConditions(query));
  return queries.filter((query, index) => {
    const text = (query || '').trim();
    if (!text || text.endsWith('&')) return false;
    return !conditions.slice(0, index).some((more) => isTypedPartOf(conditions[index], more));
  });
}

export function readPreviousQueries() {
  const stored = Storage.get(PREVIOUS_QUERIES_KEY, []);
  const queries = Array.isArray(stored) ? stored : [];
  // 1.12 saved every query typed after a pause, so its lists are full of
  // half-typed ones: cleaned once, then only complete searches are stored
  if (Storage.get(CLEANED_KEY) !== true) {
    const cleaned = cleanPreviousQueries(queries);
    Storage.set(PREVIOUS_QUERIES_KEY, cleaned);
    Storage.set(CLEANED_KEY, true);
    return cleaned;
  }
  return queries;
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

export function removePreviousQuery(query) {
  Storage.set(PREVIOUS_QUERIES_KEY, readPreviousQueries().filter((previous) => previous !== query));
}
