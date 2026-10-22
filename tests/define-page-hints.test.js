/**
 * The two hints on the Define page.
 *
 * The page only looks up Tibetan, and its field turns whatever is typed into
 * Tibetan script. So a Sanskrit word has to be remembered as typed (to offer
 * the Search page with it), and a lookup that finds little has to say which
 * packs were not searched.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { nextTick } from 'vue'

vi.mock('../src/config/platform.js', () => ({
  isTauri: () => true,
  supportsModularPacks: () => true,
}))

vi.mock('../src/services/pack-manager', () => ({
  default: { isInitialized: true, installedPacks: ['core'], downloadingPacks: {} },
}))

vi.mock('../src/services/sql-database', () => ({
  default: {
    allTerms: ['ཀ་', 'ཀ་ཀ་'],
    getEntriesFor: vi.fn(async () => []),
  },
}))

vi.mock('../src/services/scan-service', () => ({
  getScanInfo: () => null,
}))

import DefinePage from '../src/components/DefinePage.vue'
import Storage from '../src/services/storage'

const vuetify = createVuetify({ components, directives })
const stub = (name) => ({ name, template: '<div />' })

function mountPage() {
  Storage.set('dictionaries', [{ id: 1, position: 1, enabled: true, label: 'Tsepak Rigdzin' }])
  return mount(DefinePage, {
    global: {
      plugins: [vuetify],
      mocks: {
        $route: { params: {}, path: '/define' },
        $router: { push: vi.fn() },
      },
      provide: { snackbar: { open: vi.fn() } },
      stubs: {
        TibetanTextField: stub('TibetanTextField'),
        Entries: stub('Entries'),
        QuickAddDialog: stub('QuickAddDialog'),
        ResultsAndPaginationAndDictionaries: stub('ResultsAndPaginationAndDictionaries'),
      },
    },
  })
}

describe('DefinePage — search instead hint', () => {
  beforeEach(() => {
    window.IntersectionObserver = class {
      observe() {}
      disconnect() {}
    }
  })

  it('should offer Search when the typed text carries Sanskrit diacritics', async () => {
    const wrapper = mountPage()

    wrapper.vm.searchTerm = 'kāka'
    await nextTick()

    expect(wrapper.find('.search-instead-hint').exists()).toBe(true)
    expect(wrapper.find('.search-instead-hint').text()).toContain('kāka')

    wrapper.unmount()
  })

  it('should keep offering Search with the text as typed after the field converts it to Tibetan', async () => {
    const wrapper = mountPage()

    wrapper.vm.searchTerm = 'kāka'
    await nextTick()
    wrapper.vm.searchTerm = 'ཀཱཀ་'
    await nextTick()

    expect(wrapper.find('.search-instead-hint').text()).toContain('kāka')

    wrapper.unmount()
  })

  it('should not offer Search for plain Wylie', async () => {
    const wrapper = mountPage()

    wrapper.vm.searchTerm = "sangs rgyas 'phrin las"
    await nextTick()

    expect(wrapper.find('.search-instead-hint').exists()).toBe(false)

    wrapper.unmount()
  })

  it('should stop offering Search once the field is cleared', async () => {
    const wrapper = mountPage()

    wrapper.vm.searchTerm = 'kāka'
    await nextTick()
    wrapper.vm.searchTerm = ''
    await nextTick()

    expect(wrapper.find('.search-instead-hint').exists()).toBe(false)

    wrapper.unmount()
  })
})

describe('DefinePage — packs not searched', () => {
  beforeEach(() => {
    window.IntersectionObserver = class {
      observe() {}
      disconnect() {}
    }
  })

  it('should name the packs that were not searched when a lookup finds nothing', async () => {
    const wrapper = mountPage()

    wrapper.vm.searchTerm = 'བརྡ་དཀྲོལ་'
    await nextTick()

    expect(wrapper.find('.uninstalled-notice').exists()).toBe(true)
    expect(wrapper.find('.uninstalled-notice').text()).toContain('Tibetan Monolingual')

    wrapper.unmount()
  })

  it('should say nothing before the user has typed anything', async () => {
    const wrapper = mountPage()

    expect(wrapper.find('.uninstalled-notice').exists()).toBe(false)

    wrapper.unmount()
  })
})
