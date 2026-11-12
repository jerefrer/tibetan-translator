/**
 * The Reader (src/components/reader/ReaderPage.vue), mounted the way App.vue
 * mounts it: a real router and a <keep-alive> around the <router-view>, so
 * activated() and deactivated() behave as in the app.
 *
 * Ports the editor, splitting, terms, keyboard and phone cases of
 * tests/split-page.test.js to the Reader's editor, word buttons, side panel
 * (desktop) and bottom sheet (phone).
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import { h, KeepAlive, nextTick } from 'vue'

vi.mock('../src/config/platform.js', () => ({
  isTauri: () => false,
  isWeb: () => true,
  isMacOS: () => false,
  isMobile: () => false,
  supportsModularPacks: () => false,
}))

const database = vi.hoisted(() => ({ getEntriesFor: null }))
vi.mock('../src/services/sql-database', () => ({ default: database }))

// A tokenizer that knows the words below, longest first, and calls anything
// else a syllable. Punctuation comes back as its own chunk, as Botok does.
// Like Botok, it matches a known word across a space ('དང་ སེམས་'), so the
// Reader must not rely on it to keep the user's word breaks.
const tokenizer = vi.hoisted(() => ({ created: 0, words: [] }))
vi.mock('tibetan-word-tokenizer', () => ({
  createTokenizer: () => {
    tokenizer.created++
    return {
      tokenize(text) {
        const tokens = []
        let rest = text
        while (rest) {
          const space = rest.match(/^\s+/)
          if (space) {
            rest = rest.slice(space[0].length)
            continue
          }
          if (/^[།༔༑]/.test(rest)) {
            tokens.push({ text: rest[0], chunkType: 'PUNCT' })
            rest = rest.slice(1)
            continue
          }
          const word = tokenizer.words.find((candidate) => rest.startsWith(candidate)) || rest.match(/^[^་།༔༑\s]+་?/)[0]
          tokens.push({ text: word, chunkType: 'TEXT' })
          rest = rest.slice(word.length)
        }
        return tokens
      },
    }
  },
}))

import ReaderPage from '../src/components/reader/ReaderPage.vue'
import Storage from '../src/services/storage'
import { wylieFor } from '../src/services/transcription'

const BCOMLDANDAS = 'བཅོམ་ལྡན་འདས་'
const MA = 'མ་'
const SHESRAB = 'ཤེས་རབ་'
const KYI = 'ཀྱི་'
const PHAROL = 'ཕ་རོལ་'
const WORDS = [BCOMLDANDAS, MA, SHESRAB, KYI, PHAROL]
const TEXT = WORDS.join('') + '།'
const SPLIT_TEXT = WORDS.join(' ')

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
// PHAROL alone has no entry. The joined words that have one are expressions:
// 2 words from 0, 4 words from 1, 2 and 3 words from 2.
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
      { path: '/reader', component: ReaderPage },
      { path: '/lookup/:term?', component: Placeholder },
      { path: '/library', component: Placeholder },
    ],
  })
  router.push('/reader')
  await router.isReady()
  wrapper = mount(Shell, {
    attachTo: document.body,
    global: { plugins: [router], provide: { snackbar } },
  })
  await flushPromises()
  return wrapper
}

const page = () => wrapper.findComponent(ReaderPage)
const textarea = () => wrapper.find('[data-testid="reader-editor"] textarea')
const testid = (id) => wrapper.find(`[data-testid="${id}"]`)
const wordButtons = () => wrapper.findAll('[data-testid="reader-word"]')
const words = () => wrapper.findAll('[data-testid="reader-word"] .reader-word__text').map((item) => item.text())
const selectedWords = () => wordButtons().filter((item) => item.classes('is-selected')).map((item) => item.find('.reader-word__text').text())
const mergeButtons = () => wrapper.findAll('[data-testid="reader-merge"]')
const mergeLabels = () => mergeButtons().map((button) => button.attributes('aria-label'))
const panelHeadword = () => wrapper.find('[data-testid="reader-panel"] [data-testid="entry-headword"]')

function key(target, init) {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

// tests/setup.js replaces window.addEventListener: window events are
// delivered with window._triggerEvent
function windowKey(keyName, target = document.body) {
  const event = { key: keyName, target, defaultPrevented: false, preventDefault: vi.fn() }
  window._triggerEvent('keydown', event)
  return event
}

function pasteEvent(text, html = '') {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  event.clipboardData = { getData: (type) => (type === 'text/html' ? html : type === 'text/plain' ? text : '') }
  return event
}

// Types the text, splits it with Cmd+Enter and waits for the expressions
async function splitText(text = TEXT, { expectMerges = true } = {}) {
  await textarea().setValue(text)
  key(textarea().element, { key: 'Enter', metaKey: true })
  await vi.waitFor(() => expect(wordButtons().length).toBeGreaterThan(0), { timeout: 2000 })
  if (expectMerges) await vi.waitFor(() => expect(mergeButtons().length).toBeGreaterThan(0), { timeout: 2000 })
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
  Storage.delete('splitHistory')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  window.innerWidth = desktopWidth
  vi.restoreAllMocks()
})

describe('Reader — editor', () => {
  it('should be a multi-line Tibetan field with no spelling aids', async () => {
    await mountPage()

    expect(testid('reader-editor').classes()).toEqual(expect.arrayContaining(['ui-field--tibetan', 'ui-field--multiline']))
    expect(textarea().attributes('aria-label')).toBe('Tibetan text')
    expect(textarea().attributes('spellcheck')).toBe('false')
    expect(textarea().attributes('autocomplete')).toBe('off')
    expect(textarea().attributes('autocapitalize')).toBe('off')
    expect(textarea().attributes('autocorrect')).toBe('off')
  })

  it('should convert Wylie on space in the editor', async () => {
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

  it('should insert a tsheg on space and a word break on Shift+Space', async () => {
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

  it('should split on Cmd+Enter and show one button per word', async () => {
    await mountPage()
    await textarea().setValue(TEXT)

    expect(key(textarea().element, { key: 'Enter', metaKey: true }).defaultPrevented).toBe(true)
    await vi.waitFor(() => expect(words()).toEqual(WORDS))

    expect(wordButtons().every((button) => button.element.tagName === 'BUTTON')).toBe(true)
    expect(testid('reader-editor').exists()).toBe(false)
    expect(key(document.body, { key: 'Enter' }).defaultPrevented).toBe(false)
  })

  it('should split on Ctrl+Enter and with the Split button', async () => {
    await mountPage()
    await textarea().setValue('ཀ་ཁ་')
    key(textarea().element, { key: 'Enter', ctrlKey: true })
    await vi.waitFor(() => expect(words()).toEqual(['ཀ་', 'ཁ་']))

    await testid('reader-edit').trigger('click')
    await textarea().setValue(TEXT)
    await testid('reader-split').trigger('click')
    await vi.waitFor(() => expect(words()).toEqual(WORDS))
  })

  it('should convert Wylie and split the text after an ordinary paste, line breaks included', async () => {
    await mountPage()
    const event = pasteEvent('ka kha\nga')
    textarea().element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    // The browser inserts the text itself; the editor converts it 50 ms later
    await textarea().setValue('ka kha\nga')

    await vi.waitFor(() => expect(words()).toEqual(['ཀ་', 'ཁ་', 'ག་']), { timeout: 2000 })
  })

  it('should repair a legacy-font paste', async () => {
    await mountPage()
    await textarea().setValue('ཀ་ ཁ་')
    textarea().element.setSelectionRange(3, 3)
    const legacy = '<$<-{<-' // སངས་རྒྱས་ in the TibetanChogyal encoding
    const event = pasteEvent(legacy, `<span style="font-family: TibetanChogyal">&lt;$&lt;-{&lt;-</span>`)
    textarea().element.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    await vi.waitFor(() => expect(words()).toEqual(['ཀ་', 'སངས་', 'རྒྱས་', 'ཁ་']), { timeout: 3000 })
  })

  it('should paste the clipboard with the Paste button, convert it and split it', async () => {
    const readText = vi.fn(async () => 'ka kha')
    Object.defineProperty(navigator, 'clipboard', { value: { readText }, configurable: true })
    await mountPage()

    await testid('reader-paste').trigger('click')

    await vi.waitFor(() => expect(words()).toEqual(['ཀ་', 'ཁ་']))
    expect(readText).toHaveBeenCalled()
  })

  it('should say so and stay in the editor when the clipboard cannot be read', async () => {
    const readText = vi.fn(async () => { throw new Error('denied') })
    Object.defineProperty(navigator, 'clipboard', { value: { readText }, configurable: true })
    await mountPage()

    await testid('reader-paste').trigger('click')
    await flushPromises()

    expect(snackbar.open).toHaveBeenCalled()
    expect(testid('reader-editor').exists()).toBe(true)
    expect(wordButtons()).toHaveLength(0)
  })

  it('should say why the tokenizer failed and split by syllable instead', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false }))
    await mountPage()
    await textarea().setValue('ཤེས་རབ་ཀྱི།')
    key(textarea().element, { key: 'Enter', metaKey: true })
    await vi.waitFor(() => expect(words()).toEqual(['ཤེས་', 'རབ་', 'ཀྱི་']))

    expect(testid('reader-tokenizer-error').attributes('role')).toBe('alert')
    expect(testid('reader-tokenizer-error').text()).toContain('Dictionary not found')
  })

  it('should not split blank text', async () => {
    await mountPage()
    await textarea().setValue('  ')
    key(textarea().element, { key: 'Enter', metaKey: true })
    await flushPromises()

    expect(testid('reader-editor').exists()).toBe(true)
    expect(wordButtons()).toHaveLength(0)
  })
})

describe('Reader — word breaks', () => {
  it('should keep a Shift+Space word break on the first split, and the same words after Edit and Split', async () => {
    // Known across the space: a tokenizer fed the whole text would glue them
    tokenizer.words = ['བདེ་བ་', 'དང་ སེམས་']
    await mountPage()
    await textarea().setValue('བདེ་བ་དང་')
    textarea().element.setSelectionRange(9, 9)
    expect(key(textarea().element, { key: ' ', shiftKey: true }).defaultPrevented).toBe(false)
    // The browser types the real space Shift+Space leaves to it
    await textarea().setValue('བདེ་བ་དང་ སེམས་ཅན་')

    key(textarea().element, { key: 'Enter', metaKey: true })
    await vi.waitFor(() => expect(words()).toEqual(['བདེ་བ་', 'དང་', 'སེམས་', 'ཅན་']))
    expect(words().some((word) => /\s/.test(word))).toBe(false)

    await testid('reader-edit').trigger('click')
    expect(textarea().element.value).toBe('བདེ་བ་ དང་ སེམས་ ཅན་')
    key(textarea().element, { key: 'Enter', ctrlKey: true })
    await flushPromises()
    await vi.waitFor(() => expect(words()).toEqual(['བདེ་བ་', 'དང་', 'སེམས་', 'ཅན་']))
  })

  it('should keep the word breaks of a pasted text with spaces', async () => {
    tokenizer.words = ['དང་ སེམས་']
    await mountPage()
    textarea().element.dispatchEvent(pasteEvent('དང་ སེམས་'))
    await textarea().setValue('དང་ སེམས་')

    await vi.waitFor(() => expect(words()).toEqual(['དང་', 'སེམས་']), { timeout: 2000 })
  })
})

describe('Reader — text', () => {
  it('should select the first word after a split, record the text and mark the words with no entry', async () => {
    await mountPage()
    await splitText()

    expect(selectedWords()).toEqual([BCOMLDANDAS])
    expect(Storage.get('splitHistory')).toEqual([SPLIT_TEXT])
    await vi.waitFor(() => expect(wordButtons()[4].classes()).toContain('is-unknown'))
    expect(wordButtons()[0].classes()).not.toContain('is-unknown')
  })

  it('should show a word\'s entry in the side panel on desktop', async () => {
    await mountPage()
    await splitText()

    await wordButtons()[2].trigger('click')
    await flushPromises()

    expect(selectedWords()).toEqual([SHESRAB])
    expect(wordButtons()[2].attributes('aria-pressed')).toBe('true')
    expect(panelHeadword().text()).toBe(SHESRAB)
    const definitions = wrapper.findAll('[data-testid="reader-panel"] .definition').map((item) => item.text())
    expect(definitions).toEqual(['wisdom (Hopkins)', 'wisdom (RY)'])
    expect(testid('reader-sheet').exists()).toBe(false)
  })

  it('should mark the words again after a pack install, never from an older lookup', async () => {
    let releaseOld
    const gate = new Promise((resolve) => (releaseOld = resolve))
    let installed = false
    database.getEntriesFor = vi.fn(async (term) => {
      if (term === PHAROL) {
        if (!installed) {
          await gate
          return []
        }
        return [entry(PHAROL, 1, 'beyond')]
      }
      return (ENTRIES[term] || []).map((row) => ({ ...row }))
    })
    await mountPage()
    await splitText()

    // A pack gives ཕ་རོལ་ an entry while its first lookup is still running
    installed = true
    window._triggerEvent('all-terms-updated')
    await flushPromises()
    releaseOld()
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(wordButtons()[4].classes()).not.toContain('is-unknown')
  })

  it('should unmark a word that a pack install gives an entry', async () => {
    let installed = false
    database.getEntriesFor = vi.fn(async (term) =>
      term === PHAROL && installed ? [entry(PHAROL, 1, 'beyond')] : (ENTRIES[term] || []).map((row) => ({ ...row })))
    await mountPage()
    await splitText()
    await vi.waitFor(() => expect(wordButtons()[4].classes()).toContain('is-unknown'))

    installed = true
    window._triggerEvent('all-terms-updated')

    await vi.waitFor(() => expect(wordButtons()[4].classes()).not.toContain('is-unknown'))
  })

  it('should look up a detected expression', async () => {
    await mountPage()
    await splitText()

    expect(mergeLabels().sort()).toEqual([
      'Look up ' + BCOMLDANDAS + MA,
      'Look up ' + MA + SHESRAB + KYI + PHAROL,
      'Look up ' + SHESRAB + KYI,
      'Look up ' + SHESRAB + KYI + PHAROL,
    ].sort())

    await mergeButtons().find((button) => button.attributes('aria-label') === 'Look up ' + SHESRAB + KYI).trigger('click')
    await flushPromises()

    expect(panelHeadword().text()).toBe(SHESRAB + KYI)
    expect(wrapper.find('[data-testid="reader-panel"]').text()).toContain('of wisdom')
    // The words keep their splits: an expression is looked up, not merged
    expect(words()).toEqual(WORDS)
    expect(wordButtons()[2].classes()).toContain('is-in-selection')
    expect(wordButtons()[3].classes()).toContain('is-in-selection')
  })

  it('should never show the expressions of an older text, even when its lookups finish last', async () => {
    let releaseOld
    const gate = new Promise((resolve) => (releaseOld = resolve))
    database.getEntriesFor = vi.fn(async (term) => {
      if (term === BCOMLDANDAS + MA) await gate
      return (ENTRIES[term] || []).map((row) => ({ ...row }))
    })
    await mountPage()
    await textarea().setValue(TEXT)
    key(textarea().element, { key: 'Enter', metaKey: true })
    await vi.waitFor(() => expect(words()).toEqual(WORDS))

    await testid('reader-edit').trigger('click')
    await textarea().setValue([SHESRAB, KYI].join(' '))
    key(textarea().element, { key: 'Enter', metaKey: true })
    await vi.waitFor(() => expect(words()).toEqual([SHESRAB, KYI]))
    await vi.waitFor(() => expect(mergeLabels()).toEqual(['Look up ' + SHESRAB + KYI]))

    releaseOld()
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(mergeLabels()).toEqual(['Look up ' + SHESRAB + KYI])
  })

  it('should clear the expressions at once when the words change', async () => {
    await mountPage()
    await splitText()
    expect(mergeButtons().length).toBe(4)
    database.getEntriesFor = vi.fn(() => new Promise(() => {}))

    await testid('reader-edit').trigger('click')
    await textarea().setValue('ཀ་ ཁ་')
    key(textarea().element, { key: 'Enter', metaKey: true })
    await vi.waitFor(() => expect(words()).toEqual(['ཀ་', 'ཁ་']))

    expect(mergeButtons()).toHaveLength(0)
  })

  it('should move between words with the arrow keys', async () => {
    await mountPage()
    await splitText()
    expect(selectedWords()).toEqual([BCOMLDANDAS])

    expect(windowKey('ArrowUp').preventDefault).toHaveBeenCalled()
    await nextTick()
    expect(selectedWords()).toEqual([BCOMLDANDAS])
    windowKey('ArrowDown')
    windowKey('ArrowDown')
    await nextTick()
    expect(selectedWords()).toEqual([SHESRAB])
    for (let i = 0; i < 5; i++) windowKey('ArrowDown')
    await nextTick()
    expect(selectedWords()).toEqual([PHAROL])
    windowKey('ArrowUp')
    await flushPromises()
    expect(selectedWords()).toEqual([KYI])
    expect(panelHeadword().text()).toBe(KYI)
    expect(windowKey('ArrowLeft').preventDefault).not.toHaveBeenCalled()
  })

  it('should leave the arrow keys to fields, dialogs and other pages', async () => {
    await mountPage()
    await splitText()
    const field = document.createElement('input')
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    const inDialog = document.createElement('button')
    dialog.appendChild(inDialog)
    document.body.append(field, dialog)

    windowKey('ArrowDown', field)
    windowKey('ArrowDown', inDialog)
    await nextTick()
    expect(selectedWords()).toEqual([BCOMLDANDAS])

    await router.push('/library')
    await flushPromises()
    window._triggerEvent('keydown', { key: 'ArrowDown', target: document.body, defaultPrevented: false, preventDefault: vi.fn() })
    await router.push('/reader')
    await flushPromises()
    expect(selectedWords()).toEqual([BCOMLDANDAS])
  })

  it('should listen to the keyboard only while it is shown, and stop when unmounted', async () => {
    const added = vi.spyOn(window, 'addEventListener')
    const removed = vi.spyOn(window, 'removeEventListener')
    const lastCall = (spy, handler) =>
      Math.max(-1, ...spy.mock.calls
        .map((call, index) => (call[0] === 'keydown' && call[1] === handler ? spy.mock.invocationCallOrder[index] : -1)))
    await mountPage()
    const handler = page().vm.handleKeydown
    const listening = () => lastCall(added, handler) > lastCall(removed, handler)
    expect(listening()).toBe(true)

    await router.push('/library')
    await flushPromises()
    expect(listening()).toBe(false)

    await router.push('/reader')
    await flushPromises()
    expect(listening()).toBe(true)

    wrapper.unmount()
    wrapper = undefined
    expect(listening()).toBe(false)
  })

  it('should show a small Wylie line under each word with Show Wylie', async () => {
    await mountPage()
    await splitText()
    expect(wrapper.findAll('.reader-word__wylie')).toHaveLength(0)

    await testid('reader-show-wylie').trigger('click')

    const lines = wrapper.findAll('.reader-word__wylie').map((line) => line.text())
    expect(lines).toHaveLength(WORDS.length)
    expect(lines[0]).toBe(wylieFor(BCOMLDANDAS))
    expect(testid('reader-show-wylie').attributes('aria-pressed')).toBe('true')
  })

  it('should go back to the editor with word breaks kept', async () => {
    await mountPage()
    await splitText()

    await testid('reader-edit').trigger('click')
    expect(textarea().element.value).toBe(SPLIT_TEXT)

    // The user joins ཤེས་རབ་ཀྱི་ by hand: the spaces are the word breaks
    const edited = [BCOMLDANDAS, MA, SHESRAB + KYI, PHAROL].join(' ')
    await textarea().setValue(edited)
    key(textarea().element, { key: 'Enter', metaKey: true })
    await vi.waitFor(() => expect(words()).toEqual([BCOMLDANDAS, MA, SHESRAB + KYI, PHAROL]))
    expect(Storage.get('splitHistory')).toEqual([edited])
  })

  it('should clear the text and go back to an empty editor with the recent texts', async () => {
    await mountPage()
    await splitText()

    await testid('reader-clear').trigger('click')
    await nextTick()

    expect(textarea().element.value).toBe('')
    expect(wordButtons()).toHaveLength(0)
    expect(wrapper.findAll('[data-testid="reader-recent-item"]').map((item) => item.text())).toEqual([SPLIT_TEXT])
  })

  it('should open the full entry in Lookup', async () => {
    await mountPage()
    await splitText()
    await wordButtons()[2].trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="reader-panel"] [data-testid="entry-open"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/lookup/' + encodeURIComponent(SHESRAB))
  })
})

describe('Reader — recent texts', () => {
  const recentItems = () => wrapper.findAll('[data-testid="reader-recent-item"]')

  it('should not list recent texts when there are none', async () => {
    await mountPage()
    expect(testid('reader-recent').exists()).toBe(false)
  })

  it('should reopen a recent text', async () => {
    // ཤེས་རབ་ཀྱི་ joined by hand: the tokenizer would split it in two
    const edited = [BCOMLDANDAS, MA, SHESRAB + KYI, PHAROL].join(' ')
    Storage.set('splitHistory', [edited, 'ཀ་ ཁ་'])
    await mountPage()

    expect(recentItems().map((item) => item.text())).toEqual([edited, 'ཀ་ ཁ་'])
    await recentItems()[0].find('button').trigger('click')
    await vi.waitFor(() => expect(words()).toEqual([BCOMLDANDAS, MA, SHESRAB + KYI, PHAROL]))

    expect(tokenizer.created).toBe(0)
    expect(selectedWords()).toEqual([BCOMLDANDAS])
  })

  it('should empty the recent texts with their Clear', async () => {
    Storage.set('splitHistory', ['ཀ་ ཁ་'])
    await mountPage()

    await testid('reader-recent-clear').trigger('click')

    expect(testid('reader-recent').exists()).toBe(false)
    expect(Storage.get('splitHistory', [])).toEqual([])
  })
})

// Ported from tests/split-page.test.js (empty state, Split words and the
// tokenizer)
describe('Reader — ported from Split', () => {
  it('should fill the editor with the example and split it when Try it with is clicked', async () => {
    await mountPage()
    const example = testid('reader-example')
    expect(example.text()).toContain('སངས་རྒྱས་')

    await example.trigger('click')
    await vi.waitFor(() => expect(wordButtons().length).toBeGreaterThan(0))

    expect(words().join('')).toBe('སངས་རྒྱས་ཆོས་དང་ཚོགས་ཀྱི་མཆོག་རྣམས་ལ་')
    expect(testid('reader-editor').exists()).toBe(false)
  })

  it('should load the tokenizer once, and keep the selected position on the next split', async () => {
    await mountPage()
    await splitText()
    await wordButtons()[3].trigger('click')
    await flushPromises()

    await testid('reader-edit').trigger('click')
    key(textarea().element, { key: 'Enter', metaKey: true })
    await vi.waitFor(() => expect(words()).toEqual(WORDS))
    await flushPromises()

    expect(selectedWords()).toEqual([KYI])

    await testid('reader-clear').trigger('click')
    await nextTick()
    await textarea().setValue('ཀ་ཁ་')
    key(textarea().element, { key: 'Enter', metaKey: true })
    await vi.waitFor(() => expect(words()).toEqual(['ཀ་', 'ཁ་']))
    expect(tokenizer.created).toBe(1)
  })

  it('should show a spinner on Split while the tokenizer loads', async () => {
    let respond
    globalThis.fetch = vi.fn(() => new Promise((done) => (respond = done)))
    await mountPage()
    await textarea().setValue('ཀ་ཁ་')
    key(textarea().element, { key: 'Enter', metaKey: true })
    await vi.waitFor(() => expect(testid('reader-split').attributes('aria-busy')).toBe('true'))

    respond({ ok: true, json: async () => ({}) })
    await vi.waitFor(() => expect(words()).toEqual(['ཀ་', 'ཁ་']))
  })

  it('should try the tokenizer again on the next split after it failed', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false }))
    await mountPage()
    await textarea().setValue('ཤེས་རབ་ཀྱི།')
    key(textarea().element, { key: 'Enter', metaKey: true })
    await vi.waitFor(() => expect(testid('reader-tokenizer-error').exists()).toBe(true))
    expect(tokenizer.created).toBe(0)

    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) }))
    await testid('reader-clear').trigger('click')
    await nextTick()
    await textarea().setValue('ཀ་ཁ་')
    key(textarea().element, { key: 'Enter', metaKey: true })
    await vi.waitFor(() => expect(words()).toEqual(['ཀ་', 'ཁ་']))

    expect(tokenizer.created).toBe(1)
    expect(testid('reader-tokenizer-error').exists()).toBe(false)
  })
})

describe('Reader — phone', () => {
  beforeEach(() => {
    window.innerWidth = 390
  })

  it('should open a bottom sheet on a phone and close it with Escape', async () => {
    await mountPage()
    await splitText()
    expect(testid('reader-panel').exists()).toBe(false)
    // The first word is selected after a split, but the sheet waits for a tap
    expect(testid('reader-sheet').exists()).toBe(false)

    await wordButtons()[2].trigger('click')
    await flushPromises()

    expect(testid('reader-sheet').exists()).toBe(true)
    expect(wrapper.find('[data-testid="reader-sheet"] [data-testid="entry-headword"]').text()).toBe(SHESRAB)
    expect(testid('reader-sheet-handle').exists()).toBe(true)

    const escape = windowKey('Escape')
    await nextTick()
    expect(escape.preventDefault).toHaveBeenCalled()
    expect(testid('reader-sheet').exists()).toBe(false)
    expect(selectedWords()).toEqual([SHESRAB])
  })

  it('should close the sheet when the dimmed text is tapped', async () => {
    await mountPage()
    await splitText()
    await wordButtons()[1].trigger('click')

    await testid('reader-scrim').trigger('click')

    expect(testid('reader-sheet').exists()).toBe(false)
  })

  it('should close the sheet when it is swiped down, and keep it on a short drag', async () => {
    await mountPage()
    await splitText()
    await wordButtons()[1].trigger('click')
    const handle = testid('reader-sheet-handle')

    await handle.trigger('pointerdown', { clientY: 100, pointerId: 1 })
    await handle.trigger('pointermove', { clientY: 120, pointerId: 1 })
    await handle.trigger('pointerup', { clientY: 120, pointerId: 1 })
    expect(testid('reader-sheet').exists()).toBe(true)

    await handle.trigger('pointerdown', { clientY: 100, pointerId: 1 })
    await handle.trigger('pointermove', { clientY: 260, pointerId: 1 })
    await handle.trigger('pointerup', { clientY: 260, pointerId: 1 })
    expect(testid('reader-sheet').exists()).toBe(false)
  })

  it('should close the sheet when it is swiped down by touch', async () => {
    await mountPage()
    await splitText()
    await wordButtons()[1].trigger('click')
    const handle = testid('reader-sheet-handle')

    await handle.trigger('touchstart', { touches: [{ clientY: 100 }] })
    await handle.trigger('touchmove', { touches: [{ clientY: 250 }] })
    await handle.trigger('touchend', { changedTouches: [{ clientY: 250 }] })

    expect(testid('reader-sheet').exists()).toBe(false)
  })

  it('should open the sheet when the arrow keys select a word', async () => {
    await mountPage()
    await splitText()

    windowKey('ArrowDown')
    await flushPromises()

    expect(testid('reader-sheet').exists()).toBe(true)
    expect(selectedWords()).toEqual([MA])
  })

  it('should look up an expression in the sheet', async () => {
    await mountPage()
    await splitText()

    await mergeButtons().find((button) => button.attributes('aria-label') === 'Look up ' + BCOMLDANDAS + MA).trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="reader-sheet"] [data-testid="entry-headword"]').text()).toBe(BCOMLDANDAS + MA)
  })
})
