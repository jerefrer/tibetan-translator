import Storage from './storage';

// The passages the user split on the Split page, most recent first.
const KEY = 'splitHistory';
export const SPLIT_HISTORY_LIMIT = 10;

// Splitting rewrites the spaces and users edit them by hand, so two texts that
// differ only by whitespace are the same passage.
const stripped = (text) => text.replace(/\s+/g, '');

export function recentTexts() {
  const stored = Storage.get(KEY, []);
  return Array.isArray(stored) ? stored : [];
}

export function recordText(text) {
  if (typeof text !== 'string' || !text.trim()) return;
  const key = stripped(text);
  let previous = recentTexts();
  // Typing a passage out records every step: one that extends (or shortens)
  // the latest entry replaces it instead of piling up
  const [latest] = previous;
  if (latest) {
    const latestKey = stripped(latest);
    if (latestKey !== key && (key.startsWith(latestKey) || latestKey.startsWith(key))) {
      previous = previous.slice(1);
    }
  }
  const texts = [text, ...previous.filter((t) => stripped(t) !== key)].slice(0, SPLIT_HISTORY_LIMIT);
  Storage.set(KEY, texts);
}

export function clearSplitHistory() {
  Storage.delete(KEY);
}
