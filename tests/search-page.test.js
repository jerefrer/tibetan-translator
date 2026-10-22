/**
 * The Search screen (SearchPage.vue), mounted the way App.vue mounts it: a
 * real router and a <keep-alive> around the <router-view>, so the route
 * parameter, the guards and activated() behave as in the app.
 *
 * Each block maps to the behaviours listed in docs/redesign/reports/search.md.
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import { h, KeepAlive, nextTick } from 'vue'

const platform = vi.hoisted(() => ({ modularPacks: true }))
vi.mock('../src/config/platform.js', () => ({
  isTauri: () => platform.modularPacks,
  isMacOS: () => false,
  isMobile: () => false,
  supportsModularPacks: () => platform.modularPacks,
}))

const packManager = vi.hoisted(() => ({
  isInitialized: true,
  installedPacks: ['core'],
  downloadingPacks: {},
}))
vi.mock('../src/services/pack-manager', () => ({ default: packManager }))

const database = vi.hoisted(() => ({ allTerms: [], exec: null }))
vi.mock('../src/services/sql-database', () => ({ default: database }))

import SearchPage from '../src/components/SearchPage.vue'
import SearchBuilder from '../src/components/SearchBuilder.vue'
import ResultsAndPaginationAndDictionaries from '../src/components/ResultsAndPaginationAndDictionaries.vue'
import Storage from '../src/services/storage'

const KA = 'ཀ་'
const CHOGYAL_SANGS_RGYAS = '<$<-{<-' // སངས་རྒྱས་ in the TibetanChogyal encoding
const DICTIONARIES = [
  { id: 1, name: 'RangjungYeshe', position: 2, enabled: true },
  { id: 2, name: 'Hopkins2015', position: 1, enabled: true },
  { id: 3, name: 'Jaeschke_Scan', position: 3, enabled: true },
  { id: 4, name: 'RichardBarron', position: 4, enabled: false },
]
const ROWS = [
  { term: 'ཡེ་ཤེས་', dictionaryId: 1, dictionary: 'RangjungYeshe', definition: 'primordial wakefulness', rank: -2 },
  { term: 'ཡེ་ཤེས་', dictionaryId: 2, dictionary: 'Hopkins2015', definition: 'exalted wisdom; wakefulness', rank: -1 },
  { term: 'ཡེ་ཤེས་', dictionaryId: 3, dictionary: 'Jaeschke_Scan', definition: '505?', rank: -3 },
  { term: 'ཡེ་ཤེས་', dictionaryId: 4, dictionary: 'RichardBarron', definition: 'off in Settings: wakefulness', rank: 0 },
]

const scanViewerStub = {
  name: 'ScanViewer',
  props: ['modelValue', 'dictionaryId', 'initialPage', 'approximate'],
  template: '<div class="scan-viewer-stub" />',
}
const aboutStub = {
  name: 'DictionaryAboutDialog',
  props: ['modelValue', 'dictionary'],
  template: '<div class="about-stub" />',
}
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
      { path: '/search', component: SearchPage },
      { path: '/search/:query', component: SearchPage },
      { path: '/define/:term?', component: Placeholder },
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
      provide: { snackbar: { open: vi.fn() } },
      stubs: {
        ScanViewer: scanViewerStub,
        DictionaryAboutDialog: aboutStub,
        QuickAddDialog: quickAddStub,
      },
    },
  })
  await flushPromises()
  return wrapper
}

const page = () => wrapper.findComponent(SearchPage)
const find = (testid) => wrapper.find(`[data-testid="${testid}"]`)
const findAll = (testid) => wrapper.findAll(`[data-testid="${testid}"]`)
const field = () => wrapper.find('[data-testid="search-field"] input')
const lastSql = () => database.exec.mock.calls.at(-1)?.[0] || ''
const searchFor = (query) => '/search/' + encodeURIComponent(query)

// happy-dom has no ClipboardEvent; the handler only reads the two flavours
function pasteEvent({ text = '', html = '' } = {}) {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  event.clipboardData = { getData: (type) => (type === 'text/html' ? html : text) }
  return event
}

beforeAll(async () => {
  // Load the font tables once so the paste test does not pay for it
  const { convertLegacyPaste } = await import('../src/services/legacy-to-unicode.js')
  await convertLegacyPaste({ text: CHOGYAL_SANGS_RGYAS })
})

beforeEach(() => {
  platform.modularPacks = true
  packManager.installedPacks = ['core']
  database.exec = vi.fn(async () => ROWS.map((row) => ({ ...row })))
  Storage.set('dictionaries', DICTIONARIES)
  // Storage writes localStorage properties, which the setup's clear() keeps
  Storage.delete('searchQuery')
  Storage.delete('previousQueries')
  Storage.delete('searchBuilderVisible')
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('Search — route and lifecycle', () => {
  it('should run the query from the route and show it in the field (R1, R4)', async () => {
    await mountAt('/search/wakefulness')

    expect(field().element.value).toBe('wakefulness')
    expect(database.exec).toHaveBeenCalledTimes(1)
    expect(lastSql()).toContain("entries_fts MATCH 'term:\"wakefulness\" OR definition:\"wakefulness\"'")
    expect(findAll('search-result')).toHaveLength(3)
  })

  it('should go back to the stored query when /search is opened without one (R2)', () => {
    Storage.set('searchQuery', 'wakefulness')
    const next = vi.fn()

    SearchPage.beforeRouteEnter({ params: {} }, {}, next)
    SearchPage.beforeRouteEnter({ params: { query: 'x' } }, {}, next)

    expect(next.mock.calls).toEqual([['/search/wakefulness'], []])
  })

  it('should restore the stored query, encoded, on a route update without one (R2)', () => {
    Storage.set('searchQuery', 'a & b')
    const next = vi.fn()

    SearchPage.beforeRouteUpdate({ path: '/search', params: {} }, {}, next)

    expect(next).toHaveBeenCalledWith('/search/' + encodeURIComponent('a & b'))
  })

  it('should run a query reached by navigation without adding it to the recent searches (R3)', async () => {
    await mountAt('/search/wakefulness')
    database.exec.mockClear()

    await router.push('/search/bodhichitta')
    await flushPromises()

    expect(field().element.value).toBe('bodhichitta')
    expect(Storage.get('searchQuery')).toBe('bodhichitta')
    expect(database.exec).toHaveBeenCalledTimes(1)
    expect(Storage.get('previousQueries')).toEqual(['wakefulness'])
  })

  it('should run a search from the page once, not again when its route changes (R3)', async () => {
    await mountAt('/search')

    await field().setValue('wakefulness')
    await field().trigger('keyup', { key: 'Enter' })
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/search/wakefulness')
    expect(database.exec).toHaveBeenCalledTimes(1)
  })

  it('should still run a query reached with Back after searches from the page (R3)', async () => {
    await mountAt('/search/dharma')
    await field().setValue('wakefulness')
    await field().trigger('keyup', { key: 'Enter' })
    await flushPromises()
    // Same query again: the route does not change
    await field().trigger('keyup', { key: 'Enter' })
    await flushPromises()
    database.exec.mockClear()

    router.back()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/search/dharma'))
    await flushPromises()

    expect(field().element.value).toBe('dharma')
    expect(database.exec).toHaveBeenCalledTimes(1)
  })

  it('should keep its query and results when another page is shown (R3, R5)', async () => {
    await mountAt('/search/wakefulness')
    const searchPage = page().vm

    await router.push('/define/' + encodeURIComponent(KA))
    await flushPromises()
    document.activeElement?.blur?.()
    await router.push('/search/wakefulness')
    await flushPromises()

    // Same instance: the page was cached, not rebuilt
    expect(page().vm).toBe(searchPage)
    expect(field().element.value).toBe('wakefulness')
    expect(findAll('search-result')).toHaveLength(3)
    expect(document.activeElement).toBe(field().element)
  })
})

describe('Search — coming back to the page', () => {
  const MANY_ROWS = Array.from({ length: 120 }, (_, i) => ({
    term: `ཀ${i}`, dictionaryId: 1, dictionary: 'RangjungYeshe', definition: `wakefulness ${i}`, rank: 0,
  }))
  const leaveAndComeBackTo = async (path) => {
    await router.push('/define/' + encodeURIComponent(KA))
    await flushPromises()
    await router.push(path)
    await flushPromises()
  }

  it('should not run the query shown again, keeping its results, how many are shown and the menu counts', async () => {
    database.exec = vi.fn(async () => MANY_ROWS.map((row) => ({ ...row })))
    await mountAt('/search/wakefulness')
    await vi.waitFor(() => expect(page().vm._infiniteScrollObserver).toBeTruthy())
    page().vm._infiniteScrollObserver._trigger(true)
    await flushPromises()
    const shownResults = page().vm.entries
    database.exec.mockClear()

    await leaveAndComeBackTo('/search/wakefulness')

    expect(database.exec).not.toHaveBeenCalled()
    expect(page().vm.entries).toBe(shownResults)
    expect(findAll('search-result')).toHaveLength(100)
    expect(page().vm.dictionariesForCurrentResults.map((dictionary) => dictionary.numberOfEntries)).toEqual([120])
  })

  it('should give the field the focus back without scrolling, since on a phone it scrolls with the results', async () => {
    await mountAt('/search/wakefulness')
    const focus = vi.spyOn(field().element, 'focus')

    await leaveAndComeBackTo('/search/wakefulness')

    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
    expect(document.activeElement).toBe(field().element)
  })

  it('should not run it again when coming back through /search, which restores the stored query', async () => {
    Storage.set('searchQuery', 'wakefulness')
    await mountAt('/search/wakefulness')
    database.exec.mockClear()

    await leaveAndComeBackTo('/search')

    expect(router.currentRoute.value.path).toBe('/search/wakefulness')
    expect(database.exec).not.toHaveBeenCalled()
    expect(findAll('search-result')).toHaveLength(3)
  })

  it('should run it again when the enabled dictionaries changed in Settings meanwhile', async () => {
    await mountAt('/search/wakefulness')
    database.exec.mockClear()

    await router.push('/settings')
    await flushPromises()
    Storage.set('dictionaries', DICTIONARIES.map((dictionary) => ({ ...dictionary, enabled: true })))
    await router.push('/search/wakefulness')
    await flushPromises()

    expect(database.exec).toHaveBeenCalledTimes(1)
    expect(findAll('search-result')).toHaveLength(4)
  })

  it('should run the query when it is another one than the query shown', async () => {
    await mountAt('/search/wakefulness')
    database.exec.mockClear()

    await leaveAndComeBackTo('/search/bodhichitta')

    expect(database.exec).toHaveBeenCalledTimes(1)
    expect(field().element.value).toBe('bodhichitta')
  })

  it.each(['all-terms-updated', 'dictionaries-updated'])(
    'should run it again when the packs changed meanwhile (%s)',
    async (eventName) => {
      await mountAt('/search/wakefulness')
      database.exec.mockClear()

      await router.push('/settings')
      await flushPromises()
      window._triggerEvent(eventName)
      await router.push('/search/wakefulness')
      await flushPromises()

      expect(database.exec).toHaveBeenCalledTimes(1)
    }
  )

  it('should not run it again on the next return once it ran for changed packs', async () => {
    await mountAt('/search/wakefulness')
    window._triggerEvent('all-terms-updated')
    await leaveAndComeBackTo('/search/wakefulness')
    database.exec.mockClear()

    await leaveAndComeBackTo('/search/wakefulness')

    expect(database.exec).not.toHaveBeenCalled()
  })
})

describe('Search — query field', () => {
  it('should carry the placeholder, a search key and no spelling help (F1)', async () => {
    await mountAt('/search')

    expect(field().attributes('placeholder')).toBe('Type your query')
    expect(field().attributes('aria-label')).toBe('Search query')
    expect(field().attributes('enterkeyhint')).toBe('search')
    expect(field().attributes('autofocus')).toBeDefined()
    for (const attribute of ['spellcheck', 'autocorrect', 'autocapitalize'])
      expect(field().attributes(attribute)).toMatch(/false|off/)
    expect(field().attributes('autocomplete')).toBe('off')
  })

  it('should leave Wylie typed in the field as typed (F2)', async () => {
    await mountAt('/search')

    await field().setValue('sangs rgyas ')
    await field().trigger('keyup', { key: ' ' })

    expect(field().element.value).toBe('sangs rgyas ')
    expect(database.exec).not.toHaveBeenCalled()
  })

  it('should read Wylie inside parentheses as Tibetan when the query runs (F2)', async () => {
    await mountAt(searchFor('(sangs rgyas)'))

    expect(lastSql()).toContain("entries.term LIKE '%སངས་རྒྱས%'")
  })

  it('should run the query on Enter and with the search button, and disable the button when blank (F3)', async () => {
    await mountAt('/search')
    expect(find('search-button').attributes('disabled')).toBeDefined()

    await field().setValue('   ')
    expect(find('search-button').attributes('disabled')).toBeDefined()

    await field().setValue('wakefulness')
    expect(find('search-button').attributes('disabled')).toBeUndefined()
    await field().trigger('keyup', { key: 'Enter' })
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/search/wakefulness')

    await field().setValue('dharma')
    await find('search-button').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/search/dharma')
    expect(database.exec).toHaveBeenCalledTimes(2)
  })

  it('should show a spinner in the field while the query runs (F4)', async () => {
    let finish
    await mountAt('/search')
    database.exec = vi.fn(() => new Promise((resolve) => (finish = resolve)))

    await field().setValue('wakefulness')
    await find('search-button').trigger('click')
    expect(find('search-field').find('[data-testid="ui-spinner"]').exists()).toBe(true)

    finish([])
    await flushPromises()
    expect(find('search-field').find('[data-testid="ui-spinner"]').exists()).toBe(false)
  })

  it('should clear the query, the stored query, the route and the results (F5)', async () => {
    Storage.set('previousQueries', ['wakefulness'])
    await mountAt('/search/wakefulness')

    await find('ui-text-field-clear').trigger('click')
    await flushPromises()

    expect(field().element.value).toBe('')
    expect(Storage.get('searchQuery')).toBe(null)
    expect(router.currentRoute.value.path).toBe('/search/')
    expect(find('search-results').exists()).toBe(false)
    expect(find('search-recent').exists()).toBe(true)
  })

  it('should repair text pasted in a pre-Unicode Tibetan font, at the caret (F6)', async () => {
    await mountAt('/search')
    await field().setValue('ཨ་ & ')
    field().element.setSelectionRange(5, 5)

    const event = pasteEvent({ text: CHOGYAL_SANGS_RGYAS })
    field().element.dispatchEvent(event)
    await vi.waitFor(() => expect(field().element.value).toBe('ཨ་ & སངས་རྒྱས་'))

    expect(event.defaultPrevented).toBe(true)
  })

  it('should leave an ordinary paste to the browser (F6)', async () => {
    await mountAt('/search')

    const event = pasteEvent({ text: 'wakefulness' })
    field().element.dispatchEvent(event)
    await flushPromises()

    expect(event.defaultPrevented).toBe(false)
  })

  it('should clear when a blank query runs (F7)', async () => {
    await mountAt('/search/wakefulness')

    await field().setValue('  ')
    await field().trigger('keyup', { key: 'Enter' })
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/search/')
    expect(find('search-start').exists()).toBe(true)
  })
})

describe('Search — running a query', () => {
  it('should search Tibetan with LIKE, every time (S2)', async () => {
    // The tibetanGroups regexp has the g flag: reused as is, it answered
    // false every other call and a Tibetan query found "No entries".
    await mountAt(searchFor('ཡེ་ཤེས་'))
    expect(lastSql()).toContain("entries.term LIKE '%ཡེ་ཤེས་%'")
    expect(lastSql()).not.toContain('entries_fts')

    for (let i = 0; i < 3; i++) {
      await router.push(searchFor('ཡེ་ཤེས་') + '?n=' + i)
      page().vm.performSearch({ query: 'ཡེ་ཤེས་', fromNavigation: true })
      await flushPromises()
      expect(lastSql()).toContain("entries.term LIKE '%ཡེ་ཤེས་%'")
      expect(lastSql()).not.toContain('entries_fts')
    }
    expect(find('search-no-results').exists()).toBe(false)
  })

  it('should AND the parts and read [..] and {..} as phonetics (S1)', async () => {
    await mountAt(searchFor('wisdom & [yeshe] & {yeshe}'))

    const sql = lastSql()
    expect(sql).toContain('definition:"wisdom"')
    expect(sql).toContain('termPhoneticsStrict')
    expect(sql).toContain('termPhoneticsLoose')
    expect(sql.match(/ AND /g).length).toBeGreaterThanOrEqual(2)
  })

  it('should add each query to the front of the recent searches, once (S3)', async () => {
    Storage.set('previousQueries', ['dharma', 'wakefulness'])
    await mountAt('/search')

    await field().setValue('wakefulness')
    await field().trigger('keyup', { key: 'Enter' })
    await flushPromises()

    expect(Storage.get('previousQueries')).toEqual(['wakefulness', 'dharma'])
  })

  it('should keep at most 100 recent searches (S3)', async () => {
    Storage.set('previousQueries', Array.from({ length: 100 }, (_, i) => `q${i}`))
    await mountAt('/search')

    await field().setValue('new')
    await field().trigger('keyup', { key: 'Enter' })
    await flushPromises()

    const queries = Storage.get('previousQueries')
    expect(queries).toHaveLength(100)
    expect(queries[0]).toBe('new')
    expect(queries).not.toContain('q99')
  })

  it('should not re-render the hits while the query is edited (S4)', async () => {
    await mountAt('/search/wakefulness')
    const before = find('search-results').html()

    await field().setValue('something else')

    expect(find('search-results').html()).toBe(before)
  })

  it('should show only the dictionaries on in Settings, in the Settings order (S5, S6)', async () => {
    await mountAt('/search/wakefulness')

    const chips = findAll('search-result-dictionary').map((chip) => chip.text())
    expect(chips).toEqual(['Hopkins 2015', 'Rangjung Yeshe', 'Jäschke (scanned dictionary)'])
  })

  it('should put the terms that start with the query first (S6)', async () => {
    database.exec = vi.fn(async () => [
      { term: 'བདེ་སྟོང་ཡེ་ཤེས་', dictionaryId: 2, dictionary: 'Hopkins2015', definition: 'a', rank: -9 },
      { term: 'ཡེ་ཤེས་', dictionaryId: 1, dictionary: 'RangjungYeshe', definition: 'b', rank: 0 },
    ])
    await mountAt(searchFor('ཡེ་ཤེས་'))

    expect(findAll('search-result-term').map((term) => term.text())).toEqual(['ཡེ་ཤེས་', 'བདེ་སྟོང་ཡེ་ཤེས་'])
  })

  it('should give each query the Settings choice of dictionaries again (S5)', async () => {
    await mountAt('/search/wakefulness')
    page().vm.dictionaries.find((dictionary) => dictionary.id == 1).enabled = false
    await nextTick()
    expect(findAll('search-result')).toHaveLength(2)

    await router.push('/search/dharma')
    await flushPromises()

    expect(findAll('search-result')).toHaveLength(3)
  })

  it('should hide the recent searches while a query runs (S7)', async () => {
    Storage.set('previousQueries', ['dharma'])
    await mountAt('/search')
    expect(find('search-recent').exists()).toBe(true)
    database.exec = vi.fn(() => new Promise(() => {}))

    await field().setValue('wakefulness')
    await field().trigger('keyup', { key: 'Enter' })

    expect(find('search-recent').exists()).toBe(false)
  })
})

describe('Search — before any search (board "B · Search, empty")', () => {
  it('should list the recent searches, Tibetan in its font (H1, H2)', async () => {
    Storage.set('previousQueries', ['ཡེ་ཤེས་', 'wakefulness'])
    await mountAt('/search')

    expect(find('search-recent').text()).toContain('Recent searches')
    const queries = findAll('search-recent-query')
    expect(queries.map((query) => query.text())).toEqual(['ཡེ་ཤེས་', 'wakefulness'])
    expect(queries[0].find('.tibetan').exists()).toBe(true)
  })

  it('should run a recent search when it is clicked (H3)', async () => {
    Storage.set('previousQueries', ['dharma', 'wakefulness'])
    await mountAt('/search')

    await findAll('search-recent-query')[1].trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/search/wakefulness')
    expect(Storage.get('previousQueries')).toEqual(['wakefulness', 'dharma'])
    expect(findAll('search-result')).toHaveLength(3)
  })

  it('should give the field the focus after a recent search, not lose it with the button', async () => {
    Storage.set('previousQueries', ['dharma', 'wakefulness'])
    await mountAt('/search')
    const button = findAll('search-recent-query')[1]
    button.element.focus()

    await button.trigger('click')
    await flushPromises()

    expect(document.activeElement).toBe(find('search-field').find('input').element)
  })

  it('should clear the history and give the field the focus (H4)', async () => {
    Storage.set('previousQueries', ['dharma'])
    await mountAt('/search')
    document.activeElement?.blur?.()

    await find('search-clear-history').trigger('click')

    expect(find('search-recent').exists()).toBe(false)
    expect(Storage.get('previousQueries')).toEqual([])
    expect(document.activeElement).toBe(field().element)
  })

  it('should say what can be searched, without recent searches too', async () => {
    await mountAt('/search')

    expect(find('search-recent').exists()).toBe(false)
    const tips = find('search-tips').text()
    for (const title of ['What you can search', 'Tibetan or Wylie', 'English words', 'How it sounds'])
      expect(tips).toContain(title)
  })
})

describe('Search — query builder', () => {
  it('should be open by default, and stay hidden once hidden (B1)', async () => {
    await mountAt('/search')
    expect(find('search-builder').exists()).toBe(true)
    expect(find('search-builder-show').exists()).toBe(false)

    await find('search-builder-hide').trigger('click')
    expect(find('search-builder').exists()).toBe(false)
    expect(Storage.get('searchBuilderVisible')).toBe(false)

    wrapper.unmount()
    await mountAt('/search')
    expect(find('search-builder').exists()).toBe(false)

    await find('search-builder-show').trigger('click')
    expect(find('search-builder').exists()).toBe(true)
    expect(Storage.get('searchBuilderVisible')).toBe(true)
  })

  it('should hand the focus between Hide and "Query builder", which each disappear when pressed', async () => {
    await mountAt('/search')
    find('search-builder-hide').element.focus()

    await find('search-builder-hide').trigger('click')
    await nextTick()
    expect(document.activeElement).toBe(find('search-builder-show').element)

    find('search-builder-show').element.focus()
    await find('search-builder-show').trigger('click')
    await nextTick()
    await nextTick()
    expect(document.activeElement).toBe(find('search-builder-term').element)
  })

  it('should follow the field, and the field the rows (B2)', async () => {
    await mountAt('/search')

    await field().setValue('(ye shes) & wakefulness')
    await nextTick()
    expect(findAll('search-builder-term').map((input) => input.element.value)).toEqual(['ye shes', 'wakefulness'])

    await findAll('search-builder-term')[1].setValue('wisdom')
    await nextTick()
    expect(field().element.value).toBe('(ye shes) & wisdom')
    expect(database.exec).not.toHaveBeenCalled()
  })

  it('should run the query on Enter in a row (B6)', async () => {
    await mountAt('/search')

    await findAll('search-builder-term')[0].setValue('wakefulness')
    await findAll('search-builder-term')[0].trigger('keyup', { key: 'Enter' })
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/search/wakefulness')
    expect(findAll('search-result')).toHaveLength(3)
  })

  it('should add and remove conditions (B4, B5)', async () => {
    await mountAt('/search/wakefulness')

    await find('search-builder-add').trigger('click')
    expect(findAll('search-builder-row')).toHaveLength(2)
    await findAll('search-builder-term')[1].setValue('wisdom')
    expect(field().element.value).toBe('wakefulness & wisdom')

    await findAll('search-builder-remove')[0].trigger('click')
    await nextTick()
    expect(field().element.value).toBe('wisdom')
  })
})

describe('Search — results', () => {
  it('should say how many results are shown out of how many (L1)', async () => {
    await mountAt('/search/wakefulness')

    expect(find('search-count').text().replace(/\s+/g, ' ')).toBe('Showing 3 of 3 results')
  })

  it('should offer Add my definition with the query when it is one Tibetan term, and search again after a save (L2)', async () => {
    await mountAt(searchFor('ཡེ་ཤེས་'))
    const quickAdd = wrapper.findComponent(quickAddStub)
    expect(quickAdd.props('term')).toBe('ཡེ་ཤེས་')

    await find('search-add').trigger('click')
    expect(quickAdd.props('modelValue')).toBe(true)

    database.exec.mockClear()
    quickAdd.vm.$emit('saved')
    await flushPromises()
    expect(database.exec).toHaveBeenCalledTimes(1)
  })

  it('should leave the term of Add my definition empty for other queries (L2)', async () => {
    await mountAt(searchFor('wakefulness & [yeshe]'))
    expect(wrapper.findComponent(quickAddStub).props('term')).toBe('')
  })

  it('should not offer Add my definition where packs are not modular (web) (L2)', async () => {
    platform.modularPacks = false
    await mountAt('/search/wakefulness')
    expect(find('search-add').exists()).toBe(false)
  })

  it('should offer the Dictionaries menu with the dictionaries that have results (L3)', async () => {
    await mountAt('/search/wakefulness')

    const menu = wrapper.findComponent(ResultsAndPaginationAndDictionaries)
    expect(menu.props('dictionaries').map((dictionary) => dictionary.id).sort()).toEqual([1, 2, 3, 4])
    expect(menu.props('totalNumberOfEntries')).toBe(3)
  })

  it('should give the field the focus when the Dictionaries menu closes (L3)', async () => {
    await mountAt('/search/wakefulness')
    document.activeElement?.blur?.()

    wrapper.findComponent(ResultsAndPaginationAndDictionaries).vm.$emit('close:dictionariesMenu')

    expect(document.activeElement).toBe(field().element)
  })

  it('should decorate and highlight each definition, in an element App.vue listens on (L4, L5)', async () => {
    await mountAt('/search/wakefulness')

    const definition = findAll('search-result-definition')[0]
    expect(definition.classes()).toContain('definition')
    expect(definition.html()).toContain('<em>wakefulness</em>')
    expect(definition.html()).not.toContain('<em><em>')
  })

  it('should highlight Tibetan hits in the term (L5)', async () => {
    await mountAt(searchFor('ཡེ་ཤེས་'))
    expect(findAll('search-result-term')[0].html()).toContain('<em>ཡེ་ཤེས་</em>')
  })

  it('should open the dictionary About dialog from its chip (L6)', async () => {
    await mountAt('/search/wakefulness')

    await findAll('search-result-dictionary')[1].trigger('click')

    const about = wrapper.findComponent(aboutStub)
    expect(about.props('modelValue')).toBe(true)
    expect(about.props('dictionary')).toBe('RangjungYeshe')
  })

  it('should show the page of a scanned dictionary and open the scan there (L7)', async () => {
    await mountAt('/search/wakefulness')

    const scanned = find('search-result-scan')
    expect(scanned.text()).toContain('Page 505')
    expect(scanned.text()).toContain('(approximate)')
    expect(scanned.classes()).not.toContain('definition')

    await find('search-result-view-scan').trigger('click')
    const viewer = wrapper.findComponent(scanViewerStub)
    expect(viewer.props()).toMatchObject({
      modelValue: true,
      dictionaryId: 'Jaeschke_Scan',
      initialPage: 505,
      approximate: true,
    })

    viewer.vm.$emit('update:modelValue', false)
    await nextTick()
    expect(wrapper.findComponent(scanViewerStub).exists()).toBe(false)
  })

  it('should show 50 results, then 50 more as the end comes into view, then say all are loaded (L8)', async () => {
    database.exec = vi.fn(async () =>
      Array.from({ length: 120 }, (_, i) => ({
        term: `ཀ${i}`, dictionaryId: 1, dictionary: 'RangjungYeshe', definition: `wakefulness ${i}`, rank: 0,
      }))
    )
    await mountAt('/search/wakefulness')
    expect(findAll('search-result')).toHaveLength(50)
    expect(find('search-sentinel').find('[data-testid="ui-spinner"]').exists()).toBe(true)

    for (const expected of [100, 120]) {
      await vi.waitFor(() => expect(page().vm._infiniteScrollObserver).toBeTruthy())
      page().vm._infiniteScrollObserver._trigger(true)
      await nextTick()
      expect(findAll('search-result')).toHaveLength(expected)
      await flushPromises()
    }
    expect(find('search-sentinel').text()).toBe('All 120 results loaded')
    expect(find('search-count').text().replace(/\s+/g, ' ')).toBe('Showing 120 of 120 results')
  })

  it('should decorate each result once per search, not again with each new batch', async () => {
    database.exec = vi.fn(async () =>
      Array.from({ length: 120 }, (_, i) => ({
        term: `ཀ${i}`, dictionaryId: 1, dictionary: 'RangjungYeshe', definition: `wakefulness ${i}`, rank: 0,
      }))
    )
    await mountAt('/search/wakefulness')
    const highlight = vi.spyOn(page().vm, 'highlightSearchTerms')

    await vi.waitFor(() => expect(page().vm._infiniteScrollObserver).toBeTruthy())
    page().vm._infiniteScrollObserver._trigger(true)
    await nextTick()

    expect(findAll('search-result')).toHaveLength(100)
    // the 50 new results, term and definition: 100 calls, not 200
    expect(highlight).toHaveBeenCalledTimes(100)
    expect(find('search-result-definition').html()).toContain('<em>wakefulness</em>')
  })

  it('should watch the results card on a desktop and the page on a phone (L8)', async () => {
    await mountAt('/search/wakefulness')
    await flushPromises()
    expect(page().vm._infiniteScrollObserver.options.root).toBe(find('search-results').element)
    expect(page().vm._infiniteScrollObserver.options.rootMargin).toBe('200px')
  })

  it('should say "No entries" when nothing matched (L9)', async () => {
    database.exec = vi.fn(async () => [])
    await mountAt('/search/zzz')

    expect(find('search-no-results').text()).toBe('No entries')
    expect(find('search-count').exists()).toBe(false)
  })

  it('should show the uninstalled-packs notice after a search with few results (L10)', async () => {
    database.exec = vi.fn(async () => [])
    await mountAt('/search/zzz')

    expect(find('uninstalled-notice').exists()).toBe(true)
    expect(find('uninstalled-notice').text()).toContain('packs were not searched')
  })

  it('should not show the packs notice before any search (L10)', async () => {
    await mountAt('/search')
    expect(find('uninstalled-notice').exists()).toBe(false)
  })
})

describe('Search — phone', () => {
  beforeEach(() => {
    window.innerWidth = 390
  })

  it('should switch to the phone layout, with Add my definition as an icon (X3)', async () => {
    await mountAt('/search/wakefulness')

    expect(find('search-page').classes()).toContain('is-phone')
    expect(find('search-add').attributes('aria-label')).toBe('Add my definition')
    expect(find('search-add').text()).toBe('')
  })

  it('should watch the page itself for the infinite scroll (L8)', async () => {
    await mountAt('/search/wakefulness')
    await flushPromises()
    expect(page().vm._infiniteScrollObserver.options.root).toBe(find('search-page').element)
  })
})

describe('Search — the shared builder', () => {
  it('should hand the builder the query and take its changes', async () => {
    await mountAt('/search/wakefulness')
    const builder = wrapper.findComponent(SearchBuilder)
    expect(builder.props('modelValue')).toBe('wakefulness')
  })
})
