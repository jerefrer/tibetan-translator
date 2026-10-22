/**
 * The selection popup of the main window (SelectedTibetanEntriesPopup.vue):
 * selecting Tibetan shows, after a second, a card with its entries.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'

const getEntriesFor = vi.fn()
vi.mock('../src/services/sql-database', () => ({
  default: { getEntriesFor: (...args) => getEntriesFor(...args), hasTerm: () => false },
}))

import SelectedTibetanEntriesPopup, { SHOW_DELAY_MS } from '../src/components/SelectedTibetanEntriesPopup.vue'
import Storage from '../src/services/storage'

const entry = (overrides = {}) => ({
  term: 'ཡེ་ཤེས་',
  dictionary: 'TsepakRigdzin',
  dictionaryId: 18,
  definition: 'wisdom',
  ...overrides,
})

let wrapper
let page

function select(html, { whole = false } = {}) {
  page.innerHTML = html
  const target = page.querySelector('[data-select]') || page
  const range = document.createRange()
  range.selectNodeContents(whole ? target : target.firstChild)
  const selection = document.getSelection()
  selection.removeAllRanges()
  selection.addRange(range)
}

async function show() {
  wrapper.vm.maybeShowPopup()
  await flushPromises()
  await nextTick()
}

beforeEach(() => {
  getEntriesFor.mockReset().mockResolvedValue([entry()])
  page = document.createElement('div')
  document.body.appendChild(page)
  wrapper = mount(SelectedTibetanEntriesPopup, {
    attachTo: document.body,
    global: { provide: { snackbar: { open: vi.fn() } } },
  })
})

afterEach(() => {
  wrapper?.unmount()
  document.getSelection().removeAllRanges()
  document.body.innerHTML = ''
  Storage.delete('dictionaries')
})

describe('SelectedTibetanEntriesPopup', () => {
  it('P1/P4: should look the selected Tibetan up, with a trailing tsheg, and show its entries', async () => {
    select('<p data-select>ཡེ་ཤེས</p>')
    await show()
    expect(getEntriesFor).toHaveBeenCalledWith('ཡེ་ཤེས་')
    expect(wrapper.find('[data-testid="selection-popup"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="entry"]')).toHaveLength(1)
  })

  it('P2: should strip non-Tibetan characters and leading punctuation', async () => {
    select('<p data-select>= ་ཡེ་ཤེས་!</p>')
    await show()
    expect(getEntriesFor).toHaveBeenCalledWith('ཡེ་ཤེས་')
  })

  it('P2: should not open for a selection with a lot of non-Tibetan text (more than 15 runs of it)', async () => {
    select('<p data-select>' + 'ཀ་ a '.repeat(16) + '</p>')
    await show()
    expect(getEntriesFor).not.toHaveBeenCalled()
  })

  it('P2: should not open inside a field, old or rebuilt', async () => {
    select('<div class="ui-field"><span data-select>ཡེ་ཤེས་</span></div>')
    await show()
    select('<div class="v-input"><span data-select>ཡེ་ཤེས་</span></div>')
    await show()
    expect(getEntriesFor).not.toHaveBeenCalled()
  })

  it('P2: should not open on Split', async () => {
    select('<div class="segment-page"><span data-select>ཡེ་ཤེས་</span></div>')
    await show()
    expect(getEntriesFor).not.toHaveBeenCalled()
  })

  it('P2: should not open for a whole term of a list, but should for part of one', async () => {
    select('<div class="term-item" data-select>ཡེ་ཤེས་</div>', { whole: true })
    await show()
    expect(getEntriesFor).not.toHaveBeenCalled()

    page.innerHTML = '<div class="result-term"><span data-select>ཡེ་</span>ཤེས་</div>'
    const range = document.createRange()
    range.selectNodeContents(page.querySelector('[data-select]').firstChild)
    document.getSelection().removeAllRanges()
    document.getSelection().addRange(range)
    await show()
    expect(getEntriesFor).toHaveBeenCalledWith('ཡེ་')
  })

  it('P4: should show only the dictionaries enabled in Settings, in the Settings order', async () => {
    Storage.set('dictionaries', [
      { id: 5, position: 1, enabled: true },
      { id: 18, position: 2, enabled: true },
      { id: 7, position: 3, enabled: false },
    ])
    getEntriesFor.mockResolvedValue([
      entry(),
      entry({ dictionary: 'Drungtso', dictionaryId: 5, definition: 'first' }),
      entry({ dictionaryId: 7, definition: 'off' }),
    ])
    select('<p data-select>ཡེ་ཤེས་</p>')
    await show()
    expect(wrapper.findAll('.definition').map((d) => d.text())).toEqual(['first', 'wisdom'])
  })

  it('P4: should show a spinner while loading, then "No entries." when there are none', async () => {
    let release
    getEntriesFor.mockReturnValue(new Promise((resolve) => { release = resolve }))
    select('<p data-select>ཀཀཀ</p>')
    wrapper.vm.maybeShowPopup()
    await nextTick()
    expect(wrapper.find('[data-testid="selection-popup-loading"]').exists()).toBe(true)
    release([])
    await flushPromises()
    await nextTick()
    expect(wrapper.find('[data-testid="selection-popup-empty"]').text()).toBe('No entries.')
  })

  // Real timers: underscore's debounce reads the clock it captured at import
  it('P1/P5: should open a second after the selection stops changing, and hide on change or scroll', async () => {
    select('<p data-select>ཡེ་ཤེས་</p>')
    document.onselectionchange()
    await new Promise((resolve) => setTimeout(resolve, SHOW_DELAY_MS / 2))
    expect(getEntriesFor).not.toHaveBeenCalled()
    await new Promise((resolve) => setTimeout(resolve, SHOW_DELAY_MS / 2 + 100))
    await flushPromises()
    expect(wrapper.vm.show).toBe(true)

    document.onselectionchange()
    expect(wrapper.vm.show).toBe(false)
    wrapper.vm.maybeShowPopup()
    expect(wrapper.vm.show).toBe(true)
    window.onscroll()
    expect(wrapper.vm.show).toBe(false)
  })

  it('P3: should sit beside the selection, on the side with room', async () => {
    window.innerWidth = 1000
    window.innerHeight = 800
    document.onmousemove({ x: 100, y: 100 })
    document.onselectstart()
    document.onselectionchange()
    select('<p data-select>ཡེ་ཤེས་</p>')
    await show()
    expect(wrapper.vm.left).toBe('100px')
    expect(wrapper.vm.top).toBe('145px')

    document.onmousemove({ x: 900, y: 700 })
    document.onselectstart()
    document.onselectionchange()
    select('<p data-select>ཡེ་ཤེས་</p>')
    await show()
    expect(wrapper.vm.left).toBe('calc(900px - min(90vw, 640px))')
    expect(wrapper.vm.top).toBe('calc(700px - 10px - 45vh)')
  })

  it('P5: should release the document handlers when unmounted', () => {
    wrapper.unmount()
    expect(document.onselectionchange).toBeNull()
    expect(window.onscroll).toBeNull()
    wrapper = undefined
  })

  it('P6: should render without Vuetify', async () => {
    select('<p data-select>ཡེ་ཤེས་</p>')
    await show()
    expect(wrapper.html()).not.toMatch(/class="[^"]*\bv-/)
  })
})
