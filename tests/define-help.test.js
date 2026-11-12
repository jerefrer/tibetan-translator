/**
 * The "Looking up a word" help dialog, opened from Library's help rows.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const platform = vi.hoisted(() => ({ tauri: true }))
vi.mock('../src/config/platform.js', () => ({
  isTauri: () => platform.tauri,
  isMacOS: () => false,
  isMobile: () => false,
}))

import DefinePageHelpDialogWithButton from '../src/components/DefinePageHelpDialogWithButton.vue'

let wrapper
const body = (testid) => document.body.querySelector(`[data-testid="${testid}"]`)
const tabLabels = () =>
  Array.from(document.body.querySelectorAll('.ui-tabs__trigger')).map((tab) => tab.textContent.trim())

// Library opens the dialog from its help rows with open()
async function openHelp() {
  wrapper = mount(DefinePageHelpDialogWithButton, { attachTo: document.body })
  wrapper.vm.open()
  await flushPromises()
  return wrapper
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  platform.tauri = true
})

describe('Define help', () => {
  it('should render no button of its own, only the dialog Library opens', async () => {
    wrapper = mount(DefinePageHelpDialogWithButton, { attachTo: document.body })
    expect(wrapper.find('button').exists()).toBe(false)
    expect(body('define-help')).toBeNull()
  })

  it('should open on how to look up a word, with the Quick Lookup and Navigation tabs in the desktop app', async () => {
    await openHelp()

    expect(document.body.querySelector('.ui-dialog__title').textContent).toBe('Looking up a word')
    expect(tabLabels()).toEqual(['Looking up', 'Dictionaries filter', 'Quick Lookup', 'Navigation'])
    const lookup = body('define-help').textContent
    for (const text of ['བོད', 'EN', 'sangs rgyas', 'In short', 'Recent', 'Saved']) expect(lookup).toContain(text)

    wrapper.vm.tab = 'dictionaries'
    await flushPromises()
    const menuHelp = body('dictionaries-menu-help').textContent
    for (const text of ['All', 'More…', 'Dictionary preferences', 'Library', 'Alt']) expect(menuHelp).toContain(text)
    expect(menuHelp).not.toContain('Ctrl + click')
    expect(menuHelp).not.toContain('B for Browse')
  })

  it('should leave out Quick Lookup outside the desktop app', async () => {
    platform.tauri = false
    await openHelp()
    expect(tabLabels()).toEqual(['Looking up', 'Dictionaries filter', 'Navigation'])
  })

  it('should leave out Navigation and the keyboard hint on a phone', async () => {
    window.innerWidth = 390
    await openHelp()

    expect(tabLabels()).not.toContain('Navigation')
    wrapper.vm.tab = 'dictionaries'
    await flushPromises()
    const menuHelp = body('dictionaries-menu-help').textContent
    expect(menuHelp).toContain('More…')
    expect(menuHelp).toContain('Dictionary preferences')
    expect(menuHelp).not.toContain('Alt')
  })

  it('should list Up/Down and the page shortcuts under Navigation', async () => {
    await openHelp()
    wrapper.vm.tab = 'navigation'
    await flushPromises()

    const text = body('define-help').textContent
    expect(text).toContain('Select previous entry in results')
    expect(text).toContain('Go to Lookup')
    expect(text).toContain('Search the definitions (Lookup in EN)')
    expect(text).toContain('Go to Library settings')
  })

  it('should close from its Close button', async () => {
    await openHelp()
    body('define-help-close').click()
    await flushPromises()
    expect(body('define-help')).toBeNull()
  })
})
