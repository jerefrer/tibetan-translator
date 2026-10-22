/**
 * DictionaryCatalog, UninstalledPacksNotice and SearchInsteadHint.
 *
 * These run against the real dictionary details and pack definitions, so they
 * also guard the subject tags: if "archaic" stops finding the dictionaries John
 * asked about, this fails.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { nextTick } from 'vue'

let modular = true
let initialized = true
let installedPacks = ['core']
const downloadPackMock = vi.fn()
const waitForDownloadMock = vi.fn()
const reloadPackMock = vi.fn()

vi.mock('../src/config/platform.js', () => ({
  isTauri: () => modular,
  supportsModularPacks: () => modular,
}))

vi.mock('../src/services/pack-manager', () => ({
  default: {
    get isInitialized() {
      return initialized
    },
    get installedPacks() {
      return installedPacks
    },
    downloadingPacks: {},
    downloadPack: (...args) => downloadPackMock(...args),
    waitForDownload: (...args) => waitForDownloadMock(...args),
  },
}))

vi.mock('../src/services/sql-database', () => ({
  default: { reloadPack: (...args) => reloadPackMock(...args) },
}))

import DictionaryCatalog from '../src/components/DictionaryCatalog.vue'
import UninstalledPacksNotice from '../src/components/UninstalledPacksNotice.vue'
import SearchInsteadHint from '../src/components/SearchInsteadHint.vue'

const vuetify = createVuetify({ components, directives })
const snackbar = { open: vi.fn() }

beforeEach(() => {
  modular = true
  initialized = true
  installedPacks = ['core']
  downloadPackMock.mockReset().mockResolvedValue(undefined)
  waitForDownloadMock.mockReset().mockResolvedValue(undefined)
  reloadPackMock.mockReset().mockResolvedValue(undefined)
  snackbar.open.mockClear()
})

afterEach(() => {
  // v-dialog teleports into document.body; see custom-pack-section.test.js
  document.body.innerHTML = ''
})

const mountCatalog = (props = {}) =>
  mount(DictionaryCatalog, {
    props,
    global: { plugins: [vuetify], provide: { snackbar } },
    attachTo: document.body,
  })

const findButton = (text) =>
  Array.from(document.body.querySelectorAll('button')).find((b) =>
    b.textContent.trim().includes(text)
  )

describe('DictionaryCatalog', () => {
  it('should show a first page of rows with a way to see them all when nothing is searched', () => {
    const wrapper = mountCatalog()

    expect(wrapper.findAll('.catalog-row')).toHaveLength(10)
    expect(wrapper.text()).toContain('Show all 65 dictionaries')

    wrapper.unmount()
  })

  it('should find the dictionaries tagged archaic when searching for archaic', async () => {
    const wrapper = mountCatalog()

    wrapper.vm.query = 'archaic'
    await nextTick()

    expect(wrapper.vm.results.map((entry) => entry.id)).toEqual([
      'DanMartin',
      'brda_dkrol_gser_gyi_me_long',
      'li_shii_gur_khang',
      'sgra-sbyor-bam-po-gnyis-pa',
    ])
    expect(wrapper.text()).toContain('Brda dkrol gser gyi me long')

    wrapper.unmount()
  })

  it('should say so when nothing matches', async () => {
    const wrapper = mountCatalog()

    wrapper.vm.query = 'zzzzzz'
    await nextTick()

    expect(wrapper.text()).toContain('No dictionary matches')

    wrapper.unmount()
  })

  it('should start from the query the notice sends it with', () => {
    const wrapper = mountCatalog({ initialQuery: 'verbs', initialStatus: 'available' })

    expect(wrapper.vm.query).toBe('verbs')
    expect(wrapper.vm.status).toBe('available')

    wrapper.unmount()
  })

  it('should only list dictionaries of packs that are not installed when filtered by that status', async () => {
    const wrapper = mountCatalog()

    wrapper.vm.status = 'available'
    await nextTick()

    const packs = new Set(wrapper.vm.results.map((entry) => entry.packId))
    expect(packs).toEqual(new Set(['tibetan-monolingual', 'sanskrit-academic']))

    wrapper.unmount()
  })

  it('should mark a dictionary of an installed pack as installed', async () => {
    const wrapper = mountCatalog()

    wrapper.vm.query = 'Verbinator'
    await nextTick()

    expect(wrapper.find('.installed-label').exists()).toBe(true)

    wrapper.unmount()
  })

  it('should offer to install a dictionary whose pack is missing', async () => {
    const wrapper = mountCatalog()

    wrapper.vm.query = 'brda dkrol'
    await nextTick()

    expect(wrapper.find('.installed-label').exists()).toBe(false)
    expect(wrapper.text()).toContain('Install')

    wrapper.unmount()
  })

  it('should not download anything until the install is confirmed', async () => {
    const wrapper = mountCatalog()

    wrapper.vm.askInstall(wrapper.vm.catalog.find((e) => e.id === 'brda_dkrol_gser_gyi_me_long'))
    await nextTick()

    expect(downloadPackMock).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('Install Tibetan Monolingual?')
    expect(document.body.textContent).toContain('Brda dkrol gser gyi me long')

    wrapper.unmount()
  })

  it('should not download anything when the install is cancelled', async () => {
    const wrapper = mountCatalog()

    wrapper.vm.askInstall(wrapper.vm.catalog.find((e) => e.id === 'brda_dkrol_gser_gyi_me_long'))
    await nextTick()
    findButton('Cancel').click()
    await flushPromises()

    expect(downloadPackMock).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('should download the whole pack, load it and say so when the install is confirmed', async () => {
    const wrapper = mountCatalog()

    wrapper.vm.askInstall(wrapper.vm.catalog.find((e) => e.id === 'brda_dkrol_gser_gyi_me_long'))
    await nextTick()
    findButton('Install pack').click()
    await flushPromises()

    expect(downloadPackMock).toHaveBeenCalledWith('tibetan-monolingual')
    expect(reloadPackMock).toHaveBeenCalledWith('tibetan-monolingual')
    expect(snackbar.open).toHaveBeenCalledWith('Tibetan Monolingual installed')

    wrapper.unmount()
  })

  it('should report a failed install and not load the pack', async () => {
    downloadPackMock.mockRejectedValue(new Error('offline'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = mountCatalog()

    wrapper.vm.askInstall(wrapper.vm.catalog.find((e) => e.id === 'brda_dkrol_gser_gyi_me_long'))
    await nextTick()
    findButton('Install pack').click()
    await flushPromises()

    expect(reloadPackMock).not.toHaveBeenCalled()
    expect(snackbar.open).toHaveBeenCalledWith('Could not install Tibetan Monolingual.')

    consoleError.mockRestore()
    wrapper.unmount()
  })

  it('should treat every dictionary as installed and offer no install on the web', async () => {
    modular = false
    const wrapper = mountCatalog()

    wrapper.vm.query = 'brda dkrol'
    await nextTick()

    expect(wrapper.find('.installed-label').exists()).toBe(true)
    expect(wrapper.vm.filterGroups.map((group) => group.key)).not.toContain('status')

    wrapper.unmount()
  })

  it('should not offer to install before the pack manager knows what is installed', async () => {
    initialized = false
    const wrapper = mountCatalog()

    wrapper.vm.query = 'brda dkrol'
    await nextTick()

    expect(wrapper.vm.canInstall).toBe(false)

    wrapper.unmount()
  })
})

describe('UninstalledPacksNotice', () => {
  const mountNotice = (resultCount) =>
    mount(UninstalledPacksNotice, {
      props: { resultCount },
      global: { plugins: [vuetify], mocks: { $router: { push: vi.fn() } } },
    })

  it('should name the packs that were not searched when results are few', () => {
    const wrapper = mountNotice(1)

    expect(wrapper.text()).toContain('2 packs were not searched')
    expect(wrapper.text()).toContain('Tibetan Monolingual')
    expect(wrapper.text()).toContain('Sanskrit & Academic')
  })

  it('should stay hidden when there are plenty of results', () => {
    expect(mountNotice(3).find('.uninstalled-notice').exists()).toBe(false)
  })

  it('should stay hidden when every pack is installed', () => {
    installedPacks = ['core', 'tibetan-monolingual', 'sanskrit-academic']
    expect(mountNotice(0).find('.uninstalled-notice').exists()).toBe(false)
  })

  it('should stay hidden before the pack manager has loaded', () => {
    initialized = false
    expect(mountNotice(0).find('.uninstalled-notice').exists()).toBe(false)
  })

  it('should stay hidden on the web, where every dictionary is bundled', () => {
    modular = false
    expect(mountNotice(0).find('.uninstalled-notice').exists()).toBe(false)
  })

  it('should say one pack when only one is missing', () => {
    installedPacks = ['core', 'sanskrit-academic']
    expect(mountNotice(0).text()).toContain('1 pack was not searched')
  })

  it('should send the user to the catalog, filtered to what is not installed', async () => {
    const push = vi.fn()
    const wrapper = mount(UninstalledPacksNotice, {
      props: { resultCount: 0 },
      global: { plugins: [vuetify], mocks: { $router: { push } } },
    })

    await wrapper.find('button').trigger('click')

    expect(push).toHaveBeenCalledWith({ path: '/settings', query: { status: 'available' } })
  })
})

describe('SearchInsteadHint', () => {
  it('should carry the text as typed to the Search page', async () => {
    const push = vi.fn()
    const wrapper = mount(SearchInsteadHint, {
      props: { text: 'kākiṇī' },
      global: { plugins: [vuetify], mocks: { $router: { push } } },
    })

    await wrapper.find('button').trigger('click')

    expect(push).toHaveBeenCalledWith('/search/' + encodeURIComponent('kākiṇī'))
  })
})
