/**
 * Define results: the headwords starting with the Tibetan typed. Mounted the way App.vue
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

describe('Define results — Tibetan', () => {
  it('should list the terms starting with the Tibetan typed, 100 at a time', async () => {
    database.allTerms = [
      KHA,
      ...Array.from({ length: 150 }, (_, i) => KA + String(i).padStart(3, '0')),
    ]
    await mountAt('/define')
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
    await mountAt('/define')
    await typeTibetan('ཀ')

    await vi.waitFor(() =>
      expect(results()[0].find('[data-testid="lookup-result-gloss"]').text()).toBe(
        'ka; the first consonant'
      )
    )
    // Its only definition is in a dictionary turned off: no gloss
    expect(results()[1].find('[data-testid="lookup-result-gloss"]').text()).toBe('')
    // Define's home also reads glosses (the terms to Try): this is the results'
    const [sql] = database.exec.mock.calls.find(([query]) => isGlossQuery(query) && query.includes(`'${KAKA}'`))
    expect(sql).toContain(`'${KA}'`)
  })

  it('should select the first match after a pause and record it in Recent', async () => {
    await mountAt('/define')
    await typeTibetan('ཀ')

    await waitForTerm(KA)
    await flushPromises()
    expect(input().element.value).toBe('ཀ')
    expect(selectedRow().find('[data-testid="lookup-result-term"]').text()).toBe(KA)
    expect(Storage.get('lookupState').term).toBe(KA)
    await vi.waitFor(() => expect(recentTerms()[0]).toBe(KA), { timeout: 2000 })
  })

  it('should move the selection with Up and Down', async () => {
    await mountAt('/define')
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
    await mountAt('/define')
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

  it('should record the selected term at once when leaving Define before the pause ends', async () => {
    await mountAt('/define/' + encodeURIComponent(KAKA))
    await go('/reader')
    expect(recentTerms()[0]).toBe(KAKA)
  })

  it('should select the term clicked', async () => {
    await mountAt('/define')
    await typeTibetan('ཀ')
    await waitForTerm(KA)

    await results()[1].trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.params.term).toBe(KAKA)
    expect(input().element.value).toBe('ཀ')
  })

  it('should say how the input was read', async () => {
    await mountAt('/define')
    await typeWylie('ka ')
    expect(readAs().text()).toBe('Wylie ka → ཀ་ · 2 terms')
  })

  it('should list the new terms once a pack is installed', async () => {
    await mountAt('/define')
    await typeTibetan('ཀ')
    expect(resultTerms()).toEqual([KA, KAKA])

    database.allTerms = [KA, 'ཀ་ར་', KAKA, KHA]
    window._triggerEvent('all-terms-updated')
    await flushPromises()
    expect(resultTerms()).toEqual([KA, KAKA, 'ཀ་ར་'])
  })

  it('should show the glosses of the new first dictionary when the order changed in Library', async () => {
    await mountAt('/define')
    await typeTibetan('ཀ')
    await vi.waitFor(() =>
      expect(results()[0].find('[data-testid="lookup-result-gloss"]').text()).toBe('ka; the first consonant')
    )

    await go('/reader')
    Storage.set('dictionaries', DICTIONARIES.map((d) => ({ ...d, position: d.id })))
    await go('/define')

    await vi.waitFor(() =>
      expect(results()[0].find('[data-testid="lookup-result-gloss"]').text()).toBe('the first letter')
    )
  })

  it('should show the uninstalled packs notice when nothing matches', async () => {
    packManager.installedPacks = ['core']
    await mountAt('/define')
    await typeTibetan('ང')

    expect(results()).toHaveLength(0)
    expect(wrapper.find('[data-testid="lookup-no-results"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="uninstalled-notice"]').exists()).toBe(true)
  })
})

// Ported from tests/define-page.test.js
describe('Define results — ported from Define', () => {
  it('should render enough terms for the term picked with the keyboard to be in the list', async () => {
    const terms = Array.from({ length: 150 }, (_, i) => KA + String(i).padStart(3, '0'))
    database.allTerms = terms
    await mountAt('/define')
    await typeTibetan(KA)
    await waitForTerm(terms[0])
    expect(results()).toHaveLength(100)

    await go('/define/' + encodeURIComponent(terms[120]))
    expect(results()).toHaveLength(150)
    expect(selectedRow().find('[data-testid="lookup-result-term"]').text()).toBe(terms[120])
  })
})
