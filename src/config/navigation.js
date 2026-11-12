/**
 * Main navigation of the app shell.
 *
 * Lookup and Reader everywhere. On desktop the sidebar also lists My
 * glossary and Dictionaries (the `collections` group, set apart from the
 * `tools` group) and ends with a Settings link; on a phone Settings is the
 * third tab and the two collections are rows inside it, so the Settings tab
 * stays highlighted while one of them is open (`parent`).
 */

export const NAV_ITEMS = [
  { id: 'lookup', label: 'Lookup', path: '/lookup', icon: 'search', group: 'tools', mobile: true, shortcut: 'D', shortcutPath: '/lookup?mode=bo' },
  { id: 'reader', label: 'Reader', path: '/reader', icon: 'align-left', group: 'tools', mobile: true, shortcut: 'T' },
  { id: 'glossary', label: 'My glossary', path: '/glossary', icon: 'notebook-pen', group: 'collections', mobile: false, parent: 'settings' },
  { id: 'dictionaries', label: 'Dictionaries', path: '/dictionaries', icon: 'book-open', group: 'collections', mobile: false, parent: 'settings' },
  // On desktop Settings is the sidebar's bottom link, not an item of the list
  { id: 'settings', label: 'Settings', path: '/settings', icon: 'settings', group: 'tools', mobile: true, desktop: false, shortcut: 'G' },
];

export function navItemsFor(isMobile) {
  return NAV_ITEMS.filter((item) => (isMobile ? item.mobile : item.desktop !== false));
}

/** The id of the route's first path segment ("/define/foo" -> "define"). */
export function routeSegment(path) {
  return String(path || '').split('/').filter(Boolean)[0] || '';
}

/** Which nav item is highlighted for a route path: the one with the longest
 * path the route is at or under ("/glossary/x" -> glossary). */
export function activeNavId(path, isMobile) {
  const route = String(path || '');
  const item = NAV_ITEMS
    .filter((candidate) => route === candidate.path || route.startsWith(candidate.path + '/'))
    .sort((a, b) => b.path.length - a.path.length)[0];
  if (!item) return '';
  if (isMobile && !item.mobile) return item.parent || '';
  return item.id;
}

/** Fired when a link to the current route (hash included) is followed again. */
export const REFOLLOW_EVENT = 'route-refollowed';

/**
 * Router push that survives a link to where the user already is: vue-router
 * ignores such a duplicate, so a page scrolled away from its `#section` would
 * never go back to it. The event lets the page do that itself (Settings).
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
  { key: 'D', text: 'Look up a Tibetan term (Lookup in བོད)' },
  { key: 'S', text: 'Search the definitions (Lookup in EN)' },
  { key: 'K', text: 'Put the cursor in the Lookup field' },
  { key: 'T', text: 'Go to Reader' },
  { key: 'G', text: 'Go to Settings' },
];

/**
 * Keyboard shortcut (Cmd/Ctrl + key) -> route path. `D` opens Lookup in
 * Tibetan mode and `S` in English mode (LookupPage switches with its usual
 * rules, keeping what the field holds); `K` is the action 'focus-lookup'
 * (App.vue routes to Lookup, then fires the `focus-lookup` window event).
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
