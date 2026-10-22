/**
 * The help button and dialog of the Search page.
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

async function openHelp(path = '/search/wakefulness') {
  wrapper = mount(SearchPageHelpDialogWithButton, {
    attachTo: document.body,
    global: { mocks: { $route: { path } } },
  })
  const button = wrapper.find('[data-testid="search-help-button"]')
  if (button.exists()) {
    await button.trigger('click')
    await flushPromises()
  }
  return wrapper
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('Search help', () => {
  it('should only show its button on the Search page', async () => {
    await openHelp('/define/x')
    expect(wrapper.find('[data-testid="search-help-button"]').exists()).toBe(false)
  })

  it('should open on the query builder, with every tab of the old help', async () => {
    await openHelp()

    expect(document.body.querySelector('.ui-dialog__title').textContent).toBe('How to use the search page')
    expect(tabLabels()).toEqual([
      'Query Builder',
      'Syntax Examples',
      'Phonetic search',
      'Wylie support',
      'Dictionaries filter',
      'Navigation',
    ])
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
    expect(body('search-help').textContent).toContain('Go to Search page')
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
