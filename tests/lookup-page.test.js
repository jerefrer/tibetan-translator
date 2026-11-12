/**
 * LookupPage state: the field, the བོད / EN mode, the route and what is
 * remembered. Mounted the way App.vue mounts it (a <keep-alive> around the
 * <router-view>) with the app's own route table, so the redirects from the
 * old /define and /search links are the real ones.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import { h, KeepAlive, nextTick } from 'vue'

import appRouter from '../src/router.js'
import LookupPage from '../src/components/lookup/LookupPage.vue'
import Storage from '../src/services/storage'
import SqlDatabase from '../src/services/sql-database'

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
const radios = () => wrapper.findAll('[data-testid="lookup-mode"] [role="radio"]')
const checkedMode = () =>
  radios().find((radio) => radio.attributes('aria-checked') === 'true')?.attributes('aria-label')
const typed = () => wrapper.find('[data-testid="lookup-typed"]')

async function typeWylie(value) {
  await input().setValue(value)
  await input().trigger('keyup', { key: value.at(-1) })
  await nextTick()
}

async function chooseMode(label) {
  await radios()
    .find((radio) => radio.attributes('aria-label') === label)
    .trigger('click')
  await flushPromises()
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
  // The entry of a selected term reads them (the app has them once loaded)
  Storage.set('dictionaries', [])
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('Lookup — route', () => {
  it('should fill the field with the term of the route', async () => {
    await mountAt('/lookup/' + encodeURIComponent(SANGS_RGYAS))
    expect(input().element.value).toBe(SANGS_RGYAS)
    expect(checkedMode()).toBe('Tibetan')
  })

  it('should fill the field from an old Define link with a percent-encoded term', async () => {
    await mountAt('/define/' + encodeURIComponent(SANGS_RGYAS))
    expect(router.currentRoute.value.path).toBe('/lookup/' + encodeURIComponent(SANGS_RGYAS))
    expect(input().element.value).toBe(SANGS_RGYAS)
    expect(checkedMode()).toBe('Tibetan')
  })

  it('should open in English mode with the query of an old Search link', async () => {
    await mountAt('/search/wisdom')
    expect(checkedMode()).toBe('English')
    expect(input().element.value).toBe('wisdom')
  })

  it('should decode a percent-encoded query from an old Search link', async () => {
    await mountAt('/search/' + encodeURIComponent('buddha nature & (ye shes)'))
    expect(checkedMode()).toBe('English')
    expect(input().element.value).toBe('buddha nature & (ye shes)')
  })

  it('should keep the start typed when the route selects a longer term', async () => {
    await mountAt('/lookup')
    await typeWylie('sangs ')
    expect(page().vm.text).toBe('སངས་')
    await go('/lookup/' + encodeURIComponent(SANGS_RGYAS))
    expect(input().element.value).toBe('སངས་')
  })

  it('should open a definition link in Tibetan mode while in English mode', async () => {
    await mountAt('/search/wisdom')
    await go('/define/' + encodeURIComponent(KA))
    expect(checkedMode()).toBe('Tibetan')
    expect(input().element.value).toBe(KA)
  })

  it('should run an English search from the field with Enter', async () => {
    await mountAt('/lookup?mode=en')
    await input().setValue('buddha nature')
    await input().trigger('keydown', { key: 'Enter' })
    await flushPromises()
    const route = router.currentRoute.value
    expect(route.path).toBe('/lookup')
    expect(route.query).toEqual({ mode: 'en', q: 'buddha nature' })
  })

  it('should ignore routes of other pages while it is kept alive', async () => {
    await mountAt('/lookup/' + encodeURIComponent(KA))
    const vm = page().vm
    await go('/reader?mode=en&q=wisdom')
    expect(vm.text).toBe(KA)
    expect(vm.mode).toBe('bo')
    expect(Storage.get('lookupState')).toMatchObject({ mode: 'bo', term: KA })
  })
})

describe('Lookup — modes', () => {
  it('should carry the typed Wylie to English and back', async () => {
    await mountAt('/lookup')
    await typeWylie('sangs rgyas ')
    expect(input().element.value).toBe(SANGS_RGYAS)
    expect(typed().text()).toBe('typed sangs rgyas')

    await chooseMode('English')
    expect(input().element.value).toBe('sangs rgyas')
    expect(router.currentRoute.value.query.mode).toBe('en')

    await chooseMode('Tibetan')
    expect(input().element.value).toBe(SANGS_RGYAS)
    expect(typed().text()).toBe('typed sangs rgyas')
    expect(router.currentRoute.value.query.mode).toBe('bo')
  })

  it('should switch to English with the Tibetan as is when no Wylie was typed', async () => {
    await mountAt('/lookup/' + encodeURIComponent(KA))
    await chooseMode('English')
    expect(input().element.value).toBe(KA)
  })

  it('should switch to English with the shortcut route', async () => {
    await mountAt('/lookup')
    await typeWylie('sangs rgyas ')
    await go('/lookup?mode=en')
    expect(checkedMode()).toBe('English')
    expect(input().element.value).toBe('sangs rgyas')
  })
})

describe('Lookup — the Cmd+D route', () => {
  it('should switch to Tibetan with the Latin read as Wylie when coming back from another page', async () => {
    await mountAt('/lookup?mode=en')
    await input().setValue('sangs rgyas')
    await go('/reader')
    await go('/lookup?mode=bo')
    expect(checkedMode()).toBe('Tibetan')
    expect(input().element.value).toBe(SANGS_RGYAS)
  })

  it('should keep the term shown when it is already in Tibetan mode', async () => {
    await mountAt('/lookup/' + encodeURIComponent(KA))
    await go('/reader')
    await go('/lookup?mode=bo')
    expect(checkedMode()).toBe('Tibetan')
    expect(input().element.value).toBe(KA)
    expect(Storage.get('lookupState')).toMatchObject({ mode: 'bo', term: KA })
  })

  it('should open the last Tibetan term when the field is empty', async () => {
    Storage.set('lookupState', { mode: 'en', term: KA, query: '' })
    await mountAt('/reader')
    await go('/lookup?mode=bo')
    expect(router.currentRoute.value.path).toBe('/lookup/' + encodeURIComponent(KA))
    expect(checkedMode()).toBe('Tibetan')
    expect(input().element.value).toBe(KA)
  })
})

describe('Lookup — remembering', () => {
  it('should restore the last mode and term when opened bare', async () => {
    Storage.set('lookupState', { mode: 'bo', term: KA, query: 'wisdom' })
    await mountAt('/lookup')
    expect(router.currentRoute.value.path).toBe('/lookup/' + encodeURIComponent(KA))
    expect(checkedMode()).toBe('Tibetan')
    expect(input().element.value).toBe(KA)
  })

  it('should restore the last English query when opened bare', async () => {
    Storage.set('lookupState', { mode: 'en', term: KA, query: 'wisdom' })
    await mountAt('/lookup')
    expect(router.currentRoute.value.query).toEqual({ mode: 'en', q: 'wisdom' })
    expect(checkedMode()).toBe('English')
    expect(input().element.value).toBe('wisdom')
  })

  it('should restore the term of the mode an old Define link asks for', async () => {
    Storage.set('lookupState', { mode: 'en', term: KA, query: 'wisdom' })
    await mountAt('/define')
    expect(checkedMode()).toBe('Tibetan')
    expect(input().element.value).toBe(KA)
  })

  it('should remember the mode, the term and the query', async () => {
    await mountAt('/lookup/' + encodeURIComponent(KA))
    expect(Storage.get('lookupState')).toMatchObject({ mode: 'bo', term: KA })
    await go('/search/wisdom')
    expect(Storage.get('lookupState')).toEqual({ mode: 'en', term: KA, query: 'wisdom' })
    await chooseMode('Tibetan')
    expect(Storage.get('lookupState').mode).toBe('bo')
  })

  it('should keep the field and mode when coming back', async () => {
    await mountAt('/lookup')
    await typeWylie('sangs rgyas ')
    await go('/reader')
    await go('/lookup')
    expect(checkedMode()).toBe('Tibetan')
    expect(input().element.value).toBe(SANGS_RGYAS)
    expect(typed().text()).toBe('typed sangs rgyas')

    await chooseMode('English')
    await go('/reader')
    await go('/lookup')
    expect(checkedMode()).toBe('English')
    expect(input().element.value).toBe('sangs rgyas')
  })

  it('should forget the term when the field is cleared', async () => {
    await mountAt('/lookup/' + encodeURIComponent(KA))
    await wrapper.get('[data-testid="ui-text-field-clear"]').trigger('click')
    await flushPromises()
    expect(input().element.value).toBe('')
    expect(router.currentRoute.value.params.term).toBeFalsy()
    expect(Storage.get('lookupState').term).toBe('')
  })
})

describe('Lookup — field', () => {
  it('should focus the field on focus-lookup', async () => {
    await mountAt('/lookup')
    input().element.blur()
    expect(document.activeElement).not.toBe(input().element)
    window._triggerEvent('focus-lookup')
    await nextTick()
    expect(document.activeElement).toBe(input().element)
  })

  it('should refuse a second tsheg and repair a legacy-font paste', async () => {
    await mountAt('/lookup/' + encodeURIComponent(KA))
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

describe('Lookup — hints between the modes', () => {
  it('should keep Sanskrit with diacritics as typed when switching from Tibetan to English', async () => {
    await mountAt('/lookup')
    await typeWylie('kākiṇī ')
    expect(page().vm.typedWylie).toBe('')
    expect(input().element.value).not.toContain('kākiṇī')
    await chooseMode('English')
    expect(input().element.value).toBe('kākiṇī')
  })

  it('should offer searching Sanskrit with diacritics in the definitions and run the search', async () => {
    await mountAt('/lookup')
    await typeWylie('kākiṇī ')
    const hint = wrapper.find('[data-testid="hint-search-definitions"]')
    expect(hint.exists()).toBe(true)
    await hint.find('button').trigger('click')
    await flushPromises()
    expect(checkedMode()).toBe('English')
    expect(input().element.value).toBe('kākiṇī')
    expect(router.currentRoute.value.query).toEqual({ mode: 'en', q: 'kākiṇī' })
    expect(wrapper.find('[data-testid="hint-search-definitions"]').exists()).toBe(false)
  })

  it('should offer the typed Wylie when no Tibetan term starts with the text', async () => {
    await mountAt('/lookup')
    await typeWylie('bliss ')
    const hint = wrapper.find('[data-testid="hint-search-definitions"]')
    expect(hint.text()).toContain('“bliss”')
  })

  const searchHint = () => wrapper.find('[data-testid="hint-search-definitions"]')

  it('should offer Search for a pasted word, which arrives converted', async () => {
    await mountAt('/lookup')
    input().element.dispatchEvent(pasteEvent({ text: 'ཀཱཀིṇī་' }))
    await vi.waitFor(() => expect(page().vm.text).toBe('ཀཱཀིṇī་'))
    await nextTick()
    expect(searchHint().exists()).toBe(true)
    expect(searchHint().text()).toContain('“ཀཱཀིṇī་”')
  })

  it('should not offer Search in the definitions for plain Wylie that matches headwords', async () => {
    await mountAt('/lookup')
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
    await mountAt('/lookup')
    await typeWylie('kākiṇī ')
    expect(searchHint().exists()).toBe(true)
    await wrapper.get('[data-testid="ui-text-field-clear"]').trigger('click')
    await flushPromises()
    expect(searchHint().exists()).toBe(false)
  })

  it('should forget the text as typed when it is replaced by other Tibetan', async () => {
    await mountAt('/lookup')
    await typeWylie('kāka ')
    expect(page().vm.asTyped).toBe('kāka')
    // The text is replaced as a paste over a selection or a picked term would
    page().vm.text = 'བཅོམ་'
    await nextTick()
    expect(page().vm.asTyped).toBe('')
  })
})

describe('Lookup — layout', () => {
  const DICTIONARIES = [{ id: 1, name: 'RangjungYeshe', position: 0, enabled: true }]
  const KAKA = 'ཀ་ཀ་'
  // What `SELECT … WHERE term IN (…)` finds for the glosses
  const GLOSS_ROWS = [
    { term: KA, dictionaryId: 1, definition: 'the first letter' },
    { term: SANGS_RGYAS, dictionaryId: 1, definition: 'Buddha; awakened one' },
  ]
  // What a definitions search finds
  const SEARCH_ROWS = [
    { term: SANGS_RGYAS, dictionaryId: 1, dictionary: 'RangjungYeshe', definition: 'the buddha nature', rank: -2 },
    { term: KA, dictionaryId: 1, dictionary: 'RangjungYeshe', definition: 'buddha letter', rank: -1 },
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
      /WHERE term IN/.test(sql) ? GLOSS_ROWS : SEARCH_ROWS
    )
    vi.spyOn(SqlDatabase, 'getEntriesFor').mockImplementation(async (term) => entryRows(term))
    SqlDatabase.allTerms = [KA, KAKA, SANGS_RGYAS]
  })

  afterEach(() => {
    SqlDatabase.allTerms = []
    vi.restoreAllMocks()
  })

  it('should show three panes on desktop', async () => {
    await mountAt('/lookup')
    expect(resultsPane().find('[data-testid="lookup-field"]').exists()).toBe(true)
    expect(entryPane().find('[data-testid="lookup-home"]').exists()).toBe(true)

    await go('/lookup/' + encodeURIComponent(KA))
    expect(shown(resultsPane())).toBe(true)
    expect(shown(entryPane())).toBe(true)
    expect(resultsPane().find('[data-testid="lookup-headwords"]').exists()).toBe(true)
    expect(headword().text()).toBe(KA)
    expect(entryPane().find('[data-testid="lookup-home"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="lookup-back"]').exists()).toBe(false)
  })

  it('should show Recent and Saved with glosses on an empty phone Lookup', async () => {
    window.innerWidth = 390
    const { recordTerm } = await import('../src/services/history')
    recordTerm(KA)
    Storage.set('savedTerms', [SANGS_RGYAS])
    await mountAt('/lookup')

    expect(wrapper.find('.lookup-page__title').text()).toBe('Lookup')
    expect(resultsPane().find('[data-testid="lookup-home"]').exists()).toBe(true)
    const recent = wrapper.find('[data-testid="lookup-recent"]')
    expect(recent.text()).toContain(KA)
    expect(recent.text()).toContain('the first letter')
    const saved = wrapper.find('[data-testid="lookup-saved"]')
    expect(saved.text()).toContain(SANGS_RGYAS)
    expect(saved.text()).toContain('Buddha; awakened one')
    expect(home().text()).toContain('Type sangs rgyas for སངས་རྒྱས་, or switch to EN to search the definitions.')
  })

  it('should give the home its phone layout when the page is in its phone layout', async () => {
    window.innerWidth = 390
    await mountAt('/lookup')

    expect(home().classes()).toContain('lookup-home--phone')
  })

  it('should keep the home in its desktop layout when the page is on desktop', async () => {
    await mountAt('/lookup')

    expect(home().exists()).toBe(true)
    expect(home().classes()).not.toContain('lookup-home--phone')
  })

  it('should hide Saved when nothing is saved', async () => {
    window.innerWidth = 390
    await mountAt('/lookup')
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
    await mountAt('/lookup')
    const recent = wrapper.find('[data-testid="lookup-recent"]')
    expect(recent.find('img').exists()).toBe(false)
    expect(recent.text()).toContain('<img src=x onerror=alert(1)>')
  })

  it('should clear Recent', async () => {
    window.innerWidth = 390
    const { recordTerm, recentTerms } = await import('../src/services/history')
    recordTerm(KA)
    await mountAt('/lookup')
    await wrapper.get('[data-testid="lookup-recent-clear"]').trigger('click')
    await flushPromises()
    expect(recentTerms()).toEqual([])
    expect(wrapper.find('[data-testid="lookup-recent"]').exists()).toBe(false)
  })

  it('should open a recent term from the home', async () => {
    const { recordTerm } = await import('../src/services/history')
    recordTerm(SANGS_RGYAS)
    await mountAt('/lookup')
    await wrapper.get('[data-testid="lookup-home-term"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/lookup/' + encodeURIComponent(SANGS_RGYAS))
    expect(headword().text()).toBe(SANGS_RGYAS)
  })

  it('should open the entry full screen on a phone and come back with Lookup', async () => {
    window.innerWidth = 390
    await mountAt('/lookup')
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
    expect(back.text()).toBe('Lookup')

    await back.trigger('click')
    await flushPromises()
    expect(shown(resultsPane())).toBe(true)
    expect(shown(entryPane())).toBe(false)
    expect(input().element.value).toBe(KA)
    expect(wrapper.findAll('[data-testid="lookup-result"]').length).toBe(2)
  })

  it('should not open the entry full screen when the first match is selected after a pause', async () => {
    window.innerWidth = 390
    await mountAt('/lookup')
    await typeWylie('ka ')
    await vi.waitFor(() =>
      expect(router.currentRoute.value.path).toBe('/lookup/' + encodeURIComponent(KA))
    )
    await flushPromises()
    expect(page().vm.selectedTerm).toBe(KA)
    expect(shown(entryPane())).toBe(false)
    expect(shown(resultsPane())).toBe(true)
  })

  it('should open the entry on a phone when another page links to a term', async () => {
    window.innerWidth = 390
    await mountAt('/lookup')
    await go('/reader')
    await go('/lookup/' + encodeURIComponent(KAKA))
    expect(wrapper.find('[data-testid="lookup-back"]').exists()).toBe(true)
    expect(shown(entryPane())).toBe(true)
    expect(shown(resultsPane())).toBe(false)
    expect(headword().text()).toBe(KAKA)
  })

  it('should open the entry on a phone when Lookup is first opened by a link from another page', async () => {
    window.innerWidth = 390
    await mountAt('/reader')
    await go('/lookup/' + encodeURIComponent(KAKA))
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
    await go('/lookup/' + encodeURIComponent(KAKA))
    await wrapper.get('[data-testid="lookup-back"]').trigger('click')
    await flushPromises()
    expect(shown(resultsPane())).toBe(true)
    expect(shown(entryPane())).toBe(false)
    expect(input().element.value).toBe(KAKA)
  })

  it('should keep the list on a phone while typing after arriving by a link', async () => {
    window.innerWidth = 390
    await mountAt('/reader')
    await go('/lookup/' + encodeURIComponent(KAKA))
    await wrapper.get('[data-testid="lookup-back"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="ui-text-field-clear"]').trigger('click')
    await flushPromises()
    await typeWylie('ka ')
    await vi.waitFor(() =>
      expect(router.currentRoute.value.path).toBe('/lookup/' + encodeURIComponent(KA))
    )
    await flushPromises()
    expect(shown(resultsPane())).toBe(true)
    expect(shown(entryPane())).toBe(false)
  })

  it('should size the phone results to the visible height', async () => {
    window.innerWidth = 390
    await mountAt('/lookup')
    expect(page().classes()).toContain('is-phone')
    // jsdom applies no styles: read the rule the phone page gets
    const fs = await import('fs')
    const path = await import('path')
    const source = fs.readFileSync(path.resolve(__dirname, '../src/components/lookup/LookupPage.vue'), 'utf8')
    const rule = source.match(/\.lookup-page\.is-phone\s*\{[^}]*\}/)
    expect(rule?.[0]).toMatch(/height:[^;]*var\(--visible-height/)
    expect(source).toMatch(/\.lookup-page\.is-phone \.lookup-page__list\s*\{[^}]*overflow-y:\s*auto/)
  })

  it('should show the typed Wylie on a phone', async () => {
    window.innerWidth = 390
    await mountAt('/lookup')
    await typeWylie('sangs rgyas ')
    expect(typed().text()).toBe('typed sangs rgyas')
  })

  it('should open the selected English result with Enter', async () => {
    await mountAt('/lookup?mode=en')
    await input().setValue('buddha')
    await input().trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(wrapper.findAll('[data-testid="lookup-result"]').length).toBe(2)
    expect(entryPane().find('[data-testid="term-entry"]').exists()).toBe(false)

    await input().trigger('keydown', { key: 'ArrowDown' })
    await input().trigger('keydown', { key: 'ArrowDown' })
    await input().trigger('keydown', { key: 'ArrowUp' })
    await nextTick()
    const selected = wrapper.find('[data-testid="lookup-result"].is-selected')
    expect(selected.find('[data-testid="lookup-result-term"]').text()).toBe(SANGS_RGYAS)

    await input().trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(headword().text()).toBe(SANGS_RGYAS)
    // The hits show in the entry
    expect(entryPane().find('.definition em').text().toLowerCase()).toBe('buddha')
    expect(checkedMode()).toBe('English')
  })

  it('should clear the field with Escape', async () => {
    await mountAt('/lookup/' + encodeURIComponent(KA))
    await input().trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(input().element.value).toBe('')
    expect(router.currentRoute.value.params.term).toBeFalsy()
  })

  it('should focus the new field after switching mode', async () => {
    await mountAt('/lookup')
    await chooseMode('English')
    await nextTick()
    expect(document.activeElement).toBe(input().element)
    await chooseMode('Tibetan')
    await nextTick()
    expect(document.activeElement).toBe(input().element)
  })

  // Ported from tests/define-page.test.js (recent terms and the Wylie tip)
  it('should show at most eight recent terms', async () => {
    window.innerWidth = 390
    const { recordTerm } = await import('../src/services/history')
    for (let i = 0; i < 12; i++) recordTerm('ཀ' + i + '་')
    await mountAt('/lookup')
    expect(wrapper.findAll('[data-testid="lookup-recent"] [data-testid="lookup-home-term"]')).toHaveLength(8)
  })

  it('should hide Recent when there is no history, and still show the Wylie tip', async () => {
    window.innerWidth = 390
    await mountAt('/lookup')
    expect(wrapper.find('[data-testid="lookup-recent"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="lookup-tip"]').text()).toContain('sangs rgyas')
  })
})

// Ported from tests/define-page.test.js and tests/search-page.test.js: the
// heading, the focus on return, clearing an English query and the queries
// reached by a link
describe('Lookup — ported from Define and Search', () => {
  beforeEach(() => {
    Storage.delete('previousQueries')
  })

  it('should carry a visually hidden level-one heading on desktop', async () => {
    await mountAt('/lookup')
    const title = wrapper.get('h1')
    expect(title.text()).toBe('Lookup')
    expect(title.classes()).toContain('ui-visually-hidden')
  })

  it('should focus the field each time the page is shown again (keep-alive)', async () => {
    await mountAt('/lookup')
    const field = input().element
    await go('/reader')
    expect(document.activeElement).not.toBe(field)
    await go('/lookup')
    await nextTick()
    expect(document.activeElement).toBe(input().element)
  })

  it('should clear the English query, the stored query, the route and the results', async () => {
    await mountAt('/lookup?mode=en&q=wisdom')
    expect(page().vm.query).toBe('wisdom')

    await wrapper.get('[data-testid="ui-text-field-clear"]').trigger('click')
    await flushPromises()

    expect(input().element.value).toBe('')
    expect(page().vm.query).toBe('')
    expect(router.currentRoute.value.query).toEqual({ mode: 'en' })
    expect(Storage.get('lookupState').query).toBe('')
    expect(wrapper.find('[data-testid="lookup-no-results"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="lookup-definitions"]').exists()).toBe(false)
  })

  it('should not add a query reached by a link to the recent searches', async () => {
    await mountAt('/search/wisdom')
    expect(page().vm.query).toBe('wisdom')
    expect(Storage.get('previousQueries', [])).toEqual([])
  })

  it('should show an earlier query again when Back returns to it', async () => {
    await mountAt('/lookup?mode=en&q=wisdom')
    await input().setValue('compassion')
    await input().trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(page().vm.query).toBe('compassion')

    router.back()
    await vi.waitFor(() => expect(page().vm.query).toBe('wisdom'))
    await flushPromises()
    expect(input().element.value).toBe('wisdom')
    expect(checkedMode()).toBe('English')
  })
})
