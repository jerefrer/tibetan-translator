/**
 * CustomPackSection Component Tests
 *
 * Covers the final-review fix (BLOCKING 2): removing a custom dictionary used
 * to call PackManager.removeCustomPack() straight from the delete icon's
 * click handler — no confirmation, no undo, no trash — which could destroy a
 * user's only copy of a personal lexicon on a single misclick next to the
 * "Manage entries" icon. onRemove() now only stages the target and opens a
 * confirmation dialog; the actual delete happens in confirmRemove(), and the
 * dialog's wording escalates when the pack carries local edits (modifiedAt
 * set — see the create_lexicon fix that leaves it unset until an entry is
 * actually written, so a freshly created, untouched lexicon does not trigger
 * the stronger wording).
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

vi.mock('../src/config/platform.js', () => ({
  isTauri: () => true,
  supportsModularPacks: () => true,
}))

let customPacks = []
const removeCustomPackMock = vi.fn()

vi.mock('../src/services/pack-manager', () => ({
  default: {
    get customPacks() {
      return customPacks
    },
    removeCustomPack: (...args) => removeCustomPackMock(...args),
  },
}))

import CustomPackSection from '../src/components/CustomPackSection.vue'

const vuetify = createVuetify({ components, directives })
const snackbar = { open: vi.fn() }

const PACK = {
  id: 'custom-mine',
  manifest: { name: 'My Lexicon', version: '1.0.0', dictionaries: [{ name: 'My Lexicon' }] },
}

const EDITED_PACK = {
  id: 'custom-edited',
  manifest: {
    name: 'Edited Lexicon',
    version: '1.0.1',
    modifiedAt: '2026-02-02T00:00:00Z',
    dictionaries: [{ name: 'Edited Lexicon' }],
  },
}

describe('CustomPackSection', () => {
  beforeEach(() => {
    customPacks = [PACK]
    removeCustomPackMock.mockReset().mockResolvedValue(undefined)
    snackbar.open.mockClear()
  })

  afterEach(() => {
    // v-dialog teleports into document.body and its leave transition isn't
    // guaranteed to finish (and thus detach its DOM) by the time
    // wrapper.unmount() returns, which otherwise leaks a previous test's
    // dialog markup into the next test's document.body queries.
    document.body.innerHTML = ''
  })

  const mountSection = () =>
    mount(CustomPackSection, {
      global: { plugins: [vuetify], provide: { snackbar } },
      attachTo: document.body,
    })

  const findButton = (text) =>
    Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent.trim().includes(text)
    )

  it('does not remove the pack when the delete icon is clicked — it only opens a confirmation dialog', async () => {
    const wrapper = mountSection()

    wrapper.vm.onRemove(PACK)
    await nextTick()

    expect(removeCustomPackMock).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('Remove dictionary?')
    expect(document.body.textContent).toContain('My Lexicon')

    wrapper.unmount()
  })

  it('does not remove the pack when the dialog is cancelled', async () => {
    const wrapper = mountSection()

    wrapper.vm.onRemove(PACK)
    await nextTick()

    findButton('Cancel').click()
    await flushPromises()

    expect(removeCustomPackMock).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('removes the pack only after the dialog is confirmed', async () => {
    const wrapper = mountSection()

    wrapper.vm.onRemove(PACK)
    await nextTick()

    findButton('Remove').click()
    await flushPromises()

    expect(removeCustomPackMock).toHaveBeenCalledWith('custom-mine')
    expect(snackbar.open).toHaveBeenCalledWith('My Lexicon removed')
    expect(wrapper.vm.removeOpen).toBe(false)

    wrapper.unmount()
  })

  it('does not show the local-edits warning for a pack that was never modified', async () => {
    const wrapper = mountSection()

    wrapper.vm.onRemove(PACK)
    await nextTick()

    expect(document.body.textContent).not.toContain('Consider exporting it first')

    wrapper.unmount()
  })

  it('shows a stronger warning, suggesting export first, when the pack has local edits', async () => {
    customPacks = [EDITED_PACK]
    const wrapper = mountSection()

    wrapper.vm.onRemove(EDITED_PACK)
    await nextTick()

    expect(document.body.textContent).toContain('Consider exporting it first')

    wrapper.unmount()
  })

  it('shows an error and keeps removing=false when removeCustomPack rejects', async () => {
    removeCustomPackMock.mockRejectedValue(new Error('disk error'))
    const wrapper = mountSection()

    wrapper.vm.onRemove(PACK)
    await nextTick()

    findButton('Remove').click()
    await flushPromises()

    expect(snackbar.open).toHaveBeenCalledWith('Could not remove this dictionary.')
    expect(wrapper.vm.removing).toBe(false)

    wrapper.unmount()
  })
})
