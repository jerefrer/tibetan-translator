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
import { nextTick } from 'vue'

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

const createMock = vi.fn()
const applyImportMock = vi.fn()

vi.mock('../src/services/lexicon', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    default: {
      ...actual.default,
      create: (...args) => createMock(...args),
      applyImport: (...args) => applyImportMock(...args),
    },
  }
})

import CustomPackSection from '../src/components/CustomPackSection.vue'

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
    createMock.mockReset().mockResolvedValue({ id: 'custom-x', manifest: { name: 'X' } })
    applyImportMock.mockReset().mockResolvedValue({ inserted: 0, updated: 0 })
    snackbar.open.mockClear()
  })

  afterEach(() => {
    // UiDialog teleports into document.body; clear it so a previous test's
    // dialog markup never leaks into the next test's document.body queries.
    document.body.innerHTML = ''
  })

  const mountSection = () =>
    mount(CustomPackSection, {
      global: {
        provide: { snackbar },
        mocks: { $router: { push: vi.fn() } },
      },
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

/**
 * Creating a dictionary straight from a spreadsheet.
 *
 * The ordering is the whole point: Lexicon.create() must not run until the
 * user has confirmed both the preview and the name, or backing out of either
 * would leave an empty dictionary behind.
 */
describe('CustomPackSection — create from a spreadsheet', () => {
  const GRID = {
    sheetName: 'vocabulaire',
    headers: ['A', 'B'],
    rows: [
      ['Terme', 'Traduction'],
      ['བླ་མ་', 'lama'],
    ],
  }
  const ROWS = [{ term: 'བླ་མ་', definition: 'lama' }]

  beforeEach(() => {
    customPacks = [PACK]
    createMock.mockReset().mockResolvedValue({ id: 'custom-x', manifest: { name: 'X' } })
    applyImportMock.mockReset().mockResolvedValue({ inserted: 0, updated: 0 })
    snackbar.open.mockClear()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  const mountSection = () =>
    mount(CustomPackSection, {
      global: {
        provide: { snackbar },
        mocks: { $router: { push: vi.fn() } },
      },
      attachTo: document.body,
    })

  it('creates nothing while the preview is merely open', async () => {
    const wrapper = mountSection()
    wrapper.vm.importGrid = GRID
    wrapper.vm.importOpen = true
    await flushPromises()
    expect(createMock).not.toHaveBeenCalled()
    expect(applyImportMock).not.toHaveBeenCalled()
  })

  it('still creates nothing when the preview is confirmed but the name is not', async () => {
    const wrapper = mountSection()
    wrapper.vm.importGrid = GRID
    wrapper.vm.onCreateRequested(ROWS)
    await flushPromises()
    expect(wrapper.vm.createOpen).toBe(true)
    expect(createMock).not.toHaveBeenCalled()
    expect(applyImportMock).not.toHaveBeenCalled()
  })

  it('offers the sheet name as the dictionary name', async () => {
    const wrapper = mountSection()
    wrapper.vm.importGrid = GRID
    wrapper.vm.onCreateRequested(ROWS)
    await flushPromises()
    expect(wrapper.vm.newName).toBe('vocabulaire')
  })

  it('creates the dictionary first, then writes the rows into it', async () => {
    const order = []
    createMock.mockImplementation(async () => {
      order.push('create')
      return { id: 'custom-vocabulaire', manifest: { name: 'vocabulaire' } }
    })
    applyImportMock.mockImplementation(async () => {
      order.push('applyImport')
      return { inserted: 1, updated: 0 }
    })

    const wrapper = mountSection()
    wrapper.vm.importGrid = GRID
    wrapper.vm.onCreateRequested(ROWS)
    await flushPromises()
    await wrapper.vm.confirmCreate()

    expect(order).toEqual(['create', 'applyImport'])
    expect(applyImportMock).toHaveBeenCalledWith('custom-vocabulaire', 1, ROWS)
    expect(snackbar.open).toHaveBeenCalledWith('vocabulaire created with 1 entries')
  })

  it('does not import anything for a plain new dictionary', async () => {
    createMock.mockResolvedValue({ id: 'custom-plain', manifest: { name: 'Plain' } })
    const wrapper = mountSection()
    wrapper.vm.onCreate()
    wrapper.vm.newName = 'Plain'
    await wrapper.vm.confirmCreate()
    expect(applyImportMock).not.toHaveBeenCalled()
    expect(snackbar.open).toHaveBeenCalledWith('Plain created')
  })
})

describe('CustomPackSection — list and empty state', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  const mountSection = (router = { push: vi.fn() }) =>
    mount(CustomPackSection, {
      global: { provide: { snackbar }, mocks: { $router: router } },
      attachTo: document.body,
    })

  it('lists each pack with its version and opens its entries from Manage entries', async () => {
    customPacks = [PACK]
    const router = { push: vi.fn() }
    const wrapper = mountSection(router)

    const row = wrapper.get('[data-testid="custom-pack"]')
    expect(row.text()).toContain('My Lexicon')
    expect(row.text()).toContain('v1.0.0')

    await wrapper.get('[data-testid="custom-pack-manage"]').trigger('click')
    expect(router.push).toHaveBeenCalledWith('/glossary/custom-mine')
    wrapper.unmount()
  })

  it('still offers all three ways in when there is no dictionary yet', () => {
    customPacks = []
    const wrapper = mountSection()
    expect(wrapper.text()).toContain("You don't have a dictionary of your own yet.")
    for (const testid of ['custom-pack-new', 'custom-pack-from-sheet', 'custom-pack-import']) {
      expect(wrapper.find(`[data-testid="${testid}"]`).exists(), testid).toBe(true)
    }
    wrapper.unmount()
  })

  it('creates the dictionary when Enter is pressed in the name field', async () => {
    customPacks = []
    createMock.mockReset().mockResolvedValue({ id: 'custom-enter', manifest: { name: 'Enter' } })
    const wrapper = mountSection()
    wrapper.vm.onCreate()
    await flushPromises()

    const input = document.body.querySelector('[data-testid="custom-pack-name"] input')
    input.value = 'Enter'
    input.dispatchEvent(new Event('input'))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await flushPromises()

    expect(createMock).toHaveBeenCalledWith('Enter', '')
    wrapper.unmount()
  })

  it('shows the missing-name error in the dialog', async () => {
    customPacks = []
    const wrapper = mountSection()
    wrapper.vm.onCreate()
    await flushPromises()
    await wrapper.vm.confirmCreate()
    await flushPromises()
    expect(document.body.textContent).toContain('A name is required.')
    wrapper.unmount()
  })
})
