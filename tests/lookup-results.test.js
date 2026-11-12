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

    expect(searchCalls().at(-1)[0]).toContain('termPhoneticsLoose')
    expect(resultTerms()).toEqual(['བཅོམ་ལྡན་', 'བཅོམ་ལྡན་འདས་མ་', 'ད་'])
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
