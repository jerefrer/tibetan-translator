/**
 * LookupHints: the hint from བོད to EN. The cases of the Define page's
 * "search instead" hint, re-expressed against the component, plus the one
 * for a Wylie that starts no term.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

import LookupHints from '../src/components/lookup/LookupHints.vue'
import { switchLookupMode } from '../src/services/lookup-state'

function mountHints(props = {}) {
  return mount(LookupHints, {
    props: { mode: 'bo', text: '', typedWylie: '', asTyped: '', headwordCount: 0, ...props },
  })
}

const searchHint = (wrapper) => wrapper.find('[data-testid="hint-search-definitions"]')

describe('LookupHints — search in the definitions (བོད)', () => {
  it('should offer searching the text as typed when it carries Sanskrit diacritics', async () => {
    const wrapper = mountHints({ text: 'ཀཱཀིṇī་', asTyped: 'kākiṇī', headwordCount: 3 })
    expect(searchHint(wrapper).exists()).toBe(true)
    expect(searchHint(wrapper).text()).toContain('“kākiṇī”')
    await searchHint(wrapper).find('button').trigger('click')
    expect(wrapper.emitted('switch')[0][0]).toEqual({ mode: 'en', text: 'kākiṇī' })
  })

  it('should offer searching the typed Wylie when no Tibetan term starts with the text', async () => {
    const wrapper = mountHints({ text: 'བླིསས་', typedWylie: 'bliss', headwordCount: 0 })
    expect(searchHint(wrapper).text()).toContain('No Tibetan term starts with བླིསས་')
    expect(searchHint(wrapper).text()).toContain('“bliss”')
    await searchHint(wrapper).find('button').trigger('click')
    expect(wrapper.emitted('switch')[0][0]).toEqual({ mode: 'en', text: 'bliss' })
  })

  it('should prefer the text as typed over the typed Wylie', async () => {
    const wrapper = mountHints({ text: 'ཀཱཀ་', asTyped: 'kāka', typedWylie: 'kaka', headwordCount: 0 })
    await searchHint(wrapper).find('button').trigger('click')
    expect(wrapper.emitted('switch')[0][0].text).toBe('kāka')
  })

  it('should not offer English search while Tibetan terms match', () => {
    const wrapper = mountHints({ text: 'བཅོམ་', typedWylie: 'bcom', headwordCount: 2 })
    expect(searchHint(wrapper).exists()).toBe(false)
  })

  it('should not offer English search when nothing matches and no Latin was typed', () => {
    const wrapper = mountHints({ text: 'བླིསས་', typedWylie: '', headwordCount: 0 })
    expect(searchHint(wrapper).exists()).toBe(false)
  })

  it('should not offer English search for an empty field', () => {
    expect(searchHint(mountHints()).exists()).toBe(false)
  })

  it('should offer nothing in the English mode', () => {
    const wrapper = mountHints({ mode: 'en', text: 'bcom', asTyped: 'kākiṇī', typedWylie: 'bcom' })
    expect(wrapper.find('.lookup-hint').exists()).toBe(false)
  })
})

describe('switchLookupMode — text as typed fallback', () => {
  it('should switch to English with the text as typed when the Wylie is unknown', () => {
    expect(
      switchLookupMode({ mode: 'bo', text: 'ཀཱཀིṇī་', typedWylie: '', asTyped: 'kākiṇī' }, 'en')
    ).toBe('kākiṇī')
  })
})
