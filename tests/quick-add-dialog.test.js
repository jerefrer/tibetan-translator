/**
 * QuickAddDialog Component Tests
 *
 * Covers the quick-add gesture wired into DefinePage and SearchPage (Task 9),
 * plus the review-round fixes on top of it:
 *  - Lexicon.saveEntry() returning null (unusable input) must not be treated
 *    as a successful save — same guard already proven for LexiconEntryDialog
 *    in lexicon-entry-dialog.test.js
 *  - when the user has no personal dictionary yet, the dialog offers an
 *    inline "create a dictionary" path instead of a term/definition form
 *  - when the incoming term prop already exists in the target dictionary,
 *    its definition is pre-loaded for editing via an EXACT-MATCH lookup
 *    (Lexicon.findEntry), not the paginated substring search behind
 *    Lexicon.entries() — a bounded search can miss a real match in a large
 *    dictionary and silently let a save overwrite it (review finding)
 *  - "A Tibetan term is required." renders on the term field, not the
 *    definition field (review finding — it was bound to the wrong field)
 *
 * Plus the final-review fix (BLOCKING 4): loadExisting() only ran on dialog
 * open and on a target-dictionary change — not while the user edits the
 * term. Typing over the pre-filled term with one that already exists left
 * the "already in X" warning unshown and the existing definition unloaded,
 * so Save's upsert-by-term silently overwrote it with no warning. A
 * debounced watcher on localTerm keeps the check live as the term changes.
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
const findEntryMock = vi.fn()
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
      findEntry: (...args) => findEntryMock(...args),
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
    findEntryMock.mockReset().mockResolvedValue(null)
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

  // Vuetify renders each field's label and its error messages inside the
  // same `.v-input` wrapper, so this locates the wrapper for a given field
  // by its visible label text — letting a test assert an error is attached
  // to the RIGHT field, not merely present somewhere in the DOM.
  const fieldContainerFor = (labelText) => {
    const label = Array.from(document.body.querySelectorAll('label')).find((l) =>
      l.textContent.trim().startsWith(labelText)
    )
    return label?.closest('.v-input') ?? null
  }

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

  it('renders "A Tibetan term is required." on the term field, not the definition field', async () => {
    // Regression check for a review finding: the message was previously
    // bound to the definition v-textarea's :error-messages, not the term
    // TibetanTextField's — wrong field entirely. TibetanTextField also
    // hardcodes `hide-details` on its inner v-text-field, which swallows
    // error-messages unless the caller overrides it with
    // hide-details="auto" — asserting against component state alone would
    // pass even with that bug present, so this must check the rendered DOM.
    saveEntryMock.mockResolvedValue(null)
    const wrapper = mountDialog()
    wrapper.vm.localTerm = 'ཀ'
    wrapper.vm.definition = 'a letter'
    await nextTick()

    findButton('Save').click()
    await flushPromises()

    const termField = fieldContainerFor('Tibetan term')
    const definitionField = fieldContainerFor('My definition')
    expect(termField).not.toBeNull()
    expect(definitionField).not.toBeNull()
    expect(termField.textContent).toContain('A Tibetan term is required.')
    expect(definitionField.textContent).not.toContain('A Tibetan term is required.')

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

  it('pre-loads the existing definition via the exact-match lookup, even when a bounded substring search would have missed it', async () => {
    // Simulate the data-loss scenario the review finding described: a
    // bounded substring search (Lexicon.entries, LIMIT 50) finds nothing
    // for this term — exactly what happens when 50+ other entries sort
    // ahead of it while also matching the same LIKE clause — while the
    // exact-match lookup (Lexicon.findEntry) finds it regardless.
    entriesMock.mockResolvedValue({ total: 0, entries: [] })
    findEntryMock.mockResolvedValue({ id: 7, term: 'ཀ་', definition: 'existing definition' })

    // Mount closed first, then open — the prefill/lookup logic lives in the
    // modelValue watcher, which only fires on a false -> true transition
    // (exactly what happens when a caller flips its v-model open), not on
    // the initial prop value at mount time.
    const wrapper = mountDialog({ modelValue: false, term: 'ཀ' })
    await wrapper.setProps({ modelValue: true })
    await flushPromises()

    expect(findEntryMock).toHaveBeenCalledWith('custom-mine', 1, 'ཀ')
    expect(entriesMock).not.toHaveBeenCalled()
    expect(wrapper.vm.existingId).toBe(7)
    expect(wrapper.vm.definition).toBe('existing definition')
    expect(document.body.textContent).toContain('This term is already in My Lexicon')

    wrapper.unmount()
  })

  it('does not pre-load or warn when the exact-match lookup finds nothing', async () => {
    findEntryMock.mockResolvedValue(null)
    const wrapper = mountDialog({ modelValue: false, term: 'ཀ' })
    await wrapper.setProps({ modelValue: true })
    await flushPromises()

    expect(wrapper.vm.existingId).toBeNull()
    expect(wrapper.vm.definition).toBe('')
    expect(document.body.textContent).not.toContain('saving will update it')

    wrapper.unmount()
  })

  it('re-checks for an existing entry when the user edits the term after opening (BLOCKING 4)', async () => {
    // Opens on a term with no existing entry...
    findEntryMock.mockResolvedValue(null)
    const wrapper = mountDialog({ modelValue: false, term: 'ཀ' })
    await wrapper.setProps({ modelValue: true })
    await flushPromises()

    expect(wrapper.vm.existingId).toBeNull()

    // ...then the user types over it with a DIFFERENT term that already
    // exists in the target dictionary. Without a live re-check this stays
    // silently stale: no warning, nothing pre-filled, and Save's
    // upsert-by-term would overwrite the existing definition unannounced.
    findEntryMock.mockReset().mockResolvedValue({
      id: 9,
      term: 'ཁ་',
      definition: 'existing definition for kha',
    })
    wrapper.vm.localTerm = 'ཁ'
    await nextTick()

    // The check is debounced (not immediate, to avoid a lookup per
    // keystroke/Wylie-conversion tick) — real wait, comfortably past the
    // 250ms window.
    await new Promise((resolve) => setTimeout(resolve, 400))
    await flushPromises()

    expect(findEntryMock).toHaveBeenCalledWith('custom-mine', 1, 'ཁ')
    expect(wrapper.vm.existingId).toBe(9)
    expect(wrapper.vm.definition).toBe('existing definition for kha')
    expect(document.body.textContent).toContain('This term is already in My Lexicon')

    wrapper.unmount()
  })

  it('cancels the pending debounce and re-checks synchronously when Save is clicked inside the 250ms window (residual fix)', async () => {
    // Opens on a term with no existing entry, same as the BLOCKING 4 case
    // above, but this time the user does NOT wait out the debounce before
    // saving.
    findEntryMock.mockResolvedValue(null)
    const wrapper = mountDialog({ modelValue: false, term: 'ཀ' })
    await wrapper.setProps({ modelValue: true })
    await flushPromises()
    expect(wrapper.vm.existingId).toBeNull()

    // Definition typed first...
    wrapper.vm.definition = 'a fresh definition typed before editing the term'

    // ...then the term is edited to one that already exists in the target
    // dictionary. This starts the 250ms debounced onLocalTermInput timer
    // but does NOT let it fire.
    findEntryMock.mockReset().mockResolvedValue({
      id: 9,
      term: 'ཁ་',
      definition: 'existing definition for kha',
    })
    wrapper.vm.localTerm = 'ཁ'
    await nextTick()

    // Capture existingId at the exact moment Lexicon.saveEntry (the upsert)
    // is invoked. If save() still trusts the stale, not-yet-fired debounced
    // check, existingId will read null here — the same stale read that let
    // the upsert silently overwrite an existing entry with no warning.
    let existingIdWhenUpsertRan
    saveEntryMock.mockImplementation(() => {
      existingIdWhenUpsertRan = wrapper.vm.existingId
      return Promise.resolve({ id: 9, created: false })
    })

    // Click Save immediately — well inside the 250ms window, with no real
    // time elapsed and no fake timers advanced.
    findButton('Save').click()
    await flushPromises()

    // save() must have cancelled the stale debounce and re-run the
    // exact-match lookup for the CURRENT term itself, synchronously ahead
    // of the upsert — not relied on the abandoned debounced call.
    expect(findEntryMock).toHaveBeenCalledWith('custom-mine', 1, 'ཁ')
    expect(existingIdWhenUpsertRan).toBe(9)
    expect(wrapper.vm.existingId).toBe(9)

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
    // save() now awaits a synchronous loadExisting() re-check (the
    // debounce-race fix, tested above) before setting saving = true, adding
    // an extra microtask hop that a single nextTick() no longer spans —
    // flushPromises() drains that chain and then blocks on the still-
    // unresolved saveEntryMock promise below, leaving saving = true.
    await flushPromises()
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
