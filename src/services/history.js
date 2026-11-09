import Storage from './storage';

// The terms the user opened in Define, most recent first.
const KEY = 'defineHistory';
export const HISTORY_LIMIT = 20;

export function recentTerms() {
  const stored = Storage.get(KEY, []);
  return Array.isArray(stored) ? stored : [];
}

export function recordTerm(term) {
  if (typeof term !== 'string' || !term.trim()) return;
  let previous = recentTerms();
  // Define opens the first matching term as you type, so typing སངས་རྒྱས་
  // opens སངས་ on the way: a term that extends (or shortens) the latest one
  // replaces it instead of piling up every step
  const [latest] = previous;
  if (latest && latest !== term && (term.startsWith(latest) || latest.startsWith(term))) {
    previous = previous.slice(1);
  }
  const terms = [term, ...previous.filter((t) => t !== term)].slice(0, HISTORY_LIMIT);
  Storage.set(KEY, terms);
}

export function clearHistory() {
  Storage.delete(KEY);
}
