import { createRouter, createWebHistory } from 'vue-router'

import Storage from './services/storage'

import DefinePage from './components/DefinePage.vue'
import SearchPage from './components/SearchPage.vue'
import SegmentPage from './components/SegmentPage.vue'
import ConfigurePage from './components/ConfigurePage.vue'
import TestsPage from './components/TestsPage.vue'
import LexiconPage from './components/LexiconPage.vue'
import DictionariesPage from './components/DictionariesPage.vue'

const routes = [
  { path: '/', redirect: '/define' },
  { path: '/define', component: DefinePage },
  { path: '/define/:term', component: DefinePage },
  { path: '/search', component: SearchPage },
  { path: '/search/:query', component: SearchPage },
  { path: '/segment', component: SegmentPage },
  { path: '/settings', component: ConfigurePage },
  // "My glossary": the user's own dictionaries (LexiconPage)
  { path: '/glossary/:packId?/:dictionaryId?', component: LexiconPage },
  { path: '/dictionaries', component: DictionariesPage },
  // Former route of the glossary
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
