/**
 * LexiconEntryDialog Component Tests
 *
 * Covers two review findings on Task 7:
 *  - the term field's validation/error messages must actually reach the
 *    rendered DOM (TibetanTextField hardcodes `hide-details` on its inner
 *    v-text-field; the dialog must override it so error-messages render)
 *  - Lexicon.saveEntry() returning null (unusable input) must not be treated
 *    as a successful save: no 'saved' emit, dialog stays open, error shown
 *
 * Plus the final-review fix (BLOCKING 3): lexicon_upsert_entry resolves
 * purely by (dictionaryId, term), so editing an entry's term never renamed
 * the row — it inserted (or matched) a different one and left the original
 * behind, duplicating the entry. Two ways this fired, both covered below:
 * a visible term edit (typo fix), and no visible edit at all, because a
 * stored term and its normalized form can differ (imported entries keep a
 * trailing shad; tibetanLookupKey rewrites it to a tsheg), so pressing Save
 * with no changes still resolves to a different row.
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

const saveEntryMock = vi.fn()
const deleteEntryMock = vi.fn()

// Mock only the Tauri-backed calls on Lexicon. Keep normalizeTerm and
// everything else real, since the dialog's own validation depends on it.
vi.mock('../src/services/lexicon', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    default: {
      ...actual.default,
      saveEntry: (...args) => saveEntryMock(...args),
      deleteEntry: (...args) => deleteEntryMock(...args),
    },
  }
})

import LexiconEntryDialog from '../src/components/LexiconEntryDialog.vue'

const vuetify = createVuetify({ components, directives })

describe('LexiconEntryDialog', () => {
  beforeEach(() => {
    saveEntryMock.mockReset()
    deleteEntryMock.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    // v-dialog teleports into document.body and its leave transition isn't
    // guaranteed to finish (and thus detach its DOM) by the time
    // wrapper.unmount() returns, which otherwise leaks a previous test's
    // dialog markup into the next test's document.body queries.
    document.body.innerHTML = ''
  })

  const mountDialog = (props = {}) =>
    mount(LexiconEntryDialog, {
      props: {
        modelValue: true,
        packId: 'custom-x',
        dictionaryId: 1,
        entry: null,
        initialTerm: '',
        ...props,
      },
      global: { plugins: [vuetify] },
      attachTo: document.body,
    })

  // v-dialog teleports its content to document.body, outside the mounted
  // wrapper's own DOM subtree, so buttons must be located via the real DOM
  // rather than wrapper.find()/findAll().
  const findButton = (text) =>
    Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent.trim().includes(text)
    )

  const clickSave = async () => {
    findButton('Save').click()
    await flushPromises()
  }

  it('renders the term validation error message in the DOM (not just component state)', async () => {
    const wrapper = mountDialog()

    await clickSave()

    // Regression check for the review finding: TibetanTextField hardcodes a
    // bare `hide-details` on its inner v-text-field, which swallows
    // error-messages entirely unless the caller overrides it. Asserting
    // against the component's own data would pass even with that bug present
    // — the message must be verified in the actual rendered DOM.
    expect(wrapper.vm.termError).toBe('A Tibetan term is required.')
    expect(document.body.textContent).toContain('A Tibetan term is required.')

    wrapper.unmount()
  })

  it('renders the save-failure error message in the DOM when Lexicon.saveEntry resolves null', async () => {
    saveEntryMock.mockResolvedValue(null)
    const wrapper = mountDialog()
    wrapper.vm.term = 'ཀ'
    wrapper.vm.definition = 'a letter'
    await nextTick()

    await clickSave()

    expect(document.body.textContent).toContain('Could not save this entry.')

    wrapper.unmount()
  })

  it('does not emit "saved" and does not close the dialog when Lexicon.saveEntry resolves null', async () => {
    saveEntryMock.mockResolvedValue(null)
    const wrapper = mountDialog()
    wrapper.vm.term = 'ཀ'
    wrapper.vm.definition = 'a letter'
    await nextTick()

    await clickSave()

    expect(saveEntryMock).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.vm.saving).toBe(false)

    wrapper.unmount()
  })

  it('emits "saved" and closes when Lexicon.saveEntry resolves a real outcome', async () => {
    saveEntryMock.mockResolvedValue({ id: 42, created: true })
    const wrapper = mountDialog()
    wrapper.vm.term = 'ཀ'
    wrapper.vm.definition = 'a letter'
    await nextTick()

    await clickSave()

    expect(wrapper.emitted('saved')).toEqual([[{ id: 42, created: true }]])
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
    // Adding a brand new entry (entry: null, not editing) must never trigger
    // the rename cleanup below — there is no previous row to remove.
    expect(deleteEntryMock).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  describe('editing renames the term instead of duplicating it (BLOCKING 3)', () => {
    // Mount closed then open, mirroring quick-add-dialog.test.js: the
    // term/definition prefill from `entry` lives in the modelValue watcher,
    // which only fires on a false -> true transition, not on the initial
    // prop value at mount time.
    const mountForEdit = (entry) => {
      const wrapper = mountDialog({ modelValue: false, entry })
      return wrapper
    }

    it('removes the original row when a visible term edit resolves to a different row (typo fix)', async () => {
      saveEntryMock.mockResolvedValue({ id: 42, created: true })
      const wrapper = mountForEdit({ id: 5, term: 'ཀ་', definition: 'old definition' })
      await wrapper.setProps({ modelValue: true })
      await nextTick()

      expect(wrapper.vm.term).toBe('ཀ་') // prefilled from the entry being edited

      wrapper.vm.term = 'ཁ་' // the user fixes a typo
      await nextTick()

      await clickSave()

      expect(saveEntryMock).toHaveBeenCalledWith('custom-x', 1, 'ཁ་', 'old definition')
      expect(deleteEntryMock).toHaveBeenCalledWith('custom-x', 5)
      expect(wrapper.emitted('saved')).toEqual([[{ id: 42, created: true }]])
      expect(wrapper.emitted('update:modelValue')).toEqual([[false]])

      wrapper.unmount()
    })

    it('removes the original row on Save with NO visible edit, when the stored term normalizes differently (shad vs tsheg)', async () => {
      // Anki-imported entries keep a trailing shad
      // (build/lib/build-tibdict-sqlite.js's ensureTrailingTsheg preserves
      // it), but tibetanLookupKey — the rule saveEntry's prepareEntry()
      // applies before writing — rewrites a trailing shad to a tsheg. So
      // even pressing Save with the field untouched normalizes 'ཀ།' to
      // 'ཀ་' and the upsert resolves to a different row than entry.id.
      saveEntryMock.mockResolvedValue({ id: 99, created: true })
      const wrapper = mountForEdit({ id: 7, term: 'ཀ།', definition: 'unchanged definition' })
      await wrapper.setProps({ modelValue: true })
      await nextTick()

      expect(wrapper.vm.term).toBe('ཀ།') // confirms no edit — this is the field as opened

      await clickSave()

      expect(saveEntryMock).toHaveBeenCalledWith('custom-x', 1, 'ཀ།', 'unchanged definition')
      expect(deleteEntryMock).toHaveBeenCalledWith('custom-x', 7)
      expect(wrapper.emitted('saved')).toEqual([[{ id: 99, created: true }]])
      expect(wrapper.emitted('update:modelValue')).toEqual([[false]])

      wrapper.unmount()
    })

    it('does not delete anything when the upsert resolves back to the same row (definition-only edit)', async () => {
      saveEntryMock.mockResolvedValue({ id: 5, created: false })
      const wrapper = mountForEdit({ id: 5, term: 'ཀ་', definition: 'old definition' })
      await wrapper.setProps({ modelValue: true })
      await nextTick()

      wrapper.vm.definition = 'a corrected definition'
      await nextTick()

      await clickSave()

      expect(deleteEntryMock).not.toHaveBeenCalled()
      expect(wrapper.emitted('saved')).toEqual([[{ id: 5, created: false }]])
      expect(wrapper.emitted('update:modelValue')).toEqual([[false]])

      wrapper.unmount()
    })

    it('keeps the dialog open with an explicit error, rather than reporting success, when cleanup of the old row fails', async () => {
      // This is the ordering guarantee the fix depends on: the upsert (new
      // definition) already succeeded by the time this delete is attempted,
      // so the failure mode is a surfaced error with a retryable duplicate —
      // never silent data loss, and never a false "saved" while a duplicate
      // is left behind unmentioned.
      saveEntryMock.mockResolvedValue({ id: 42, created: true })
      deleteEntryMock.mockRejectedValue(new Error('disk error'))
      const wrapper = mountForEdit({ id: 5, term: 'ཀ་', definition: 'old definition' })
      await wrapper.setProps({ modelValue: true })
      await nextTick()

      wrapper.vm.term = 'ཁ་'
      await nextTick()

      await clickSave()

      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
      expect(document.body.textContent).toContain(
        'Saved, but the previous version of this entry could not be removed'
      )
      // The parent must still be told a save happened, so its list reflects
      // the (temporarily duplicated) reality instead of looking unchanged.
      expect(wrapper.emitted('saved')).toEqual([[{ id: 42, created: true }]])

      wrapper.unmount()
    })
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
    wrapper.vm.term = 'ཀ'
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
