/**
 * LexiconEntryDialog Component Tests
 *
 * Covers two review findings on Task 7:
 *  - the term field's validation/error messages must actually reach the
 *    rendered DOM (TibetanTextField hardcodes `hide-details` on its inner
 *    v-text-field; the dialog must override it so error-messages render)
 *  - Lexicon.saveEntry() returning null (unusable input) must not be treated
 *    as a successful save: no 'saved' emit, dialog stays open, error shown
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

// Mock only Lexicon.saveEntry (the Tauri-backed call). Keep normalizeTerm and
// everything else real, since the dialog's own validation depends on it.
vi.mock('../src/services/lexicon', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    default: { ...actual.default, saveEntry: (...args) => saveEntryMock(...args) },
  }
})

import LexiconEntryDialog from '../src/components/LexiconEntryDialog.vue'

const vuetify = createVuetify({ components, directives })

describe('LexiconEntryDialog', () => {
  beforeEach(() => {
    saveEntryMock.mockReset()
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
