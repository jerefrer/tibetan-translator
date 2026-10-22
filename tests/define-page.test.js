/**
 * The Define screen (DefinePage.vue), mounted the way App.vue mounts it: a
 * real router and a <keep-alive> around the <router-view>, so the route
 * parameter, the guards and activated() behave as in the app.
 *
 * Each block maps to the behaviours listed in docs/redesign/reports/define.md.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { h, KeepAlive, nextTick } from 'vue'
import { RouterView } from 'vue-router'

vi.mock('../src/config/platform.js', () => ({
  isTauri: () => true,
  isMacOS: () => false,
  isMobile: () => false,
  supportsModularPacks: () => true,
}))

vi.mock('../src/services/pack-manager', () => ({
  default: { isInitialized: true, installedPacks: ['core'], downloadingPacks: {} },
}))

const database = vi.hoisted(() => ({
  allTerms: [],
  getEntriesFor: null,
}))
vi.mock('../src/services/sql-database', () => ({ default: database }))

const writeToClipboard = vi.hoisted(() => vi.fn())
vi.mock('../src/services/copy-service', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    default: { ...actual.default, writeToClipboard },
  }
})

import DefinePage from '../src/components/DefinePage.vue'
import Storage from '../src/services/storage'

const KA = 'ཀ་'
const KAKA = 'ཀ་ཀ་'
const KHA = 'ཁ་'
const DICTIONARIES = [
  { id: 1, name: 'RangjungYeshe', position: 2, enabled: true },
  { id: 2, name: 'Hopkins2015', position: 1, enabled: true },
  { id: 3, name: 'Jaeschke_Scan', position: 3, enabled: true },
  { id: 4, name: 'RichardBarron', position: 4, enabled: false },
]
const ENTRIES = [
  { term: KA, dictionaryId: 1, dictionary: 'RangjungYeshe', definition: 'the first letter' },
  { term: KA, dictionaryId: 2, dictionary: 'Hopkins2015', definition: 'ka' },
  { term: KA, dictionaryId: 3, dictionary: 'Jaeschke_Scan', definition: '1?' },
  { term: KA, dictionaryId: 4, dictionary: 'RichardBarron', definition: 'disabled in Settings' },
]

const snackbar = { open: vi.fn() }
const quickAddStub = {
  name: 'QuickAddDialog',
  props: ['modelValue', 'term'],
  emits: ['update:modelValue', 'saved'],
  template: '<div class="quick-add-stub" />',
}
const Placeholder = { template: '<div class="placeholder" />' }

let wrapper
let router

const Shell = {
  render: () =>
    h(RouterView, null, {
      default: ({ Component }) => h(KeepAlive, null, [Component ? h(Component) : null]),
    }),
}

async function mountAt(path) {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/define', component: DefinePage },
      { path: '/define/:term', component: DefinePage },
      { path: '/search/:query?', component: Placeholder },
      { path: '/dictionaries', component: Placeholder },
      { path: '/settings', component: Placeholder },
    ],
  })
  router.push(path)
  await router.isReady()
  wrapper = mount(Shell, {
    attachTo: document.body,
    global: {
      plugins: [router],
      provide: { snackbar },
      stubs: { QuickAddDialog: quickAddStub },
    },
  })
  await flushPromises()
  return wrapper
}

const page = () => wrapper.findComponent(DefinePage)
const field = () => wrapper.find('[data-testid="define-field"] input')
const terms = () => wrapper.findAll('[data-testid="define-term"]').map((item) => item.text())
const typeInField = async (value) => {
  await field().setValue(value)
  await nextTick()
}
const waitForRoute = (path) => vi.waitFor(() => expect(router.currentRoute.value.path).toBe(path), { timeout: 2000 })

beforeEach(() => {
  database.allTerms = [KA, KAKA, KHA]
  database.getEntriesFor = vi.fn(async () => ENTRIES.map((entry) => ({ ...entry })))
  writeToClipboard.mockReset().mockResolvedValue()
  snackbar.open.mockClear()
  Storage.set('dictionaries', DICTIONARIES)
  // Storage writes localStorage properties, which the setup's clear() keeps
  Storage.delete('selectedTerm')
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('Define — route and lifecycle', () => {
  it('should show the term from the route in the field, and its definitions', async () => {
    await mountAt('/define/' + encodeURIComponent(KA))

    expect(field().element.value).toBe(KA)
    expect(database.getEntriesFor).toHaveBeenCalledWith(KA)
    await vi.waitFor(() => expect(wrapper.find('[data-testid="define-entries"]').exists()).toBe(true))
  })

  it('should go back to the last term when /define is opened without one', () => {
    Storage.set('selectedTerm', KHA)
    const next = vi.fn()

    DefinePage.beforeRouteEnter({ params: {} }, {}, next)

    expect(next).toHaveBeenCalledWith('/define/' + KHA)
  })

  it('should open /define as is when no term was stored, or when the route has one', () => {
    const next = vi.fn()
    DefinePage.beforeRouteEnter({ params: {} }, {}, next)
    Storage.set('selectedTerm', KHA)
    DefinePage.beforeRouteEnter({ params: { term: KA } }, {}, next)

    expect(next.mock.calls).toEqual([[], []])
  })

  it('should remember each selected term', async () => {
    await mountAt('/define/' + encodeURIComponent(KA))

    await router.push('/define/' + encodeURIComponent(KHA))
    await flushPromises()

    expect(Storage.get('selectedTerm')).toBe(KHA)
  })

  it('should focus the field each time the page is shown again (keep-alive)', async () => {
    await mountAt('/define/' + encodeURIComponent(KA))
    const definePage = page().vm

    await router.push('/settings')
    await flushPromises()
    document.activeElement?.blur?.()
    await router.push('/define/' + encodeURIComponent(KA))
    await flushPromises()

    // Same instance: the page was cached, not rebuilt
    expect(page().vm).toBe(definePage)
    expect(document.activeElement).toBe(field().element)
  })

  it('should keep what was typed, and the list, when coming back to the same term (keep-alive)', async () => {
    database.allTerms = [KA, KAKA, 'ཀ་ར་', KHA]
    await mountAt('/define')
    await typeInField(KA)
    await vi.waitFor(() => expect(router.currentRoute.value.params.term).toBe(KA), { timeout: 2000 })
    await wrapper.findAll('[data-testid="define-term"]')[1].trigger('click')
    await waitForRoute('/define/' + encodeURIComponent(KAKA))
    await flushPromises()
    database.getEntriesFor.mockClear()

    await router.push('/settings')
    await flushPromises()
    await router.push('/define/' + encodeURIComponent(KAKA))
    await flushPromises()

    expect(field().element.value).toBe(KA)
    expect(terms()).toEqual([KA, KAKA, 'ཀ་ར་'])
    expect(database.getEntriesFor).not.toHaveBeenCalled()
  })

  it('should still follow a link to another term from another page', async () => {
    await mountAt('/define/' + encodeURIComponent(KA))
    await router.push('/search/x')
    await flushPromises()
    await router.push('/define/' + encodeURIComponent(KHA))
    await flushPromises()

    expect(field().element.value).toBe(KHA)
    await vi.waitFor(() => expect(database.getEntriesFor).toHaveBeenLastCalledWith(KHA))
  })

  it('should list new terms once a pack is installed (all-terms-updated)', async () => {
    await mountAt('/define/' + encodeURIComponent(KA))
    expect(terms()).toEqual([KA, KAKA])

    database.allTerms = [KA, 'ཀ་ར་', KAKA, KHA]
    window._triggerEvent('all-terms-updated')
    await nextTick()

    expect(terms()).toEqual([KA, KAKA, 'ཀ་ར་'])
  })
})

describe('Define — search field', () => {
  it('should be the Tibetan field, with the Define placeholder and a search key', async () => {
    await mountAt('/define')

    expect(wrapper.find('[data-testid="define-field"]').classes()).toContain('ui-field--tibetan')
    expect(field().attributes('placeholder')).toBe('Type a Tibetan term')
    expect(field().attributes('enterkeyhint')).toBe('search')
    expect(field().attributes('autofocus')).toBeDefined()
  })

  it('should turn Wylie into Tibetan when a space is typed', async () => {
    await mountAt('/define')

    await typeInField('ka')
    await field().trigger('keyup', { key: ' ' })
    await nextTick()

    expect(page().vm.searchTerm).toBe(KA)
  })

  it('should echo the Wylie that was typed', async () => {
    await mountAt('/define')

    await typeInField('ka')
    await field().trigger('keyup', { key: ' ' })
    await nextTick()

    expect(wrapper.find('[data-testid="define-typed"]').text()).toBe('typed ka')
  })

  it('should select the first matching term after a pause in typing', async () => {
    await mountAt('/define')

    await typeInField(KA)

    expect(terms()).toEqual([KA, KAKA])
    await waitForRoute('/define/' + encodeURIComponent(KA))
  })

  it('should clear the field, the definitions and the stored term with its clear button', async () => {
    await mountAt('/define/' + encodeURIComponent(KA))
    Storage.set('selectedTerm', KA)

    await wrapper.find('[data-testid="ui-text-field-clear"]').trigger('click')
    await flushPromises()

    expect(field().element.value).toBe('')
    expect(Storage.get('selectedTerm')).toBeNull()
    expect(router.currentRoute.value.path).toBe('/define')
    expect(wrapper.find('[data-testid="define-entries"]').exists()).toBe(false)
  })

  it('should move to the next and previous term with Down and Up', async () => {
    await mountAt('/define/' + encodeURIComponent(KA))

    const down = await field().trigger('keydown', { key: 'ArrowDown' })
    await flushPromises()
    expect(router.currentRoute.value.params.term).toBe(KAKA)

    await field().trigger('keydown', { key: 'ArrowDown' })
    await flushPromises()
    expect(router.currentRoute.value.params.term).toBe(KAKA)

    await field().trigger('keydown', { key: 'ArrowUp' })
    await flushPromises()
    expect(router.currentRoute.value.params.term).toBe(KA)
    expect(down).toBeUndefined()
  })

  it('should keep what was typed in the field when a longer term is picked', async () => {
    await mountAt('/define/' + encodeURIComponent(KA))

    await wrapper.findAll('[data-testid="define-term"]')[1].trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.params.term).toBe(KAKA)
    expect(field().element.value).toBe(KA)
  })
})

describe('Define — terms', () => {
  it('should say how many terms are shown out of how many match', async () => {
    await mountAt('/define/' + encodeURIComponent(KA))
    expect(wrapper.find('[data-testid="define-terms-count"]').text()).toBe('Showing 2 of 2 terms')
  })

  it('should highlight the selected term', async () => {
    await mountAt('/define/' + encodeURIComponent(KA))
    const active = wrapper.findAll('.term-item.is-active')
    expect(active).toHaveLength(1)
    expect(active[0].text()).toBe(KA)
    expect(active[0].attributes('aria-selected')).toBe('true')
  })

  it('should render terms 100 at a time, loading more as the list scrolls', async () => {
    database.allTerms = Array.from({ length: 250 }, (_, index) => `ཀ་${String(index).padStart(3, '0')}`)
    await mountAt('/define/' + encodeURIComponent(database.allTerms[0]))
    await page().vm.$nextTick()
    page().vm.searchTerm = 'ཀ་'
    await flushPromises()

    expect(terms()).toHaveLength(100)
    expect(wrapper.find('[data-testid="define-terms-count"]').text()).toBe('Showing 100 of 250 terms')
    expect(wrapper.find('.terms-load-more-sentinel [data-testid="ui-spinner"]').exists()).toBe(true)

    page().vm.termsObserver._trigger(true)
    await flushPromises()

    expect(terms()).toHaveLength(200)
  })

  it('should render enough terms for the term picked with the keyboard to be in the list', async () => {
    database.allTerms = Array.from({ length: 250 }, (_, index) => `ཀ་${String(index).padStart(3, '0')}`)
    await mountAt('/define/' + encodeURIComponent(database.allTerms[0]))
    page().vm.searchTerm = 'ཀ་'
    await flushPromises()

    await router.push('/define/' + encodeURIComponent(database.allTerms[150]))
    await flushPromises()

    expect(terms()).toContain(database.allTerms[150])
  })

  it('should say "No results." when nothing starts with what was typed', async () => {
    await mountAt('/define')

    await typeInField('ག་')

    expect(wrapper.find('[data-testid="define-no-results"]').text()).toBe('No results.')
    expect(wrapper.find('[data-testid="define-terms"]').exists()).toBe(false)
  })

  it('should carry the Dictionaries menu in the terms header', async () => {
    await mountAt('/define/' + encodeURIComponent(KA))
    await vi.waitFor(() =>
      expect(wrapper.find('.terms-header [data-testid="dictionaries-menu-button"]').exists()).toBe(true)
    )
  })
})

describe('Define — definitions', () => {
  it('should show entries of the enabled dictionaries only, in the Settings order', async () => {
    await mountAt('/define/' + encodeURIComponent(KA))
    await vi.waitFor(() => expect(wrapper.findAll('[data-testid="entry"]')).toHaveLength(3))

    const labels = wrapper.findAll('[data-testid="entry-dictionary"]').map((chip) => chip.text())
    expect(labels[0]).toContain('Hopkins')
    expect(labels[1]).toContain('Rangjung')
    expect(wrapper.text()).not.toContain('disabled in Settings')
  })

  it('should show a scanned entry with its page and a View scan button', async () => {
    await mountAt('/define/' + encodeURIComponent(KA))
    await vi.waitFor(() => expect(wrapper.find('[data-testid="entry-scan"]').exists()).toBe(true))

    expect(wrapper.find('[data-testid="entry-scan"]').text()).toContain('Page 1 (approximate)')
    expect(wrapper.find('[data-testid="entry-view-scan"]').exists()).toBe(true)
  })

  it('should show a spinner while the definitions load', async () => {
    let resolve
    database.getEntriesFor = vi.fn(() => new Promise((done) => (resolve = done)))
    await mountAt('/define/' + encodeURIComponent(KA))

    expect(wrapper.find('[data-testid="define-loading"]').text()).toContain('Loading definitions...')
    expect(wrapper.find('[data-testid="define-copy-all"]').exists()).toBe(false)

    resolve(ENTRIES)
    await flushPromises()
    expect(wrapper.find('[data-testid="define-loading"]').exists()).toBe(false)
  })

  it('should copy every definition but the scanned ones with Copy all', async () => {
    await mountAt('/define/' + encodeURIComponent(KA))
    await vi.waitFor(() => expect(wrapper.find('[data-testid="define-copy-all"]').exists()).toBe(true))

    await wrapper.find('[data-testid="define-copy-all"]').trigger('click')
    await flushPromises()

    const text = writeToClipboard.mock.calls[0][0]
    expect(text.startsWith(KA)).toBe(true)
    expect(text).toContain('the first letter')
    expect(text).toContain('ka')
    expect(text).not.toContain('1?')
    expect(snackbar.open).toHaveBeenCalledWith('Copied')
  })

  it('should say when Copy all failed', async () => {
    writeToClipboard.mockRejectedValue(new Error('denied'))
    await mountAt('/define/' + encodeURIComponent(KA))
    await vi.waitFor(() => expect(wrapper.find('[data-testid="define-copy-all"]').exists()).toBe(true))

    await wrapper.find('[data-testid="define-copy-all"]').trigger('click')
    await flushPromises()

    expect(snackbar.open).toHaveBeenCalledWith('Copy failed')
  })

  it('should hide Copy all when only scanned entries are shown', async () => {
    database.getEntriesFor = vi.fn(async () => [ENTRIES[2]])
    await mountAt('/define/' + encodeURIComponent(KA))
    await vi.waitFor(() => expect(wrapper.find('[data-testid="entry-scan"]').exists()).toBe(true))

    expect(wrapper.find('[data-testid="define-copy-all"]').exists()).toBe(false)
  })

  it('should open Add my definition with the selected term, then look it up again once saved', async () => {
    await mountAt('/define/' + encodeURIComponent(KA))
    await vi.waitFor(() => expect(wrapper.find('[data-testid="define-add"]').exists()).toBe(true))
    const dialog = wrapper.findComponent(quickAddStub)
    expect(dialog.props()).toMatchObject({ modelValue: false, term: KA })

    await wrapper.find('[data-testid="define-add"]').trigger('click')
    expect(dialog.props('modelValue')).toBe(true)

    database.getEntriesFor.mockClear()
    dialog.vm.$emit('saved', { id: 1, created: true })
    expect(database.getEntriesFor).toHaveBeenCalledWith(KA)
  })

  it('should keep Add my definition hidden without a selected term', async () => {
    await mountAt('/define')
    expect(wrapper.find('[data-testid="define-add"]').exists()).toBe(false)
  })

  it('should have no headword audio button (audio plays from links in definitions)', async () => {
    await mountAt('/define/' + encodeURIComponent(KA))
    await vi.waitFor(() => expect(wrapper.findAll('[data-testid="entry"]')).toHaveLength(3))

    expect(wrapper.find('.audio-play-btn').exists()).toBe(false)
    expect(wrapper.find('[aria-label*="audio" i]').exists()).toBe(false)
  })
})

describe('Define — phone', () => {
  beforeEach(() => {
    window.innerWidth = 390
  })

  const visible = (selector) => {
    const element = wrapper.find(selector)
    return element.exists() && element.element.style.display !== 'none'
  }

  it('should show the terms first, then the definitions after a tap', async () => {
    await mountAt('/define/' + encodeURIComponent(KA))

    expect(visible('.terms-pane')).toBe(true)
    expect(visible('.entries-pane')).toBe(false)
    // Let the first-term selection that follows opening the page run first
    await new Promise((resolve) => setTimeout(resolve, 600))

    await wrapper.findAll('[data-testid="define-term"]')[1].trigger('click')
    await flushPromises()

    expect(visible('.terms-pane')).toBe(false)
    expect(visible('.define-search')).toBe(false)
    expect(visible('.entries-pane')).toBe(true)
    await vi.waitFor(
      () => expect(wrapper.find('[data-testid="define-headword"]').text()).toBe(KAKA),
      { timeout: 2000 }
    )
    expect(wrapper.find('.entries').classes()).toContain('entries--cards')
  })

  it('should go back to the terms from the Terms link', async () => {
    await mountAt('/define/' + encodeURIComponent(KA))
    await wrapper.findAll('[data-testid="define-term"]')[0].trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="define-back"]').trigger('click')

    expect(visible('.terms-pane')).toBe(true)
    expect(visible('.entries-pane')).toBe(false)
  })

  it('should go back to the terms when the field gets the focus', async () => {
    await mountAt('/define/' + encodeURIComponent(KA))
    page().vm.mobileShowDefinition = true
    await nextTick()

    await field().trigger('focus')

    expect(page().vm.mobileShowDefinition).toBe(false)
  })

  it('should not echo the typed Wylie on a phone', async () => {
    await mountAt('/define')

    await typeInField('ka')
    await field().trigger('keyup', { key: ' ' })
    await nextTick()

    expect(wrapper.find('[data-testid="define-typed"]').exists()).toBe(false)
  })
})
