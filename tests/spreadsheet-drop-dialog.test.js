/**
 * SpreadsheetDropDialog: where a spreadsheet is brought in, dropped on a
 * large zone or chosen from the file picker.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const openMock = vi.fn()
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: (...args) => openMock(...args) }))

import SpreadsheetDropDialog from '../src/components/SpreadsheetDropDialog.vue'

let wrapper
const zone = () => document.body.querySelector('[data-testid="drop-zone"]')
const fire = (type, files = []) => {
  const event = new Event(type, { bubbles: true, cancelable: true })
  event.dataTransfer = { files, types: ['Files'] }
  zone().dispatchEvent(event)
  return event
}

beforeEach(() => {
  openMock.mockReset()
  wrapper = mount(SpreadsheetDropDialog, {
    props: { modelValue: true, title: 'Import into A' },
    attachTo: document.body,
  })
})

afterEach(() => {
  wrapper.unmount()
  document.body.innerHTML = ''
})

describe('SpreadsheetDropDialog', () => {
  it('should show a large zone that says what to drop', async () => {
    await flushPromises()
    expect(zone().textContent).toContain('Drop a spreadsheet here')
    expect(zone().textContent).toContain('or click to choose a file')
  })

  it('should light up while a file is dragged over it, and calm down when it leaves', async () => {
    await flushPromises()
    fire('dragenter')
    await flushPromises()
    expect(zone().classList).toContain('is-over')
    fire('dragleave')
    await flushPromises()
    expect(zone().classList).not.toContain('is-over')
  })

  it('should hand over a dropped spreadsheet and close', async () => {
    await flushPromises()
    const file = new File(['a'], 'words.xlsx')
    const event = fire('drop', [file])
    await flushPromises()
    expect(event.defaultPrevented).toBe(true)
    expect(wrapper.emitted('file')[0][0]).toBe(file)
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([false])
  })

  it('should say so, and stay open, when what is dropped is not a spreadsheet', async () => {
    await flushPromises()
    fire('drop', [new File(['a'], 'notes.pdf')])
    await flushPromises()
    expect(wrapper.emitted('file')).toBeUndefined()
    expect(zone().textContent).toContain('notes.pdf is not a spreadsheet')
  })

  it('should open the file picker on a click, and hand over the file chosen', async () => {
    openMock.mockResolvedValue('/Users/me/words.csv')
    await flushPromises()
    zone().click()
    await flushPromises()
    expect(openMock.mock.calls[0][0].filters[0].extensions).toEqual(['xlsx', 'xls', 'ods', 'csv', 'tsv'])
    expect(wrapper.emitted('path')[0][0]).toBe('/Users/me/words.csv')
  })

  it('should stay open when the picker is cancelled', async () => {
    openMock.mockResolvedValue(null)
    await flushPromises()
    zone().click()
    await flushPromises()
    expect(wrapper.emitted('path')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
