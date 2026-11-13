import { createRecents } from './recents';

// The terms the user opened in Define, most recent first.
export const HISTORY_LIMIT = 20;

// Define opens the first matching term as you type, so typing སངས་རྒྱས་
// opens སངས་ on the way: a term that extends (or shortens) the latest one
// replaces it instead of piling up every step
const recents = createRecents({
  key: 'defineHistory',
  limit: HISTORY_LIMIT,
  sameAs: (a, b) => a === b,
  replacesLatest: (latest, next) => next.startsWith(latest) || latest.startsWith(next),
});

export const recentTerms = () => recents.list();

export function recordTerm(term) {
  if (typeof term !== 'string' || !term.trim()) return;
  recents.record(term);
}

export const forgetTerm = (term) => recents.remove(term);

export const clearHistory = () => recents.clear();
