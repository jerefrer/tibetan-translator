/**
 * SearchPage state: the field, the route, the entry opened beside the results
 * and what is remembered. Mounted the way App.vue mounts it (a <keep-alive>
 * around the <router-view>) with the app's own route table, so the redirects
 * from the old /search/<query> and /lookup?mode=en links are the real ones.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import { h, KeepAlive, nextTick } from 'vue'

import appRouter from '../src/router.js'
import SearchPage from '../src/components/search/SearchPage.vue'
import Storage from '../src/services/storage'
import SqlDatabase from '../src/services/sql-database'
import { historyState } from '../src/services/navigation-history'

const KA = 'ཀ་'
const SANGS_RGYAS = 'སངས་རྒྱས་'
const DICTIONARIES = [
  { id: 1, name: 'RangjungYeshe', position: 0, enabled: true },
  { id: 2, name: 'MyGlossary', position: 1, enabled: true },
]
// What a definitions search finds
const SEARCH_ROWS = [
  { term: SANGS_RGYAS, dictionaryId: 1, dictionary: 'RangjungYeshe', definition: 'the buddha nature', rank: -2 },
  { term: KA, dictionaryId: 2, dictionary: 'MyGlossary', definition: 'buddha letter', rank: -1 },
]
const entryRows = (term) => [
  { term, dictionaryId: 1, dictionary: 'RangjungYeshe', dictionaryPosition: 0, definition: `buddha nature of ${term}` },
]

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
  wrapper = mount(Shell, { attachTo: document.body, global: { plugins: [router], provide: { snackbar: { open: vi.fn() } } },
  })
  await flushPromises()
  return wrapper
}

const page = () => wrapper.findComponent(SearchPage)
const input = () => wrapper.find('[data-testid="search-field"] input')
const results = () => wrapper.findAll('[data-testid="lookup-result"]')
const resultTerms = () => wrapper.findAll('[data-testid="lookup-result-term"]').map((term) => term.text())
const resultsPane = () => wrapper.find('[data-testid="search-results-pane"]')
const entryPane = () => wrapper.find('[data-testid="search-entry-pane"]')
const headword = () => entryPane().find('[data-testid="entry-headword"]')
const only = () => wrapper.find('[data-testid="search-only"]')
const lookUpHint = () => wrapper.find('[data-testid="hint-look-up"]')
const shown = (element) => element.exists() && element.element.style.display !== 'none'

async function go(path) {
  await router.push(path)
  await flushPromises()
}

async function submit(value) {
  await input().setValue(value)
  await input().trigger('keydown', { key: 'Enter' })
  await flushPromises()
}

beforeEach(() => {
  // Storage writes localStorage properties, which the setup's clear() keeps
  Storage.delete('lookupState')
  Storage.delete('searchBuilderVisible')
  Storage.delete('previousQueries')
  Storage.set('dictionaries', DICTIONARIES)
  vi.spyOn(SqlDatabase, 'exec').mockImplementation(async (sql) => (/WHERE term IN/.test(sql) ? [] : SEARCH_ROWS))
  vi.spyOn(SqlDatabase, 'getEntriesFor').mockImplementation(async (term) => entryRows(term))
  SqlDatabase.allTerms = [KA, SANGS_RGYAS]
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  SqlDatabase.allTerms = []
  vi.restoreAllMocks()
})

describe('Search — route', () => {
  it('should fill the field with the query of the route', async () => {
    await mountAt('/search?q=wisdom')
    expect(input().element.value).toBe('wisdom')
    expect(page().vm.query).toBe('wisdom')
  })

  it('should open on the query of an old Search link', async () => {
    await mountAt('/search/wisdom')
    expect(router.currentRoute.value.path).toBe('/search')
    expect(router.currentRoute.value.query).toEqual({ q: 'wisdom' })
    expect(input().element.value).toBe('wisdom')
  })

  it('should decode a percent-encoded query from an old Search link', async () => {
    await mountAt('/search/' + encodeURIComponent('buddha nature & (ye shes)'))
    expect(input().element.value).toBe('buddha nature & (ye shes)')
  })

  it('should open on the query of a former English-mode Define link', async () => {
    await mountAt('/lookup?mode=en&q=wisdom')
    expect(router.currentRoute.value.path).toBe('/search')
    expect(router.currentRoute.value.query).toEqual({ q: 'wisdom' })
    expect(input().element.value).toBe('wisdom')
  })

  it('should run the search from the field with Enter, adding it to the recent searches', async () => {
    await mountAt('/search')
    await submit('buddha nature')
    const route = router.currentRoute.value
    expect(route.path).toBe('/search')
    expect(route.query).toEqual({ q: 'buddha nature' })
    expect(Storage.get('previousQueries')).toEqual(['buddha nature'])
  })

  it('should search after a pause in typing without adding it to the recent searches', async () => {
    await mountAt('/search')
    await input().setValue('buddha')
    await vi.waitFor(() => expect(router.currentRoute.value.query).toEqual({ q: 'buddha' }), { timeout: 2000 })
    await flushPromises()
    expect(results()).toHaveLength(2)
    expect(input().element.value).toBe('buddha')
    expect(Storage.get('previousQueries', [])).toEqual([])
  })

  it('should ignore routes of other pages while it is kept alive', async () => {
    await mountAt('/search?q=wisdom')
    const vm = page().vm
    await go('/reader?q=other')
    expect(vm.text).toBe('wisdom')
    expect(vm.query).toBe('wisdom')
    expect(Storage.get('lookupState')).toMatchObject({ query: 'wisdom' })
  })

  it('should not add a query reached by a link to the recent searches', async () => {
    await mountAt('/search/wisdom')
    expect(page().vm.query).toBe('wisdom')
    expect(Storage.get('previousQueries', [])).toEqual([])
  })

  it('should show an earlier query again when Back returns to it', async () => {
    await mountAt('/search?q=wisdom')
    await submit('compassion')
    expect(page().vm.query).toBe('compassion')

    router.back()
    await vi.waitFor(() => expect(page().vm.query).toBe('wisdom'))
    await flushPromises()
    expect(input().element.value).toBe('wisdom')
  })
})

describe('Search — remembering', () => {
  it('should restore the last query when opened bare', async () => {
    Storage.set('lookupState', { term: KA, query: 'wisdom' })
    await mountAt('/search')
    expect(router.currentRoute.value.path).toBe('/search')
    expect(router.currentRoute.value.query).toEqual({ q: 'wisdom' })
    expect(input().element.value).toBe('wisdom')
  })

  it('should stay bare when no query was searched yet', async () => {
    await mountAt('/search')
    expect(router.currentRoute.value.query).toEqual({})
    expect(input().element.value).toBe('')
  })

  it('should show the query again when coming back to a bare Search', async () => {
    await mountAt('/search?q=wisdom')
    await go('/reader')
    await go('/search')
    expect(router.currentRoute.value.query).toEqual({ q: 'wisdom' })
    expect(input().element.value).toBe('wisdom')
  })

  it('should remember the query', async () => {
    await mountAt('/search?q=wisdom')
    expect(Storage.get('lookupState')).toMatchObject({ query: 'wisdom' })
  })

  it('should forget the query, the route and the results when the field is cleared', async () => {
    await mountAt('/search?q=wisdom')
    expect(page().vm.query).toBe('wisdom')

    await wrapper.get('[data-testid="ui-text-field-clear"]').trigger('click')
    await flushPromises()

    expect(input().element.value).toBe('')
    expect(page().vm.query).toBe('')
    expect(router.currentRoute.value.query).toEqual({})
    expect(Storage.get('lookupState').query).toBe('')
    expect(wrapper.find('[data-testid="lookup-no-results"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="lookup-definitions"]').exists()).toBe(false)
  })

  it('should clear the field with Escape', async () => {
    await mountAt('/search?q=wisdom')
    await input().trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(input().element.value).toBe('')
    expect(router.currentRoute.value.query).toEqual({})
  })
})

describe('Search — field', () => {
  it('should carry a visually hidden level-one heading on desktop', async () => {
    await mountAt('/search')
    const title = wrapper.get('h1')
    expect(title.text()).toBe('Search')
    expect(title.classes()).toContain('ui-visually-hidden')
  })

  it('should focus the field on focus-lookup', async () => {
    await mountAt('/search')
    input().element.blur()
    expect(document.activeElement).not.toBe(input().element)
    window._triggerEvent('focus-lookup')
    await nextTick()
    expect(document.activeElement).toBe(input().element)
  })

  it('should focus the field each time the page is shown again (keep-alive)', async () => {
    await mountAt('/search')
    const field = input().element
    await go('/reader')
    expect(document.activeElement).not.toBe(field)
    await go('/search')
    await nextTick()
    expect(document.activeElement).toBe(input().element)
  })

  it('should say how the query was read', async () => {
    await mountAt('/search?q=buddha')
    expect(wrapper.find('[data-testid="search-read-as"]').text()).toBe(
      'Terms whose definitions say “buddha” · 2 terms'
    )
  })
})

describe('Search — results scroll', () => {
  const list = () => wrapper.find('.lookup-page__list').element

  it('should show the top of the results when a new query is searched', async () => {
    await mountAt('/search?q=buddha')
    list().scrollTop = 800
    await submit('wisdom')
    expect(list().scrollTop).toBe(0)
  })

  it('should keep the results where they were when the page is shown again (keep-alive)', async () => {
    await mountAt('/search?q=buddha')
    list().scrollTop = 800
    await go('/reader')
    await go('/search')
    expect(list().scrollTop).toBe(800)
  })
})

describe('Search — the entry of a result', () => {
  it('should open the entry of the result clicked beside the results without leaving Search', async () => {
    await mountAt('/search?q=buddha')
    expect(entryPane().find('[data-testid="term-entry"]').exists()).toBe(false)

    await results()[1].trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/search')
    expect(router.currentRoute.value.query).toEqual({ q: 'buddha', term: KA })
    expect(headword().text()).toBe(KA)
    expect(results()).toHaveLength(2)
    expect(results()[1].attributes('aria-selected')).toBe('true')
  })

  it('should add the query to the recent searches and the term to Recent when a result is chosen', async () => {
    const { recentTerms, clearHistory } = await import('../src/services/history')
    clearHistory()
    await mountAt('/search?q=buddha')
    await results()[1].trigger('click')
    await flushPromises()
    expect(recentTerms()[0]).toBe(KA)
    expect(Storage.get('previousQueries')).toEqual(['buddha'])
  })

  it('should mark the hits of the query in the entry', async () => {
    await mountAt('/search?q=buddha')
    await results()[0].trigger('click')
    await flushPromises()
    expect(entryPane().find('.definition em').text().toLowerCase()).toBe('buddha')
  })

  it('should ask to choose a term while results are shown and none is open', async () => {
    await mountAt('/search?q=buddha')
    expect(wrapper.find('[data-testid="search-pick"]').exists()).toBe(true)
    await results()[0].trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="search-pick"]').exists()).toBe(false)
  })

  it('should show five examples to try when there is no query', async () => {
    await mountAt('/search')
    expect(wrapper.find('[data-testid="search-home"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="search-home-example"]')).toHaveLength(5)
  })

  it('should search an example when its row is clicked', async () => {
    await mountAt('/search')
    await wrapper.findAll('[data-testid="search-home-example"]')[2].trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/search')
    expect(router.currentRoute.value.query).toEqual({ q: 'seven & limbs' })
    expect(wrapper.find('[data-testid="search-home"]').exists()).toBe(false)
  })

  it('should not ask to choose a term before any search', async () => {
    await mountAt('/search')
    expect(wrapper.find('[data-testid="search-pick"]').exists()).toBe(false)
  })

  it('should close the entry when another query is searched', async () => {
    await mountAt('/search?q=buddha')
    await results()[0].trigger('click')
    await flushPromises()
    await submit('letter')
    expect(entryPane().find('[data-testid="term-entry"]').exists()).toBe(false)
  })

  it('should open the highlighted result with Up, Down and Enter', async () => {
    await mountAt('/search')
    await submit('buddha')
    expect(results()).toHaveLength(2)
    expect(entryPane().find('[data-testid="term-entry"]').exists()).toBe(false)

    await input().trigger('keydown', { key: 'ArrowDown' })
    await input().trigger('keydown', { key: 'ArrowDown' })
    await input().trigger('keydown', { key: 'ArrowUp' })
    await nextTick()
    const selected = wrapper.find('[data-testid="lookup-result"].is-selected')
    expect(selected.find('[data-testid="lookup-result-term"]').text()).toBe(SANGS_RGYAS)

    await input().trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/search')
    expect(headword().text()).toBe(SANGS_RGYAS)
  })

  it('should search a query changed since instead of opening the highlighted result', async () => {
    await mountAt('/search?q=buddha')
    await input().trigger('keydown', { key: 'ArrowDown' })
    await input().setValue('letter')
    await input().trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ q: 'letter' })
    expect(entryPane().find('[data-testid="term-entry"]').exists()).toBe(false)
  })

  it('should open the entry full screen on a phone and come back with Search', async () => {
    window.innerWidth = 390
    await mountAt('/search?q=buddha')
    expect(wrapper.find('.lookup-page__title').text()).toBe('Search')
    expect(shown(entryPane())).toBe(false)

    await results()[1].trigger('click')
    await flushPromises()
    expect(shown(entryPane())).toBe(true)
    expect(shown(resultsPane())).toBe(false)
    expect(router.currentRoute.value.path).toBe('/search')
    const back = wrapper.get('[data-testid="search-back"]')
    expect(back.text()).toBe('Search')

    await back.trigger('click')
    await flushPromises()
    expect(shown(resultsPane())).toBe(true)
    expect(shown(entryPane())).toBe(false)
    expect(input().element.value).toBe('buddha')
    expect(results()).toHaveLength(2)
  })

  it('should show the previous queries on a phone while there is no query', async () => {
    window.innerWidth = 390
    Storage.set('previousQueries', ['wisdom'])
    await mountAt('/search')
    expect(wrapper.find('[data-testid="lookup-previous"]').exists()).toBe(true)
  })

  it('should search a previous query picked from the list', async () => {
    Storage.set('previousQueries', ['wisdom', 'compassion'])
    await mountAt('/search')
    await wrapper.findAll('[data-testid="lookup-previous-query"]')[1].trigger('click')
    await flushPromises()
    expect(input().element.value).toBe('compassion')
    expect(router.currentRoute.value.query).toEqual({ q: 'compassion' })
    expect(results()).toHaveLength(2)
  })
})

describe('Search — the way to Define', () => {
  it('should offer looking up a Tibetan term that exists', async () => {
    await mountAt('/search')
    await input().setValue(KA)
    expect(lookUpHint().exists()).toBe(true)
    expect(lookUpHint().text()).toContain(KA)
    expect(lookUpHint().text()).toContain('Define')
  })

  it('should open the term in Define when the hint is followed', async () => {
    await mountAt('/search')
    await input().setValue(KA)
    await lookUpHint().find('button').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/define/' + encodeURIComponent(KA))
  })

  it('should not offer looking up English text', async () => {
    await mountAt('/search')
    await input().setValue('wisdom')
    expect(lookUpHint().exists()).toBe(false)
  })

  it('should not offer looking up Tibetan that is no term', async () => {
    await mountAt('/search')
    await input().setValue('ཁཁ་')
    expect(lookUpHint().exists()).toBe(false)
  })

  it('should not offer looking up Tibetan mixed with Latin', async () => {
    await mountAt('/search')
    await input().setValue(KA + ' wisdom')
    expect(lookUpHint().exists()).toBe(false)
  })

  it('should stop offering it once the field is cleared', async () => {
    await mountAt('/search')
    await input().setValue(KA)
    await wrapper.get('[data-testid="ui-text-field-clear"]').trigger('click')
    await flushPromises()
    expect(lookUpHint().exists()).toBe(false)
  })
})

describe('Search — the definitions of one dictionary', () => {
  it('should search only the definitions of the dictionary the link names', async () => {
    await mountAt('/search?dict=MyGlossary&q=buddha')
    expect(resultTerms()).toEqual([KA])
    expect(only().text()).toContain('MyGlossary')
    expect(wrapper.find('[data-testid="search-read-as"]').text()).toContain('in MyGlossary')
  })

  it('should show the chip and keep the query there was when only a dictionary is named', async () => {
    await mountAt('/search?dict=MyGlossary')
    expect(only().exists()).toBe(true)
    expect(page().vm.onlyDictionary).toBe('MyGlossary')
  })

  it('should keep to that dictionary when another query is typed', async () => {
    await mountAt('/search?dict=MyGlossary&q=buddha')
    await submit('letter')
    expect(router.currentRoute.value.query).toEqual({ q: 'letter', dict: 'MyGlossary' })
  })

  it('should keep to that dictionary when the field is cleared', async () => {
    await mountAt('/search?dict=MyGlossary&q=buddha')
    await wrapper.get('[data-testid="ui-text-field-clear"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ dict: 'MyGlossary' })
    expect(only().exists()).toBe(true)
  })

  it('should search every dictionary again with the ×, keeping the query', async () => {
    await mountAt('/search?dict=MyGlossary&q=buddha')
    const clear = only().find('button')
    expect(clear.attributes('aria-label')).toBe('Search every dictionary')
    await clear.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ q: 'buddha' })
    expect(only().exists()).toBe(false)
    expect(resultTerms()).toEqual([SANGS_RGYAS, KA])
  })

  it('should not show the chip when no dictionary is named', async () => {
    await mountAt('/search?q=buddha')
    expect(only().exists()).toBe(false)
  })
})

describe('Search — results width', () => {
  const handle = () => wrapper.findComponent({ name: 'UiResizeHandle' })
  const widthStyle = () => wrapper.find('[data-testid="search-page"]').element.style.getPropertyValue('--results-width')

  beforeEach(() => Storage.delete('lookupResultsWidth'))

  it('should leave the results their default width until the divider is moved', async () => {
    await mountAt('/search')
    expect(handle().exists()).toBe(true)
    expect(widthStyle()).toBe('')
  })

  it('should give the results the width the divider is dragged to, and remember it', async () => {
    await mountAt('/search')
    handle().vm.$emit('update:modelValue', 520)
    await nextTick()
    expect(widthStyle()).toContain('520px')
    expect(Storage.get('lookupResultsWidth')).toBe(520)
  })

  it('should open with the width chosen before', async () => {
    Storage.set('lookupResultsWidth', 480)
    await mountAt('/search')
    expect(widthStyle()).toContain('480px')
  })
})

describe('Search — Back and Forward', () => {
  const entryOpen = () => entryPane().find('[data-testid="term-entry"]').exists()
  const searchPath = (query) => router.resolve({ path: '/search', query }).fullPath
  let push
  let replace

  function spyOnRouter() {
    push = vi.spyOn(router, 'push')
    replace = vi.spyOn(router, 'replace')
  }

  beforeEach(() => {
    historyState.back = null
    historyState.forward = null
  })

  it('should push the route with the term when a result is clicked', async () => {
    await mountAt('/search?q=buddha')
    spyOnRouter()

    await results()[1].trigger('click')
    await flushPromises()

    expect(push).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith({ path: '/search', query: { q: 'buddha', term: KA } })
    expect(replace).not.toHaveBeenCalled()
  })

  it('should close the entry when Back returns to the route without a term', async () => {
    await mountAt('/search?q=buddha')
    await results()[1].trigger('click')
    await flushPromises()
    expect(entryOpen()).toBe(true)

    router.back()
    await vi.waitFor(() => expect(router.currentRoute.value.query).toEqual({ q: 'buddha' }))
    await flushPromises()

    expect(entryOpen()).toBe(false)
    expect(page().vm.selectedTerm).toBe('')
  })

  it('should open the entry again when Forward returns to the route with a term', async () => {
    await mountAt('/search?q=buddha')
    await results()[1].trigger('click')
    await flushPromises()
    router.back()
    await vi.waitFor(() => expect(entryOpen()).toBe(false))

    router.forward()
    await vi.waitFor(() => expect(router.currentRoute.value.query).toEqual({ q: 'buddha', term: KA }))
    await flushPromises()

    expect(headword().text()).toBe(KA)
  })

  it('should push a query typed while an entry is open', async () => {
    await mountAt('/search?q=buddha&term=' + encodeURIComponent(KA))
    spyOnRouter()

    await input().setValue('letter')
    await vi.waitFor(() => expect(push).toHaveBeenCalledTimes(1), { timeout: 2000 })

    expect(push).toHaveBeenCalledWith({ path: '/search', query: { q: 'letter' } })
    expect(replace).not.toHaveBeenCalled()
  })

  it('should return to the entry with Back after a query typed while it was open', async () => {
    await mountAt('/search?q=buddha&term=' + encodeURIComponent(KA))
    await input().setValue('letter')
    await vi.waitFor(() => expect(router.currentRoute.value.query).toEqual({ q: 'letter' }), { timeout: 2000 })
    await flushPromises()

    router.back()
    await vi.waitFor(() => expect(router.currentRoute.value.query).toEqual({ q: 'buddha', term: KA }))
    await flushPromises()

    expect(input().element.value).toBe('buddha')
    expect(headword().text()).toBe(KA)
  })

  it('should replace the route with a query typed while no entry is open', async () => {
    await mountAt('/search?q=buddha')
    spyOnRouter()

    await input().setValue('letter')
    await vi.waitFor(() => expect(replace).toHaveBeenCalledTimes(1), { timeout: 2000 })

    expect(replace).toHaveBeenCalledWith({ path: '/search', query: { q: 'letter' } })
    expect(push).not.toHaveBeenCalled()
  })

  it('should keep the open term when the × of the dictionary chip is used', async () => {
    await mountAt('/search?dict=MyGlossary&q=buddha&term=' + encodeURIComponent(KA))
    expect(only().exists()).toBe(true)

    await only().find('button').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ q: 'buddha', term: KA })
    expect(headword().text()).toBe(KA)
  })

  it('should show the entry of the term of the route when mounted on it', async () => {
    await mountAt('/search?q=buddha&term=' + encodeURIComponent(SANGS_RGYAS))
    expect(headword().text()).toBe(SANGS_RGYAS)
    expect(input().element.value).toBe('buddha')
  })

  describe('on a phone', () => {
    beforeEach(() => {
      window.innerWidth = 390
    })

    it('should show the entry full screen when mounted on a route with a term', async () => {
      await mountAt('/search?q=buddha&term=' + encodeURIComponent(SANGS_RGYAS))
      expect(shown(entryPane())).toBe(true)
      expect(shown(resultsPane())).toBe(false)
      expect(headword().text()).toBe(SANGS_RGYAS)
    })

    it('should show the results when Back returns to the route without a term', async () => {
      await mountAt('/search?q=buddha')
      await results()[1].trigger('click')
      await flushPromises()
      expect(shown(entryPane())).toBe(true)

      router.back()
      await vi.waitFor(() => expect(shown(resultsPane())).toBe(true))

      expect(shown(entryPane())).toBe(false)
    })

    it('should open the entry full screen when another page returns to a route with a term', async () => {
      await mountAt('/search?q=buddha')
      await go('/reader')
      await go('/search?q=buddha&term=' + encodeURIComponent(KA))

      expect(shown(entryPane())).toBe(true)
      expect(shown(resultsPane())).toBe(false)
    })

    it('should read Back and go back when the entry was reached from another entry', async () => {
      await mountAt('/search?q=buddha')
      await results()[1].trigger('click')
      await flushPromises()
      historyState.back = '/search?q=buddha&term=' + encodeURIComponent(SANGS_RGYAS)
      await nextTick()
      const link = wrapper.get('[data-testid="search-back"]')
      expect(link.text()).toBe('Back')
      const back = vi.spyOn(router, 'back').mockImplementation(() => {})
      spyOnRouter()

      await link.trigger('click')

      expect(back).toHaveBeenCalledTimes(1)
      expect(replace).not.toHaveBeenCalled()
    })

    it('should read Search and go back when the previous place is the same results', async () => {
      await mountAt('/search?q=buddha')
      await results()[1].trigger('click')
      await flushPromises()
      historyState.back = searchPath({ q: 'buddha' })
      await nextTick()
      const link = wrapper.get('[data-testid="search-back"]')
      expect(link.text()).toBe('Search')
      const back = vi.spyOn(router, 'back').mockImplementation(() => {})
      spyOnRouter()

      await link.trigger('click')

      expect(back).toHaveBeenCalledTimes(1)
      expect(replace).not.toHaveBeenCalled()
    })

    it('should read Search and replace the route with the results when the previous place is elsewhere', async () => {
      await mountAt('/search?q=buddha&term=' + encodeURIComponent(KA))
      historyState.back = '/reader'
      await nextTick()
      const link = wrapper.get('[data-testid="search-back"]')
      expect(link.text()).toBe('Search')
      const back = vi.spyOn(router, 'back').mockImplementation(() => {})
      spyOnRouter()

      await link.trigger('click')
      await flushPromises()

      expect(back).not.toHaveBeenCalled()
      expect(replace).toHaveBeenCalledWith(searchPath({ q: 'buddha' }))
      expect(router.currentRoute.value.query).toEqual({ q: 'buddha' })
      expect(shown(resultsPane())).toBe(true)
    })
  })
})
