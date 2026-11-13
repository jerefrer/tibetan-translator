/**
 * DictionariesPage: the one place for dictionaries. The packs, the dictionaries
 * in the order lookups use them (switched on or off, reordered here), those of
 * packs not installed, and the selected one's detail. Ported from the former
 * catalog, the Packs list and Settings' dictionary preferences.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'

const env = vi.hoisted(() => ({ modular: true, phone: false }))

const packs = vi.hoisted(() => ({ state: null, api: null }))

vi.mock('../src/config/platform.js', () => ({
  isTauri: () => env.modular,
  supportsModularPacks: () => env.modular,
  isMacOS: () => false,
}))

vi.mock('../src/services/resize-service', () => ({
  default: { isMobile: () => env.phone, subscribe: vi.fn(), unsubscribe: vi.fn() },
}))

vi.mock('../src/services/pack-manager', async () => {
  const { reactive } = await import('vue')
  packs.state = reactive({
    isInitialized: true,
    installedPacks: ['core'],
    downloadingPacks: {},
    updatingPacks: {},
    availableUpdates: {},
  })
  packs.api = {
    get isInitialized() { return packs.state.isInitialized },
    get installedPacks() { return packs.state.installedPacks },
    get downloadingPacks() { return packs.state.downloadingPacks },
    get updatingPacks() { return packs.state.updatingPacks },
    get availableUpdates() { return packs.state.availableUpdates },
    get hasUpdates() { return Object.keys(packs.state.availableUpdates).length > 0 },
    init: vi.fn(async () => { packs.state.isInitialized = true }),
    downloadPack: vi.fn(async () => {}),
    waitForDownload: vi.fn(async () => {}),
    removePack: vi.fn(async () => {}),
    checkForUpdates: vi.fn(async () => {}),
    updatePack: vi.fn(async () => {}),
    waitForUpdate: vi.fn(async () => {}),
  }
  return { default: packs.api }
})

vi.mock('../src/services/sql-database', () => ({
  default: { reloadPack: vi.fn(async () => {}), unloadPack: vi.fn() },
}))

import Storage from '../src/services/storage'
import db from '../src/services/sql-database'
import DictionariesPage from '../src/components/dictionaries/DictionariesPage.vue'
import DictionaryPacks from '../src/components/dictionaries/DictionaryPacks.vue'

const STORED = [
  { id: 1, name: 'Hopkins2015', enabled: true, position: 1 },
  { id: 2, name: 'RangjungYeshe', enabled: true, position: 2 },
  { id: 3, name: 'JimValby', enabled: false, position: 3 },
  { id: 9, name: 'Practice terms', enabled: true, position: 4, _sourcePackId: 'custom-1' },
]

const snackbar = { open: vi.fn() }
let wrapper
let route

// A router reduced to what the page uses: the route, and a history that
// push adds to and back (the system Back on Android) steps through
function fakeRouter() {
  const steps = []
  const go = (to) => {
    if (to.path === route.path) route.query = to.query || {}
  }
  return {
    push: vi.fn((to) => {
      steps.push({ ...route.query })
      go(to)
    }),
    replace: vi.fn(go),
    back: vi.fn(() => {
      route.query = steps.pop() || {}
    }),
  }
}

const mountPage = async (query = {}) => {
  route = reactive({ path: '/dictionaries', query })
  wrapper = mount(DictionariesPage, {
    global: {
      provide: { snackbar },
      mocks: { $route: route, $router: fakeRouter() },
      stubs: { RouterLink: RouterLinkStub },
    },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

const rows = () => wrapper.findAll('[data-testid="dictionary-row"]')
const names = () => rows().map((row) => row.find('.dictionary-row__name').text())
const rowOf = (label) => rows().find((row) => row.find('.dictionary-row__name').text() === label)
const detail = () => wrapper.find('[data-testid="dictionary-detail"]')
const stored = () => [...Storage.get('dictionaries')].sort((a, b) => a.position - b.position)
const search = async (text) => {
  await wrapper.find('[data-testid="dictionaries-search"] input').setValue(text)
}
const chooseStatus = async (label) => {
  await wrapper.findAll('[data-testid="dictionaries-status"] [role="radio"]').find((radio) => radio.text() === label).trigger('click')
}

beforeEach(() => {
  env.modular = true
  env.phone = false
  Object.assign(packs.state, {
    isInitialized: true,
    installedPacks: ['core'],
    downloadingPacks: {},
    updatingPacks: {},
    availableUpdates: {},
  })
  Object.values(packs.api).forEach((value) => value?.mockClear?.())
  snackbar.open.mockClear()
  Storage.set('dictionaries', STORED)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('DictionariesPage — the list', () => {
  it('should have one level-one heading, with the page name', async () => {
    await mountPage()
    expect(wrapper.findAll('h1').map((heading) => heading.text())).toEqual(['Dictionaries'])
  })

  it('should list the dictionaries in the order lookups use them, then those of packs not installed', async () => {
    await mountPage()
    expect(names().slice(0, 4)).toEqual(['Hopkins 2015', 'Rangjung Yeshe', 'James Valby', 'Practice terms'])
    expect(wrapper.find('.dictionary-list__subhead').text()).toBe('Not on this device')
    expect(rows().length).toBeGreaterThan(4)
  })

  it('should sum up what is used, on this device and still to add', async () => {
    await mountPage()
    expect(wrapper.find('[data-testid="dictionaries-summary"]').text()).toMatch(/^3 used in lookups · 4 on this device · \d+ more in packs you can add$/)
  })

  it('should say a dictionary switched off is off', async () => {
    await mountPage()
    expect(rowOf('James Valby').find('.dictionary-row__meta').text()).toMatch(/^Off · Tibetan/)
  })

  it('should save a dictionary switched off, keeping the others', async () => {
    await mountPage()
    await rowOf('Rangjung Yeshe').findComponent({ name: 'UiSwitch' }).vm.$emit('update:modelValue', false)
    expect(stored().map((entry) => [entry.name, entry.enabled])).toEqual([
      ['Hopkins2015', true], ['RangjungYeshe', false], ['JimValby', false], ['Practice terms', true],
    ])
  })

  it('should reload the list after the dictionaries change elsewhere', async () => {
    await mountPage()
    Storage.set('dictionaries', STORED.slice(0, 2))
    window._triggerEvent('dictionaries-updated')
    await nextTick()
    expect(names().slice(0, 3)).toEqual(['Hopkins 2015', 'Rangjung Yeshe', expect.not.stringMatching('James Valby')])
  })

  it('should open on the search and the status a link gives it', async () => {
    await mountPage({ find: 'kunsang', status: 'available' })
    expect(wrapper.find('[data-testid="dictionaries-search"] input').element.value).toBe('kunsang')
    expect(wrapper.find('[data-testid="dictionaries-status"] [aria-checked="true"]').text()).toBe('Not installed')
  })

  it('should find dictionaries by what they hold, and say how many of how many match', async () => {
    await mountPage()
    await search('kunsang')
    expect(names()).toEqual(['Rangjung Yeshe'])
    expect(wrapper.find('.dictionaries-page__label').text()).toMatch(/^1 of \d+ dictionaries$/)
  })

  it('should find the dictionaries tagged archaic, wherever they are', async () => {
    // Against the real details: guards the subject tags a user asked for
    await mountPage()
    await search('archaic')
    expect(names()).toEqual(expect.arrayContaining(['Brda dkrol gser gyi me long', "Li shi'i gur khang"]))
  })

  it('should keep only the dictionaries switched off, or not installed', async () => {
    await mountPage()
    await chooseStatus('Off')
    expect(names()).toEqual(['James Valby'])
    await chooseStatus('Not installed')
    expect(rows().every((row) => row.classes('is-available'))).toBe(true)
  })

  it('should say when nothing matches, and clear the search and filters from there', async () => {
    await mountPage()
    await search('zzzz nothing')
    expect(wrapper.find('[data-testid="dictionary-empty"]').exists()).toBe(true)
    await wrapper.find('.dictionary-list__clear').trigger('click')
    expect(names().slice(0, 2)).toEqual(['Hopkins 2015', 'Rangjung Yeshe'])
  })
})

describe('DictionariesPage — reordering', () => {
  const handles = () => wrapper.findAll('[data-testid="dictionary-handle"]')

  it('should name each handle after its dictionary and its place', async () => {
    await mountPage()
    expect(handles()[1].attributes('aria-label')).toBe('Move Rangjung Yeshe, position 2 of 4')
  })

  it('should move a dictionary down with Alt+Down, save the order, announce it and keep the focus on its handle', async () => {
    await mountPage()
    handles()[0].element.focus()
    await handles()[0].trigger('keydown', { key: 'ArrowDown', altKey: true })
    await nextTick()
    expect(stored().map((entry) => [entry.name, entry.position])).toEqual([
      ['RangjungYeshe', 1], ['Hopkins2015', 2], ['JimValby', 3], ['Practice terms', 4],
    ])
    expect(wrapper.find('[data-testid="dictionary-announcement"]').text()).toBe('Hopkins 2015 moved to position 2 of 4')
    expect(document.activeElement).toBe(handles()[1].element)
  })

  it('should leave the order as it is past either end, and for Down without Alt', async () => {
    await mountPage()
    await handles()[0].trigger('keydown', { key: 'ArrowUp', altKey: true })
    await handles()[0].trigger('keydown', { key: 'ArrowDown' })
    expect(stored().map((entry) => entry.name)).toEqual(['Hopkins2015', 'RangjungYeshe', 'JimValby', 'Practice terms'])
  })

  it('should hide the handles while the list is searched or filtered, and say why', async () => {
    await mountPage()
    await search('hopkins')
    expect(handles()).toHaveLength(0)
    expect(wrapper.find('.dictionaries-page__hint').text()).toBe('Clear the search and filters to reorder')
  })
})

describe('DictionariesPage — the selected dictionary', () => {
  it('should show the first dictionary until another is chosen', async () => {
    await mountPage()
    expect(detail().find('[data-testid="dictionary-detail-title"]').text()).toBe('Hopkins 2015')
    await rowOf('Rangjung Yeshe').find('[data-testid="dictionary-select"]').trigger('click')
    expect(detail().find('[data-testid="dictionary-detail-title"]').text()).toBe('Rangjung Yeshe')
    expect(rowOf('Rangjung Yeshe').classes()).toContain('is-selected')
  })

  it('should show its sources with live links, its languages and subjects, and its place in lookups', async () => {
    await mountPage()
    await rowOf('Rangjung Yeshe').find('[data-testid="dictionary-select"]').trigger('click')
    expect(detail().find('.dictionary-detail__sources a').exists()).toBe(true)
    expect(detail().text()).toContain('Tibetan ↔ English')
    expect(detail().find('[data-testid="dictionary-detail-rank"]').text()).toBe('Yes · 2nd of 3')
  })

  it('should search the definitions of a dictionary switched on, its own or bundled', async () => {
    await mountPage()
    await rowOf('Rangjung Yeshe').find('[data-testid="dictionary-select"]').trigger('click')
    await detail().find('[data-testid="dictionary-search-definitions"]').trigger('click')
    expect(wrapper.vm.$router.push).toHaveBeenCalledWith({ path: '/lookup', query: { mode: 'en', dict: 'RangjungYeshe' } })
    await rowOf('Practice terms').find('[data-testid="dictionary-select"]').trigger('click')
    await detail().find('[data-testid="dictionary-search-definitions"]').trigger('click')
    expect(wrapper.vm.$router.push).toHaveBeenLastCalledWith({ path: '/lookup', query: { mode: 'en', dict: 'Practice terms' } })
  })

  it('should not offer to search the definitions of a dictionary switched off', async () => {
    await mountPage()
    await rowOf('James Valby').find('[data-testid="dictionary-select"]').trigger('click')
    expect(detail().find('[data-testid="dictionary-search-definitions"]').exists()).toBe(false)
  })

  it('should move it to the top or the bottom of the order', async () => {
    await mountPage()
    await rowOf('James Valby').find('[data-testid="dictionary-select"]').trigger('click')
    await wrapper.find('[data-testid="dictionary-move-top"]').trigger('click')
    expect(stored().map((entry) => entry.name)).toEqual(['JimValby', 'Hopkins2015', 'RangjungYeshe', 'Practice terms'])
    await wrapper.find('[data-testid="dictionary-move-bottom"]').trigger('click')
    expect(stored().map((entry) => entry.name)).toEqual(['Hopkins2015', 'RangjungYeshe', 'Practice terms', 'JimValby'])
  })

  it('should not offer to move the first one higher', async () => {
    await mountPage()
    expect(wrapper.find('[data-testid="dictionary-move-top"]').attributes('disabled')).toBeDefined()
  })

  it('should switch it off from its detail too', async () => {
    await mountPage()
    await detail().findComponent({ name: 'UiSwitch' }).vm.$emit('update:modelValue', false)
    expect(stored()[0]).toMatchObject({ name: 'Hopkins2015', enabled: false })
  })

  it('should say one of the user\'s glossaries is theirs, and link to it', async () => {
    await mountPage()
    await rowOf('Practice terms').find('[data-testid="dictionary-select"]').trigger('click')
    expect(detail().text()).toContain('One of your glossaries')
    expect(detail().findComponent(RouterLinkStub).props('to')).toBe('/glossary/custom-1')
  })

  it('should offer to install the pack of a dictionary not on this device, after confirmation', async () => {
    await mountPage()
    await chooseStatus('Not installed')
    await rows()[0].find('[data-testid="dictionary-select"]').trigger('click')
    await wrapper.find('[data-testid="dictionary-install"]').trigger('click')
    await flushPromises()
    expect(packs.api.downloadPack).not.toHaveBeenCalled()
    document.body.querySelector('[data-testid="pack-confirm-install"]').click()
    await flushPromises()
    expect(packs.api.downloadPack).toHaveBeenCalledWith('tibetan-monolingual')
    expect(db.reloadPack).toHaveBeenCalledWith('tibetan-monolingual')
  })
})

describe('DictionariesPage — packs', () => {
  const pack = (id) => wrapper.find(`[data-testid="pack-${id}"]`)

  it('should list every pack with what it holds and where it stands', async () => {
    await mountPage()
    expect(pack('core').text()).toContain('Included')
    expect(pack('core').text()).toMatch(/\d+ dictionaries · always on this device/)
    expect(pack('tibetan-monolingual').text()).toMatch(/Install\s*\d+ dictionaries · 65 MB/)
  })

  it('should ask before installing a pack, and download nothing when cancelled', async () => {
    await mountPage()
    await pack('tibetan-monolingual').find('[data-testid="pack-install"]').trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('Install Tibetan Monolingual?')
    expect(packs.api.downloadPack).not.toHaveBeenCalled()
  })

  it('should report a failed install', async () => {
    packs.api.downloadPack.mockRejectedValueOnce(new Error('offline'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await mountPage()
    await pack('tibetan-monolingual').find('[data-testid="pack-install"]').trigger('click')
    await flushPromises()
    document.body.querySelector('[data-testid="pack-confirm-install"]').click()
    await flushPromises()
    expect(snackbar.open).toHaveBeenCalledWith('Could not install Tibetan Monolingual.')
    expect(db.reloadPack).not.toHaveBeenCalled()
  })

  it('should show the progress of a pack downloading or updating', async () => {
    packs.state.downloadingPacks = { 'tibetan-monolingual': { percentage: 41.6 } }
    await mountPage()
    expect(pack('tibetan-monolingual').find('[data-testid="pack-status"]').text()).toBe('Downloading 42%')
    packs.state.downloadingPacks = {}
    packs.state.installedPacks = ['core', 'tibetan-monolingual']
    packs.state.updatingPacks = { 'tibetan-monolingual': { percentage: 10 } }
    await nextTick()
    expect(pack('tibetan-monolingual').find('[data-testid="pack-status"]').text()).toBe('Updating 10%')
  })

  it('should not offer to install before the pack manager knows what is installed', async () => {
    packs.state.isInitialized = false
    packs.api.init.mockImplementationOnce(async () => {})
    await mountPage()
    expect(wrapper.find('[data-testid="pack-install"]').exists()).toBe(false)
  })

  it('should remove an installed pack after confirmation', async () => {
    packs.state.installedPacks = ['core', 'tibetan-monolingual']
    await mountPage()
    const packsView = wrapper.findComponent(DictionaryPacks)
    packsView.vm.askRemove(packsView.vm.packs.find((entry) => entry.id === 'tibetan-monolingual'))
    await flushPromises()
    expect(packs.api.removePack).not.toHaveBeenCalled()
    document.body.querySelector('[data-testid="remove-confirm"]').click()
    await flushPromises()
    expect(db.unloadPack).toHaveBeenCalledWith('tibetan-monolingual')
    expect(packs.api.removePack).toHaveBeenCalledWith('tibetan-monolingual')
  })

  it('should check for updates, then offer each update and all of them', async () => {
    packs.state.installedPacks = ['core', 'tibetan-monolingual']
    await mountPage()
    await wrapper.find('[data-testid="packs-check-updates"]').trigger('click')
    await flushPromises()
    expect(packs.api.checkForUpdates).toHaveBeenCalled()
    expect(snackbar.open).toHaveBeenCalledWith('Every pack is up to date')

    packs.state.availableUpdates = { 'tibetan-monolingual': { sizeMB: 3 } }
    await nextTick()
    expect(pack('tibetan-monolingual').find('[data-testid="pack-update"]').text()).toBe('Update · 3 MB')
    await wrapper.find('[data-testid="packs-update-all"]').trigger('click')
    await flushPromises()
    expect(packs.api.updatePack).toHaveBeenCalledWith('tibetan-monolingual')
    expect(db.reloadPack).toHaveBeenCalledWith('tibetan-monolingual')
  })
})

describe('DictionariesPage — on the web', () => {
  it('should leave out the packs and what is not installed, every dictionary being bundled', async () => {
    env.modular = false
    await mountPage()
    expect(wrapper.find('[data-testid="dictionary-packs"]').exists()).toBe(false)
    expect(wrapper.find('.dictionary-list__subhead').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="dictionaries-status"] [role="radio"]').map((radio) => radio.text())).toEqual(['All', 'On', 'Off'])
    expect(wrapper.find('[data-testid="dictionaries-summary"]').text()).toBe('3 of 4 used in lookups')
  })
})

describe('DictionariesPage — on a phone', () => {
  beforeEach(() => {
    env.phone = true
  })

  it('should link back to Settings above the title', async () => {
    await mountPage()
    const back = wrapper.findComponent(RouterLinkStub)
    expect(back.props('to')).toBe('/settings')
    expect(back.text()).toContain('Settings')
  })

  it('should show the handles only after Reorder, until Done', async () => {
    await mountPage()
    expect(wrapper.findAll('[data-testid="dictionary-handle"]')).toHaveLength(0)
    await wrapper.find('[data-testid="dictionaries-reorder"]').trigger('click')
    expect(wrapper.findAll('[data-testid="dictionary-handle"]')).toHaveLength(4)
    expect(wrapper.find('[data-testid="dictionaries-reorder"]').text()).toBe('Done')
  })

  it('should open a tapped dictionary on a screen of its own, with a way back to the list', async () => {
    await mountPage()
    expect(detail().exists()).toBe(false)
    await rowOf('Rangjung Yeshe').find('[data-testid="dictionary-select"]').trigger('click')
    expect(detail().find('[data-testid="dictionary-detail-title"]').text()).toBe('Rangjung Yeshe')
    expect(wrapper.find('.dictionaries-page__main').isVisible()).toBe(false)
    await wrapper.find('[data-testid="dictionary-detail-back"]').trigger('click')
    expect(detail().exists()).toBe(false)
  })

  it('should close the dictionary with the system Back, which steps back through the history', async () => {
    await mountPage()
    await rowOf('Rangjung Yeshe').find('[data-testid="dictionary-select"]').trigger('click')
    expect(route.query).toEqual({ dictionary: 'RangjungYeshe' })
    wrapper.vm.$router.back()
    await nextTick()
    expect(detail().exists()).toBe(false)
    expect(wrapper.find('.dictionaries-page__main').isVisible()).toBe(true)
  })

  it('should open the dictionary a link names', async () => {
    await mountPage({ dictionary: 'RangjungYeshe' })
    expect(detail().find('[data-testid="dictionary-detail-title"]').text()).toBe('Rangjung Yeshe')
  })
})

describe('DictionariesPage — reactive pack state', () => {
  it('should list a pack\'s dictionaries on this device once it is installed', async () => {
    await mountPage()
    const before = wrapper.findAll('.dictionary-row.is-available').length
    packs.state.installedPacks = ['core', 'tibetan-monolingual']
    await nextTick()
    expect(wrapper.findAll('.dictionary-row.is-available').length).toBeLessThan(before)
  })
})

describe('DictionariesPage — keyboard', () => {
  // tests/setup.js delivers window events with window._triggerEvent
  const press = (key, init = {}) => {
    const event = { key, target: document.body, preventDefault: vi.fn(), ...init }
    window._triggerEvent('keydown', event)
    return event
  }
  const title = () => detail().find('[data-testid="dictionary-detail-title"]').text()

  it('should select the next and previous dictionary with Down and Up', async () => {
    await mountPage()
    press('ArrowDown')
    await nextTick()
    expect(title()).toBe('Rangjung Yeshe')
    press('ArrowUp')
    await nextTick()
    expect(title()).toBe('Hopkins 2015')
  })

  it('should move the selected dictionary with Alt+Down and Alt+Up, wherever the focus is', async () => {
    await mountPage()
    const event = press('ArrowDown', { altKey: true })
    await nextTick()
    expect(event.preventDefault).toHaveBeenCalled()
    expect(stored().map((entry) => entry.name)).toEqual(['RangjungYeshe', 'Hopkins2015', 'JimValby', 'Practice terms'])
    expect(title()).toBe('Hopkins 2015')
  })

  it('should leave the keys to a text field being typed in', async () => {
    await mountPage()
    press('ArrowDown', { altKey: true, target: wrapper.find('[data-testid="dictionaries-search"] input').element })
    expect(stored().map((entry) => entry.name)).toEqual(['Hopkins2015', 'RangjungYeshe', 'JimValby', 'Practice terms'])
  })

  it('should undo a move with Ctrl+Z, say so, and redo it with Ctrl+Y', async () => {
    await mountPage()
    await rowOf('James Valby').find('[data-testid="dictionary-select"]').trigger('click')
    await wrapper.find('[data-testid="dictionary-move-top"]').trigger('click')
    expect(stored()[0].name).toBe('JimValby')

    press('z', { ctrlKey: true })
    await nextTick()
    expect(stored().map((entry) => entry.name)).toEqual(['Hopkins2015', 'RangjungYeshe', 'JimValby', 'Practice terms'])
    expect(snackbar.open).toHaveBeenLastCalledWith('Undone: James Valby moved to the top')

    press('y', { ctrlKey: true })
    await nextTick()
    expect(stored()[0].name).toBe('JimValby')
    expect(snackbar.open).toHaveBeenLastCalledWith('Redone: James Valby moved to the top')
  })

  it('should undo a switch and a drag too, and redo with Cmd+Shift+Z', async () => {
    await mountPage()
    await rowOf('Rangjung Yeshe').findComponent({ name: 'UiSwitch' }).vm.$emit('update:modelValue', false)
    wrapper.findComponent({ name: 'DictionaryList' }).vm.$emit('reorder', ['RangjungYeshe', 'Hopkins2015', 'JimValby', 'Practice terms'])
    await nextTick()

    press('z', { metaKey: true })
    expect(stored().map((entry) => entry.name)).toEqual(['Hopkins2015', 'RangjungYeshe', 'JimValby', 'Practice terms'])
    press('z', { metaKey: true })
    expect(stored()[1]).toMatchObject({ name: 'RangjungYeshe', enabled: true })
    press('z', { metaKey: true, shiftKey: true })
    expect(stored()[1]).toMatchObject({ name: 'RangjungYeshe', enabled: false })
  })

  it('should forget what was undone once something else changes', async () => {
    await mountPage()
    await wrapper.find('[data-testid="dictionary-move-bottom"]').trigger('click')
    press('z', { ctrlKey: true })
    await rowOf('Rangjung Yeshe').findComponent({ name: 'UiSwitch' }).vm.$emit('update:modelValue', false)
    press('y', { ctrlKey: true })
    expect(stored()[0].name).toBe('Hopkins2015')
  })
})

describe('DictionariesPage — pack updates', () => {
  it('should look for pack updates by itself when the page opens, without a word when there are none', async () => {
    await mountPage()
    await flushPromises()
    expect(packs.api.checkForUpdates).toHaveBeenCalledTimes(1)
    expect(snackbar.open).not.toHaveBeenCalled()
  })
})

describe('DictionariesPage — review fixes', () => {
  const press = (key, init = {}) => {
    const event = { key, target: document.body, preventDefault: vi.fn(), ...init }
    window._triggerEvent('keydown', event)
    return event
  }

  it('should undo onto the current list, keeping dictionaries added since and ignoring those gone', async () => {
    await mountPage()
    await rowOf('Rangjung Yeshe').findComponent({ name: 'UiSwitch' }).vm.$emit('update:modelValue', false)
    // A pack installed meanwhile adds a dictionary; another one is removed
    Storage.set('dictionaries', [
      ...stored().filter((entry) => entry.name !== 'JimValby'),
      { id: 30, name: 'brda', enabled: true, position: 5 },
    ])
    window._triggerEvent('dictionaries-updated')
    await nextTick()

    press('z', { ctrlKey: true })
    expect(stored().map((entry) => [entry.name, entry.enabled, entry.position])).toEqual([
      ['Hopkins2015', true, 1], ['RangjungYeshe', true, 2], ['Practice terms', true, 3], ['brda', true, 4],
    ])
  })

  it('should leave plain arrows to scrolling when the focus is outside the list', async () => {
    await mountPage()
    const button = wrapper.find('[data-testid="dictionary-move-bottom"]').element
    const event = press('ArrowDown', { target: button })
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(detail().find('[data-testid="dictionary-detail-title"]').text()).toBe('Hopkins 2015')
  })

  it('should leave Ctrl+Z to an open menu or list box', async () => {
    await mountPage()
    await wrapper.find('[data-testid="dictionary-move-bottom"]').trigger('click')
    const menu = document.createElement('div')
    menu.setAttribute('role', 'menu')
    document.body.appendChild(menu)
    press('z', { ctrlKey: true, target: menu })
    expect(stored().at(-1).name).toBe('Hopkins2015')
  })

  it('should announce a move made from the keyboard', async () => {
    await mountPage()
    press('ArrowDown', { altKey: true })
    await nextTick()
    expect(wrapper.find('[data-testid="dictionaries-announcement"]').text()).toBe('Hopkins 2015 moved to position 2 of 4')
  })

  it('should not offer to install from a detail before the pack manager knows what is installed', async () => {
    packs.state.isInitialized = false
    packs.api.init.mockImplementationOnce(async () => {})
    await mountPage()
    await chooseStatus('Not installed')
    await rows()[0].find('[data-testid="dictionary-select"]').trigger('click')
    expect(wrapper.find('[data-testid="dictionary-install"]').exists()).toBe(false)
  })

  it('should drop the filters a link set once the page is opened without one', async () => {
    await mountPage({ status: 'available' })
    wrapper.vm.$options.watch['$route.query'].handler.call(wrapper.vm, {})
    await nextTick()
    expect(wrapper.find('[data-testid="dictionaries-status"] [aria-checked="true"]').text()).toBe('All')
  })

  it('should keep filters chosen by hand when the page is opened again', async () => {
    await mountPage()
    await chooseStatus('Off')
    wrapper.vm.$options.watch['$route.query'].handler.call(wrapper.vm, {})
    await nextTick()
    expect(wrapper.find('[data-testid="dictionaries-status"] [aria-checked="true"]').text()).toBe('Off')
  })

  describe('on a phone', () => {
    beforeEach(() => {
      env.phone = true
    })

    it('should come back to the list, not to an old detail, after leaving the page', async () => {
      await mountPage()
      await rowOf('Rangjung Yeshe').find('[data-testid="dictionary-select"]').trigger('click')
      wrapper.vm.$options.deactivated.call(wrapper.vm)
      await nextTick()
      expect(detail().exists()).toBe(false)
    })

    it('should give the list back where it was scrolled when the detail is closed', async () => {
      await mountPage()
      const page = wrapper.find('[data-testid="dictionaries-page"]').element
      page.scrollTop = 420
      await rowOf('Rangjung Yeshe').find('[data-testid="dictionary-select"]').trigger('click')
      expect(page.scrollTop).toBe(0)
      await wrapper.find('[data-testid="dictionary-detail-back"]').trigger('click')
      await nextTick()
      expect(page.scrollTop).toBe(420)
    })
  })
})
