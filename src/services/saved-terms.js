import Storage from './storage';

// The terms the user saved, newest first, no limit.
const KEY = 'savedTerms';

export function savedTerms() {
  const stored = Storage.get(KEY, []);
  return Array.isArray(stored) ? stored : [];
}

export const isSaved = (term) => savedTerms().includes(term);

// Returns the new state: true when the term is now saved.
export function toggleSaved(term) {
  const saved = isSaved(term);
  const terms = saved ? savedTerms().filter((t) => t !== term) : [term, ...savedTerms()];
  Storage.set(KEY, terms);
  window.dispatchEvent(new CustomEvent('saved-terms-updated'));
  return !saved;
}
