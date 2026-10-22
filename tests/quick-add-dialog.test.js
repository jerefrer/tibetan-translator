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
import { nextTick } from 'vue'

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
import Storage from '../src/services/storage'

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
    // The dialog teleports into document.body, outside the wrapper; clear it
    // so a previous test's dialog markup cannot leak into the next one's
    // document.body queries.
    document.body.innerHTML = ''
  })

  const mountDialog = (props = {}) =>
    mount(QuickAddDialog, {
      props: {
        modelValue: true,
        term: '',
        ...props,
      },
      global: { provide: { snackbar } },
      attachTo: document.body,
    })

  // The dialog teleports its content to document.body, outside the mounted
  // wrapper's own DOM subtree, so buttons must be located via the real DOM
  // rather than wrapper.find()/findAll().
  const findButton = (text) =>
    Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent.trim() === text || b.textContent.trim().includes(text)
    )

  // Each field renders its label and its error message inside the same
  // `.ui-field` wrapper, so this locates the wrapper for a given field
  // by its visible label text — letting a test assert an error is attached
  // to the RIGHT field, not merely present somewhere in the DOM.
  const fieldContainerFor = (labelText) => {
    const label = Array.from(document.body.querySelectorAll('label')).find((l) =>
      l.textContent.trim().startsWith(labelText)
    )
    return label?.closest('.ui-field') ?? null
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
    // bound to the definition field's error, not the term field's — wrong
    // field entirely. Asserting against component state alone would pass
    // even with that bug present, so this must check the rendered DOM.
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

  describe('in the new design', () => {
    const TWO_TARGETS = [
      ...ONE_TARGET,
      { packId: 'custom-other', dictionaryId: 1, packName: 'Other', name: 'Other', entriesCount: 0 },
    ]

    it('says where the definition goes when there is a single dictionary, and offers no picker', async () => {
      const wrapper = mountDialog({ modelValue: false, term: 'ཀ' })
      await wrapper.setProps({ modelValue: true })
      await flushPromises()

      expect(document.body.querySelector('.ui-dialog__title').textContent).toBe('Add my definition')
      expect(document.body.textContent).toContain('Saving to My Lexicon')
      expect(document.body.querySelector('[data-testid="quick-add-target"]')).toBeNull()
      wrapper.unmount()
    })

    it('offers a picker with several dictionaries, starting on the last one used', async () => {
      editableDictionariesMock.mockReturnValue(TWO_TARGETS)
      Storage.set('lastLexiconTarget', 'custom-other:1')
      const wrapper = mountDialog({ modelValue: false, term: 'ཀ' })
      await wrapper.setProps({ modelValue: true })
      await flushPromises()

      expect(document.body.querySelector('[data-testid="quick-add-target"]')).not.toBeNull()
      expect(wrapper.vm.targetKey).toBe('custom-other:1')
      expect(document.body.textContent).not.toContain('Saving to')
      wrapper.unmount()
    })

    it('fills the term in and focuses the definition', async () => {
      const wrapper = mountDialog({ modelValue: false, term: 'ཀ་' })
      await wrapper.setProps({ modelValue: true })
      await flushPromises()
      await new Promise((resolve) => setTimeout(resolve, 80))

      const term = document.body.querySelector('[data-testid="quick-add-term"] input')
      const definition = document.body.querySelector('[data-testid="quick-add-definition"] textarea')
      expect(term.value).toBe('ཀ་')
      expect(document.activeElement).toBe(definition)
      wrapper.unmount()
    })

    it('asks for a definition under the definition field', async () => {
      const wrapper = mountDialog({ modelValue: false, term: 'ཀ' })
      await wrapper.setProps({ modelValue: true })
      await flushPromises()

      findButton('Save').click()
      await flushPromises()

      expect(fieldContainerFor('My definition').textContent).toContain('A definition is required.')
      expect(saveEntryMock).not.toHaveBeenCalled()
      wrapper.unmount()
    })

    it('saves, says so, remembers the dictionary, tells the page and closes', async () => {
      saveEntryMock.mockResolvedValue({ id: 3, created: true })
      const wrapper = mountDialog({ modelValue: false, term: 'ཀ' })
      await wrapper.setProps({ modelValue: true })
      await flushPromises()
      wrapper.vm.definition = 'a letter'
      await nextTick()

      findButton('Save').click()
      await flushPromises()

      expect(saveEntryMock).toHaveBeenCalledWith('custom-mine', 1, 'ཀ', 'a letter')
      expect(snackbar.open).toHaveBeenCalledWith('Added to your dictionary')
      expect(Storage.get('lastLexiconTarget')).toBe('custom-mine:1')
      expect(wrapper.emitted('saved')).toEqual([[{ id: 3, created: true }]])
      expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
      wrapper.unmount()
    })

    it('closes from Cancel without saving', async () => {
      const wrapper = mountDialog()
      await flushPromises()

      findButton('Cancel').click()

      expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
      expect(saveEntryMock).not.toHaveBeenCalled()
      wrapper.unmount()
    })
  })
})
