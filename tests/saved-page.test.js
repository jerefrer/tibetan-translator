/**
 * SavedPage: every saved term with its gloss, to search, sort, open, remove,
 * copy as a list, or clear (with a way back).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'

const env = vi.hoisted(() => ({ phone: false }))

vi.mock('../src/services/resize-service', () => ({
  default: { isMobile: () => env.phone, subscribe: vi.fn(), unsubscribe: vi.fn() },
}))

vi.mock('../src/services/glosses', async (importOriginal) => ({
  ...(await importOriginal()),
  loadGlosses: vi.fn(async (terms) => terms.map((term) => [term, { 'ཀ་': 'the first letter', 'བདེ་བ་': 'bliss, happiness', 'ཆོས་': 'dharma' }[term] || ''])),
}))

const writeToClipboard = vi.fn(async () => {})
vi.mock('../src/services/copy-service', async (importOriginal) => ({
  ...(await importOriginal()),
  writeToClipboard: (...args) => writeToClipboard(...args),
}))

import Storage from '../src/services/storage'
import { savedTerms, setSavedTerms } from '../src/services/saved-terms'
import SavedPage from '../src/components/saved/SavedPage.vue'

const snackbar = { open: vi.fn() }
let wrapper
let router

async function mountPage() {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/saved', component: SavedPage },
      { path: '/lookup/:term?', component: { template: '<div />' } },
    ],
  })
  router.push('/saved')
  await router.isReady()
  wrapper = mount({ template: '<router-view />' }, {
    attachTo: document.body,
    global: { plugins: [router], provide: { snackbar } },
  })
  await flushPromises()
  return wrapper
}

const rows = () => wrapper.findAll('[data-testid="saved-row"]')
const terms = () => rows().map((row) => row.find('.saved-row__term').text())
const byTestId = (id) => wrapper.find(`[data-testid="${id}"]`)

beforeEach(() => {
  env.phone = false
  Storage.delete('savedTerms')
  Storage.delete('savedOrder')
  // Newest first, as saved: ཆོས་ last saved
  setSavedTerms(['ཆོས་', 'བདེ་བ་', 'ཀ་'])
  writeToClipboard.mockClear()
  snackbar.open.mockClear()
})

afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
})

describe('SavedPage', () => {
  it('should list every saved term, newest first, each with its gloss', async () => {
    await mountPage()
    expect(wrapper.find('h1').text()).toBe('Saved')
    expect(byTestId('saved-summary').text()).toBe('3 terms')
    expect(terms()).toEqual(['ཆོས་', 'བདེ་བ་', 'ཀ་'])
    expect(rows()[1].text()).toContain('bliss, happiness')
  })

  it('should open a term in Lookup', async () => {
    await mountPage()
    await rows()[1].find('[data-testid="saved-open"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/lookup/' + encodeURIComponent('བདེ་བ་'))
  })

  it('should remove one term', async () => {
    await mountPage()
    await rows()[0].find('[data-testid="saved-remove"]').trigger('click')
    expect(savedTerms()).toEqual(['བདེ་བ་', 'ཀ་'])
    expect(terms()).toEqual(['བདེ་བ་', 'ཀ་'])
  })

  it('should find terms by their Tibetan, their Wylie or their gloss', async () => {
    await mountPage()
    const search = byTestId('saved-search').find('input')
    await search.setValue('བདེ')
    expect(terms()).toEqual(['བདེ་བ་'])
    await search.setValue('chos')
    expect(terms()).toEqual(['ཆོས་'])
    await search.setValue('letter')
    expect(terms()).toEqual(['ཀ་'])
    await search.setValue('zzz')
    expect(byTestId('saved-no-match').exists()).toBe(true)
  })

  it('should keep a term saved elsewhere after the clear when the clear is undone', async () => {
    await mountPage()
    await byTestId('saved-clear').trigger('click')
    setSavedTerms(['སེམས་'])
    await byTestId('saved-undo').trigger('click')
    expect(savedTerms()).toEqual(['སེམས་', 'ཆོས་', 'བདེ་བ་', 'ཀ་'])
  })

  it('should copy the list, one term and its gloss per line, ready for a spreadsheet', async () => {
    await mountPage()
    await byTestId('saved-copy').trigger('click')
    await flushPromises()
    expect(writeToClipboard).toHaveBeenCalledWith('ཆོས་\tdharma\nབདེ་བ་\tbliss, happiness\nཀ་\tthe first letter')
    expect(snackbar.open).toHaveBeenCalledWith('Copied 3 terms')
  })

  it('should copy only the terms a search shows', async () => {
    await mountPage()
    await byTestId('saved-search').find('input').setValue('chos')
    await byTestId('saved-copy').trigger('click')
    await flushPromises()
    expect(writeToClipboard).toHaveBeenCalledWith('ཆོས་\tdharma')
  })

  it('should clear every term, and bring them back with Undo', async () => {
    await mountPage()
    await byTestId('saved-clear').trigger('click')
    expect(savedTerms()).toEqual([])
    expect(byTestId('saved-undo-bar').text()).toContain('3 terms removed')
    await byTestId('saved-undo').trigger('click')
    expect(savedTerms()).toEqual(['ཆོས་', 'བདེ་བ་', 'ཀ་'])
    expect(byTestId('saved-undo-bar').exists()).toBe(false)
  })

  it('should list the terms in Tibetan order on request, and remember it', async () => {
    setSavedTerms(['ང་', 'བསྒྲུབ་', 'ཀ་'])
    await mountPage()
    await byTestId('saved-order').find('[role="radio"]:last-child').trigger('click')
    // བསྒྲུབ་ goes under its root letter ག, not its prefix བ
    expect(terms()).toEqual(['ཀ་', 'བསྒྲུབ་', 'ང་'])
    wrapper.unmount()
    await mountPage()
    expect(terms()).toEqual(['ཀ་', 'བསྒྲུབ་', 'ང་'])
    await byTestId('saved-order').find('[role="radio"]:first-child').trigger('click')
    expect(terms()).toEqual(['ང་', 'བསྒྲུབ་', 'ཀ་'])
  })

  it('should copy the list in the order shown', async () => {
    await mountPage()
    await byTestId('saved-order').find('[role="radio"]:last-child').trigger('click')
    await byTestId('saved-copy').trigger('click')
    await flushPromises()
    expect(writeToClipboard).toHaveBeenCalledWith('ཀ་\tthe first letter\nཆོས་\tdharma\nབདེ་བ་\tbliss, happiness')
  })

  it('should say how to save a term when none is saved', async () => {
    setSavedTerms([])
    await mountPage()
    expect(byTestId('saved-empty').text()).toContain('Save')
    expect(byTestId('saved-copy').exists()).toBe(false)
  })

  it('should follow a term saved or removed elsewhere', async () => {
    await mountPage()
    setSavedTerms(['ཀ་'])
    window._triggerEvent('saved-terms-updated')
    await flushPromises()
    expect(terms()).toEqual(['ཀ་'])
  })

  it('should link back to Lookup on a phone', async () => {
    env.phone = true
    await mountPage()
    await byTestId('saved-back').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/lookup')
  })
})
