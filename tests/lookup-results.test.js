/**
 * Lookup results: the headwords starting with the Tibetan typed (བོད), or the
 * terms whose definitions match the query (EN). Mounted the way App.vue
 * mounts LookupPage (a <keep-alive> around the <router-view>) with the app's
 * own route table, the database mocked.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import { h, KeepAlive, nextTick } from 'vue'

const platform = vi.hoisted(() => ({ modularPacks: true }))
vi.mock('../src/config/platform.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    isTauri: () => platform.modularPacks,
    isMacOS: () => false,
    isMobile: () => false,
    supportsModularPacks: () => platform.modularPacks,
  }
})

const packManager = vi.hoisted(() => ({
  isInitialized: true,
  installedPacks: ['core'],
  downloadingPacks: {},
  // Read by the entry's Add my definition dialog
  customPacks: [],
}))
vi.mock('../src/services/pack-manager', () => ({ default: packManager }))

const database = vi.hoisted(() => ({ allTerms: [], exec: null, getEntriesFor: null }))
vi.mock('../src/services/sql-database', () => ({ default: database }))

import appRouter from '../src/router.js'
import LookupPage from '../src/components/lookup/LookupPage.vue'
import HeadwordResults from '../src/components/lookup/HeadwordResults.vue'
import Storage from '../src/services/storage'
import { clearGlossCache } from '../src/services/glosses'
import { recentTerms } from '../src/services/history'

const KA = 'ཀ་'
const KAKA = 'ཀ་ཀ་'
const KHA = 'ཁ་'
const DICTIONARIES = [
  { id: 1, name: 'RangjungYeshe', position: 2, enabled: true },
  { id: 2, name: 'Hopkins2015', position: 1, enabled: true },
  { id: 3, name: 'Jaeschke_Scan', position: 3, enabled: true },
  { id: 4, name: 'RichardBarron', position: 4, enabled: false },
]
// What `SELECT … WHERE term IN (…)` finds for the glosses
const GLOSS_ROWS = [
  { term: KA, dictionaryId: 1, definition: 'the first letter' },
  { term: KA, dictionaryId: 2, definition: 'ka; the <b>first</b> consonant' },
  { term: KAKA, dictionaryId: 4, definition: 'off in Settings' },
]
// What a definitions search finds
const SEARCH_ROWS = [
  { term: 'ཡེ་ཤེས་', dictionaryId: 1, dictionary: 'RangjungYeshe', definition: 'primordial wakefulness', rank: -2 },
  { term: 'ཡེ་ཤེས་', dictionaryId: 2, dictionary: 'Hopkins2015', definition: 'exalted wisdom; <i>wakefulness</i> &amp; more', rank: -1 },
  { term: 'ཡེ་ཤེས་', dictionaryId: 3, dictionary: 'Jaeschke_Scan', definition: '505?', rank: -3 },
  { term: 'ཡེ་ཤེས་', dictionaryId: 4, dictionary: 'RichardBarron', definition: 'off in Settings: wakefulness', rank: 0 },
  { term: 'རིག་པ་', dictionaryId: 1, dictionary: 'RangjungYeshe', definition: 'awareness, &lt;wakefulness&gt;', rank: -1 },
]
// tests/search-page.test.js's fixture for {jomden}
const JOMDEN_ROWS = [
  { term: 'ད་', termPhoneticsStrict: 'ta', termPhoneticsLoose: 'ta', dictionaryId: 1, dictionary: 'RangjungYeshe', definition: 'now; a particle', rank: -20 },
  { term: 'བཅོམ་ལྡན་འདས་མ་', termPhoneticsStrict: 'chom den de ma', termPhoneticsLoose: 'chom ten te ma', dictionaryId: 1, dictionary: 'RangjungYeshe', definition: 'bhagavati', rank: -9 },
  { term: 'བཅོམ་ལྡན་', termPhoneticsStrict: 'chom den', termPhoneticsLoose: 'chom ten', dictionaryId: 2, dictionary: 'Hopkins2015', definition: 'conqueror; victor', rank: -1 },
]

// tests/search-query.test.js's golden SQL for {jomden}, as Search built it
const JOMDEN_SQL = "\n            SELECT entries.*, dictionaries.name AS dictionary, dictionaries.position AS dictionaryPosition,\n                   bm25(entries_fts, 10.0, 8.0, 8.0, 1.0, 1.0, 1.0) AS rank\n            FROM entries\n            INNER JOIN dictionaries ON dictionaries.id = entries.dictionaryId\n            INNER JOIN entries_fts ON entries.id = entries_fts.rowid\n            WHERE (entries_fts MATCH '(termPhoneticsLoose:\"cho mten\" OR termPhoneticsLoose:\"chom ten\" OR termPhoneticsLoose:\"chomten\" OR termPhoneticsLoose:\"cho mmten\" OR termPhoneticsLoose:\"chom mten\" OR termPhoneticsLoose:\"chommten\" OR termPhoneticsLoose:\"chommten\" OR termPhoneticsLoose:\"cho mtten\" OR termPhoneticsLoose:\"chom tten\" OR termPhoneticsLoose:\"chomtten\" OR termPhoneticsLoose:\"chomtten\" OR termPhoneticsLoose:\"cho mtenn\" OR termPhoneticsLoose:\"chom tenn\" OR termPhoneticsLoose:\"chomt enn\") OR definitionPhoneticsWordsLoose:\"chom ten\"')\n            ORDER BY rank\n            LIMIT 5000\n          "

let searchRows
const isGlossQuery = (sql) => /WHERE term IN/.test(sql)
const searchCalls = () => database.exec.mock.calls.filter(([sql]) => !isGlossQuery(sql))

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
  wrapper = mount(Shell, {
    attachTo: document.body,
    global: { plugins: [router], provide: { snackbar: { open: vi.fn() } } },
  })
  await flushPromises()
  return wrapper
}

const input = () => wrapper.find('[data-testid="lookup-field"] input')
const results = () => wrapper.findAll('[data-testid="lookup-result"]')
const resultTerms = () => results().map((row) => row.find('[data-testid="lookup-result-term"]').text())
const readAs = () => wrapper.find('[data-testid="lookup-read-as"]')
const selectedRow = () => results().find((row) => row.attributes('aria-selected') === 'true')

async function typeTibetan(value) {
  await input().setValue(value)
  await nextTick()
}

async function typeWylie(value) {
  await input().setValue(value)
  await input().trigger('keyup', { key: value.at(-1) })
  await nextTick()
}

async function go(path) {
  await router.push(path)
  await flushPromises()
}

const waitForTerm = (term) =>
  vi.waitFor(() => expect(router.currentRoute.value.params.term).toBe(term), { timeout: 2000 })

beforeEach(() => {
  platform.modularPacks = true
  packManager.installedPacks = ['core', 'tibetan-monolingual', 'sanskrit-academic']
  database.allTerms = [KA, KAKA, KHA]
  searchRows = SEARCH_ROWS
  database.exec = vi.fn(async (sql) =>
    (isGlossQuery(sql) ? GLOSS_ROWS : searchRows).map((row) => ({ ...row }))
  )
  database.getEntriesFor = vi.fn(async () => [])
  clearGlossCache()
  Storage.set('dictionaries', DICTIONARIES)
  // Storage writes localStorage properties, which the setup's clear() keeps
  Storage.delete('lookupState')
  Storage.delete('selectedTerm')
  Storage.delete('previousQueries')
  Storage.delete('searchBuilderVisible')
  Storage.delete('defineHistory')
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('Lookup results — Tibetan', () => {
  it('should list the terms starting with the Tibetan typed, 100 at a time', async () => {
    database.allTerms = [
      KHA,
      ...Array.from({ length: 150 }, (_, i) => KA + String(i).padStart(3, '0')),
    ]
    await mountAt('/lookup')
    await typeTibetan(KA)

    expect(results()).toHaveLength(100)
    expect(resultTerms()[0]).toBe(KA + '000')
    expect(readAs().text()).toBe('150 terms')

    const list = wrapper.findComponent(HeadwordResults)
    list.vm._infiniteScrollObserver._trigger(true)
    await flushPromises()
    expect(results()).toHaveLength(150)
  })

  it("should show each result's gloss from the first enabled dictionary", async () => {
    await mountAt('/lookup')
    await typeTibetan('ཀ')

    await vi.waitFor(() =>
      expect(results()[0].find('[data-testid="lookup-result-gloss"]').text()).toBe(
        'ka; the first consonant'
      )
    )
    // Its only definition is in a dictionary turned off: no gloss
    expect(results()[1].find('[data-testid="lookup-result-gloss"]').text()).toBe('')
    const [sql] = database.exec.mock.calls.find(([query]) => isGlossQuery(query))
    expect(sql).toContain(`'${KA}'`)
    expect(sql).toContain(`'${KAKA}'`)
  })

  it('should select the first match after a pause and record it in Recent', async () => {
    await mountAt('/lookup')
    await typeTibetan('ཀ')

    await waitForTerm(KA)
    await flushPromises()
    expect(input().element.value).toBe('ཀ')
    expect(selectedRow().find('[data-testid="lookup-result-term"]').text()).toBe(KA)
    expect(Storage.get('lookupState').term).toBe(KA)
    await vi.waitFor(() => expect(recentTerms()[0]).toBe(KA), { timeout: 2000 })
  })

  it('should move the selection with Up and Down', async () => {
    await mountAt('/lookup')
    await typeTibetan('ཀ')
    await waitForTerm(KA)

    await input().trigger('keydown', { key: 'ArrowDown' })
    await flushPromises()
    expect(router.currentRoute.value.params.term).toBe(KAKA)
    expect(selectedRow().find('[data-testid="lookup-result-term"]').text()).toBe(KAKA)

    await input().trigger('keydown', { key: 'ArrowUp' })
    await flushPromises()
    expect(router.currentRoute.value.params.term).toBe(KA)
  })

  it('should record in Recent only the term the selection stops on', async () => {
    const KARA = 'ཀ་ར་'
    database.allTerms = [KA, KAKA, KARA]
    await mountAt('/lookup')
    await typeTibetan('ཀ')
    await waitForTerm(KA)
    await vi.waitFor(() => expect(recentTerms()).toEqual([KA]), { timeout: 2000 })

    await input().trigger('keydown', { key: 'ArrowDown' })
    await flushPromises()
    await input().trigger('keydown', { key: 'ArrowDown' })
    await flushPromises()
    expect(router.currentRoute.value.params.term).toBe(KARA)
    // ཀ་ཀ་, passed through, would have stayed next to ཀ་ར་
    await vi.waitFor(() => expect(recentTerms()).toEqual([KARA]), { timeout: 2000 })
  })

  it('should record the selected term at once when leaving Lookup before the pause ends', async () => {
    await mountAt('/lookup/' + encodeURIComponent(KAKA))
    await go('/reader')
    expect(recentTerms()[0]).toBe(KAKA)
  })

  it('should select the term clicked', async () => {
    await mountAt('/lookup')
    await typeTibetan('ཀ')
    await waitForTerm(KA)

    await results()[1].trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.params.term).toBe(KAKA)
    expect(input().element.value).toBe('ཀ')
  })

  it('should say how the input was read', async () => {
    await mountAt('/lookup')
    await typeWylie('ka ')
    expect(readAs().text()).toBe('Wylie ka → ཀ་ · 2 terms')
  })

  it('should list the new terms once a pack is installed', async () => {
    await mountAt('/lookup')
    await typeTibetan('ཀ')
    expect(resultTerms()).toEqual([KA, KAKA])

    database.allTerms = [KA, 'ཀ་ར་', KAKA, KHA]
    window._triggerEvent('all-terms-updated')
    await flushPromises()
    expect(resultTerms()).toEqual([KA, KAKA, 'ཀ་ར་'])
  })

  it('should show the glosses of the new first dictionary when the order changed in Library', async () => {
    await mountAt('/lookup')
    await typeTibetan('ཀ')
    await vi.waitFor(() =>
      expect(results()[0].find('[data-testid="lookup-result-gloss"]').text()).toBe('ka; the first consonant')
    )

    await go('/reader')
    Storage.set('dictionaries', DICTIONARIES.map((d) => ({ ...d, position: d.id })))
    await go('/lookup')

    await vi.waitFor(() =>
      expect(results()[0].find('[data-testid="lookup-result-gloss"]').text()).toBe('the first letter')
    )
  })

  it('should show the uninstalled packs notice when nothing matches', async () => {
    packManager.installedPacks = ['core']
    await mountAt('/lookup')
    await typeTibetan('ང')

    expect(results()).toHaveLength(0)
    expect(wrapper.find('[data-testid="lookup-no-results"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="uninstalled-notice"]').exists()).toBe(true)
  })
})

describe('Lookup results — English', () => {
  it('should search the definitions in English mode and list one row per term', async () => {
    await mountAt('/lookup?mode=en')
    await input().setValue('wakefulness')
    await input().trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(searchCalls().at(-1)[0]).toContain(
      "entries_fts MATCH 'term:\"wakefulness\" OR definition:\"wakefulness\"'"
    )
    expect(resultTerms()).toEqual(['ཡེ་ཤེས་', 'རིག་པ་'])
    const first = results()[0]
    // The first definition in the user's order, as plain text, its hit marked
    expect(first.find('[data-testid="lookup-result-gloss"]').html()).toContain(
      'exalted wisdom; <em>wakefulness</em> &amp; more'
    )
    expect(first.find('[data-testid="lookup-result-count"]').text()).toBe('3 definitions')
    // A definition's angle brackets are text, never markup
    expect(results()[1].find('[data-testid="lookup-result-gloss"]').text()).toBe('awareness, <wakefulness>')
    expect(results()[1].find('[data-testid="lookup-result-gloss"] em').text()).toBe('wakefulness')
    expect(readAs().text()).toBe('Terms whose definitions say “wakefulness” · 2 terms')
    expect(Storage.get('previousQueries')).toEqual(['wakefulness'])
  })

  it('should search after a pause in typing', async () => {
    await mountAt('/lookup?mode=en')
    await input().setValue('wakefulness')

    await vi.waitFor(() => expect(results()).toHaveLength(2), { timeout: 2000 })
    expect(router.currentRoute.value.query).toEqual({ mode: 'en', q: 'wakefulness' })
    expect(input().element.value).toBe('wakefulness')
  })

  it('should support phonetic searches in English mode', async () => {
    searchRows = JOMDEN_ROWS
    await mountAt('/lookup?mode=en&q=' + encodeURIComponent('{jomden}'))

    // The raw phonetic term reaches buildSearchSql: the SQL Search built
    expect(searchCalls().at(-1)[0]).toBe(JOMDEN_SQL)
    expect(resultTerms()).toEqual(['བཅོམ་ལྡན་', 'བཅོམ་ལྡན་འདས་མ་', 'ད་'])
  })

  it.each([
    ['(ye shes', 'the (ye shes of the text'],
    ['c++', 'code in c++'],
  ])('should list the results of a query with regex characters (%s) while it is typed', async (query, definition) => {
    searchRows = [{ term: 'ཡེ་ཤེས་', dictionaryId: 1, dictionary: 'RangjungYeshe', definition, rank: -1 }]
    await mountAt('/lookup?mode=en')
    await input().setValue(query)

    await vi.waitFor(() => expect(results()).toHaveLength(1), { timeout: 2000 })
    expect(results()[0].find('[data-testid="lookup-result-gloss"] em').text()).toBe(query)
  })

  it('should show previous queries before any English search', async () => {
    Storage.set('previousQueries', ['wisdom', 'ཡེ་ཤེས་'])
    await mountAt('/lookup?mode=en')

    const previous = wrapper.findAll('[data-testid="lookup-previous-query"]')
    expect(wrapper.find('[data-testid="lookup-previous"]').exists()).toBe(true)
    expect(previous.map((button) => button.text())).toEqual(['wisdom', 'ཡེ་ཤེས་'])

    await previous[0].trigger('click')
    await flushPromises()
    expect(input().element.value).toBe('wisdom')
    expect(router.currentRoute.value.query).toEqual({ mode: 'en', q: 'wisdom' })
    expect(results()).toHaveLength(2)
  })

  it('should select the term clicked and record it in Recent', async () => {
    await mountAt('/lookup?mode=en&q=wakefulness')
    await results()[1].trigger('click')
    await flushPromises()

    expect(results()[1].attributes('aria-selected')).toBe('true')
    expect(recentTerms()[0]).toBe('རིག་པ་')
  })

  it('should search again when a pack was installed meanwhile', async () => {
    await mountAt('/lookup?mode=en&q=wakefulness')
    expect(searchCalls()).toHaveLength(1)

    await go('/reader')
    window._triggerEvent('all-terms-updated')
    await go('/lookup')

    expect(searchCalls()).toHaveLength(2)
  })

  it('should search again when a dictionary was switched off in Library meanwhile', async () => {
    await mountAt('/lookup?mode=en&q=wakefulness')
    expect(results()[0].find('[data-testid="lookup-result-count"]').text()).toBe('3 definitions')

    await go('/reader')
    Storage.set('dictionaries', DICTIONARIES.map((d) => (d.id === 3 ? { ...d, enabled: false } : d)))
    await go('/lookup')

    expect(searchCalls()).toHaveLength(2)
    expect(results()[0].find('[data-testid="lookup-result-count"]').text()).toBe('2 definitions')
  })

  it('should not search again when coming back with nothing changed', async () => {
    await mountAt('/lookup?mode=en&q=wakefulness')
    await go('/reader')
    await go('/lookup')
    expect(searchCalls()).toHaveLength(1)
  })

  it('should show the uninstalled packs notice when nothing matches', async () => {
    packManager.installedPacks = ['core']
    searchRows = []
    await mountAt('/lookup?mode=en&q=zzz')

    expect(results()).toHaveLength(0)
    expect(wrapper.find('[data-testid="lookup-no-results"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="uninstalled-notice"]').exists()).toBe(true)
  })
})

// Ported from tests/define-page.test.js and tests/search-page.test.js
describe('Lookup results — ported from Define and Search', () => {
  it('should render enough terms for the term picked with the keyboard to be in the list', async () => {
    const terms = Array.from({ length: 150 }, (_, i) => KA + String(i).padStart(3, '0'))
    database.allTerms = terms
    await mountAt('/lookup')
    await typeTibetan(KA)
    await waitForTerm(terms[0])
    expect(results()).toHaveLength(100)

    await go('/lookup/' + encodeURIComponent(terms[120]))
    expect(results()).toHaveLength(150)
    expect(selectedRow().find('[data-testid="lookup-result-term"]').text()).toBe(terms[120])
  })

  it('should show a spinner instead of the recent searches while the first search runs', async () => {
    Storage.set('previousQueries', ['wisdom'])
    let resolve
    database.exec = vi.fn((sql) =>
      isGlossQuery(sql) ? Promise.resolve([]) : new Promise((done) => (resolve = done))
    )
    await mountAt('/lookup?mode=en&q=wakefulness')

    expect(wrapper.find('.lookup-results__loading').exists()).toBe(true)
    expect(wrapper.find('[data-testid="lookup-previous"]').exists()).toBe(false)

    resolve(SEARCH_ROWS.map((row) => ({ ...row })))
    await flushPromises()
    expect(wrapper.find('.lookup-results__loading').exists()).toBe(false)
    expect(results()).toHaveLength(2)
  })

  it('should list 20 terms, then 20 more as the end comes into view', async () => {
    searchRows = Array.from({ length: 45 }, (_, i) => ({
      term: 'ཀ' + String(i).padStart(2, '0') + '་',
      dictionaryId: 1,
      dictionary: 'RangjungYeshe',
      definition: 'wakefulness ' + i,
      rank: -1,
    }))
    await mountAt('/lookup?mode=en&q=wakefulness')
    expect(results()).toHaveLength(20)

    const list = wrapper.findComponent({ name: 'DefinitionResults' })
    list.vm._infiniteScrollObserver._trigger(true)
    await flushPromises()
    expect(results()).toHaveLength(40)
    list.vm._infiniteScrollObserver._trigger(true)
    await flushPromises()
    expect(results()).toHaveLength(45)
  })

  it('should not show the uninstalled packs notice before any search', async () => {
    packManager.installedPacks = ['core']
    await mountAt('/lookup?mode=en')
    expect(wrapper.find('[data-testid="uninstalled-notice"]').exists()).toBe(false)
  })

  it('should empty the recent searches with their Clear', async () => {
    Storage.set('previousQueries', ['wisdom', 'compassion'])
    await mountAt('/lookup?mode=en')

    await wrapper.get('[data-testid="lookup-previous-clear"]').trigger('click')

    expect(wrapper.findAll('[data-testid="lookup-previous-query"]')).toHaveLength(0)
    expect(Storage.get('previousQueries')).toEqual([])
  })

  it('should put the terms starting with the query first, then the others', async () => {
    searchRows = [
      { term: 'བདེ་སྟོང་ཡེ་ཤེས་', dictionaryId: 2, dictionary: 'Hopkins2015', definition: 'far', rank: -9 },
      { term: 'ཡེ་ཤེས་', dictionaryId: 1, dictionary: 'RangjungYeshe', definition: 'first, position 2', rank: -1 },
      { term: 'ཡེ་ཤེས་', dictionaryId: 2, dictionary: 'Hopkins2015', definition: 'second, position 1', rank: -5 },
      { term: 'ཡེ་ཤེས་ཅན་', dictionaryId: 1, dictionary: 'RangjungYeshe', definition: 'longer', rank: -1 },
    ]
    await mountAt('/lookup?mode=en&q=' + encodeURIComponent('ཡེ་ཤེས་'))

    expect(resultTerms()).toEqual(['ཡེ་ཤེས་', 'ཡེ་ཤེས་ཅན་', 'བདེ་སྟོང་ཡེ་ཤེས་'])
    expect(results().map((row) => row.find('[data-testid="lookup-result-count"]').text())).toEqual([
      '2 definitions',
      '1 definition',
      '1 definition',
    ])
    // The first definition in the user's order: Hopkins2015 comes first
    expect(results()[0].find('[data-testid="lookup-result-gloss"]').text()).toBe('second, position 1')
  })

  it('should order terms with the same start by their best rank, not by dictionary position', async () => {
    searchRows = [
      { term: 'ཡེ་ཤེས་ཀ', dictionaryId: 1, dictionary: 'RangjungYeshe', definition: 'a', rank: -1 },
      { term: 'ཡེ་ཤེས་ཁ', dictionaryId: 3, dictionary: 'Jaeschke_Scan', definition: 'b', rank: -8 },
    ]
    await mountAt('/lookup?mode=en&q=' + encodeURIComponent('ཡེ་ཤེས་'))

    expect(resultTerms()).toEqual(['ཡེ་ཤེས་ཁ', 'ཡེ་ཤེས་ཀ'])
  })
})
