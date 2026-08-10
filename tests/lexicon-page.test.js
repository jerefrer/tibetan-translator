/**
 * LexiconPage Component Tests
 *
 * Covers three review rounds on Task 8's lexicon management page:
 *
 *  - Critical 1 (round 1): syncSelection()'s `stillThere` short-circuit never
 *    consulted $route.params.packId once a dictionary was already selected,
 *    so clicking "Manage entries" on a second pack silently kept showing the
 *    first one.
 *
 *  - Critical 1 regression (round 2): the fix for the above — a
 *    '$route.params.packId' watcher writing into a separate `selectedKey`
 *    data field — only compared against the IMMEDIATELY PRECEDING watched
 *    value. Leaving /lexicon/A for /settings fired the watcher with
 *    `undefined` (harmlessly guarded); returning to /lexicon/A fired it
 *    again with 'A', indistinguishable from a fresh navigation, so it
 *    unconditionally clobbered a manual dropdown choice of B made earlier in
 *    the same session. This is why LexiconPage now derives `selected`
 *    (and `selectedKey`) directly from $route.params — there is no second,
 *    mutable copy of "which dictionary is selected" left to go stale.
 *
 *  - Critical 2: deleting the last entry on the final page left `page`
 *    pointing past the end; pageCount recomputed to 1, v-pagination
 *    (v-if="pageCount > 1") disappeared, and the user was stranded on an
 *    empty page with no control left to get back to page 1.
 *
 * These tests mount a small Shell that reproduces App.vue's actual
 * <router-view><keep-alive :key="currentTabId"> structure (App.vue:342-346),
 * not a bare LexiconPage — a bare mount cannot observe deactivation at all,
 * which is exactly why the round-2 regression passed review undetected.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { ref, nextTick } from 'vue'

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
// A single pack with two dictionaries — only expressible on the route once
// dictionaryId is part of it (scenario e).
const PACK_C_D1 = {
  packId: 'custom-c',
  dictionaryId: 1,
  packName: 'C',
  name: 'C — volume 1',
  entriesCount: 1,
}
const PACK_C_D2 = {
  packId: 'custom-c',
  dictionaryId: 2,
  packName: 'C',
  name: 'C — volume 2',
  entriesCount: 1,
}

function makeRouter(initialPath) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/settings', component: { template: '<div class="settings-stub" />' } },
      // Matches src/router.js exactly.
      { path: '/lexicon/:packId?/:dictionaryId?', component: LexiconPage },
    ],
  })
  router.push(initialPath)
  return router
}

// Mirrors App.vue:342-346 exactly: <router-view> handing its resolved
// Component to a <keep-alive> keyed on the first path segment. This is what
// makes LexiconPage genuinely activate/deactivate as the route moves in and
// out of "/lexicon/...", instead of just being patched in place or torn down
// — the real mechanics a bare mount() cannot exercise.
const Shell = {
  name: 'Shell',
  template: `
    <router-view v-slot="{ Component }">
      <keep-alive>
        <component :is="Component" :key="currentTabId" />
      </keep-alive>
    </router-view>
  `,
  computed: {
    currentTabId() {
      return this.$route.path.split('/').filter(Boolean)[0] || ''
    },
  },
}

async function mountShell(initialPath, dictionaries) {
  dictionariesRef.value = dictionaries
  const router = makeRouter(initialPath)
  await router.isReady()
  const wrapper = mount(Shell, {
    global: {
      plugins: [vuetify, router],
      stubs: { LexiconEntryDialog: true },
      provide: { snackbar },
    },
  })
  await settle()
  return { wrapper, router }
}

// A router.replace()/push() triggered from inside a component method that
// nothing awaits (e.g. a fire-and-forget navigateTo() called from
// activated()) resolves over several chained microtask/scheduler hops —
// empirically more than one flushPromises() + nextTick() round in this
// environment. Rather than hardcode a fragile hop count everywhere a
// navigation might be triggered indirectly (a 'dictionaries-updated' event
// handler, for instance, whose return value nothing can await), loop enough
// rounds to reliably drain it.
async function settle() {
  for (let i = 0; i < 10; i += 1) {
    await flushPromises()
    await nextTick()
  }
}

// LexiconPage is nested inside the Shell's <router-view>/<keep-alive>; find
// it fresh each time rather than caching the reference, since keep-alive
// deactivation means it can legitimately stop existing in the render tree.
function lexiconPage(wrapper) {
  return wrapper.findComponent(LexiconPage)
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

  describe('route-driven selection', () => {
    it('(a) follows a route change to a second pack while the page is already showing the first', async () => {
      const { wrapper, router } = await mountShell('/lexicon/custom-a', [PACK_A, PACK_B])
      expect(lexiconPage(wrapper).vm.selected?.packId).toBe('custom-a')

      // Mirrors CustomPackSection.vue's onManage(pack): router.push(`/lexicon/${pack.id}`).
      await router.push('/lexicon/custom-b')
      await settle()

      expect(lexiconPage(wrapper).vm.selected?.packId).toBe('custom-b')
    })

    it('(b) preserves a manual dropdown choice across a real deactivate/reactivate round trip through Settings', async () => {
      const { wrapper, router } = await mountShell('/lexicon/custom-a', [PACK_A, PACK_B])
      expect(lexiconPage(wrapper).vm.selected?.packId).toBe('custom-a')

      // Manual choice via the dropdown navigates rather than mutating local state.
      await lexiconPage(wrapper).vm.onSelectDictionary('custom-b:1')
      await settle()
      expect(router.currentRoute.value.path).toBe('/lexicon/custom-b/1')
      expect(lexiconPage(wrapper).vm.selected?.packId).toBe('custom-b')

      // Leave to Settings. This must be a REAL deactivation — the whole
      // point of this harness — not just data surviving in a bare mount.
      await router.push('/settings')
      await settle()
      expect(lexiconPage(wrapper).exists()).toBe(false)

      // Come back to exactly the URL the dropdown pick left behind.
      await router.push('/lexicon/custom-b/1')
      await settle()

      expect(lexiconPage(wrapper).vm.selected?.packId).toBe('custom-b')
    })

    it('(c) falls back to a remaining pack, and the route follows, when the selected dictionary is deleted', async () => {
      const { wrapper, router } = await mountShell('/lexicon/custom-a', [PACK_A, PACK_B])
      expect(lexiconPage(wrapper).vm.selected?.packId).toBe('custom-a')

      // Pack A is removed elsewhere (e.g. from Settings); only B remains.
      // The real app learns this via the 'dictionaries-updated' CustomEvent
      // LexiconPage listens for in mounted(). Nothing can await that
      // listener's return value (the DOM event system discards it), so this
      // relies on settle()'s multi-round drain rather than a direct await.
      dictionariesRef.value = [PACK_B]
      window._triggerEvent('dictionaries-updated')
      await settle()

      expect(lexiconPage(wrapper).vm.selected?.packId).toBe('custom-b')
      expect(router.currentRoute.value.path).toBe('/lexicon/custom-b/1')
    })

    it('(d) picks the first available dictionary, and navigates there, when arriving at bare /lexicon', async () => {
      const { wrapper, router } = await mountShell('/lexicon', [PACK_A, PACK_B])

      expect(lexiconPage(wrapper).vm.selected?.packId).toBe('custom-a')
      expect(router.currentRoute.value.path).toBe('/lexicon/custom-a/1')
    })

    it('(e) a multi-dictionary pack: selecting its second dictionary survives a deactivate/reactivate round trip', async () => {
      const { wrapper, router } = await mountShell('/lexicon/custom-c/1', [PACK_C_D1, PACK_C_D2])
      expect(lexiconPage(wrapper).vm.selected?.dictionaryId).toBe(1)

      await lexiconPage(wrapper).vm.onSelectDictionary('custom-c:2')
      await settle()
      expect(router.currentRoute.value.path).toBe('/lexicon/custom-c/2')

      await router.push('/settings')
      await settle()
      expect(lexiconPage(wrapper).exists()).toBe(false)

      // A packId-only route could not have distinguished this from volume 1.
      await router.push('/lexicon/custom-c/2')
      await settle()

      expect(lexiconPage(wrapper).vm.selected?.dictionaryId).toBe(2)
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

      const { wrapper } = await mountShell('/lexicon/custom-a', [PACK_A])
      const page = lexiconPage(wrapper)

      // Simulate having been on page 2 of what was, before the delete, a
      // 51-entry / 2-page dictionary.
      page.vm.page = 2

      await page.vm.remove({ id: 999, term: 'x', definition: 'y' })
      await flushPromises()

      expect(deleteEntryMock).toHaveBeenCalledWith('custom-a', 999)
      expect(page.vm.page).toBe(1)
      expect(page.vm.entries.length).toBe(50)
      expect(page.vm.total).toBe(50)
    })

    it('resets to page 1 when the selected dictionary changes', async () => {
      entriesMock.mockResolvedValue({
        total: 10,
        entries: [{ id: 1, term: 'a', definition: 'b' }],
      })
      const { wrapper } = await mountShell('/lexicon/custom-a', [PACK_A, PACK_B])
      const page = lexiconPage(wrapper)

      page.vm.page = 3
      await page.vm.onSelectDictionary('custom-b:1')
      await settle()

      expect(page.vm.page).toBe(1)
    })
  })
})
