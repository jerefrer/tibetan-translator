import { createRouter, createWebHistory } from 'vue-router'

import Storage from './services/storage'

import TranslatePage from './components/TranslatePage.vue'
import DefinePage from './components/DefinePage.vue'
import SearchPage from './components/SearchPage.vue'
import ConfigurePage from './components/ConfigurePage.vue'
import TestsPage from './components/TestsPage.vue'

const routes = [
  { path: '/', redirect: '/define' },
  { path: '/translate', component: TranslatePage },
  { path: '/define', component: DefinePage },
  { path: '/define/:term', component: DefinePage },
  { path: '/search', component: SearchPage },
  { path: '/search/:query', component: SearchPage },
  { path: '/configure', component: ConfigurePage },
  { path: '/tests', component: TestsPage },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  linkExactActiveClass: 'active'
})

export default router
