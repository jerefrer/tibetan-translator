/**
 * LookupPage state: the field, the route and what is remembered. Mounted the way App.vue mounts it (a <keep-alive> around the
 * <router-view>) with the app's own route table, so the redirects from the
 * old /lookup and /lookup?mode=en links are the real ones.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import { h, KeepAlive, nextTick } from 'vue'

import appRouter from '../src/router.js'
import LookupPage from '../src/components/lookup/LookupPage.vue'
import Storage from '../src/services/storage'
import SqlDatabase from '../src/services/sql-database'
import { historyState } from '../src/services/navigation-history'

const KA = 'ཀ་'
const SANGS_RGYAS = 'སངས་རྒྱས་'
const CHOGYAL_SANGS_RGYAS = '<$<-{<-' // སངས་རྒྱས་ in the TibetanChogyal encoding

beforeAll(async () => {
  const { convertLegacyPaste } = await import('../src/services/legacy-to-unicode.js')
  await convertLegacyPaste({ text: CHOGYAL_SANGS_RGYAS })
})

const Shell = {
  render: () =>
    h(RouterView, null, {
      default: ({ Component }) => h(KeepAlive, null, [Component ? h(Component) : null]),
    }),
}

let wrapper
let router

async function mountAt(path) {
  router = createRouter({ history: createMemoryHistory(), routes: appRouter.options.routes })
  router.push(path)
  await router.isReady()
  wrapper = mount(Shell, { attachTo: document.body, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

const page = () => wrapper.findComponent(LookupPage)
const input = () => wrapper.find('[data-testid="lookup-field"] input')
const typed = () => wrapper.find('[data-testid="lookup-typed"]')

async function typeWylie(value) {
  await input().setValue(value)
  await input().trigger('keyup', { key: value.at(-1) })
  await nextTick()
}

async function go(path) {
  await router.push(path)
  await flushPromises()
}

function pasteEvent({ text = '', html = '' } = {}) {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  event.clipboardData = { getData: (type) => (type === 'text/html' ? html : text) }
  return event
}

beforeEach(() => {
  // Storage writes localStorage properties, which the setup's clear() keeps
  Storage.delete('lookupState')
  Storage.delete('searchBuilderVisible')
  Storage.delete('newLook')
  // The entry of a selected term reads them (the app has them once loaded)
  Storage.set('dictionaries', [])
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('Define — route', () => {
  it('should fill the field with the term of the route', async () => {
    await mountAt('/define/' + encodeURIComponent(SANGS_RGYAS))
    expect(input().element.value).toBe(SANGS_RGYAS)
  })

  it('should fill the field from an old Define link with a percent-encoded term', async () => {
    await mountAt('/define/' + encodeURIComponent(SANGS_RGYAS))
    expect(router.currentRoute.value.path).toBe('/define/' + encodeURIComponent(SANGS_RGYAS))
    expect(input().element.value).toBe(SANGS_RGYAS)
  })



  it('should keep the start typed when the route selects a longer term', async () => {
    await mountAt('/define')
    await typeWylie('sangs ')
    expect(page().vm.text).toBe('སངས་')
    await go('/define/' + encodeURIComponent(SANGS_RGYAS))
    expect(input().element.value).toBe('སངས་')
  })

  it('should open a definition link on its term while Search is shown', async () => {
    await mountAt('/search?q=wisdom')
    await go('/define/' + encodeURIComponent(KA))
    expect(router.currentRoute.value.path).toBe('/define/' + encodeURIComponent(KA))
    expect(input().element.value).toBe(KA)
  })


  it('should ignore routes of other pages while it is kept alive', async () => {
    await mountAt('/define/' + encodeURIComponent(KA))
    const vm = page().vm
    await go('/reader?q=wisdom')
    expect(vm.text).toBe(KA)
    expect(Storage.get('lookupState')).toMatchObject({ term: KA })
  })
})


describe('Define — the Cmd+D route', () => {

  it('should keep the term shown when coming back from another page', async () => {
    await mountAt('/define/' + encodeURIComponent(KA))
    await go('/reader')
    await go('/define')
    expect(input().element.value).toBe(KA)
    expect(Storage.get('lookupState')).toMatchObject({ term: KA })
  })

  it('should open the last Tibetan term when the field is empty', async () => {
    Storage.set('lookupState', { term: KA, query: '' })
    await mountAt('/reader')
    await go('/define')
    expect(router.currentRoute.value.path).toBe('/define/' + encodeURIComponent(KA))
    expect(input().element.value).toBe(KA)
  })
})

describe('Define — remembering', () => {
  it('should restore the last term when opened bare', async () => {
    Storage.set('lookupState', { term: KA, query: 'wisdom' })
    await mountAt('/define')
    expect(router.currentRoute.value.path).toBe('/define/' + encodeURIComponent(KA))
    expect(input().element.value).toBe(KA)
  })


  it('should stay on its home, where A new look shows, when the card was not seen yet', async () => {
    // A user coming from 1.12: a last term remembered, the card still pending
    Storage.set('lookupState', { term: KA, query: '' })
    Storage.set('newLook', 'pending')
    await mountAt('/define')
    expect(router.currentRoute.value.path).toBe('/define')
    expect(input().element.value).toBe('')
    expect(wrapper.find('[data-testid="new-look"]').exists()).toBe(true)
  })

  it('should restore the last term again once the card was seen', async () => {
    Storage.set('lookupState', { term: KA, query: '' })
    Storage.set('newLook', 'seen')
    await mountAt('/define')
    expect(router.currentRoute.value.path).toBe('/define/' + encodeURIComponent(KA))
  })

  it('should restore the last term when a bare old Define link is followed', async () => {
    Storage.set('lookupState', { term: KA, query: 'wisdom' })
    await mountAt('/define')
    expect(input().element.value).toBe(KA)
  })

  it('should remember the term, next to the query Search remembers', async () => {
    await mountAt('/define/' + encodeURIComponent(KA))
    expect(Storage.get('lookupState')).toMatchObject({ term: KA })
    await go('/search?q=wisdom')
    expect(Storage.get('lookupState')).toEqual({ term: KA, query: 'wisdom' })
  })

  it('should keep the field when coming back', async () => {
    await mountAt('/define')
    await typeWylie('sangs rgyas ')
    await go('/reader')
    await go('/define')
    expect(input().element.value).toBe(SANGS_RGYAS)
    expect(typed().text()).toBe('typed sangs rgyas')
  })

  it('should forget the term when the field is cleared', async () => {
    await mountAt('/define/' + encodeURIComponent(KA))
    await wrapper.get('[data-testid="ui-text-field-clear"]').trigger('click')
    await flushPromises()
    expect(input().element.value).toBe('')
    expect(router.currentRoute.value.params.term).toBeFalsy()
    expect(Storage.get('lookupState').term).toBe('')
  })
})

describe('Define — field', () => {
  it('should focus the field on focus-lookup', async () => {
    await mountAt('/define')
    input().element.blur()
    expect(document.activeElement).not.toBe(input().element)
    window._triggerEvent('focus-lookup')
    await nextTick()
    expect(document.activeElement).toBe(input().element)
  })

  it('should refuse a second tsheg and repair a legacy-font paste', async () => {
    await mountAt('/define/' + encodeURIComponent(KA))
    const keydown = new KeyboardEvent('keydown', { key: '་', cancelable: true })
    input().element.dispatchEvent(keydown)
    expect(keydown.defaultPrevented).toBe(true)

    await wrapper.get('[data-testid="ui-text-field-clear"]').trigger('click')
    await flushPromises()
    input().element.dispatchEvent(pasteEvent({ text: CHOGYAL_SANGS_RGYAS }))
    await vi.waitFor(() => expect(page().vm.text).toBe(SANGS_RGYAS))
    await nextTick()
    expect(input().element.value).toBe(SANGS_RGYAS)
  })
})

describe('Define — hints leading to Search', () => {
  beforeEach(() => {
    // Search, opened by a hint, finds nothing
    vi.spyOn(SqlDatabase, 'exec').mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should offer searching Sanskrit with diacritics in the definitions and open Search on it', async () => {
    await mountAt('/define')
    await typeWylie('kākiṇī ')
    const hint = wrapper.find('[data-testid="hint-search-definitions"]')
    expect(hint.exists()).toBe(true)
    await hint.find('button').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/search')
    expect(router.currentRoute.value.query).toEqual({ q: 'kākiṇī' })
    expect(wrapper.find('[data-testid="search-field"] input').element.value).toBe('kākiṇī')
  })

  it('should open Search on the typed Wylie when no Tibetan term starts with the text', async () => {
    await mountAt('/define')
    await typeWylie('bliss ')
    await wrapper.get('[data-testid="hint-search-definitions"] button').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/search')
    expect(router.currentRoute.value.query).toEqual({ q: 'bliss' })
  })

  it('should offer the typed Wylie when no Tibetan term starts with the text', async () => {
    await mountAt('/define')
    await typeWylie('bliss ')
    const hint = wrapper.find('[data-testid="hint-search-definitions"]')
    expect(hint.text()).toContain('“bliss”')
  })

  const searchHint = () => wrapper.find('[data-testid="hint-search-definitions"]')

  it('should offer Search for a pasted word, which arrives converted', async () => {
    await mountAt('/define')
    input().element.dispatchEvent(pasteEvent({ text: 'ཀཱཀིṇī་' }))
    await vi.waitFor(() => expect(page().vm.text).toBe('ཀཱཀིṇī་'))
    await nextTick()
    expect(searchHint().exists()).toBe(true)
    expect(searchHint().text()).toContain('“ཀཱཀིṇī་”')
  })

  it('should not offer Search in the definitions for plain Wylie that matches headwords', async () => {
    await mountAt('/define')
    SqlDatabase.allTerms = [SANGS_RGYAS, KA]
    try {
      await typeWylie('sangs rgyas ')
      expect(page().vm.matches.length).toBeGreaterThan(0)
      expect(searchHint().exists()).toBe(false)
    } finally {
      SqlDatabase.allTerms = []
    }
  })

  it('should stop offering Search once the field is cleared', async () => {
    await mountAt('/define')
    await typeWylie('kākiṇī ')
    expect(searchHint().exists()).toBe(true)
    await wrapper.get('[data-testid="ui-text-field-clear"]').trigger('click')
    await flushPromises()
    expect(searchHint().exists()).toBe(false)
  })

  it('should forget the text as typed when it is replaced by other Tibetan', async () => {
    await mountAt('/define')
    await typeWylie('kāka ')
    expect(page().vm.asTyped).toBe('kāka')
    // The text is replaced as a paste over a selection or a picked term would
    page().vm.text = 'བཅོམ་'
    await nextTick()
    expect(page().vm.asTyped).toBe('')
  })
})

describe('Define — layout', () => {
  const DICTIONARIES = [{ id: 1, name: 'RangjungYeshe', position: 0, enabled: true }]
  const KAKA = 'ཀ་ཀ་'
  // What `SELECT … WHERE term IN (…)` finds for the glosses
  const GLOSS_ROWS = [
    { term: KA, dictionaryId: 1, definition: 'the first letter' },
    { term: SANGS_RGYAS, dictionaryId: 1, definition: 'Buddha; awakened one' },
  ]
  const entryRows = (term) => [
    { term, dictionaryId: 1, dictionary: 'RangjungYeshe', dictionaryPosition: 0, definition: `buddha nature of ${term}` },
  ]

  const home = () => wrapper.find('[data-testid="lookup-home"]')
  const resultsPane = () => wrapper.find('[data-testid="lookup-results-pane"]')
  const entryPane = () => wrapper.find('[data-testid="lookup-entry-pane"]')
  const shown = (element) => element.exists() && element.element.style.display !== 'none'
  const headword = () => wrapper.find('[data-testid="lookup-entry-pane"] [data-testid="entry-headword"]')

  beforeEach(async () => {
    Storage.set('dictionaries', DICTIONARIES)
    Storage.delete('savedTerms')
    const { clearHistory } = await import('../src/services/history')
    clearHistory()
    const { clearGlossCache } = await import('../src/services/glosses')
    clearGlossCache()
    vi.spyOn(SqlDatabase, 'exec').mockImplementation(async (sql) =>
      /WHERE term IN/.test(sql) ? GLOSS_ROWS : []
    )
    vi.spyOn(SqlDatabase, 'getEntriesFor').mockImplementation(async (term) => entryRows(term))
    SqlDatabase.allTerms = [KA, KAKA, SANGS_RGYAS]
  })

  afterEach(() => {
    SqlDatabase.allTerms = []
    vi.restoreAllMocks()
  })

  it('should show three panes on desktop', async () => {
    await mountAt('/define')
    expect(resultsPane().find('[data-testid="lookup-field"]').exists()).toBe(true)
    expect(entryPane().find('[data-testid="lookup-home"]').exists()).toBe(true)

    await go('/define/' + encodeURIComponent(KA))
    expect(shown(resultsPane())).toBe(true)
    expect(shown(entryPane())).toBe(true)
    expect(resultsPane().find('[data-testid="lookup-headwords"]').exists()).toBe(true)
    expect(headword().text()).toBe(KA)
    expect(entryPane().find('[data-testid="lookup-home"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="lookup-back"]').exists()).toBe(false)
  })

  it('should show Recent and Saved with glosses on an empty phone Define', async () => {
    window.innerWidth = 390
    const { recordTerm } = await import('../src/services/history')
    recordTerm(KA)
    Storage.set('savedTerms', [SANGS_RGYAS])
    await mountAt('/define')

    expect(wrapper.find('.lookup-page__title').text()).toBe('Define')
    expect(resultsPane().find('[data-testid="lookup-home"]').exists()).toBe(true)
    const recent = wrapper.find('[data-testid="lookup-recent"]')
    expect(recent.text()).toContain(KA)
    expect(recent.text()).toContain('the first letter')
    const saved = wrapper.find('[data-testid="lookup-saved"]')
    expect(saved.text()).toContain(SANGS_RGYAS)
    expect(saved.text()).toContain('Buddha; awakened one')
    expect(home().text()).toContain('Type sangs rgyas for སངས་རྒྱས་. English goes in Search.')
  })

  it('should give the home its phone layout when the page is in its phone layout', async () => {
    window.innerWidth = 390
    await mountAt('/define')

    expect(home().classes()).toContain('lookup-home--phone')
  })

  it('should keep the home in its desktop layout when the page is on desktop', async () => {
    await mountAt('/define')

    expect(home().exists()).toBe(true)
    expect(home().classes()).not.toContain('lookup-home--phone')
  })

  it('should hide Saved when nothing is saved', async () => {
    window.innerWidth = 390
    await mountAt('/define')
    expect(home().exists()).toBe(true)
    expect(wrapper.find('[data-testid="lookup-saved"]').exists()).toBe(false)
  })

  it('should show the glosses as text, never as markup', async () => {
    window.innerWidth = 390
    const { recordTerm } = await import('../src/services/history')
    recordTerm(KA)
    SqlDatabase.exec.mockImplementation(async () => [
      { term: KA, dictionaryId: 1, definition: '&lt;img src=x onerror=alert(1)&gt;' },
    ])
    await mountAt('/define')
    const recent = wrapper.find('[data-testid="lookup-recent"]')
    expect(recent.find('img').exists()).toBe(false)
    expect(recent.text()).toContain('<img src=x onerror=alert(1)>')
  })

  it('should clear Recent', async () => {
    window.innerWidth = 390
    const { recordTerm, recentTerms } = await import('../src/services/history')
    recordTerm(KA)
    await mountAt('/define')
    await wrapper.get('[data-testid="lookup-recent-clear"]').trigger('click')
    await flushPromises()
    expect(recentTerms()).toEqual([])
    expect(wrapper.find('[data-testid="lookup-recent"]').exists()).toBe(false)
  })

  it('should open a recent term from the home', async () => {
    const { recordTerm } = await import('../src/services/history')
    recordTerm(SANGS_RGYAS)
    await mountAt('/define')
    await wrapper.get('[data-testid="lookup-home-term"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/define/' + encodeURIComponent(SANGS_RGYAS))
    expect(headword().text()).toBe(SANGS_RGYAS)
  })

  it('should open the entry full screen on a phone and come back with Define', async () => {
    window.innerWidth = 390
    await mountAt('/define')
    await typeWylie('ka ')
    expect(home().exists()).toBe(false)
    const rows = wrapper.findAll('[data-testid="lookup-result"]')
    expect(rows.length).toBe(2)
    expect(shown(entryPane())).toBe(false)

    await rows[1].trigger('click')
    await flushPromises()
    expect(shown(entryPane())).toBe(true)
    expect(shown(resultsPane())).toBe(false)
    expect(headword().text()).toBe(KAKA)
    const back = wrapper.get('[data-testid="lookup-back"]')
    expect(back.text()).toBe('Define')

    await back.trigger('click')
    await flushPromises()
    expect(shown(resultsPane())).toBe(true)
    expect(shown(entryPane())).toBe(false)
    expect(input().element.value).toBe(KA)
    expect(wrapper.findAll('[data-testid="lookup-result"]').length).toBe(2)
  })

  it('should not open the entry full screen when the first match is selected after a pause', async () => {
    window.innerWidth = 390
    await mountAt('/define')
    await typeWylie('ka ')
    await vi.waitFor(() =>
      expect(router.currentRoute.value.path).toBe('/define/' + encodeURIComponent(KA))
    )
    await flushPromises()
    expect(page().vm.selectedTerm).toBe(KA)
    expect(shown(entryPane())).toBe(false)
    expect(shown(resultsPane())).toBe(true)
  })

  it('should open the entry on a phone when another page links to a term', async () => {
    window.innerWidth = 390
    await mountAt('/define')
    await go('/reader')
    await go('/define/' + encodeURIComponent(KAKA))
    expect(wrapper.find('[data-testid="lookup-back"]').exists()).toBe(true)
    expect(shown(entryPane())).toBe(true)
    expect(shown(resultsPane())).toBe(false)
    expect(headword().text()).toBe(KAKA)
  })

  it('should open the entry on a phone when Define is first opened by a link from another page', async () => {
    window.innerWidth = 390
    await mountAt('/reader')
    await go('/define/' + encodeURIComponent(KAKA))
    expect(wrapper.find('[data-testid="lookup-back"]').exists()).toBe(true)
    expect(shown(entryPane())).toBe(true)
    expect(headword().text()).toBe(KAKA)
  })

  it('should open the entry on a phone for a cold Define deep link', async () => {
    window.innerWidth = 390
    await mountAt('/define/' + encodeURIComponent(KAKA))
    expect(wrapper.find('[data-testid="lookup-back"]').exists()).toBe(true)
    expect(shown(entryPane())).toBe(true)
    expect(shown(resultsPane())).toBe(false)
  })

  it('should come back to the list from an entry another page linked to', async () => {
    window.innerWidth = 390
    await mountAt('/reader')
    await go('/define/' + encodeURIComponent(KAKA))
    await wrapper.get('[data-testid="lookup-back"]').trigger('click')
    await flushPromises()
    expect(shown(resultsPane())).toBe(true)
    expect(shown(entryPane())).toBe(false)
    expect(input().element.value).toBe(KAKA)
  })

  it('should keep the list on a phone while typing after arriving by a link', async () => {
    window.innerWidth = 390
    await mountAt('/reader')
    await go('/define/' + encodeURIComponent(KAKA))
    await wrapper.get('[data-testid="lookup-back"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="ui-text-field-clear"]').trigger('click')
    await flushPromises()
    await typeWylie('ka ')
    await vi.waitFor(() =>
      expect(router.currentRoute.value.path).toBe('/define/' + encodeURIComponent(KA))
    )
    await flushPromises()
    expect(shown(resultsPane())).toBe(true)
    expect(shown(entryPane())).toBe(false)
  })

  it('should size the phone results to the visible height', async () => {
    window.innerWidth = 390
    await mountAt('/define')
    expect(page().classes()).toContain('is-phone')
    // jsdom applies no styles: read the rule the phone page gets
    const fs = await import('fs')
    const path = await import('path')
    const source = fs.readFileSync(path.resolve(__dirname, '../src/components/lookup/lookup-layout.css'), 'utf8')
    const rule = source.match(/\.lookup-page\.is-phone\s*\{[^}]*\}/)
    expect(rule?.[0]).toMatch(/height:[^;]*var\(--visible-height/)
    expect(source).toMatch(/\.lookup-page\.is-phone \.lookup-page__list\s*\{[^}]*overflow-y:\s*auto/)
  })

  it('should show the typed Wylie on a phone', async () => {
    window.innerWidth = 390
    await mountAt('/define')
    await typeWylie('sangs rgyas ')
    expect(typed().text()).toBe('typed sangs rgyas')
  })


  it('should clear the field with Escape', async () => {
    await mountAt('/define/' + encodeURIComponent(KA))
    await input().trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(input().element.value).toBe('')
    expect(router.currentRoute.value.params.term).toBeFalsy()
  })


  // Ported from tests/define-page.test.js (recent terms and the Wylie tip)
  it('should show at most eight recent terms', async () => {
    window.innerWidth = 390
    const { recordTerm } = await import('../src/services/history')
    for (let i = 0; i < 12; i++) recordTerm('ཀ' + i + '་')
    await mountAt('/define')
    expect(wrapper.findAll('[data-testid="lookup-recent"] [data-testid="lookup-home-term"]')).toHaveLength(8)
  })

  it('should hide Recent when there is no history, and still show the Wylie tip', async () => {
    window.innerWidth = 390
    await mountAt('/define')
    expect(wrapper.find('[data-testid="lookup-recent"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="lookup-tip"]').text()).toContain('sangs rgyas')
  })
})

// Ported from tests/define-page.test.js and tests/search-page.test.js: the
// heading, the focus on return, clearing an English query and the queries
// reached by a link
describe('Define — ported from Define and Search', () => {
  beforeEach(() => {
    Storage.delete('previousQueries')
  })

  it('should carry a visually hidden level-one heading on desktop', async () => {
    await mountAt('/define')
    const title = wrapper.get('h1')
    expect(title.text()).toBe('Define')
    expect(title.classes()).toContain('ui-visually-hidden')
  })

  it('should focus the field each time the page is shown again (keep-alive)', async () => {
    await mountAt('/define')
    const field = input().element
    await go('/reader')
    expect(document.activeElement).not.toBe(field)
    await go('/define')
    await nextTick()
    expect(document.activeElement).toBe(input().element)
  })



})

describe('LookupPage — results width', () => {
  const handle = () => wrapper.findComponent({ name: 'UiResizeHandle' })
  const widthStyle = () => wrapper.find('[data-testid="lookup-page"]').element.style.getPropertyValue('--results-width')

  beforeEach(() => Storage.delete('lookupResultsWidth'))

  it('should leave the results their default width until the divider is moved', async () => {
    await mountAt('/define')
    expect(handle().exists()).toBe(true)
    expect(widthStyle()).toBe('')
  })

  it('should give the results the width the divider is dragged to, and remember it', async () => {
    await mountAt('/define')
    handle().vm.$emit('update:modelValue', 520)
    await nextTick()
    expect(widthStyle()).toContain('520px')
    expect(Storage.get('lookupResultsWidth')).toBe(520)
  })

  it('should open with the width chosen before', async () => {
    Storage.set('lookupResultsWidth', 480)
    await mountAt('/define')
    expect(widthStyle()).toContain('480px')
  })

  it('should go back to the default width on a double-click of the divider', async () => {
    Storage.set('lookupResultsWidth', 480)
    await mountAt('/define')
    handle().vm.$emit('reset')
    await nextTick()
    expect(widthStyle()).toBe('')
    expect(Storage.get('lookupResultsWidth')).toBeNull()
  })
})


describe('Define — Back and Forward', () => {
  const KAKA = 'ཀ་ཀ་'
  const pathOf = (term) => '/define/' + encodeURIComponent(term)
  const results = () => wrapper.findAll('[data-testid="lookup-result"]')
  const shown = (element) => element.exists() && element.element.style.display !== 'none'
  let push
  let replace

  // Spies on the router mountAt just made; the calls so far are forgotten
  function spyOnRouter() {
    push = vi.spyOn(router, 'push')
    replace = vi.spyOn(router, 'replace')
  }

  async function settleOn(term) {
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe(pathOf(term)))
    await flushPromises()
  }

  beforeEach(() => {
    historyState.back = null
    historyState.forward = null
    Storage.set('dictionaries', [{ id: 1, name: 'RangjungYeshe', position: 0, enabled: true }])
    vi.spyOn(SqlDatabase, 'exec').mockResolvedValue([])
    vi.spyOn(SqlDatabase, 'getEntriesFor').mockResolvedValue([])
    SqlDatabase.allTerms = [KA, KAKA, SANGS_RGYAS]
  })

  afterEach(() => {
    SqlDatabase.allTerms = []
    vi.restoreAllMocks()
  })

  it('should add one history entry when typing selects several terms in a row', async () => {
    await mountAt('/reader')
    await go('/define')
    spyOnRouter()

    await typeWylie('ka ')
    await settleOn(KA)
    await typeWylie('ka ka ')
    await settleOn(KAKA)

    expect(push.mock.calls.length + replace.mock.calls.length).toBe(2)
    expect(replace).toHaveBeenCalledTimes(2)
    expect(push).not.toHaveBeenCalled()
  })

  it('should push the first term typed after a click and replace the ones after it', async () => {
    await mountAt('/define/' + encodeURIComponent(SANGS_RGYAS))
    spyOnRouter()

    await typeWylie('ka ')
    await settleOn(KA)
    expect(push).toHaveBeenCalledTimes(1)
    expect(replace).not.toHaveBeenCalled()

    await typeWylie('ka ka ')
    await settleOn(KAKA)
    expect(push).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledTimes(1)
  })

  it('should push when a result is clicked', async () => {
    await mountAt('/define')
    await typeWylie('ka ')
    await settleOn(KA)
    spyOnRouter()

    await results()[1].trigger('click')
    await flushPromises()

    expect(push).toHaveBeenCalledTimes(1)
    expect(replace).not.toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe(pathOf(KAKA))
  })

  it('should push the first term reached with Up and replace the next after a click', async () => {
    await mountAt('/define')
    await typeWylie('ka ')
    await settleOn(KA)
    await results()[1].trigger('click')
    await flushPromises()
    spyOnRouter()

    await input().trigger('keydown', { key: 'ArrowUp' })
    await flushPromises()
    expect(router.currentRoute.value.path).toBe(pathOf(KA))
    expect(push).toHaveBeenCalledTimes(1)

    await input().trigger('keydown', { key: 'ArrowDown' })
    await flushPromises()
    expect(router.currentRoute.value.path).toBe(pathOf(KAKA))
    expect(push).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledTimes(1)
  })

  it('should replace the bare Define when a term is typed after Escape', async () => {
    await mountAt('/define/' + encodeURIComponent(SANGS_RGYAS))
    await input().trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/define')
    spyOnRouter()

    await typeWylie('ka ')
    await settleOn(KA)

    expect(replace).toHaveBeenCalledTimes(1)
    expect(push).not.toHaveBeenCalled()
  })

  it('should empty the field when Back returns to the bare Define from a term', async () => {
    await mountAt('/define')
    await go(pathOf(KA))
    expect(input().element.value).toBe(KA)

    router.back()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/define'))
    await flushPromises()

    expect(input().element.value).toBe('')
    expect(page().vm.selectedTerm).toBe('')
  })

  it('should empty the field when the bare Define is pushed over a term', async () => {
    await mountAt('/define/' + encodeURIComponent(KA))
    await go('/define')
    expect(input().element.value).toBe('')
    expect(page().vm.selectedTerm).toBe('')
  })

  describe('on a phone', () => {
    beforeEach(() => {
      window.innerWidth = 390
    })

    it('should read Back and go back when the entry was reached from another entry', async () => {
      await mountAt('/reader')
      await go(pathOf(KA))
      historyState.back = pathOf(SANGS_RGYAS)
      await nextTick()
      const link = wrapper.get('[data-testid="lookup-back"]')
      expect(link.text()).toBe('Back')
      const back = vi.spyOn(router, 'back').mockImplementation(() => {})

      await link.trigger('click')

      expect(back).toHaveBeenCalledTimes(1)
    })

    it('should read Define and show the results when the previous place is not an entry', async () => {
      await mountAt('/reader')
      await go(pathOf(KAKA))
      historyState.back = '/reader'
      await nextTick()
      const link = wrapper.get('[data-testid="lookup-back"]')
      expect(link.text()).toBe('Define')
      const back = vi.spyOn(router, 'back').mockImplementation(() => {})

      await link.trigger('click')
      await flushPromises()

      expect(back).not.toHaveBeenCalled()
      expect(shown(wrapper.find('[data-testid="lookup-results-pane"]'))).toBe(true)
      expect(shown(wrapper.find('[data-testid="lookup-entry-pane"]'))).toBe(false)
    })
  })
})
