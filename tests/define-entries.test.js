/**
 * The definitions of the Define screen (Entries.vue, EntriesEntry.vue) and the
 * dialog the dictionary chip opens. Entries is shared with Split and the two
 * lookup popups, so these also guard what those screens rely on: the
 * `definition` class App.vue listens on, the batch-on-scroll, the copy button.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'

const writeToClipboard = vi.fn()
vi.mock('../src/services/copy-service', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    writeToClipboard: (...args) => writeToClipboard(...args),
    default: { ...actual.default, writeToClipboard: (...args) => writeToClipboard(...args) },
  }
})

import Entries from '../src/components/Entries.vue'
import EntriesEntry from '../src/components/EntriesEntry.vue'
import DictionaryAboutDialog from '../src/components/DictionaryAboutDialog.vue'

const snackbar = { open: vi.fn() }
const scanViewerStub = {
  name: 'ScanViewer',
  props: ['modelValue', 'dictionaryId', 'initialPage', 'approximate'],
  template: '<div class="scan-viewer-stub" />',
}

const entry = (overrides = {}) => ({
  term: 'ཡེ་ཤེས་',
  dictionary: 'TsepakRigdzin',
  dictionaryId: 18,
  definition: 'wisdom',
  ...overrides,
})

let wrapper
const mountEntry = (props, options = {}) => {
  wrapper = mount(EntriesEntry, {
    props,
    attachTo: document.body,
    global: { provide: { snackbar }, stubs: { ScanViewer: scanViewerStub }, ...options },
  })
  return wrapper
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

beforeEach(() => {
  writeToClipboard.mockReset().mockResolvedValue()
  snackbar.open.mockClear()
})

describe('EntriesEntry', () => {
  it('should render the definition as HTML in an element with the class App.vue listens on', () => {
    mountEntry({ entry: entry({ definition: 'see <a href="/define/ཀ་">ཀ་</a>' }) })

    const definition = wrapper.find('.definition')
    expect(definition.exists()).toBe(true)
    expect(definition.find('a[href="/define/ཀ་"]').exists()).toBe(true)
  })

  it('should keep audio players the decorator put in the definition, and have no headword audio button', () => {
    mountEntry({
      entry: entry({
        definition: '<div class="audio-player" data-audio="/audio/hotl1/a.mp3"><button class="audio-play-btn"></button></div>',
      }),
    })

    expect(wrapper.find('.definition .audio-player').exists()).toBe(true)
    expect(wrapper.findAll('.audio-play-btn')).toHaveLength(1)
  })

  it('should label the entry with the dictionary short label', () => {
    mountEntry({ entry: entry() })

    expect(wrapper.find('[data-testid="entry-dictionary"]').text()).toBe('Tsepak Rigdzin')
  })

  it('should ask for the dictionary about when its chip is clicked', async () => {
    mountEntry({ entry: entry() })

    await wrapper.find('[data-testid="entry-dictionary"]').trigger('click')

    expect(wrapper.emitted('show-about')).toEqual([['TsepakRigdzin']])
  })

  it('should copy the entry, say so, and show a check for a moment', async () => {
    vi.useFakeTimers()
    mountEntry({ entry: entry() })

    await wrapper.find('[data-testid="entry-copy"]').trigger('click')
    await flushPromises()

    expect(writeToClipboard).toHaveBeenCalledWith('ཡེ་ཤེས་ (Tsepak Rigdzin) : wisdom')
    expect(snackbar.open).toHaveBeenCalledWith('Copied')
    expect(wrapper.find('[data-testid="entry-copy"]').attributes('aria-label')).toBe('Copied')

    vi.advanceTimersByTime(1300)
    await nextTick()
    expect(wrapper.find('[data-testid="entry-copy"]').attributes('aria-label')).toBe('Copy definition')
    vi.useRealTimers()
  })

  it('should say when the copy failed', async () => {
    writeToClipboard.mockRejectedValue(new Error('denied'))
    mountEntry({ entry: entry() })

    await wrapper.find('[data-testid="entry-copy"]').trigger('click')
    await flushPromises()

    expect(snackbar.open).toHaveBeenCalledWith('Copy failed')
  })

  it('should still copy in the quick lookup popup, which provides no snackbar', async () => {
    wrapper = mount(EntriesEntry, {
      props: { entry: entry() },
      global: { stubs: { ScanViewer: scanViewerStub } },
    })

    await wrapper.find('[data-testid="entry-copy"]').trigger('click')
    await flushPromises()

    expect(writeToClipboard).toHaveBeenCalled()
  })

  describe('scanned dictionary', () => {
    const scanned = (definition) => entry({ dictionary: 'Jaeschke_Scan', definition })

    it('should show the page instead of a definition, and no copy button', () => {
      mountEntry({ entry: scanned('479') })

      expect(wrapper.find('.definition').exists()).toBe(false)
      expect(wrapper.find('[data-testid="entry-copy"]').exists()).toBe(false)
      expect(wrapper.find('.page-info').text()).toBe('Page 479')
    })

    it('should say the page is approximate when the stored page carries a question mark', () => {
      mountEntry({ entry: scanned('479?') })

      expect(wrapper.find('.page-info').text()).toBe('Page 479 (approximate)')
    })

    it('should open the scan viewer at that page', async () => {
      mountEntry({ entry: scanned('479?') })
      const viewer = wrapper.findComponent(scanViewerStub)
      expect(viewer.props('modelValue')).toBe(false)

      await wrapper.find('[data-testid="entry-view-scan"]').trigger('click')

      expect(viewer.props()).toMatchObject({
        modelValue: true,
        dictionaryId: 'Jaeschke_Scan',
        initialPage: 479,
        approximate: true,
      })
    })
  })
})

describe('Entries', () => {
  const many = (count) =>
    Array.from({ length: count }, (_, index) => entry({ definition: `definition ${index}` }))

  const mountEntries = (props) => {
    wrapper = mount(Entries, {
      props,
      attachTo: document.body,
      global: { provide: { snackbar }, stubs: { ScanViewer: scanViewerStub } },
    })
    return wrapper
  }

  it('should render the first batch only, then ten more when the last one is reached', async () => {
    mountEntries({ entries: many(40), initialNumberOfEntries: 25 })
    expect(wrapper.findAll('[data-testid="entry"]')).toHaveLength(25)

    wrapper.findAllComponents(EntriesEntry).at(24).vm.$emit('intersect')
    await nextTick()

    expect(wrapper.findAll('[data-testid="entry"]')).toHaveLength(35)
  })

  it('should start with ten when no initial count is given', () => {
    mountEntries({ entries: many(40) })
    expect(wrapper.findAll('[data-testid="entry"]')).toHaveLength(10)
  })

  it('should only report the last rendered entry as the last one', () => {
    mountEntries({ entries: many(12) })
    const flags = wrapper.findAllComponents(EntriesEntry).map((item) => item.props('isLastEntry'))
    expect(flags.filter(Boolean)).toHaveLength(1)
    expect(flags[9]).toBe(true)
  })

  it('should open the about dialog of the dictionary whose chip was clicked', async () => {
    mountEntries({ entries: [entry()] })

    await wrapper.find('[data-testid="entry-dictionary"]').trigger('click')
    await flushPromises()

    const about = document.body.querySelector('[data-testid="ui-dialog"]')
    expect(about).not.toBeNull()
    expect(about.textContent).toContain('Tsepak Rigdzin')
    expect(about.textContent).toContain('Tibetan-English Dictionary of Buddhist Terms')
  })

  it('should lay each entry out as its own card when asked to', () => {
    mountEntries({ entries: [entry()], cards: true })
    expect(wrapper.find('.entries').classes()).toContain('entries--cards')
  })
})

describe('DictionaryAboutDialog', () => {
  const mountAbout = (dictionary) => {
    wrapper = mount(DictionaryAboutDialog, {
      props: { modelValue: true, dictionary },
      attachTo: document.body,
    })
    return wrapper
  }
  const dialog = () => document.body.querySelector('[data-testid="ui-dialog"]')

  it('should show the label as title, the description lines and the languages', async () => {
    mountAbout('RangjungYeshe')
    await flushPromises()

    expect(dialog().querySelector('.ui-dialog__title').textContent).toContain('Rangjung Yeshe')
    expect(dialog().textContent).toContain('Tibetan ⇄ English')
  })

  it('should turn links in the description into links', async () => {
    mountAbout('Gaeng,Wetzel')
    await flushPromises()

    expect(dialog().querySelector('a[href^="http"]')).not.toBeNull()
  })

  it('should still open for a dictionary without details, such as one of your own', async () => {
    mountAbout('My Lexicon')
    await flushPromises()

    expect(dialog().textContent).toContain('My Lexicon')
    expect(dialog().textContent).toContain('No description for this dictionary.')
  })

  it('should close from its Close button', async () => {
    mountAbout('RangjungYeshe')
    await flushPromises()

    document.body.querySelector('[data-testid="dictionary-about-close"]').click()

    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })
})
