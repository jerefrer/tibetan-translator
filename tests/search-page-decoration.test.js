/**
 * SearchPage decoration regression.
 *
 * Decoration used to be called from the template, so every keystroke in the
 * search box (searchQuery is a render dependency) re-decorated every visible
 * entry — and the definition was highlighted twice. Decoration now lives in
 * the visibleGroups computed, which depends on the search-time cached terms
 * and not on searchQuery.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'

vi.mock('../src/services/sql-database', () => ({
  default: {
    allTerms: [],
    hasTerm: () => false,
    exec: vi.fn(async () => []),
  },
}))

vi.mock('../src/services/scan-service', () => ({
  getScanInfo: () => null,
}))

import SearchPage from '../src/components/SearchPage.vue'
import Decorator from '../src/services/decorator'
import Storage from '../src/services/storage'

const stub = (name) => ({ name, template: '<div />' })

function fakeEntries(count) {
  return Array.from({ length: count }, (_, i) => ({
    term: `ཀ${i}་`,
    definition: `ཀ་ཁ་ meaning ${i}`,
    dictionaryId: 1,
    dictionary: 'TsepakRigdzin',
    rank: -i,
    dictionaryPosition: 1,
  }))
}

async function mountPage() {
  Storage.set('dictionaries', [
    { id: 1, position: 1, enabled: true, label: 'Tsepak Rigdzin' },
  ])
  const wrapper = mount(SearchPage, {
    global: {
      mocks: {
        $route: { params: { query: 'ཀ' }, path: '/search/ཀ' },
        $router: { push: vi.fn(async () => {}), replace: vi.fn() },
      },
      provide: { snackbar: { open: vi.fn() } },
      stubs: {
        SearchBuilder: stub('SearchBuilder'),
        ResultsAndPaginationAndDictionaries: stub('ResultsAndPaginationAndDictionaries'),
        ScanViewer: stub('ScanViewer'),
        QuickAddDialog: stub('QuickAddDialog'),
      },
    },
  })
  // Let the search kicked off on mount settle (it resolves to no entries)
  // before seeding, or it would overwrite the fake entries.
  await flushPromises()
  wrapper.vm.cachedRegularTerms = ['ཀ']
  wrapper.vm.entries = fakeEntries(20)
  // Every row starts collapsed: open the first so its entries are decorated
  // and the test can read them
  wrapper.vm.openTerms = { [wrapper.vm.groups[0].term]: true }
  await nextTick()
  return wrapper
}

describe('SearchPage decoration', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('should not re-decorate any entry when the search input changes', async () => {
    const wrapper = await mountPage()
    expect(wrapper.vm.visibleGroups.length).toBe(20)

    const spy = vi.spyOn(Decorator, 'decorate')
    wrapper.vm.searchQuery = wrapper.vm.searchQuery + 'x'
    await nextTick()

    expect(spy).not.toHaveBeenCalled()
  })

  it('should carry decoratedTerm on each visible group and decoratedDefinition on its entries, leaving term raw', async () => {
    const wrapper = await mountPage()

    for (const group of wrapper.vm.visibleGroups) {
      expect(group.decoratedTerm).toEqual(expect.any(String))
      expect(group.decoratedTerm.length).toBeGreaterThan(0)
      expect(group.term).not.toContain('<')
      // A collapsed row carries only the preview, an open one its entries
      if (group.open) expect(group.preview).toBeNull()
      else expect(group.preview.decoratedDefinition).toEqual(expect.any(String))
      for (const entry of group.entries) {
        expect(entry.decoratedDefinition).toEqual(expect.any(String))
        expect(entry.decoratedDefinition.length).toBeGreaterThan(0)
        expect(entry.term).not.toContain('<')
      }
    }
  })

  it('should highlight the definition only once', async () => {
    const wrapper = await mountPage()

    const definition = wrapper.vm.visibleGroups[0].entries[0].decoratedDefinition
    expect(definition).toContain('<em>')
    expect(definition).not.toContain('<em><em>')
  })
})
