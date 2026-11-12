/**
 * Main navigation of the app shell.
 *
 * Three destinations everywhere: Lookup, Reader and Library (Settings,
 * Glossary and Dictionaries live inside Library, so the item stays highlighted
 * on every /library route).
 */

export const NAV_ITEMS = [
  { id: 'lookup', label: 'Lookup', path: '/lookup', icon: 'search', group: 'tools', mobile: true, shortcut: 'D' },
  { id: 'reader', label: 'Reader', path: '/reader', icon: 'book-open', group: 'tools', mobile: true, shortcut: 'T' },
  { id: 'library', label: 'Library', path: '/library', icon: 'library', group: 'tools', mobile: true, shortcut: 'G', shortcutPath: '/library#settings' },
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

/**
 * Keyboard shortcut (Cmd/Ctrl + key) -> route path. `S` opens Lookup in
 * English mode; `K` is the action 'focus-lookup' (App.vue routes to Lookup,
 * then fires the `focus-lookup` window event).
 */
export function shortcutPaths() {
  const map = {};
  NAV_ITEMS.forEach((item) => {
    if (item.shortcut) map[item.shortcut.toLowerCase()] = item.shortcutPath || item.path;
  });
  map.s = '/lookup?mode=en';
  map.k = 'focus-lookup';
  return map;
}
