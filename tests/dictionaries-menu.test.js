/**
 * DictionariesMenuMixin: the dictionaries of the current results, as the
 * user's Library settings enable and order them. TermEntry builds on it.
 * (The Dictionaries menu it once fed, shared by Define, Search and Split,
 * went with those pages: TermEntry's dictionary tabs replace it.)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

import DictionariesMenuMixin from '../src/components/DictionariesMenuMixin'
import Storage from '../src/services/storage'

// What keep-alive does when it caches or shows the page again
const callHook = (vm, name) => [].concat(vm.$options[name]).forEach((hook) => hook.call(vm))

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

  it('should count each dictionary\'s entries and list only those with some, whatever the id type', async () => {
    const host = mount(Host)
    host.vm.entries = [{ dictionaryId: 1 }, { dictionaryId: '1' }, { dictionaryId: 3 }]
    host.vm.resetDictionariesToDefaultAndSetNumberOfEntries()
    await nextTick()

    expect(host.vm.dictionaries.map((d) => d.numberOfEntries)).toEqual([2, 0, 1])
    expect(host.vm.dictionariesForCurrentResults.map((d) => d.id)).toEqual([1, 3])
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
