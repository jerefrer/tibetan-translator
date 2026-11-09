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
  const terms = [term, ...recentTerms().filter((t) => t !== term)].slice(0, HISTORY_LIMIT);
  Storage.set(KEY, terms);
}

export function clearHistory() {
  Storage.delete(KEY);
}
