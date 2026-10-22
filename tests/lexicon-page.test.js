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
 *    value. Leaving /glossary/A for /settings fired the watcher with
 *    `undefined` (harmlessly guarded); returning to /glossary/A fired it
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
 *  - Flaky scenario (d) (round 4): a route.replace() fired fire-and-forget
 *    from inside activated() -> syncSelection() resolves over a genuinely
 *    variable number of scheduler hops. A bounded flushPromises()+nextTick()
 *    loop (however generous) is a fixed guess against a non-deterministic
 *    wait and flaked ~20-65% of the time. Anywhere a test observes the
 *    result of a navigation it cannot await directly (fired from a lifecycle
 *    hook or a DOM event listener, whose return value nothing awaits), it
 *    now waits on the actual condition via vi.waitFor instead of a tick
 *    count. Navigations the test itself awaits directly
 *    (`await router.push(...)`, `await component.onSelectDictionary(...)`)
 *    do not have this problem for computed reads, which are live the moment
 *    the awaited promise resolves — but a resulting re-render (e.g.
 *    <keep-alive> swapping which component is mounted) or a watcher's side
 *    effect is still scheduled asynchronously by Vue itself, so those are
 *    also asserted through vi.waitFor rather than assumed to have happened
 *    by the next line.
 *
 * These tests mount a small Shell that reproduces App.vue's actual
 * <router-view><keep-alive :key="currentTabId"> structure (App.vue:342-346),
 * not a bare LexiconPage — a bare mount cannot observe deactivation at all,
 * which is exactly why the round-2 regression passed review undetected.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { ref, nextTick } from 'vue'

// LexiconPage is gated entirely behind supportsModularPacks(); force it on
// so the real page renders instead of the "desktop/mobile only" message.
// isMobile() decides whether to listen for dropped spreadsheets.
vi.mock('../src/config/platform.js', () => ({
  isTauri: () => true,
  isMobile: () => false,
  supportsModularPacks: () => true,
}))

// The page also hosts the list of the user's own dictionaries.
vi.mock('../src/services/pack-manager', () => ({
  default: { customPacks: [], removeCustomPack: vi.fn() },
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

const saveDialogMock = vi.fn()
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: (...args) => saveDialogMock(...args),
}))

import LexiconPage from '../src/components/LexiconPage.vue'

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
      { path: '/glossary/:packId?/:dictionaryId?', component: LexiconPage },
    ],
  })
  router.push(initialPath)
  return router
}

// Mirrors App.vue:342-346 exactly: <router-view> handing its resolved
// Component to a <keep-alive> keyed on the first path segment. This is what
// makes LexiconPage genuinely activate/deactivate as the route moves in and
// out of "/glossary/...", instead of just being patched in place or torn down
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

// Every shell mounted by a test, unmounted after it: the page's dialogs and
// tooltips keep Teleport anchors in document.body, and clearing the body
// under a still-mounted shell breaks its next re-render.
const mountedShells = []

async function mountShell(initialPath, dictionaries) {
  dictionariesRef.value = dictionaries
  const router = makeRouter(initialPath)
  await router.isReady()
  const wrapper = mount(Shell, {
    global: {
      plugins: [router],
      stubs: { LexiconEntryDialog: true },
      provide: { snackbar },
    },
  })
  mountedShells.push(wrapper)
  // One tick for the initial render. If the initial route requires
  // syncSelection() to fall back and navigate (e.g. bare /glossary — scenario
  // d), that navigation is fire-and-forget from activated()'s point of view
  // as far as this helper is concerned; callers that depend on its outcome
  // wait on the actual condition via vi.waitFor rather than assuming this
  // single flush was enough.
  await flushPromises()
  return { wrapper, router }
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
    mountedShells.splice(0).forEach((wrapper) => wrapper.unmount())
    document.body.innerHTML = ''
  })

  describe('route-driven selection', () => {
    it('(a) follows a route change to a second pack while the page is already showing the first', async () => {
      const { wrapper, router } = await mountShell('/glossary/custom-a', [PACK_A, PACK_B])
      expect(lexiconPage(wrapper).vm.selected?.packId).toBe('custom-a')

      // Mirrors CustomPackSection.vue's onManage(pack): router.push(`/glossary/${pack.id}`).
      // Directly awaited by the test, so the navigation itself is not the
      // uncertain part here — `selected` is a computed reading $route.params
      // and is live the instant the awaited push() resolves.
      await router.push('/glossary/custom-b')

      expect(lexiconPage(wrapper).vm.selected?.packId).toBe('custom-b')
    })

    it('(b) preserves a manual dropdown choice across a real deactivate/reactivate round trip through Settings', async () => {
      const { wrapper, router } = await mountShell('/glossary/custom-a', [PACK_A, PACK_B])
      expect(lexiconPage(wrapper).vm.selected?.packId).toBe('custom-a')

      // Manual choice via the dropdown navigates rather than mutating local
      // state, and the test awaits that navigation directly.
      await lexiconPage(wrapper).vm.onSelectDictionary('custom-b:1')
      expect(router.currentRoute.value.path).toBe('/glossary/custom-b/1')
      expect(lexiconPage(wrapper).vm.selected?.packId).toBe('custom-b')

      // Leave to Settings. This must be a REAL deactivation — the whole
      // point of this harness — not just data surviving in a bare mount.
      // <keep-alive> swapping which component is mounted is a Vue re-render
      // triggered by the route change, scheduled on Vue's own microtask
      // queue rather than returned by router.push()'s promise, so this is
      // exactly a "result of a navigation the test cannot await directly" —
      // wait on the condition, not an assumed tick count.
      await router.push('/settings')
      await vi.waitFor(() => {
        expect(lexiconPage(wrapper).exists()).toBe(false)
      })

      // Come back to exactly the URL the dropdown pick left behind.
      await router.push('/glossary/custom-b/1')
      await vi.waitFor(() => {
        expect(lexiconPage(wrapper).exists()).toBe(true)
      })

      expect(lexiconPage(wrapper).vm.selected?.packId).toBe('custom-b')
    })

    it('(c) falls back to a remaining pack, and the route follows, when the selected dictionary is deleted', async () => {
      const { wrapper, router } = await mountShell('/glossary/custom-a', [PACK_A, PACK_B])
      expect(lexiconPage(wrapper).vm.selected?.packId).toBe('custom-a')

      // Pack A is removed elsewhere (e.g. from Settings); only B remains.
      // The real app learns this via the 'dictionaries-updated' CustomEvent
      // LexiconPage listens for in mounted(). Nothing can await that
      // listener's return value (the DOM event system discards it) or the
      // fallback navigation syncSelection() fires from inside it — this is
      // exactly the "cannot await directly" case, so wait on the condition.
      dictionariesRef.value = [PACK_B]
      window._triggerEvent('dictionaries-updated')

      await vi.waitFor(() => {
        expect(router.currentRoute.value.path).toBe('/glossary/custom-b/1')
      })
      expect(lexiconPage(wrapper).vm.selected?.packId).toBe('custom-b')
    })

    it('(d) picks the first available dictionary, and navigates there, when arriving at bare /glossary', async () => {
      const { wrapper, router } = await mountShell('/glossary', [PACK_A, PACK_B])

      // The fix for this exact test's flakiness (round 4): syncSelection()'s
      // fallback navigation is fired from activated(), which the test never
      // calls or awaits itself — only vi.waitFor's retrying, not a fixed
      // tick count, reliably observes when it has actually settled.
      await vi.waitFor(() => {
        expect(router.currentRoute.value.path).toBe('/glossary/custom-a/1')
      })
      expect(lexiconPage(wrapper).vm.selected?.packId).toBe('custom-a')
    })

    it('(e) a multi-dictionary pack: selecting its second dictionary survives a deactivate/reactivate round trip', async () => {
      const { wrapper, router } = await mountShell('/glossary/custom-c/1', [PACK_C_D1, PACK_C_D2])
      expect(lexiconPage(wrapper).vm.selected?.dictionaryId).toBe(1)

      await lexiconPage(wrapper).vm.onSelectDictionary('custom-c:2')
      expect(router.currentRoute.value.path).toBe('/glossary/custom-c/2')

      await router.push('/settings')
      await vi.waitFor(() => {
        expect(lexiconPage(wrapper).exists()).toBe(false)
      })

      // A packId-only route could not have distinguished this from volume 1.
      await router.push('/glossary/custom-c/2')
      await vi.waitFor(() => {
        expect(lexiconPage(wrapper).exists()).toBe(true)
      })

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

      const { wrapper } = await mountShell('/glossary/custom-a', [PACK_A])
      const page = lexiconPage(wrapper)

      // Simulate having been on page 2 of what was, before the delete, a
      // 51-entry / 2-page dictionary.
      page.vm.page = 2

      // confirmRemove() awaits the delete but not the load() it kicks off
      // afterwards (unchanged from earlier rounds — not touched this round
      // per instruction), so its completion is still observed by waiting on
      // the condition rather than assuming a single flush is enough.
      // The delete now goes through a confirmation dialog (promptRemove
      // stages the target, confirmRemove performs the delete) rather than
      // deleting immediately — see the final-review fix for BLOCKING 2.
      page.vm.promptRemove({ id: 999, term: 'x', definition: 'y' })
      await page.vm.confirmRemove()
      await vi.waitFor(() => {
        expect(page.vm.page).toBe(1)
      })

      expect(deleteEntryMock).toHaveBeenCalledWith('custom-a', 999)
      expect(page.vm.entries.length).toBe(50)
      expect(page.vm.total).toBe(50)
    })

    it('resets to page 1 when the selected dictionary changes', async () => {
      entriesMock.mockResolvedValue({
        total: 10,
        entries: [{ id: 1, term: 'a', definition: 'b' }],
      })
      const { wrapper } = await mountShell('/glossary/custom-a', [PACK_A, PACK_B])
      const page = lexiconPage(wrapper)

      page.vm.page = 3
      // onSelectDictionary's navigation is directly awaited, but the
      // resulting `page = 1` reset happens inside the selectedKey watcher,
      // which Vue schedules on its own microtask queue rather than exposing
      // through the navigation promise — wait on the condition.
      await page.vm.onSelectDictionary('custom-b:1')
      await vi.waitFor(() => {
        expect(page.vm.page).toBe(1)
      })
    })
  })

  describe('the redrawn page', () => {
    const ROWS = [
      { id: 1, term: 'ཡེ་ཤེས་', definition: 'wisdom' },
      { id: 2, term: 'སྙིང་རྗེ་', definition: 'compassion\nsecond line' },
    ]
    const testid = (wrapper, id) => wrapper.find(`[data-testid="${id}"]`)

    afterEach(() => {
      window.innerWidth = 1024
    })

    it('lists the entries with the dictionary name and the count', async () => {
      entriesMock.mockResolvedValue({ total: 2, entries: ROWS })
      const { wrapper } = await mountShell('/glossary/custom-a', [PACK_A])
      await vi.waitFor(() => expect(wrapper.findAll('[data-testid="lexicon-entry"]')).toHaveLength(2))

      expect(wrapper.find('.page-title').text()).toBe('A')
      expect(wrapper.text()).toContain('ཡེ་ཤེས་')
      expect(wrapper.text()).toContain('compassion')
      expect(testid(wrapper, 'lexicon-count').text()).toContain('2 entries.')
      // A single dictionary needs no switcher
      expect(testid(wrapper, 'lexicon-switcher').exists()).toBe(false)
    })

    it('offers the switcher once there is more than one dictionary', async () => {
      const { wrapper } = await mountShell('/glossary/custom-a', [PACK_A, PACK_B])
      expect(testid(wrapper, 'lexicon-switcher').exists()).toBe(true)
    })

    it('says why the list is empty', async () => {
      const { wrapper } = await mountShell('/glossary/custom-a', [PACK_A])
      expect(testid(wrapper, 'lexicon-empty-list').text()).toContain('This dictionary is empty')

      lexiconPage(wrapper).vm.search = 'zzz'
      await nextTick()
      expect(testid(wrapper, 'lexicon-empty-list').text()).toBe('No entry matches this search.')
      expect(testid(wrapper, 'lexicon-count').text()).toContain('0 entries matching')
    })

    it('opens the entry dialog on a row from its Edit button', async () => {
      entriesMock.mockResolvedValue({ total: 2, entries: ROWS })
      const { wrapper } = await mountShell('/glossary/custom-a', [PACK_A])
      await vi.waitFor(() => expect(wrapper.findAll('[data-testid="lexicon-edit"]')).toHaveLength(2))

      await wrapper.findAll('[data-testid="lexicon-edit"]')[1].trigger('click')
      const dialog = wrapper.findComponent({ name: 'LexiconEntryDialog' })
      expect(dialog.props('modelValue')).toBe(true)
      expect(dialog.props('entry')).toEqual(ROWS[1])
      expect(dialog.props('deletable')).toBe(false)
    })

    it('asks before deleting a row, then deletes it', async () => {
      entriesMock.mockResolvedValue({ total: 2, entries: ROWS })
      deleteEntryMock.mockResolvedValue(undefined)
      const { wrapper } = await mountShell('/glossary/custom-a', [PACK_A])
      await vi.waitFor(() => expect(wrapper.findAll('[data-testid="lexicon-delete"]')).toHaveLength(2))

      await wrapper.findAll('[data-testid="lexicon-delete"]')[0].trigger('click')
      await flushPromises()
      expect(deleteEntryMock).not.toHaveBeenCalled()
      expect(document.body.textContent).toContain('Delete this entry?')
      expect(document.body.textContent).toContain('This cannot be undone.')

      document.body.querySelector('[data-testid="lexicon-confirm-delete"]').click()
      await flushPromises()
      expect(deleteEntryMock).toHaveBeenCalledWith('custom-a', 1)
      expect(snackbar.open).toHaveBeenCalledWith('Entry removed')
    })

    it('exports in the format picked from the Export menu', async () => {
      saveDialogMock.mockResolvedValue(null)
      const { wrapper } = await mountShell('/glossary/custom-a', [PACK_A])
      const page = lexiconPage(wrapper)

      await page.vm.onExport({ key: 'xlsx' })
      expect(saveDialogMock.mock.calls.at(-1)[0].defaultPath).toBe('A.xlsx')

      await page.vm.onExport({ key: 'tibdict' })
      expect(saveDialogMock.mock.calls.at(-1)[0].defaultPath).toBe('A.tibdict')
    })

    it('hosts the list of the user\'s own dictionaries', async () => {
      const { wrapper } = await mountShell('/glossary/custom-a', [PACK_A])
      expect(testid(wrapper, 'custom-pack-section').exists()).toBe(true)
    })

    it('on a phone, shows rows as cards that open the entry, with Delete in the dialog', async () => {
      window.innerWidth = 390
      entriesMock.mockResolvedValue({ total: 2, entries: ROWS })
      const { wrapper, router } = await mountShell('/glossary/custom-a', [PACK_A])
      await vi.waitFor(() => expect(wrapper.findAll('[data-testid="lexicon-entry"]')).toHaveLength(2))

      expect(testid(wrapper, 'lexicon-edit').exists()).toBe(false)
      await wrapper.findAll('[data-testid="lexicon-entry"]')[0].trigger('click')
      const dialog = wrapper.findComponent({ name: 'LexiconEntryDialog' })
      expect(dialog.props('entry')).toEqual(ROWS[0])
      expect(dialog.props('deletable')).toBe(true)

      dialog.vm.$emit('delete', ROWS[0])
      await flushPromises()
      expect(lexiconPage(wrapper).vm.removeTarget).toEqual(ROWS[0])
      expect(lexiconPage(wrapper).vm.removeOpen).toBe(true)

      await testid(wrapper, 'lexicon-back').trigger('click')
      await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/settings'))
    })
  })
})
