import { createRouter, createWebHistory } from 'vue-router'

import Storage from './services/storage'

import LookupPage from './components/lookup/LookupPage.vue'
import ReaderPage from './components/reader/ReaderPage.vue'
import SettingsPage from './components/settings/SettingsPage.vue'
import TestsPage from './components/TestsPage.vue'
import LexiconPage from './components/LexiconPage.vue'
import DictionariesPage from './components/DictionariesPage.vue'

// Redirects keep the query string and the hash of the old link
const withTerm = (base, term) => (term ? `${base}/${encodeURIComponent(term)}` : base)

// Links of the former Settings page: its dictionary filters now belong to
// /dictionaries, and `view=preferences` is the `#dictionary-order` section
function oldSettingsLink(to) {
  if ('find' in to.query || 'status' in to.query) {
    return { path: '/dictionaries', query: to.query, hash: to.hash }
  }
  if ('view' in to.query) {
    const { view, ...query } = to.query
    return { path: '/settings', query, hash: view === 'preferences' ? '#dictionary-order' : to.hash }
  }
  return true
}

const routes = [
  { path: '/', redirect: '/lookup' },
  // Lookup: query `mode` is `bo` or `en`, `q` is the English-mode query
  { path: '/lookup/:term?', component: LookupPage },
  { path: '/reader', component: ReaderPage },
  { path: '/settings', component: SettingsPage, beforeEnter: oldSettingsLink },
  // "My glossary": the user's own dictionaries (LexiconPage)
  { path: '/glossary/:packId?/:dictionaryId?', component: LexiconPage },
  { path: '/dictionaries', component: DictionariesPage },

  // Former routes
  {
    path: '/define/:term?',
    redirect: (to) => ({
      path: withTerm('/lookup', to.params.term),
      query: { ...to.query, mode: 'bo' },
      hash: to.hash,
    }),
  },
  {
    path: '/search/:query?',
    redirect: (to) => {
      const query = { ...to.query, mode: 'en' }
      if (to.params.query) query.q = to.params.query
      return { path: '/lookup', query, hash: to.hash }
    },
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
