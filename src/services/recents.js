import Storage from './storage';

// A most-recent-first list kept in localStorage. Define and Split each build
// one with their own key, limit and notion of "the same entry".
export function createRecents({ key, limit, sameAs, replacesLatest }) {
  const list = () => {
    const stored = Storage.get(key, []);
    return Array.isArray(stored) ? stored : [];
  };
  const announce = () => window.dispatchEvent(new CustomEvent('recents-updated', { detail: { key } }));

  return {
    list,
    record(item) {
      let previous = list();
      // Typing records every step: an item that extends (or shortens) the
      // latest one replaces it instead of piling up
      const [latest] = previous;
      if (latest !== undefined && !sameAs(latest, item) && replacesLatest(latest, item)) {
        previous = previous.slice(1);
      }
      Storage.set(key, [item, ...previous.filter((x) => !sameAs(x, item))].slice(0, limit));
      announce();
    },
    clear() {
      Storage.delete(key);
      announce();
    },
  };
}
