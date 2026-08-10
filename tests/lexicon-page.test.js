/**
 * LexiconPage Component Tests
 *
 * Covers two Critical review findings on Task 8:
 *
 *  - Critical 1: syncSelection()'s `stillThere` short-circuit never consulted
 *    $route.params.packId once a dictionary was already selected. App.vue's
 *    <keep-alive> keys route components on the first path segment
 *    ("lexicon"), so /lexicon/:packId navigations reuse ONE LexiconPage
 *    instance for the whole session — clicking "Manage entries" on a second
 *    pack from Settings silently kept showing the first one.
 *
 *  - Critical 2: deleting the last entry on the final page left `page`
 *    pointing past the end. pageCount recomputed to 1, the v-pagination
 *    control (v-if="pageCount > 1") disappeared, and the user was stranded
 *    on an empty page with no way to get back to page 1.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { ref } from 'vue'

// LexiconPage is gated entirely behind supportsModularPacks(); force it on
// so the real page renders instead of the "desktop/mobile only" message.
vi.mock('../src/config/platform.js', () => ({
  isTauri: () => true,
  supportsModularPacks: () => true,
}))

// Backed by a real Vue ref rather than a plain array: the real
// Lexicon.editableDictionaries() reads PackManager.customPacks, a reactive
// array, which is what lets LexiconPage's `dictionaryOptions` computed
// re-evaluate whenever the pack list changes. A vi.fn() returning a plain
// array gives that computed nothing reactive to depend on, so it would
// evaluate once and cache forever — silently hiding exactly the kind of
// "packs changed underneath the page" scenario these tests exist to cover.
const dictionariesRef = ref([])
const editableDictionariesMock = vi.fn(() => dictionariesRef.value)
const entriesMock = vi.fn()
const deleteEntryMock = vi.fn()

// Mock only the Tauri-backed reads/writes. Keep everything else (normalizeTerm,
// slugForName, ...) real — none of it is exercised by LexiconPage directly.
vi.mock('../src/services/lexicon', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    default: {
      ...actual.default,
      editableDictionaries: (...args) => editableDictionariesMock(...args),
      entries: (...args) => entriesMock(...args),
      deleteEntry: (...args) => deleteEntryMock(...args),
    },
  }
})

import LexiconPage from '../src/components/LexiconPage.vue'

const vuetify = createVuetify({ components, directives })
const snackbar = { open: vi.fn() }

const PACK_A = { packId: 'custom-a', dictionaryId: 1, packName: 'A', name: 'A', entriesCount: 1 }
const PACK_B = { packId: 'custom-b', dictionaryId: 1, packName: 'B', name: 'B', entriesCount: 1 }

function makeRouter(initialPath) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/lexicon', component: { template: '<div/>' } },
      { path: '/lexicon/:packId', component: { template: '<div/>' } },
    ],
  })
  router.push(initialPath)
  return router
}

// Mounts LexiconPage and simulates its first activation under <keep-alive>.
// activated() (which calls syncSelection() + load()) is only ever invoked by
// the real KeepAlive machinery, which a bare mount() does not provide, so we
// call the same methods directly — this is exactly what activated() does on
// first entry.
async function mountPage(initialPath, dictionaries) {
  dictionariesRef.value = dictionaries
  const router = makeRouter(initialPath)
  await router.isReady()
  const wrapper = mount(LexiconPage, {
    global: {
      plugins: [vuetify, router],
      stubs: { LexiconEntryDialog: true },
      provide: { snackbar },
    },
  })
  wrapper.vm.syncSelection()
  await wrapper.vm.load()
  await flushPromises()
  return { wrapper, router }
}

describe('LexiconPage', () => {
  beforeEach(() => {
    dictionariesRef.value = []
    editableDictionariesMock.mockClear()
    entriesMock.mockReset()
    deleteEntryMock.mockReset()
    entriesMock.mockResolvedValue({ total: 0, entries: [] })
    snackbar.open.mockClear()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('route-driven selection (Critical 1)', () => {
    it('follows a route change to a second pack while the page is already showing the first', async () => {
      const { wrapper, router } = await mountPage('/lexicon/custom-a', [PACK_A, PACK_B])
      expect(wrapper.vm.selected?.packId).toBe('custom-a')

      await router.push('/lexicon/custom-b')
      await flushPromises()

      expect(wrapper.vm.selected?.packId).toBe('custom-b')
    })

    it('keeps a manual dropdown choice when re-activated without a route change', async () => {
      const { wrapper } = await mountPage('/lexicon/custom-a', [PACK_A, PACK_B])

      // Manual choice via the dropdown — the route still says custom-a.
      wrapper.vm.selectedKey = 'custom-b:1'
      await flushPromises()

      // Re-activation (e.g. leaving to Settings and coming back to the exact
      // same /lexicon/custom-a route) must not override a still-valid manual
      // choice.
      wrapper.vm.syncSelection()
      await flushPromises()

      expect(wrapper.vm.selected?.packId).toBe('custom-b')
    })

    it('falls back to a remaining pack when the selected dictionary is deleted', async () => {
      const { wrapper } = await mountPage('/lexicon/custom-a', [PACK_A, PACK_B])
      expect(wrapper.vm.selected?.packId).toBe('custom-a')

      // Pack A is removed elsewhere (e.g. from Settings); only B remains.
      dictionariesRef.value = [PACK_B]
      wrapper.vm.syncSelection()
      await flushPromises()

      expect(wrapper.vm.selected?.packId).toBe('custom-b')
    })

    it('picks the first available pack when arriving at /lexicon with no packId', async () => {
      const { wrapper } = await mountPage('/lexicon', [PACK_A, PACK_B])
      expect(wrapper.vm.selected?.packId).toBe('custom-a')
    })
  })

  describe('pagination clamp on delete (Critical 2)', () => {
    it('clamps back to a valid page and reloads when deleting the last entry on the final page', async () => {
      const fullPage = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        term: `term${i}`,
        definition: 'd',
      }))
      // Mirrors the real backend: total is a plain COUNT(*) independent of
      // offset, and an out-of-range offset returns zero rows, not an error.
      entriesMock.mockImplementation((packId, dictionaryId, { offset }) => {
        if (offset === 0) return Promise.resolve({ total: 50, entries: fullPage })
        return Promise.resolve({ total: 50, entries: [] })
      })
      deleteEntryMock.mockResolvedValue(undefined)

      const { wrapper } = await mountPage('/lexicon/custom-a', [PACK_A])

      // Simulate having been on page 2 of what was, before the delete, a
      // 51-entry / 2-page dictionary.
      wrapper.vm.page = 2

      await wrapper.vm.remove({ id: 999, term: 'x', definition: 'y' })
      await flushPromises()

      expect(deleteEntryMock).toHaveBeenCalledWith('custom-a', 999)
      expect(wrapper.vm.page).toBe(1)
      expect(wrapper.vm.entries.length).toBe(50)
      expect(wrapper.vm.total).toBe(50)
    })

    it('resets to page 1 when the selected dictionary changes', async () => {
      entriesMock.mockResolvedValue({
        total: 10,
        entries: [{ id: 1, term: 'a', definition: 'b' }],
      })
      const { wrapper } = await mountPage('/lexicon/custom-a', [PACK_A, PACK_B])

      wrapper.vm.page = 3
      wrapper.vm.selectedKey = 'custom-b:1'
      await flushPromises()

      expect(wrapper.vm.page).toBe(1)
    })
  })
})
