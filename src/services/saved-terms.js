import Storage from './storage';

// The terms the user saved, newest first, no limit.
const KEY = 'savedTerms';

export function savedTerms() {
  const stored = Storage.get(KEY, []);
  return Array.isArray(stored) ? stored : [];
}

export const isSaved = (term) => savedTerms().includes(term);

// The whole list, newest first: a clear undone puts it back
export function setSavedTerms(terms) {
  Storage.set(KEY, terms);
  window.dispatchEvent(new CustomEvent('saved-terms-updated'));
}

// Returns the new state: true when the term is now saved.
export function toggleSaved(term) {
  const saved = isSaved(term);
  setSavedTerms(saved ? savedTerms().filter((t) => t !== term) : [term, ...savedTerms()]);
  return !saved;
}

export function removeSaved(term) {
  if (isSaved(term)) setSavedTerms(savedTerms().filter((t) => t !== term));
}

export const clearSaved = () => setSavedTerms([]);
