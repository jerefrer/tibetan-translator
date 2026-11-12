/**
 * Main navigation of the app shell.
 *
 * Three destinations everywhere: Lookup, Reader and Library (Settings,
 * Glossary and Dictionaries live inside Library, so the item stays highlighted
 * on every /library route).
 */

export const NAV_ITEMS = [
  { id: 'lookup', label: 'Lookup', path: '/lookup', icon: 'search', group: 'tools', mobile: true, shortcut: 'D' },
  { id: 'reader', label: 'Reader', path: '/reader', icon: 'align-left', group: 'tools', mobile: true, shortcut: 'T' },
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

/** Fired when a link to the current route (hash included) is followed again. */
export const REFOLLOW_EVENT = 'route-refollowed';

/**
 * Router push that survives a link to where the user already is: vue-router
 * ignores such a duplicate, so a page scrolled away from its `#section` would
 * never go back to it. The event lets the page do that itself (Library).
 */
export function navigateTo(router, target) {
  if (router.resolve(target).fullPath === router.currentRoute.value.fullPath) {
    window.dispatchEvent(new CustomEvent(REFOLLOW_EVENT));
    return Promise.resolve();
  }
  return router.push(target);
}

/** The page shortcuts, as the help dialogs list them (Cmd/Ctrl + key). */
export const HELP_SHORTCUTS = [
  { key: 'D', text: 'Go to Lookup' },
  { key: 'S', text: 'Search the definitions (Lookup in EN)' },
  { key: 'K', text: 'Put the cursor in the Lookup field' },
  { key: 'T', text: 'Go to Reader' },
  { key: 'G', text: 'Go to Library settings' },
];

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
