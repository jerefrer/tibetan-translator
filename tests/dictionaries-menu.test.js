/**
 * The Dictionaries button and menu (ResultsAndPaginationAndDictionaries.vue),
 * shared by Define, Search and Split, and the mixin that feeds it.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive, nextTick } from 'vue'

import ResultsAndPaginationAndDictionaries from '../src/components/ResultsAndPaginationAndDictionaries.vue'
import DictionariesMenuMixin from '../src/components/DictionariesMenuMixin'
import EventHandlers from '../src/services/event-handlers'
import Storage from '../src/services/storage'

const makeDictionaries = () =>
  reactive([
    { id: 1, shortLabel: 'Rangjung Yeshe', enabled: true, enabledInPreferences: true, numberOfEntries: 2 },
    { id: 2, shortLabel: 'Hopkins 2015', enabled: true, enabledInPreferences: true, numberOfEntries: 1 },
    { id: 3, shortLabel: 'Richard Barron', enabled: false, enabledInPreferences: false, numberOfEntries: 1 },
  ])

let wrapper
let dictionaries
const body = (testid) => document.body.querySelector(`[data-testid="${testid}"]`)
const rows = () => Array.from(document.body.querySelectorAll('[data-testid="dictionaries-menu-row"]'))
const press = (key, modifiers = {}) => {
  const event = { key, preventDefault: vi.fn(), ...modifiers }
  EventHandlers.handlers
    .filter((handler) => handler.id === 'dictionary-menu')
    .forEach((handler) => handler.callback(event))
  return event
}

// What keep-alive does when it caches or shows the page again
const callHook = (vm, name) => [].concat(vm.$options[name]).forEach((hook) => hook.call(vm))

function mountMenu(props = {}) {
  dictionaries = makeDictionaries()
  wrapper = mount(ResultsAndPaginationAndDictionaries, {
    props: { dictionaries, totalNumberOfEntries: 4, hidePagination: true, ...props },
    attachTo: document.body,
  })
  return wrapper
}

async function openMenu() {
  wrapper.vm.openMenu()
  await flushPromises()
}

beforeEach(() => {
  vi.useRealTimers()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('Dictionaries button', () => {
  it('should show how many dictionaries are enabled out of those with results', () => {
    mountMenu()
    expect(wrapper.find('[data-testid="dictionaries-menu-button"]').text()).toBe('Dictionaries · 2/3')
  })

  it('should show the plain count when every dictionary is enabled', () => {
    mountMenu()
    dictionaries[2].enabled = true
    return nextTick().then(() => {
      expect(wrapper.find('[data-testid="dictionaries-menu-button"]').text()).toBe('Dictionaries · 3')
    })
  })

  it('should stand out when the choice differs from Settings', async () => {
    mountMenu()
    const button = () => wrapper.find('[data-testid="dictionaries-menu-button"]')
    expect(button().classes()).not.toContain('is-filtered')

    dictionaries[0].enabled = false
    await nextTick()

    expect(button().classes()).toContain('is-filtered')
  })

  it('should not show without results', () => {
    mountMenu({ totalNumberOfEntries: 0 })
    expect(wrapper.find('[data-testid="dictionaries-menu-button"]').exists()).toBe(false)
  })

  it('should open the menu on click', async () => {
    mountMenu()
    await wrapper.find('[data-testid="dictionaries-menu-button"]').trigger('click')
    await flushPromises()
    expect(body('dictionaries-menu')).not.toBeNull()
    expect(rows()).toHaveLength(3)
  })
})

describe('Dictionaries menu', () => {
  it('should toggle a dictionary when its row is clicked', async () => {
    mountMenu()
    await openMenu()

    rows()[0].click()
    expect(dictionaries[0].enabled).toBe(false)
    rows()[0].click()
    expect(dictionaries[0].enabled).toBe(true)
  })

  it('should toggle a dictionary from its switch without the row toggling it back', async () => {
    mountMenu()
    await openMenu()

    rows()[2].querySelector('[data-testid="ui-switch-control"]').click()
    await nextTick()

    expect(dictionaries[2].enabled).toBe(true)
  })

  it('should keep only one dictionary on Ctrl/Cmd+click, then close', async () => {
    vi.useFakeTimers()
    mountMenu()
    await openMenu()

    rows()[1].dispatchEvent(new MouseEvent('click', { bubbles: true, metaKey: true }))

    expect(dictionaries.map((d) => d.enabled)).toEqual([false, true, false])
    vi.advanceTimersByTime(600)
    expect(wrapper.vm.dictionariesMenu).toBe(false)
  })

  it('should keep only one dictionary on a long press', async () => {
    vi.useFakeTimers()
    mountMenu()
    await openMenu()

    rows()[2].dispatchEvent(new Event('touchstart'))
    vi.advanceTimersByTime(550)
    rows()[2].dispatchEvent(new Event('touchend'))
    // The click that follows the long press must not toggle it off again
    rows()[2].click()

    expect(dictionaries.map((d) => d.enabled)).toEqual([false, false, true])
  })

  it('should filter by fuzzy match and underline the matched letters', async () => {
    mountMenu()
    await openMenu()

    wrapper.vm.term = 'rb'
    await nextTick()

    expect(rows()).toHaveLength(1)
    expect(rows()[0].innerHTML).toContain('<b><u>R</u></b>')
  })

  it('should say when no dictionary matches', async () => {
    mountMenu()
    await openMenu()

    wrapper.vm.term = 'zzz'
    await nextTick()

    expect(body('dictionaries-menu-empty').textContent).toContain('No matching dictionary')
  })

  it('should enable all, none, or restore the Settings choice for the listed dictionaries', async () => {
    mountMenu()
    await openMenu()

    body('dictionaries-menu-all').click()
    expect(dictionaries.every((d) => d.enabled)).toBe(true)

    body('dictionaries-menu-none').click()
    expect(dictionaries.some((d) => d.enabled)).toBe(false)

    body('dictionaries-menu-restore').click()
    expect(dictionaries.map((d) => d.enabled)).toEqual([true, true, false])
  })

  it('should tell the page when it closes, so the page can focus its field', async () => {
    mountMenu()
    await openMenu()

    wrapper.vm.closeMenu()
    await nextTick()

    expect(wrapper.emitted('close:dictionariesMenu')).toHaveLength(1)
  })
})

describe('Dictionaries menu keyboard', () => {
  it('should open on Ctrl/Cmd+B when there are results', async () => {
    mountMenu()
    const event = press('b', { metaKey: true })
    expect(event.preventDefault).toHaveBeenCalled()
    expect(wrapper.vm.dictionariesMenu).toBe(true)
  })

  it('should not open on Ctrl/Cmd+B without results', () => {
    mountMenu({ totalNumberOfEntries: 0 })
    press('b', { ctrlKey: true })
    expect(wrapper.vm.dictionariesMenu).toBe(false)
  })

  it('should close on Escape', async () => {
    mountMenu()
    await openMenu()
    press('Escape')
    expect(wrapper.vm.dictionariesMenu).toBe(false)
  })

  it('should keep only the listed dictionaries on Enter, then close', async () => {
    vi.useFakeTimers()
    mountMenu()
    await openMenu()
    wrapper.vm.term = 'hop'
    await nextTick()

    press('Enter')
    vi.advanceTimersByTime(600)

    expect(dictionaries.map((d) => d.enabled)).toEqual([false, true, false])
    expect(wrapper.vm.dictionariesMenu).toBe(false)
  })

  it('should run Shift or Ctrl + A, N, R and Enter on the listed dictionaries', async () => {
    mountMenu()
    await openMenu()

    press('A', { shiftKey: true })
    expect(dictionaries.every((d) => d.enabled)).toBe(true)
    press('n', { ctrlKey: true })
    expect(dictionaries.some((d) => d.enabled)).toBe(false)
    press('R', { shiftKey: true })
    expect(dictionaries.map((d) => d.enabled)).toEqual([true, true, false])
  })

  it('should move through the rows with Up/Down, toggle with Space and keep only the highlighted one with Enter', async () => {
    vi.useFakeTimers()
    mountMenu()
    await openMenu()

    press('ArrowDown')
    press('ArrowDown')
    await nextTick()
    expect(rows()[1].classList).toContain('is-highlighted')

    press(' ')
    expect(dictionaries[1].enabled).toBe(false)

    press('ArrowDown')
    press('Enter')
    expect(dictionaries.map((d) => d.enabled)).toEqual([false, false, true])
  })

  it('should stop listening while its page is cached by keep-alive', () => {
    mountMenu()
    callHook(wrapper.vm, 'deactivated')
    expect(EventHandlers.handlers.some((handler) => handler.id === 'dictionary-menu')).toBe(false)

    callHook(wrapper.vm, 'activated')
    expect(EventHandlers.handlers.some((handler) => handler.id === 'dictionary-menu')).toBe(true)
  })
})

describe('DictionariesMenuMixin', () => {
  const Host = {
    mixins: [DictionariesMenuMixin],
    data: () => ({ entries: [] }),
    template: '<div />',
  }

  beforeEach(() => {
    Storage.set('dictionaries', [
      { id: 1, name: 'RangjungYeshe', position: 2, enabled: true },
      { id: 2, name: 'Hopkins2015', position: 1, enabled: true },
      { id: 3, name: 'RichardBarron', position: 3, enabled: false },
    ])
  })

  it('should only keep entries of enabled dictionaries, in the Settings order', async () => {
    const host = mount(Host)
    host.vm.entries = [
      { dictionaryId: 1, definition: 'a' },
      { dictionaryId: 2, definition: 'b' },
      { dictionaryId: 3, definition: 'c' },
    ]
    host.vm.resetDictionariesToDefaultAndSetNumberOfEntries()
    await nextTick()

    expect(host.vm.entriesForEnabledDictionaries.map((entry) => entry.definition)).toEqual(['b', 'a'])
    expect(host.vm.dictionariesForCurrentResults).toHaveLength(3)
    host.unmount()
  })

  it('should reset a choice made in the menu on the next lookup', async () => {
    const host = mount(Host)
    host.vm.entries = [{ dictionaryId: 1 }, { dictionaryId: 2 }]
    host.vm.resetDictionariesToDefaultAndSetNumberOfEntries()
    host.vm.dictionaries[0].enabled = false

    host.vm.resetDictionariesToDefaultAndSetNumberOfEntries()

    expect(host.vm.dictionaries[0].enabled).toBe(true)
    expect(host.vm.dictionaries[0].numberOfEntries).toBe(1)
    host.unmount()
  })

  it('should reload the Settings choice when the page is shown again', () => {
    const host = mount(Host)
    Storage.set('dictionaries', [{ id: 1, name: 'RangjungYeshe', position: 1, enabled: false }])

    callHook(host.vm, 'activated')

    expect(host.vm.dictionaries).toEqual([
      { id: 1, name: 'RangjungYeshe', position: 1, enabled: false, enabledInPreferences: false },
    ])
    host.unmount()
  })
})
