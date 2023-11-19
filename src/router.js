import Vue from 'vue'
import VueRouter from 'vue-router'

import Storage from './services/storage'

import TranslatePage from './components/TranslatePage'
import DefinePage from './components/DefinePage'
import SearchPage from './components/SearchPage'
import ConfigurePage from './components/ConfigurePage'
import TestsPage from './components/TestsPage'

Vue.use(VueRouter);

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

const router = new VueRouter({
  routes,
  linkExactActiveClass: 'active'
})

export default router;