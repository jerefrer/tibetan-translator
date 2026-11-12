import { createRecents } from './recents';

// The passages the user split on the Split page, most recent first.
export const SPLIT_HISTORY_LIMIT = 10;

// Splitting rewrites the spaces and users edit them by hand, so two texts that
// differ only by whitespace are the same passage.
const stripped = (text) => text.replace(/\s+/g, '');

const recents = createRecents({
  key: 'splitHistory',
  limit: SPLIT_HISTORY_LIMIT,
  sameAs: (a, b) => stripped(a) === stripped(b),
  // Typing a passage out records every step: one that extends (or shortens)
  // the latest entry replaces it instead of piling up
  replacesLatest: (latest, next) => {
    const a = stripped(latest);
    const b = stripped(next);
    return b.startsWith(a) || a.startsWith(b);
  },
});

export const recentTexts = () => recents.list();

export function recordText(text) {
  if (typeof text !== 'string' || !text.trim()) return;
  recents.record(text);
}

export const clearSplitHistory = () => recents.clear();
