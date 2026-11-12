/**
 * The "Searching the definitions" help dialog, opened from Library's help
 * rows.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('../src/config/platform.js', () => ({
  isTauri: () => true,
  isMacOS: () => false,
  isMobile: () => false,
}))

import SearchPageHelpDialogWithButton from '../src/components/SearchPageHelpDialogWithButton.vue'

let wrapper
const body = (testid) => document.body.querySelector(`[data-testid="${testid}"]`)
const tabLabels = () =>
  Array.from(document.body.querySelectorAll('.ui-tabs__trigger')).map((tab) => tab.textContent.trim())

// Library opens the dialog from its help rows with open()
async function openHelp() {
  wrapper = mount(SearchPageHelpDialogWithButton, { attachTo: document.body })
  wrapper.vm.open()
  await flushPromises()
  return wrapper
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('Search help', () => {
  it('should render no button of its own, only the dialog Library opens', async () => {
    wrapper = mount(SearchPageHelpDialogWithButton, { attachTo: document.body })
    expect(wrapper.find('button').exists()).toBe(false)
    expect(body('search-help')).toBeNull()
  })

  it('should open on how to search in Lookup, with every tab of the old help', async () => {
    await openHelp()

    expect(document.body.querySelector('.ui-dialog__title').textContent).toBe('Searching the definitions')
    const overview = body('search-help-overview').textContent
    for (const text of ['&', '(sangs rgyas)', '[trenpa]', '{trenpa}']) expect(overview).toContain(text)
    expect(body('search-help').textContent).toContain('EN')
    expect(body('search-help').textContent).toContain('Advanced')
    expect(tabLabels()).toEqual([
      'In Lookup',
      'Advanced builder',
      'Syntax Examples',
      'Phonetic search',
      'Wylie support',
      'Dictionaries filter',
      'Navigation',
    ])
    wrapper.vm.tab = 'builder'
    await flushPromises()
    const modes = body('search-help-modes').textContent
    for (const text of ['contains (Wylie)', 'sounds precisely like', 'sounds more or less like', '[term]', '{term}', '(term)'])
      expect(modes).toContain(text)
    expect(body('search-help').textContent).toContain('Your preference is remembered.')
  })

  it('should link the syntax examples to the Wylie tab', async () => {
    await openHelp()
    wrapper.vm.tab = 'syntax'
    await flushPromises()
    expect(body('search-help-syntax').textContent).toContain('seven & limbs & enlightenment')

    body('search-help-to-wylie').click()
    await flushPromises()

    expect(wrapper.vm.tab).toBe('wylie')
    expect(body('search-help-wylie').textContent).toContain('(sangs rgyas kyi chos)')
  })

  it('should explain phonetic search', async () => {
    await openHelp()
    wrapper.vm.tab = 'phonetics'
    await flushPromises()

    const text = body('search-help').textContent
    expect(text).toContain('[chomdende]')
    expect(text).toContain('Curly brackets are more open-minded')
  })

  it('should explain the Dictionaries menu', async () => {
    await openHelp()
    wrapper.vm.tab = 'dictionaries'
    await flushPromises()
    expect(body('dictionaries-menu-help').textContent).toContain('Ctrl + click on a dictionary')
  })

  it('should list the page shortcuts under Navigation, and leave the tab out on a phone', async () => {
    await openHelp()
    wrapper.vm.tab = 'navigation'
    await flushPromises()
    expect(body('search-help').textContent).toContain('Search the definitions (Lookup in EN)')
    wrapper.unmount()
    document.body.innerHTML = ''

    window.innerWidth = 390
    await openHelp()
    expect(tabLabels()).not.toContain('Navigation')
  })

  it('should close from its Close button', async () => {
    await openHelp()
    body('search-help-close').click()
    await flushPromises()
    expect(body('search-help')).toBeNull()
  })
})
