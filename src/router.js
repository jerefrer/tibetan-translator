import { createRouter, createWebHistory } from 'vue-router'

import Storage from './services/storage'

import LookupPage from './components/lookup/LookupPage.vue'
import SearchPage from './components/search/SearchPage.vue'
import ReaderPage from './components/reader/ReaderPage.vue'
import SettingsPage from './components/settings/SettingsPage.vue'
import TestsPage from './components/TestsPage.vue'
import LexiconPage from './components/LexiconPage.vue'
import DictionariesPage from './components/dictionaries/DictionariesPage.vue'
import SavedPage from './components/saved/SavedPage.vue'

// Redirects keep the query string and the hash of the old link
const withTerm = (base, term) => (term ? `${base}/${encodeURIComponent(term)}` : base)

// Links of the former Settings page: its dictionary filters, and the
// dictionary order (`view=preferences`, `#dictionary-order`), now belong to
// /dictionaries
function oldSettingsLink(to) {
  if ('find' in to.query || 'status' in to.query) {
    return { path: '/dictionaries', query: to.query, hash: to.hash }
  }
  if ('view' in to.query) {
    const { view, ...query } = to.query
    return view === 'preferences' ? { path: '/dictionaries', query } : { path: '/settings', query, hash: to.hash }
  }
  if (to.hash === '#dictionary-order') return { path: '/dictionaries', query: to.query }
  return true
}

// Define (formerly Lookup) held Search for a while, as its EN mode
// (`/lookup?mode=en&q=…`): those links go to Search, and a `mode` left on a
// Define link is dropped
function oldLookupLink(to) {
  if (!('mode' in to.query) && !('q' in to.query)) return true
  const { mode, ...query } = to.query
  if (mode === 'en' || 'q' in to.query) return { path: '/search', query, hash: to.hash }
  return { path: to.path, query, hash: to.hash }
}

// The same for a link to the former /lookup route
function fromLookupLink(to) {
  const { mode, ...query } = to.query
  if (mode === 'en' || 'q' in to.query) return { path: '/search', query, hash: to.hash }
  return { path: withTerm('/define', to.params.term), query, hash: to.hash }
}

const routes = [
  { path: '/', redirect: '/define' },
  // Define: a Tibetan term
  { path: '/define/:term?', component: LookupPage, beforeEnter: oldLookupLink },
  // Search: `q` is the query, `dict` keeps it to one dictionary
  { path: '/search', component: SearchPage },
  { path: '/reader', component: ReaderPage },
  { path: '/settings', component: SettingsPage, beforeEnter: oldSettingsLink },
  // "My glossary": the user's own dictionaries (LexiconPage)
  { path: '/glossary/:packId?/:dictionaryId?', component: LexiconPage },
  { path: '/dictionaries', component: DictionariesPage },
  // Every saved term (the sidebar shows the eight newest)
  { path: '/saved', component: SavedPage },

  // Former routes
  // Define was called Lookup for a while
  { path: '/lookup/:term?', redirect: fromLookupLink },
  {
    path: '/search/:query',
    redirect: (to) => ({ path: '/search', query: { ...to.query, q: to.params.query }, hash: to.hash }),
  },
  { path: '/segment', redirect: (to) => ({ path: '/reader', query: to.query, hash: to.hash }) },
  // Library, which held Settings, My glossary and Dictionaries, is gone
  { path: '/library', redirect: (to) => ({ path: '/settings', query: to.query, hash: to.hash }) },
  { path: '/library/settings', redirect: (to) => ({ path: '/settings', query: to.query, hash: to.hash }) },
  {
    path: '/library/glossary/:packId?/:dictionaryId?',
    redirect: (to) => ({ path: to.path.slice('/library'.length), query: to.query, hash: to.hash }),
  },
  {
    path: '/library/dictionaries',
    redirect: (to) => ({ path: '/dictionaries', query: to.query, hash: to.hash }),
  },
  {
    path: '/lexicon/:packId?/:dictionaryId?',
    redirect: (to) => ({
      path: '/glossary' + to.path.slice('/lexicon'.length),
      query: to.query,
      hash: to.hash,
    }),
  },
  { path: '/tests', component: TestsPage },
]

// Development-only component showcase. The dynamic import keeps the page and
// everything it pulls in out of production builds.
if (import.meta.env.DEV) {
  routes.push({
    path: '/ui-showcase',
    component: () => import('./ui/UiShowcasePage.vue'),
  });
}

const router = createRouter({
  history: createWebHistory(),
  routes,
  linkExactActiveClass: 'active'
})

export default router
