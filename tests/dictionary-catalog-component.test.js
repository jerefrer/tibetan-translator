/**
 * DictionaryCatalog, UninstalledPacksNotice and SearchInsteadHint.
 *
 * These run against the real dictionary details and pack definitions, so they
 * also guard the subject tags: if "archaic" stops finding the dictionaries John
 * asked about, this fails.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
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

const mountCatalog = (props = {}, slots = {}) =>
  mount(DictionaryCatalog, {
    props,
    slots,
    global: { provide: { snackbar } },
    attachTo: document.body,
  })

const cardOf = (wrapper, label) =>
  wrapper.findAll('[data-testid="catalog-card"]').find((card) =>
    card.find('.catalog-card__title').text() === label
  )

const findButton = (text) =>
  Array.from(document.body.querySelectorAll('button')).find((b) =>
    b.textContent.trim().includes(text)
  )

describe('DictionaryCatalog', () => {
  it('should show a first page of rows with a way to see them all when nothing is searched', async () => {
    const wrapper = mountCatalog()

    expect(wrapper.findAll('[data-testid="catalog-card"]')).toHaveLength(10)
    expect(wrapper.text()).toContain('Show all 65 dictionaries')

    await wrapper.get('[data-testid="catalog-show-all"]').trigger('click')

    expect(wrapper.findAll('[data-testid="catalog-card"]')).toHaveLength(65)
    expect(wrapper.find('[data-testid="catalog-show-all"]').exists()).toBe(false)

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

    expect(wrapper.find('[data-testid="catalog-installed"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="catalog-install"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('should offer to install a dictionary whose pack is missing', async () => {
    const wrapper = mountCatalog()

    wrapper.vm.query = 'brda dkrol'
    await nextTick()

    expect(wrapper.find('[data-testid="catalog-installed"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="catalog-install"]').text()).toBe('Install pack')
    expect(wrapper.text()).toContain('In Tibetan Monolingual · 65 MB')

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

    expect(wrapper.find('[data-testid="catalog-installed"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="catalog-install"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="catalog-filter-status"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('installed')

    wrapper.unmount()
  })

  it('should not offer to install before the pack manager knows what is installed', async () => {
    initialized = false
    const wrapper = mountCatalog()

    wrapper.vm.query = 'brda dkrol'
    await nextTick()

    expect(wrapper.vm.canInstall).toBe(false)
    expect(wrapper.find('[data-testid="catalog-install"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('In Tibetan Monolingual')

    wrapper.unmount()
  })

  it('should search as the user types and clear the search with its button', async () => {
    const wrapper = mountCatalog()

    await wrapper.get('[data-testid="ui-text-field-input"]').setValue('archaic')
    expect(wrapper.findAll('[data-testid="catalog-card"]')).toHaveLength(4)

    await wrapper.get('[data-testid="ui-text-field-clear"]').trigger('click')
    expect(wrapper.vm.query).toBe('')
    expect(wrapper.findAll('[data-testid="catalog-card"]')).toHaveLength(10)

    wrapper.unmount()
  })

  it('should say how many dictionaries match and how many are not installed', async () => {
    const wrapper = mountCatalog({ initialQuery: 'archaic' })

    expect(wrapper.get('[data-testid="catalog-count"]').text().replace(/\s+/g, ' ')).toBe(
      '4 dictionaries match archaic. 3 are in packs you have not installed.'
    )

    wrapper.unmount()
  })

  it('should count every dictionary and the installed ones in its header', () => {
    const wrapper = mountCatalog()

    expect(wrapper.get('.catalog-overline').text()).toMatch(
      /^Dictionaries · 65 dictionaries in 3 packs, \d+ installed$/
    )
    expect(wrapper.get('[data-testid="catalog-count"]').text().replace(/\s+/g, ' ')).toBe(
      '65 of 65 dictionaries. 30 are in packs you have not installed.'
    )

    wrapper.unmount()
  })

  it('should filter by language from the "Gives you" row', async () => {
    const wrapper = mountCatalog()

    const tibetanOnly = wrapper
      .findAll('[data-testid="catalog-language"]')
      .find((chip) => chip.text() === 'Tibetan only')
    await tibetanOnly.trigger('click')

    expect(wrapper.vm.language).toBe('tib-only')
    expect(tibetanOnly.attributes('aria-pressed')).toBe('true')
    expect(wrapper.vm.results.every((entry) => entry.languages.join() === 'tib')).toBe(true)

    wrapper.unmount()
  })

  it('should keep the "Other" language and the pack filter', async () => {
    const wrapper = mountCatalog()

    const languages = wrapper.findAll('[data-testid="catalog-language"]').map((chip) => chip.text())
    expect(languages).toEqual(['Any', 'Tibetan only', 'English', 'Sanskrit', 'Chinese', 'Other'])

    const sanskritPack = wrapper
      .get('[data-testid="catalog-filter-packId"]')
      .findAll('button')
      .find((chip) => chip.text() === 'Sanskrit & Academic')
    await sanskritPack.trigger('click')

    expect(new Set(wrapper.vm.results.map((entry) => entry.packId))).toEqual(
      new Set(['sanskrit-academic'])
    )

    wrapper.unmount()
  })

  it('should search for a purpose tag when it is clicked, and clear it on a second click', async () => {
    const wrapper = mountCatalog()

    const archaic = () =>
      wrapper
        .get('[data-testid="catalog-purposes"]')
        .findAll('button')
        .find((chip) => chip.text().startsWith('archaic'))

    expect(archaic().text()).toBe('archaic4')
    await archaic().trigger('click')

    expect(wrapper.vm.query).toBe('archaic')
    expect(archaic().attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('[data-testid="catalog-card"]')).toHaveLength(4)

    await archaic().trigger('click')
    expect(wrapper.vm.query).toBe('')

    wrapper.unmount()
  })

  it('should highlight the subject tags the search matched', async () => {
    const wrapper = mountCatalog({ initialQuery: 'archaic' })

    const tags = cardOf(wrapper, 'Dan Martin').findAll('[data-testid="catalog-keyword"]')
    const selected = tags.filter((tag) => tag.classes().includes('is-selected')).map((tag) => tag.text())
    expect(selected).toEqual(['archaic'])

    wrapper.unmount()
  })

  it('should show the pack, the languages and the description of a dictionary', () => {
    const wrapper = mountCatalog({ initialQuery: 'Dan Martin' })

    const card = cardOf(wrapper, 'Dan Martin')
    expect(card.text()).toContain('Core Dictionaries')
    expect(card.text()).toContain('English')
    expect(card.get('.catalog-card__subtitle').text()).toContain('Tibetan Vocabulary')
    expect(card.get('.catalog-card__description').text()).toContain('word-index')

    wrapper.unmount()
  })

  it('should show everything known about an installed dictionary, with live links', async () => {
    const wrapper = mountCatalog({ initialQuery: 'Dan Martin' })

    const about = cardOf(wrapper, 'Dan Martin').findAll('button').find((b) => b.text() === 'About')
    await about.trigger('click')
    await flushPromises()

    const dialog = document.body.querySelector('[data-testid="catalog-about"]')
    expect(dialog.textContent).toContain('11th and 12th century texts')
    expect(dialog.querySelector('a').getAttribute('href')).toBe('http://rywiki.tsadra.org')

    wrapper.unmount()
  })

  it('should show download progress instead of the install button while its pack downloads', async () => {
    const PackManager = (await import('../src/services/pack-manager')).default
    PackManager.downloadingPacks['tibetan-monolingual'] = { percentage: 41.6 }
    const wrapper = mountCatalog({ initialQuery: 'brda dkrol' })

    expect(wrapper.get('[data-testid="catalog-downloading"]').text()).toBe('Downloading 42%')
    expect(wrapper.find('[data-testid="catalog-install"]').exists()).toBe(false)

    delete PackManager.downloadingPacks['tibetan-monolingual']
    wrapper.unmount()
  })

  it('should ask before installing a whole pack picked from the Packs list', async () => {
    const wrapper = mountCatalog()

    wrapper.vm.askInstallPack('sanskrit-academic')
    await nextTick()

    expect(document.body.textContent).toContain('Install Sanskrit & Academic?')
    expect(document.body.textContent).toContain('Installing adds its 9 dictionaries')
    findButton('Install pack').click()
    await flushPromises()

    expect(downloadPackMock).toHaveBeenCalledWith('sanskrit-academic')

    wrapper.unmount()
  })

  it('should put the content of its aside slot beside the results', () => {
    const wrapper = mountCatalog({}, { aside: '<p class="test-aside">Packs</p>' })

    expect(wrapper.find('.catalog-aside .test-aside').exists()).toBe(true)
    wrapper.unmount()

    const bare = mountCatalog()
    expect(bare.find('.catalog-aside').exists()).toBe(false)
    bare.unmount()
  })

  it('should use the heading level it is given', () => {
    const wrapper = mountCatalog({ headingTag: 'h1' })

    expect(wrapper.get('.catalog-heading').element.tagName).toBe('H1')

    wrapper.unmount()
  })
})

describe('UninstalledPacksNotice', () => {
  const mountNotice = (resultCount) =>
    mount(UninstalledPacksNotice, {
      props: { resultCount },
      global: { mocks: { $router: { push: vi.fn() } } },
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
      global: { mocks: { $router: { push } } },
    })

    await wrapper.find('button').trigger('click')

    expect(push).toHaveBeenCalledWith({ path: '/dictionaries', query: { status: 'available' } })
  })
})

describe('SearchInsteadHint', () => {
  it('should carry the text as typed to the Search page', async () => {
    const push = vi.fn()
    const wrapper = mount(SearchInsteadHint, {
      props: { text: 'kākiṇī' },
      global: { mocks: { $router: { push } } },
    })

    await wrapper.find('button').trigger('click')

    expect(push).toHaveBeenCalledWith('/search/' + encodeURIComponent('kākiṇī'))
  })
})
