/**
 * Main navigation of the app shell.
 *
 * Define, Search and Reader everywhere. On desktop the sidebar also lists My
 * glossary and Dictionaries (the `collections` group, set apart from the
 * `tools` group) and ends with a Settings link; on a phone Settings is the
 * fourth tab and the two collections are rows inside it, so the Settings tab
 * stays highlighted while one of them is open (`parent`).
 */

export const NAV_ITEMS = [
  { id: 'lookup', label: 'Define', path: '/define', icon: 'search', group: 'tools', mobile: true, shortcut: 'D' },
  { id: 'search', label: 'Search', path: '/search', icon: 'text-search', group: 'tools', mobile: true, shortcut: 'S' },
  { id: 'reader', label: 'Reader', path: '/reader', icon: 'align-left', group: 'tools', mobile: true, shortcut: 'E' },
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
  // Saved belongs with Define: the sidebar links to it, a phone's Define home too
  if (route === '/saved') return isMobile ? 'lookup' : '';
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
  { key: 'D', text: 'Define a Tibetan term' },
  { key: 'S', text: 'Search the definitions (Search)' },
  { key: 'K', text: 'Put the cursor in the field of Define, or of Search when it is open' },
  { key: 'E', text: 'Go to Reader' },
  { key: '1 2 3', text: 'Go to Define, Search or Reader, in the order of the menu' },
  { key: 'G', text: 'Go to Settings' },
  { key: '[', text: 'Back, where you were before (the mouse’s back button too)' },
  { key: ']', text: 'Forward again' },
];

/**
 * Keyboard shortcut (Cmd/Ctrl + key) -> route path. `D` opens Define, `S`
 * Search; `K` is the action 'focus-lookup' (App.vue routes to Define unless
 * Search is open, then fires the `focus-lookup` window event, which the page
 * shown answers by focusing its field).
 */
export function shortcutPaths() {
  const map = {};
  NAV_ITEMS.forEach((item) => {
    if (item.shortcut) map[item.shortcut.toLowerCase()] = item.path;
  });
  map.k = 'focus-lookup';
  return map;
}

/**
 * Cmd/Ctrl + 1, 2, 3 -> Define, Search, Reader, the sidebar's tools in order.
 * Keyed on `event.code`, the key pressed: on AZERTY the same keys give "&",
 * "é" and "\"" as `event.key`.
 */
export function digitShortcutPaths() {
  const map = {};
  NAV_ITEMS.filter((item) => item.group === 'tools' && item.desktop !== false).forEach((item, index) => {
    map[`Digit${index + 1}`] = item.path;
  });
  return map;
}
