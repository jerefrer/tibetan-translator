/**
 * Back and Forward through the places visited, as a browser does: the
 * sidebar's arrows, Cmd/Ctrl+[ and ], the mouse's side buttons, and a phone
 * entry's "Back" link.
 *
 * vue-router keeps, in each history entry's state, the location before it
 * (`back`) and after it (`forward`); `historyState` mirrors them so the
 * arrows can be disabled when there is nowhere to go.
 */
import { reactive } from 'vue';

export const historyState = reactive({ back: null, forward: null });

function readHistoryState() {
  const state = window.history.state || {};
  historyState.back = typeof state.back === 'string' ? state.back : null;
  historyState.forward = typeof state.forward === 'string' ? state.forward : null;
}

/** Keeps `historyState` in step with the router; returns a function that stops it. */
export function trackHistory(router) {
  readHistoryState();
  const stopAfterEach = router.afterEach(() => readHistoryState());
  window.addEventListener('popstate', readHistoryState);
  return () => {
    stopAfterEach();
    window.removeEventListener('popstate', readHistoryState);
  };
}

export function goBack(router) {
  if (historyState.back) router.back();
}

export function goForward(router) {
  if (historyState.forward) router.forward();
}

/** Whether a location is a term's entry: Lookup on a term, or Search with
 *  one open (`term=`). */
export function isEntryLocation(location) {
  if (typeof location !== 'string') return false;
  const [path, search = ''] = location.split('#')[0].split('?');
  if (/^\/lookup\/[^/]+/.test(path)) return true;
  return path === '/search' && new URLSearchParams(search).has('term');
}
