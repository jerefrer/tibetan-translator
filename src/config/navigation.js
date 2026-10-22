/**
 * Main navigation of the app shell.
 *
 * Desktop: a left rail with three groups. `tools` at the top, a divider,
 * `library` (Glossary, Dictionaries), then `bottom` (Settings) pushed down.
 * Phone: a bottom bar with the four `mobile` items only. Glossary and
 * Dictionaries have no tab there; the routes still exist and the bar keeps
 * Settings highlighted while one of them is open.
 */

export const NAV_ITEMS = [
  { id: 'define', label: 'Define', path: '/define', icon: 'book-open', group: 'tools', mobile: true, shortcut: 'D' },
  { id: 'search', label: 'Search', path: '/search', icon: 'search', group: 'tools', mobile: true, shortcut: 'S' },
  { id: 'segment', label: 'Split', path: '/segment', icon: 'columns-2', group: 'tools', mobile: true, shortcut: 'T' },
  { id: 'glossary', label: 'Glossary', path: '/glossary', icon: 'notebook-text', group: 'library', mobile: false, parent: 'settings' },
  { id: 'dictionaries', label: 'Dictionaries', path: '/dictionaries', icon: 'library', group: 'library', mobile: false, parent: 'settings' },
  { id: 'settings', label: 'Settings', path: '/settings', icon: 'settings', group: 'bottom', mobile: true, shortcut: 'G' },
];

export function navItemsFor(isMobile) {
  return isMobile ? NAV_ITEMS.filter((item) => item.mobile) : NAV_ITEMS;
}

/** The id of the route's first path segment ("/define/foo" -> "define"). */
export function routeSegment(path) {
  return String(path || '').split('/').filter(Boolean)[0] || '';
}

/** Which nav item is highlighted for a route path. */
export function activeNavId(path, isMobile) {
  const segment = routeSegment(path);
  const item = NAV_ITEMS.find((candidate) => candidate.id === segment);
  if (!item) return '';
  if (isMobile && !item.mobile) return item.parent || '';
  return item.id;
}

/** Keyboard shortcut (Cmd/Ctrl + key) -> route path. */
export function shortcutPaths() {
  const map = {};
  NAV_ITEMS.forEach((item) => {
    if (item.shortcut) map[item.shortcut.toLowerCase()] = item.path;
  });
  return map;
}
