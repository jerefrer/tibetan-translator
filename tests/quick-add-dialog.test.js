/**
 * QuickAddDialog Component Tests
 *
 * Covers the quick-add gesture wired into DefinePage and SearchPage (Task 9):
 *  - Lexicon.saveEntry() returning null (unusable input) must not be treated
 *    as a successful save — same guard already proven for LexiconEntryDialog
 *    in lexicon-entry-dialog.test.js
 *  - when the user has no personal dictionary yet, the dialog offers an
 *    inline "create a dictionary" path instead of a term/definition form
 *  - when the incoming term prop already exists in the target dictionary,
 *    its definition is pre-loaded into the textarea for editing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { nextTick } from 'vue'

// happy-dom does not implement window.visualViewport, which Vuetify's
// VOverlay location strategy reads unconditionally once a v-dialog actually
// opens. Without this the dialog throws on mount instead of rendering.
if (typeof window.visualViewport === 'undefined') {
  window.visualViewport = {
    addEventListener: () => {},
    removeEventListener: () => {},
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

const editableDictionariesMock = vi.fn()
const entriesMock = vi.fn()
const saveEntryMock = vi.fn()
const createMock = vi.fn()

// Mock only the Tauri-backed calls on Lexicon. Keep normalizeTerm real, since
// the dialog's own lookup (loadExisting) and saveEntry's own validation path
// both depend on it producing the real lookup key.
vi.mock('../src/services/lexicon', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    default: {
      ...actual.default,
      editableDictionaries: (...args) => editableDictionariesMock(...args),
      entries: (...args) => entriesMock(...args),
      saveEntry: (...args) => saveEntryMock(...args),
      create: (...args) => createMock(...args),
    },
  }
})

import QuickAddDialog from '../src/components/QuickAddDialog.vue'

const vuetify = createVuetify({ components, directives })
const snackbar = { open: vi.fn() }

const ONE_TARGET = [
  { packId: 'custom-mine', dictionaryId: 1, packName: 'My Lexicon', name: 'My Lexicon', entriesCount: 1 },
]

describe('QuickAddDialog', () => {
  beforeEach(() => {
    editableDictionariesMock.mockReset().mockReturnValue(ONE_TARGET)
    entriesMock.mockReset().mockResolvedValue({ total: 0, entries: [] })
    saveEntryMock.mockReset()
    createMock.mockReset()
    snackbar.open.mockClear()
  })

  afterEach(() => {
    // v-dialog teleports into document.body and its leave transition isn't
    // guaranteed to finish (and thus detach its DOM) by the time
    // wrapper.unmount() returns, which otherwise leaks a previous test's
    // dialog markup into the next test's document.body queries.
    document.body.innerHTML = ''
  })

  const mountDialog = (props = {}) =>
    mount(QuickAddDialog, {
      props: {
        modelValue: true,
        term: '',
        ...props,
      },
      global: { plugins: [vuetify], provide: { snackbar } },
      attachTo: document.body,
    })

  // v-dialog teleports its content to document.body, outside the mounted
  // wrapper's own DOM subtree, so buttons must be located via the real DOM
  // rather than wrapper.find()/findAll().
  const findButton = (text) =>
    Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent.trim() === text || b.textContent.trim().includes(text)
    )

  it('does not emit "saved" or close the dialog when Lexicon.saveEntry resolves null', async () => {
    saveEntryMock.mockResolvedValue(null)
    const wrapper = mountDialog()
    wrapper.vm.localTerm = 'ཀ'
    wrapper.vm.definition = 'a letter'
    await nextTick()

    findButton('Save').click()
    await flushPromises()

    expect(saveEntryMock).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.vm.saving).toBe(false)
    expect(document.body.textContent).toContain('A Tibetan term is required.')

    wrapper.unmount()
  })

  it('offers to create a personal dictionary inline when none exists yet, instead of the term/definition form', async () => {
    editableDictionariesMock.mockReturnValue([])
    createMock.mockResolvedValue({ id: 'custom-new-lexicon', manifest: { name: 'New Lexicon' } })
    const wrapper = mountDialog({ term: 'ཀ' })
    await nextTick()

    expect(document.body.textContent).toContain("You don't have a personal dictionary yet.")
    expect(findButton('Save')).toBeUndefined()
    expect(findButton('Create')).toBeDefined()

    wrapper.vm.newLexiconName = 'New Lexicon'
    await nextTick()

    findButton('Create').click()
    await flushPromises()

    expect(createMock).toHaveBeenCalledWith('New Lexicon')
    expect(wrapper.vm.targetKey).toBe('custom-new-lexicon:1')
    expect(snackbar.open).toHaveBeenCalledWith('New Lexicon created')
    expect(wrapper.vm.saving).toBe(false)

    wrapper.unmount()
  })

  it('pre-loads the existing definition when the term is already in the target dictionary', async () => {
    entriesMock.mockResolvedValue({
      total: 1,
      entries: [{ id: 7, term: 'ཀ་', definition: 'existing definition' }],
    })
    // Mount closed first, then open — the prefill/lookup logic lives in the
    // modelValue watcher, which only fires on a false -> true transition
    // (exactly what happens when a caller flips its v-model open), not on
    // the initial prop value at mount time.
    const wrapper = mountDialog({ modelValue: false, term: 'ཀ' })
    await wrapper.setProps({ modelValue: true })
    await flushPromises()

    expect(entriesMock).toHaveBeenCalledWith('custom-mine', 1, {
      search: 'ཀ་',
      limit: 50,
      offset: 0,
    })
    expect(wrapper.vm.existingId).toBe(7)
    expect(wrapper.vm.definition).toBe('existing definition')
    expect(document.body.textContent).toContain('This term is already in My Lexicon')

    wrapper.unmount()
  })

  it('resets the saving flag when the dialog is reopened while a save is still in flight', async () => {
    let resolveSave
    saveEntryMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve
        })
    )
    const wrapper = mountDialog()
    wrapper.vm.localTerm = 'ཀ'
    wrapper.vm.definition = 'a letter'
    await nextTick()

    findButton('Save').click()
    await nextTick()
    expect(wrapper.vm.saving).toBe(true)

    // Parent closes the dialog (e.g. user dismisses it) while the save is
    // still pending, then reopens it later.
    await wrapper.setProps({ modelValue: false })
    await wrapper.setProps({ modelValue: true })

    expect(wrapper.vm.saving).toBe(false)

    resolveSave({ id: 1, created: true })
    await flushPromises()
    wrapper.unmount()
  })
})
