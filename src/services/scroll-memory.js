/**
 * Keeps the scroll positions of a page kept alive by <keep-alive>.
 *
 * A deactivated page's DOM is detached, and the browser resets the
 * scrollTop of every element it detaches, so coming back to Search showed
 * the top of the results again. `remember(key, root)` notes the scrolled
 * elements under `root` as the page leaves; `restore(key)` puts them back
 * once the page is in the document again.
 */
const pages = new Map();

export function remember(key, root) {
  if (!key || !root) return;
  const scrolled = [];
  for (const element of [root, ...root.querySelectorAll('*')]) {
    if (element.scrollTop > 0 || element.scrollLeft > 0) {
      scrolled.push([element, element.scrollTop, element.scrollLeft]);
    }
  }
  pages.set(key, scrolled);
}

export function restore(key) {
  const scrolled = pages.get(key);
  if (!scrolled) return;
  pages.delete(key);
  for (const [element, top, left] of scrolled) {
    if (!element.isConnected) continue;
    element.scrollTop = top;
    element.scrollLeft = left;
  }
}
