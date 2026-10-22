/**
 * The Split screen (SegmentPage.vue), mounted the way App.vue mounts it: a
 * real router and a <keep-alive> around the <router-view>, so activated() and
 * deactivated() behave as in the app.
 *
 * Each block maps to the behaviours listed in docs/redesign/reports/split.md
 * (L = lifecycle, A = text area, B = buttons and tokenizer, T = terms,
 * P = definitions, R = dividers, M = phone).
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import { h, KeepAlive, nextTick } from 'vue'

vi.mock('../src/config/platform.js', () => ({
  isTauri: () => true,
  isMacOS: () => false,
  isMobile: () => false,
  supportsModularPacks: () => true,
}))

const database = vi.hoisted(() => ({ getEntriesFor: null }))
vi.mock('../src/services/sql-database', () => ({ default: database }))

// A tokenizer that knows the words below, longest first, and calls anything
// else a syllable. Punctuation comes back as its own chunk, as Botok does.
const tokenizer = vi.hoisted(() => ({ created: 0, words: [] }))
vi.mock('tibetan-word-tokenizer', () => ({
  createTokenizer: () => {
    tokenizer.created++
    return {
      tokenize(text) {
        const tokens = []
        for (let rest of text.split(/\s+/)) while (rest) {
          if (/^[།༔༑]/.test(rest)) {
            tokens.push({ text: rest[0], chunkType: 'PUNCT' })
            rest = rest.slice(1)
            continue
          }
          const word = tokenizer.words.find((candidate) => rest.startsWith(candidate)) || rest.match(/^[^་།༔༑]+་?/)[0]
          tokens.push({ text: word, chunkType: 'TEXT' })
          rest = rest.slice(word.length)
        }
        return tokens
      },
    }
  },
}))

import SegmentPage from '../src/components/SegmentPage.vue'
import Storage from '../src/services/storage'

const BCOMLDANDAS = 'བཅོམ་ལྡན་འདས་'
const MA = 'མ་'
const SHESRAB = 'ཤེས་རབ་'
const KYI = 'ཀྱི་'
const PHAROL = 'ཕ་རོལ་'
const TEXT = BCOMLDANDAS + MA + SHESRAB + KYI + PHAROL + '།'
const SPLIT_TEXT = [BCOMLDANDAS, MA, SHESRAB, KYI, PHAROL].join(' ')

const DICTIONARIES = [
  { id: 1, name: 'RangjungYeshe', position: 2, enabled: true },
  { id: 2, name: 'Hopkins2015', position: 1, enabled: true },
  { id: 3, name: 'RichardBarron', position: 3, enabled: false },
]
const entry = (term, dictionaryId, definition) => ({
  term,
  dictionaryId,
  dictionary: DICTIONARIES.find((dictionary) => dictionary.id === dictionaryId).name,
  definition,
})
// PHAROL alone has no entry. The joined terms that have one get merge buttons:
// 2 terms from 0, 4 terms from 1, 2 and 3 terms from 2.
const ENTRIES = {
  [BCOMLDANDAS]: [entry(BCOMLDANDAS, 1, 'Blessed One')],
  [MA]: [entry(MA, 1, 'mother')],
  [SHESRAB]: [
    entry(SHESRAB, 1, 'wisdom (RY)'),
    entry(SHESRAB, 2, 'wisdom (Hopkins)'),
    entry(SHESRAB, 3, 'disabled in Settings'),
  ],
  [KYI]: [entry(KYI, 1, 'genitive')],
  [BCOMLDANDAS + MA]: [entry(BCOMLDANDAS + MA, 1, 'Bhagavati')],
  [MA + SHESRAB + KYI + PHAROL]: [entry('x', 1, 'four')],
  [SHESRAB + KYI]: [entry(SHESRAB + KYI, 1, 'of wisdom')],
  [SHESRAB + KYI + PHAROL]: [entry(SHESRAB + KYI + PHAROL, 1, 'beyond wisdom')],
}

const snackbar = { open: vi.fn() }
const Placeholder = { template: '<div class="placeholder" />' }
const desktopWidth = window.innerWidth

let wrapper
let router

const Shell = {
  render: () =>
    h(RouterView, null, {
      default: ({ Component }) => h(KeepAlive, null, [Component ? h(Component) : null]),
    }),
}

async function mountPage() {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/segment', component: SegmentPage },
      { path: '/settings', component: Placeholder },
    ],
  })
  router.push('/segment')
  await router.isReady()
  wrapper = mount(Shell, {
    attachTo: document.body,
    global: { plugins: [router], provide: { snackbar } },
  })
  await flushPromises()
  return wrapper
}

const page = () => wrapper.findComponent(SegmentPage)
const textarea = () => wrapper.find('[data-testid="split-text"] textarea')
const terms = () => wrapper.findAll('[data-testid="split-term"] .term-item__text').map((item) => item.text())
const termItems = () => wrapper.findAll('[data-testid="split-term"]')
const selectedTerms = () => termItems().filter((item) => item.classes('is-active')).map((item) => item.text())
const testid = (id) => wrapper.find(`[data-testid="${id}"]`)
const mergeLabels = () => wrapper.findAll('[data-testid="split-merge-button"]').map((button) => button.attributes('aria-label'))
const visible = (selector) => {
  const element = wrapper.find(selector)
  return element.exists() && element.element.style.display !== 'none'
}
const lookedUp = () => database.getEntriesFor.mock.calls.map(([term]) => term)

function key(target, init) {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

// happy-dom does not deliver events dispatched on window to its listeners, so
// Up/Down are handed to the page's handler, and its registration is checked
// separately.
function arrow(key, target = document.body) {
  const event = { key, target, defaultPrevented: false, preventDefault: vi.fn() }
  page().vm.handleKeydown(event)
  return event
}

// Splits TEXT with the button and waits for the merges to be known
async function splitText(text = TEXT) {
  await textarea().setValue(text)
  await testid('split-words').trigger('click')
  await vi.waitFor(() => expect(page().vm.segmenting).toBe(false))
  await flushPromises()
  await vi.waitFor(() => expect(Object.keys(page().vm.possibleMerges).length).toBeGreaterThan(0), { timeout: 2000 })
  await flushPromises()
}

// Types text and waits for the terms to follow it (500 ms debounce)
async function typeAndWait(text, expectedTerms) {
  await textarea().setValue(text)
  await vi.waitFor(() => expect(terms()).toEqual(expectedTerms), { timeout: 2000 })
  await flushPromises()
}

beforeAll(async () => {
  // Warm the legacy-font tables (dynamic import) so the paste test is not the
  // one paying for it.
  const { convertLegacyPaste } = await import('../src/services/legacy-to-unicode.js')
  await convertLegacyPaste({ text: '<$<-{<-' })
})

beforeEach(() => {
  tokenizer.created = 0
  tokenizer.words = [BCOMLDANDAS, SHESRAB, PHAROL]
  globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) }))
  database.getEntriesFor = vi.fn(async (term) => (ENTRIES[term] || []).map((row) => ({ ...row })))
  snackbar.open.mockClear()
  Storage.set('dictionaries', DICTIONARIES)
  // Storage writes localStorage properties, which the setup's clear() keeps
  Storage.delete('segment.topHeight')
  Storage.delete('segment.leftWidth')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  window.innerWidth = desktopWidth
  vi.restoreAllMocks()
})

describe('Split — route and lifecycle', () => {
  it('should open at /segment, with the segment-page class the selection popup relies on (L1, L5)', async () => {
    await mountPage()

    expect(page().exists()).toBe(true)
    expect(page().classes()).toContain('segment-page')
  })

  it('should keep the text, the terms and the selection when you leave and come back, and focus the text (L2, L3)', async () => {
    await mountPage()
    await splitText()
    await termItems()[2].trigger('click')
    const splitPage = page().vm

    await router.push('/settings')
    await flushPromises()
    document.activeElement?.blur?.()
    await router.push('/segment')
    await flushPromises()

    expect(page().vm).toBe(splitPage)
    expect(textarea().element.value).toBe(SPLIT_TEXT)
    expect(terms()).toEqual([BCOMLDANDAS, MA, SHESRAB, KYI, PHAROL])
    expect(selectedTerms()).toEqual([SHESRAB])
    expect(document.activeElement).toBe(textarea().element)
  })

  it('should listen to Up/Down only while it is shown (L6)', async () => {
    const added = vi.spyOn(window, 'addEventListener')
    const removed = vi.spyOn(window, 'removeEventListener')
    // The last call made for the handler, add or remove
    const lastCall = (spy, handler) =>
      Math.max(-1, ...spy.mock.calls
        .map((call, index) => (call[0] === 'keydown' && call[1] === handler ? spy.mock.invocationCallOrder[index] : -1)))
    await mountPage()
    const handler = page().vm.handleKeydown
    const listening = () => lastCall(added, handler) > lastCall(removed, handler)
    expect(listening()).toBe(true)

    await router.push('/settings')
    await flushPromises()
    expect(listening()).toBe(false)

    await router.push('/segment')
    await flushPromises()
    expect(listening()).toBe(true)
  })

  it('should remove its Up/Down listener when unmounted', async () => {
    await mountPage()
    const handler = page().vm.handleKeydown
    const removed = vi.spyOn(window, 'removeEventListener')

    wrapper.unmount()
    wrapper = undefined

    expect(removed).toHaveBeenCalledWith('keydown', handler)
  })
})

describe('Split — text area', () => {
  it('should be a multi-line Tibetan field with the Split placeholder and no spelling aids (A1)', async () => {
    await mountPage()

    expect(testid('split-text').classes()).toEqual(expect.arrayContaining(['ui-field--tibetan', 'ui-field--multiline']))
    expect(textarea().attributes('placeholder')).toBe('Paste or type Tibetan text')
    expect(textarea().attributes('aria-label')).toBe('Tibetan text')
    expect(textarea().attributes('spellcheck')).toBe('false')
    expect(textarea().attributes('autocomplete')).toBe('off')
    expect(textarea().attributes('autocapitalize')).toBe('off')
    expect(textarea().attributes('autocorrect')).toBe('off')
    expect(wrapper.find('.v-input').exists()).toBe(false)
  })

  it('should type a tsheg for Space, at the caret and over the selection, and leave Shift+Space to the browser (A2)', async () => {
    await mountPage()
    await textarea().setValue('ཀཁ')
    textarea().element.setSelectionRange(1, 1)

    const space = key(textarea().element, { key: ' ' })
    await nextTick()
    expect(space.defaultPrevented).toBe(true)
    expect(textarea().element.value).toBe('ཀ་ཁ')

    textarea().element.setSelectionRange(0, 2)
    key(textarea().element, { key: ' ' })
    await nextTick()
    expect(textarea().element.value).toBe('་ཁ')

    expect(key(textarea().element, { key: ' ', shiftKey: true }).defaultPrevented).toBe(false)
  })

  it('should convert Wylie when Space or a tsheg is released, keeping spaces, line breaks and the final shad (A3)', async () => {
    await mountPage()
    await textarea().setValue('ka kha\nga།')

    await textarea().trigger('keyup', { key: ' ' })
    expect(textarea().element.value).toBe('ཀ ཁ\nག།')

    await textarea().setValue('ka་་kha')
    await textarea().trigger('keyup', { key: '་' })
    expect(textarea().element.value).toBe('ཀ་ཁ')

    await textarea().setValue('ka')
    await textarea().trigger('keyup', { key: 'a' })
    expect(textarea().element.value).toBe('ka')
  })

  it('should split with Ctrl+Enter or Cmd+Enter (A4)', async () => {
    await mountPage()
    await textarea().setValue(TEXT)

    expect(key(textarea().element, { key: 'Enter', ctrlKey: true }).defaultPrevented).toBe(true)
    await vi.waitFor(() => expect(terms()).toEqual([BCOMLDANDAS, MA, SHESRAB, KYI, PHAROL]))

    await textarea().setValue('ཀ་ཁ་')
    key(textarea().element, { key: 'Enter', metaKey: true })
    await vi.waitFor(() => expect(terms()).toEqual(['ཀ་', 'ཁ་']))

    expect(key(textarea().element, { key: 'Enter' }).defaultPrevented).toBe(false)
  })

  it('should convert Wylie and split the text after an ordinary paste, line breaks included (A5)', async () => {
    await mountPage()
    // The browser inserts the text itself; the page converts it 50 ms later
    const event = new Event('paste', { bubbles: true, cancelable: true })
    event.clipboardData = { getData: (type) => (type === 'text/plain' ? 'ka kha\nga' : '') }
    textarea().element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    await textarea().setValue('ka kha\nga')

    await vi.waitFor(() => expect(terms()).toEqual(['ཀ་', 'ཁ་', 'ག་']), { timeout: 2000 })
    expect(textarea().element.value).toBe('ཀ་ ཁ་ ག་')
  })

  it('should repair a paste in a pre-Unicode Tibetan font at the caret, then split (A5)', async () => {
    await mountPage()
    await textarea().setValue('ཀ་ ཁ་')
    textarea().element.setSelectionRange(3, 3)
    const legacy = '<$<-{<-' // སངས་རྒྱས་ in the TibetanChogyal encoding
    const event = new Event('paste', { bubbles: true, cancelable: true })
    event.clipboardData = {
      getData: (type) => (type === 'text/html' ? `<span style="font-family: TibetanChogyal">&lt;$&lt;-{&lt;-</span>` : legacy),
    }
    textarea().element.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    await vi.waitFor(() => expect(terms()).toEqual(['ཀ་', 'སངས་', 'རྒྱས་', 'ཁ་']), { timeout: 3000 })
  })

  it('should split where the spaces are, 500 ms after an edit, without the Split words button (A6)', async () => {
    await mountPage()

    await typeAndWait('བཅོམ་ལྡན་འདས མ་ ། ཤེས་རབ༔ ཀྱི།', ['བཅོམ་ལྡན་འདས་', 'མ་', 'ཤེས་རབ༔་', 'ཀྱི།'])

    expect(tokenizer.created).toBe(0)
    // Unknown and known terms are marked once looked up
    await vi.waitFor(() => expect(lookedUp()).toEqual(expect.arrayContaining(['བཅོམ་ལྡན་འདས་', 'མ་', 'ཤེས་རབ༔་', 'ཀྱི།'])))
  })

  it('should leave the terms alone when an edit does not change them (A6)', async () => {
    await mountPage()
    await typeAndWait('ཀ་ ཁ་', ['ཀ་', 'ཁ་'])
    const list = page().vm.termsList

    await textarea().setValue('ཀ་  ཁ་ ')
    await new Promise((resolve) => setTimeout(resolve, 700))

    expect(page().vm.termsList).toBe(list)
  })

  it('should keep the selected term selected where it moved, and check only the new terms (A7)', async () => {
    await mountPage()
    await splitText()
    await termItems()[2].trigger('click')
    await flushPromises()
    database.getEntriesFor.mockClear()

    await typeAndWait('ཀ་ ' + SPLIT_TEXT, ['ཀ་', BCOMLDANDAS, MA, SHESRAB, KYI, PHAROL])

    expect(selectedTerms()).toEqual([SHESRAB])
    const checkedAlone = lookedUp().filter((term) => [BCOMLDANDAS, MA, SHESRAB, KYI, PHAROL, 'ཀ་'].includes(term))
    expect(checkedAlone).toEqual(['ཀ་'])
  })

  it('should keep the selection at the same place and load its definitions when the selected term is edited away (A7)', async () => {
    await mountPage()
    await splitText()
    await termItems()[4].trigger('click')
    await flushPromises()
    database.getEntriesFor.mockClear()

    await typeAndWait([BCOMLDANDAS, MA, SHESRAB].join(' '), [BCOMLDANDAS, MA, SHESRAB])

    expect(selectedTerms()).toEqual([SHESRAB])
    await vi.waitFor(() => expect(testid('split-entries').exists()).toBe(true))
  })
})

describe('Split — Split words, Clear and the tokenizer', () => {
  it('should show Split words and Clear only when there is text, with the title moving into their row (B1)', async () => {
    await mountPage()

    expect(testid('split-words').exists()).toBe(false)
    expect(testid('split-clear').exists()).toBe(false)
    expect(testid('split-title').text()).toBe('Split')

    await textarea().setValue('ཀ')
    expect(testid('split-words').text()).toBe('Split words')
    expect(testid('split-clear').text()).toBe('Clear')
    expect(testid('split-title').exists()).toBe(false)
    expect(testid('split-header').text()).toContain('Add or remove spaces to change where words are split.')

    await textarea().setValue('   ')
    expect(testid('split-words').exists()).toBe(false)
  })

  it('should show a spinner on Split words while splitting (B1)', async () => {
    await mountPage()
    await textarea().setValue(TEXT)
    let resolveFetch
    globalThis.fetch = vi.fn(() => new Promise((resolve) => (resolveFetch = resolve)))

    await testid('split-words').trigger('click')
    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())
    expect(testid('split-words').attributes('aria-busy')).toBe('true')
    expect(testid('split-terms-count').text()).toBe('Segmenting...')

    resolveFetch({ ok: true, json: async () => ({}) })
    await vi.waitFor(() => expect(testid('split-words').attributes('aria-busy')).toBeUndefined())
  })

  it('should split into words, rewrite the text with one space between them, select the first and show its definitions (B2, B3)', async () => {
    await mountPage()
    await splitText()

    expect(terms()).toEqual([BCOMLDANDAS, MA, SHESRAB, KYI, PHAROL])
    // The final shad is not written back
    expect(textarea().element.value).toBe(SPLIT_TEXT)
    expect(selectedTerms()).toEqual([BCOMLDANDAS])
    await vi.waitFor(() => expect(testid('split-entries').text()).toContain('Blessed One'))
    expect(globalThis.fetch).toHaveBeenCalledWith('/botok-dictionary.json')
  })

  it('should load the tokenizer once, and keep the selected position on the next split (B2, B3)', async () => {
    await mountPage()
    await splitText()
    await termItems()[3].trigger('click')

    await testid('split-words').trigger('click')
    await flushPromises()

    expect(tokenizer.created).toBe(1)
    expect(page().vm.selectedTermIndex).toBe(3)
  })

  it('should say why the tokenizer failed, split by syllable instead, and try again next time (B4)', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false }))
    await mountPage()
    await textarea().setValue('ཤེས་རབ་ཀྱི།')
    await testid('split-words').trigger('click')
    await vi.waitFor(() => expect(terms()).toEqual(['ཤེས་', 'རབ་', 'ཀྱི་']))

    expect(testid('split-tokenizer-error').text()).toBe(
      'Dictionary not found. Please ensure botok-dictionary.json is in the public folder.'
    )
    expect(testid('split-tokenizer-error').attributes('role')).toBe('alert')

    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) }))
    await testid('split-words').trigger('click')
    await vi.waitFor(() => expect(tokenizer.created).toBe(1))
    expect(testid('split-tokenizer-error').exists()).toBe(false)
  })

  it('should empty the terms when splitting blank text (B5)', async () => {
    await mountPage()
    await splitText()

    await textarea().setValue('  ')
    key(textarea().element, { key: 'Enter', ctrlKey: true })
    await flushPromises()

    expect(terms()).toEqual([])
    expect(page().vm.selectedTermIndex).toBe(null)
    expect(page().vm.entries).toEqual([])
  })

  it('should clear the text, the terms, the selection, the definitions and the merges, and focus the text (B6)', async () => {
    await mountPage()
    await splitText()
    document.activeElement?.blur?.()

    await testid('split-clear').trigger('click')
    await nextTick()

    expect(textarea().element.value).toBe('')
    expect(terms()).toEqual([])
    expect(mergeLabels()).toEqual([])
    expect(testid('split-entries').exists()).toBe(false)
    expect(testid('split-terms-empty').text()).toBe('Paste text above to begin')
    expect(document.activeElement).toBe(textarea().element)
  })
})

describe('Split — terms', () => {
  it('should count the terms: "No terms", "1 term", "N terms" (T1)', async () => {
    await mountPage()
    expect(testid('split-terms-count').text()).toBe('No terms')

    await typeAndWait('ཀ་', ['ཀ་'])
    expect(testid('split-terms-count').text()).toBe('1 term')

    await typeAndWait('ཀ་ ཁ་', ['ཀ་', 'ཁ་'])
    expect(testid('split-terms-count').text()).toBe('2 terms')
  })

  it('should put the Dictionaries menu in the header once the selected term has entries, and focus the text when it closes (T2)', async () => {
    await mountPage()
    expect(testid('dictionaries-menu-button').exists()).toBe(false)

    await splitText()
    await vi.waitFor(() => expect(testid('dictionaries-menu-button').exists()).toBe(true))
    expect(wrapper.find('.terms-header [data-testid="dictionaries-menu-button"]').exists()).toBe(true)

    document.activeElement?.blur?.()
    wrapper.findComponent({ name: 'ResultsAndPaginationAndDictionaries' }).vm.$emit('close:dictionariesMenu')
    expect(document.activeElement).toBe(textarea().element)
  })

  it('should list the terms in text order, duplicates included (T3)', async () => {
    await mountPage()
    await typeAndWait('ཀ་ ཁ་ ཀ་', ['ཀ་', 'ཁ་', 'ཀ་'])

    expect(wrapper.find('[data-testid="split-terms"]').attributes('role')).toBe('listbox')
  })

  it('should select a clicked term and look it up by its canonical key (T4)', async () => {
    await mountPage()
    await typeAndWait('ཀ་ ཁ༔', ['ཀ་', 'ཁ༔་'])
    database.getEntriesFor.mockClear()

    await termItems()[1].trigger('click')
    await flushPromises()

    expect(selectedTerms()).toEqual(['ཁ༔་'])
    expect(termItems()[1].attributes('aria-selected')).toBe('true')
    expect(termItems()[0].attributes('aria-selected')).toBe('false')
    // The gter tsheg is dropped from the key
    expect(lookedUp()).toEqual(['ཁ་'])
  })

  it('should mark the terms with no entry, once they have been looked up (T5)', async () => {
    await mountPage()
    await textarea().setValue(TEXT)
    await testid('split-words').trigger('click')
    // Before the lookups, nothing is marked
    expect(wrapper.findAll('[data-testid="split-term-unknown"]')).toHaveLength(0)

    await vi.waitFor(() => expect(wrapper.findAll('[data-testid="split-term-unknown"]')).toHaveLength(1))
    const unknown = termItems()[4]
    expect(unknown.classes()).toContain('is-unknown')
    expect(unknown.find('[data-testid="split-term-unknown"]').attributes('aria-label')).toBe('No entry in your dictionaries')
    expect(termItems()[0].classes()).not.toContain('is-unknown')
  })

  it('should offer to merge 2, 3 or more adjacent terms only when the merged term has entries (T6)', async () => {
    await mountPage()
    await splitText()

    expect(mergeLabels().sort()).toEqual(
      [
        'Merge 2 terms: ' + BCOMLDANDAS + MA,
        'Merge 4 terms: ' + MA + SHESRAB + KYI + PHAROL,
        'Merge 2 terms: ' + SHESRAB + KYI,
        'Merge 3 terms: ' + SHESRAB + KYI + PHAROL,
      ].sort()
    )
    // Every joined term from 2 to 5 terms was tried
    expect(lookedUp()).toContain(BCOMLDANDAS + MA + SHESRAB + KYI + PHAROL)
    expect(lookedUp()).toContain(KYI + PHAROL)
  })

  it('should draw each merge as a bracket over its rows, in lanes that never overlap (T6)', async () => {
    await mountPage()
    await splitText()

    const brackets = page().vm.mergeBrackets
    for (const a of brackets)
      for (const b of brackets)
        if (a !== b && a.lane === b.lane)
          expect(a.start + a.count <= b.start || b.start + b.count <= a.start).toBe(true)

    expect(wrapper.findAll('[data-testid="split-merge"]')).toHaveLength(brackets.length)
    expect(brackets.map(({ start, count }) => [start, count])).toEqual([[0, 2], [1, 4], [2, 3], [2, 2]])
    expect(brackets.map(({ lane }) => lane)).toEqual([0, 1, 0, 2])
    // Positions come from the indexes (rows have a fixed height), not from measuring
    expect(page().vm.mergeBracketStyle(brackets[1])).toEqual({
      top: 'calc(var(--split-row) * 1 + 7px)',
      height: 'calc(var(--split-row) * 4 - 14px)',
      right: '44px',
    })
    expect(page().find('.terms-list').attributes('style')).toContain('--merge-lanes: 3')
  })

  it('should show the merged term and the count in the merge tooltip (T6)', async () => {
    await mountPage()
    await splitText()

    await wrapper.findAll('[data-testid="split-merge-button"]')[0].trigger('focus')
    await flushPromises()

    // Reka repeats the tip once more for screen readers
    expect(document.body.querySelector('[data-testid="ui-tooltip"]').textContent).toContain(
      BCOMLDANDAS + MA + ' · Merge 2 terms'
    )
  })

  it('should merge the terms, rewrite the text and select the merged term when the selection was in it (T7)', async () => {
    await mountPage()
    await splitText()
    await termItems()[3].trigger('click')
    await flushPromises()

    const button = wrapper.findAll('[data-testid="split-merge-button"]')
      .find((candidate) => candidate.attributes('aria-label') === 'Merge 3 terms: ' + SHESRAB + KYI + PHAROL)
    await button.trigger('click')
    await flushPromises()

    expect(terms()).toEqual([BCOMLDANDAS, MA, SHESRAB + KYI + PHAROL])
    expect(textarea().element.value).toBe([BCOMLDANDAS, MA, SHESRAB + KYI + PHAROL].join(' '))
    expect(selectedTerms()).toEqual([SHESRAB + KYI + PHAROL])
    await vi.waitFor(() => expect(testid('split-entries').text()).toContain('beyond wisdom'))
    // The merges around it are worked out again
    expect(mergeLabels()).toEqual([
      'Merge 2 terms: ' + BCOMLDANDAS + MA,
      'Merge 2 terms: ' + MA + SHESRAB + KYI + PHAROL,
    ])
    // The text rewrite does not split again
    await new Promise((resolve) => setTimeout(resolve, 600))
    expect(terms()).toEqual([BCOMLDANDAS, MA, SHESRAB + KYI + PHAROL])
  })

  it('should keep the selection on its term when merging elsewhere (T7)', async () => {
    await mountPage()
    await splitText()
    await termItems()[3].trigger('click')

    await wrapper.findAll('[data-testid="split-merge-button"]')
      .find((candidate) => candidate.attributes('aria-label').startsWith('Merge 2 terms: ' + BCOMLDANDAS))
      .trigger('click')
    await flushPromises()

    expect(selectedTerms()).toEqual([KYI])
    expect(page().vm.selectedTermIndex).toBe(2)
  })

  it('should move with Up/Down, from the first term when none is selected, without wrapping (T8)', async () => {
    await mountPage()
    await typeAndWait('ཀ་ ཁ་ ག་', ['ཀ་', 'ཁ་', 'ག་'])
    expect(selectedTerms()).toEqual([])

    expect(arrow('ArrowDown').preventDefault).toHaveBeenCalled()
    await nextTick()
    expect(selectedTerms()).toEqual(['ཀ་'])
    arrow('ArrowUp')
    await nextTick()
    expect(selectedTerms()).toEqual(['ཀ་'])
    arrow('ArrowDown')
    arrow('ArrowDown')
    arrow('ArrowDown')
    await nextTick()
    expect(selectedTerms()).toEqual(['ག་'])
    arrow('ArrowUp')
    await nextTick()
    expect(selectedTerms()).toEqual(['ཁ་'])
    // Other keys are left alone
    expect(arrow('ArrowLeft').preventDefault).not.toHaveBeenCalled()
  })

  it('should work from the text area too, and scroll the selected term into view (T8)', async () => {
    await mountPage()
    await typeAndWait('ཀ་ ཁ་', ['ཀ་', 'ཁ་'])
    const scrolled = vi.fn()
    Element.prototype.scrollIntoView = scrolled

    arrow('ArrowDown', textarea().element)
    await nextTick()
    await nextTick()

    expect(selectedTerms()).toEqual(['ཀ་'])
    expect(scrolled).toHaveBeenCalledWith({ block: 'nearest' })
    delete Element.prototype.scrollIntoView
  })

  it('should leave Up/Down to the Dictionaries menu, dialogs, dividers and other fields (T8)', async () => {
    await mountPage()
    await typeAndWait('ཀ་ ཁ་', ['ཀ་', 'ཁ་'])
    const menu = document.createElement('div')
    menu.className = 'dictionaries-menu'
    const filter = document.createElement('input')
    menu.appendChild(filter)
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    const otherField = document.createElement('input')
    document.body.append(menu, dialog, otherField)
    const event = (target, defaultPrevented = false) => ({ key: 'ArrowDown', target, defaultPrevented, preventDefault: vi.fn() })

    for (const target of [filter, dialog, otherField, wrapper.find('[role="separator"]').element]) {
      page().vm.handleKeydown(event(target))
    }
    page().vm.handleKeydown(event(document.body, true))

    expect(selectedTerms()).toEqual([])
  })

  it('should say what to do when there is no term (T9)', async () => {
    await mountPage()
    expect(testid('split-terms-empty').text()).toBe('Paste text above to begin')

    await textarea().setValue('།')
    await flushPromises()
    expect(testid('split-terms-empty').text()).toBe('Add spaces between words or click "Split words"')
  })
})

describe('Split — definitions', () => {
  it('should show a spinner while the definitions load (P1)', async () => {
    await mountPage()
    await typeAndWait(SHESRAB, [SHESRAB])
    let resolveLookup
    database.getEntriesFor = vi.fn(() => new Promise((resolve) => (resolveLookup = resolve)))

    await termItems()[0].trigger('click')
    expect(testid('split-loading').text()).toBe('Loading definitions...')

    resolveLookup(ENTRIES[SHESRAB])
    await flushPromises()
    expect(testid('split-loading').exists()).toBe(false)
  })

  it('should ask to select a term when none is (P2)', async () => {
    await mountPage()
    expect(testid('split-select-term').exists()).toBe(false)

    await typeAndWait('ཀ་ ཁ་', ['ཀ་', 'ཁ་'])

    expect(testid('split-select-term').text()).toBe('Select a term to see definitions')
  })

  it('should say when the selected term has no definition (P3)', async () => {
    await mountPage()
    await splitText()

    await termItems()[4].trigger('click')
    await flushPromises()

    expect(testid('split-no-definitions').text()).toBe(`No definitions found for "${PHAROL}"`)
  })

  it('should show the entries of the enabled dictionaries, in the Settings order (P4)', async () => {
    await mountPage()
    await splitText()

    await termItems()[2].trigger('click')
    await flushPromises()

    const definitions = wrapper.findAll('[data-testid="split-entries"] .definition').map((item) => item.text())
    expect(definitions).toEqual(['wisdom (Hopkins)', 'wisdom (RY)'])
  })

  it('should reset the Dictionaries menu choice on each lookup (P5)', async () => {
    await mountPage()
    await splitText()
    await termItems()[2].trigger('click')
    await flushPromises()
    page().vm.dictionaries.find((dictionary) => dictionary.id === 2).enabled = false
    await nextTick()
    expect(wrapper.findAll('[data-testid="split-entries"] .definition')).toHaveLength(1)

    await termItems()[0].trigger('click')
    await flushPromises()
    await termItems()[2].trigger('click')
    await flushPromises()

    expect(wrapper.findAll('[data-testid="split-entries"] .definition')).toHaveLength(2)
  })

  it('should not offer Copy all or Add my definition (P6)', async () => {
    await mountPage()
    await splitText()
    await flushPromises()

    expect(wrapper.text()).not.toContain('Copy all')
    expect(wrapper.find('[aria-label="Add my definition"]').exists()).toBe(false)
  })
})

describe('Split — dividers', () => {
  it('should start from 20 % for the text and 27 % for the terms when nothing is stored (R1, R2)', async () => {
    await mountPage()

    expect(page().find('.split-input').element.style.height).toBe('20%')
    await typeAndWait('ཀ་', ['ཀ་'])
    expect(page().find('.terms-pane').element.style.width).toBe('27%')
  })

  it('should resize the text area with the horizontal divider, between 15 % and 70 %, and remember it (R1)', async () => {
    Storage.set('segment.topHeight', 33)
    await mountPage()
    const container = page().vm.$refs.container
    Object.defineProperty(container, 'clientHeight', { value: 1000 })
    const divider = wrapper.findAllComponents({ name: 'ResizableDivider' })[0]
    expect(divider.props('direction')).toBe('horizontal')

    divider.vm.$emit('resize', 100)
    await nextTick()
    expect(page().find('.split-input').element.style.height).toBe('43%')
    expect(Storage.get('segment.topHeight')).toBe(43)

    divider.vm.$emit('resize', 1000)
    expect(page().vm.topHeight).toBe(70)
    divider.vm.$emit('resize', -2000)
    expect(page().vm.topHeight).toBe(15)
  })

  it('should resize the terms with the vertical divider, shown only with terms, between 20 % and 60 % (R2)', async () => {
    Storage.set('segment.leftWidth', 35)
    await mountPage()
    expect(wrapper.findAllComponents({ name: 'ResizableDivider' })).toHaveLength(1)

    await typeAndWait('ཀ་', ['ཀ་'])
    const divider = wrapper.findAllComponents({ name: 'ResizableDivider' })[1]
    expect(divider.props('direction')).toBe('vertical')
    Object.defineProperty(page().vm.$refs.bottomContainer, 'clientWidth', { value: 1000 })

    divider.vm.$emit('resize', -100)
    await nextTick()
    expect(page().find('.terms-pane').element.style.width).toBe('25%')
    expect(Storage.get('segment.leftWidth')).toBe(25)
    divider.vm.$emit('resize', -1000)
    expect(page().vm.leftWidth).toBe(20)
    divider.vm.$emit('resize', 5000)
    expect(page().vm.leftWidth).toBe(60)
  })
})

describe('Split — phone', () => {
  beforeEach(() => {
    window.innerWidth = 390
  })

  it('should show the text and the terms, without dividers, and the definitions after a tap (M1, M2)', async () => {
    await mountPage()
    await splitText()

    expect(wrapper.findAllComponents({ name: 'ResizableDivider' })).toHaveLength(0)
    // Split words stays on the terms
    expect(visible('.terms-pane')).toBe(true)
    expect(visible('.split-input')).toBe(true)
    expect(visible('.entries-pane')).toBe(false)

    await termItems()[2].trigger('click')
    await flushPromises()

    expect(visible('.terms-pane')).toBe(false)
    expect(visible('.split-input')).toBe(false)
    expect(visible('.entries-pane')).toBe(true)
    expect(testid('split-back').text()).toBe('Back to terms')
    expect(testid('split-headword').text()).toBe(SHESRAB)
    expect(wrapper.find('.entries').classes()).toContain('entries--cards')
  })

  it('should go back to the terms with Back to terms (M1)', async () => {
    await mountPage()
    await splitText()
    await termItems()[2].trigger('click')

    await testid('split-back').trigger('click')

    expect(visible('.terms-pane')).toBe(true)
    expect(visible('.split-input')).toBe(true)
    expect(visible('.entries-pane')).toBe(false)
  })

  it('should not size the panes from the stored percentages (M1)', async () => {
    Storage.set('segment.topHeight', 50)
    await mountPage()

    expect(page().find('.split-input').element.style.height).toBe('')
  })

  it('should show the definitions when Up/Down select a term, and go back to the terms on Clear (T8, B6)', async () => {
    await mountPage()
    await splitText()

    arrow('ArrowDown')
    await nextTick()
    expect(visible('.entries-pane')).toBe(true)

    page().vm.clearTextarea()
    await nextTick()
    expect(visible('.terms-pane')).toBe(true)
    expect(visible('.entries-pane')).toBe(false)
  })
})
