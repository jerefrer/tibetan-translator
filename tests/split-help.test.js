/**
 * The "Reading a text" help dialog, opened from Settings' help rows (it was
 * the Split page's help, H1 in docs/redesign/reports/split.md).
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const platform = vi.hoisted(() => ({ mac: false }))
vi.mock('../src/config/platform.js', () => ({
  isTauri: () => true,
  isMacOS: () => platform.mac,
  isMobile: () => false,
}))

import SplitPageHelpDialogWithButton from '../src/components/SplitPageHelpDialogWithButton.vue'

let wrapper
const desktopWidth = window.innerWidth
const body = (testid) => document.body.querySelector(`[data-testid="${testid}"]`)
const tabLabels = () =>
  Array.from(document.body.querySelectorAll('.ui-tabs__trigger')).map((tab) => tab.textContent.trim())

// Settings opens the dialog from its help rows with open()
async function openHelp() {
  wrapper = mount(SplitPageHelpDialogWithButton, { attachTo: document.body })
  wrapper.vm.open()
  await flushPromises()
  return wrapper
}

async function showNavigation() {
  wrapper.vm.tab = 'navigation'
  await flushPromises()
  return body('split-help').textContent
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  platform.mac = false
  window.innerWidth = desktopWidth
})

describe('Split help', () => {
  it('should render no button of its own, only the dialog Settings opens', async () => {
    wrapper = mount(SplitPageHelpDialogWithButton, { attachTo: document.body })
    expect(wrapper.find('button').exists()).toBe(false)
    expect(body('split-help')).toBeNull()
  })

  it('should open on how to read a text, with a Navigation tab on a desktop', async () => {
    await openHelp()

    expect(document.body.querySelector('.ui-dialog__title').textContent).toBe('Reading a text')
    expect(tabLabels()).toEqual(['Reading', 'Dictionaries filter', 'Navigation'])
    const tips = body('reader-help-tips').textContent
    for (const text of ['Shift+Space', 'Tap a word', 'expression', 'Show Wylie']) expect(tips).toContain(text)

    wrapper.vm.tab = 'dictionaries'
    await flushPromises()
    const menuHelp = body('dictionaries-menu-help').textContent
    for (const text of ['All', 'More…', 'Dictionary preferences', 'Settings', 'Alt']) expect(menuHelp).toContain(text)
    expect(menuHelp).not.toContain('Ctrl + click')
    expect(menuHelp).not.toContain('B for Browse')
  })

  it('should leave out Navigation and the keyboard hint on a phone', async () => {
    window.innerWidth = 390
    await openHelp()

    expect(tabLabels()).toEqual(['Reading', 'Dictionaries filter'])
    wrapper.vm.tab = 'dictionaries'
    await flushPromises()
    const menuHelp = body('dictionaries-menu-help').textContent
    expect(menuHelp).toContain('More…')
    expect(menuHelp).toContain('Dictionary preferences')
    expect(menuHelp).not.toContain('Alt')
  })

  it('should list Up/Down, Ctrl+Enter, Space, Shift+Space and the page shortcuts under Navigation', async () => {
    await openHelp()
    const text = await showNavigation()

    expect(text).toContain('Select previous word in results')
    expect(text).toContain('Select next word in results')
    expect(text).toContain('Split the text into words')
    expect(text).toContain('Types a tsheg in the text')
    expect(text).toContain('Types a space, which separates two words')
    for (const label of ['Look up a Tibetan term (Lookup in བོད)', 'Go to Reader', 'Go to Settings']) expect(text).toContain(label)
    expect(text).toContain('Ctrl')
  })

  it('should show ⌘ instead of Ctrl on a Mac', async () => {
    platform.mac = true
    await openHelp()
    const text = await showNavigation()

    expect(text).toContain('⌘')
    expect(text).not.toContain('Ctrl')
  })

  it('should close with Close', async () => {
    await openHelp()
    body('split-help-close').click()
    await flushPromises()

    expect(body('split-help')).toBeNull()
  })
})
