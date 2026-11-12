/**
 * LookupHints: the hints between the བོད and EN modes. The cases of the
 * Define page's "search instead" hint, re-expressed against the component,
 * plus the hint that offers Tibetan from English and the one for a Wylie that
 * starts no term.
 */
import { describe, it, expect, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'

vi.mock('../src/services/sql-database', () => ({
  default: { allTerms: ['བཅོམ་', 'བཅོམ་ལྡན་', 'ཀ་'] },
}))

import SqlDatabase from '../src/services/sql-database'
import { startsAnyTerm } from '../src/services/quick-lookup'
import LookupHints from '../src/components/lookup/LookupHints.vue'
import { switchLookupMode } from '../src/services/lookup-state'

function mountHints(props = {}) {
  return mount(LookupHints, {
    props: { mode: 'bo', text: '', typedWylie: '', asTyped: '', headwordCount: 0, definitionCount: 0, ...props },
  })
}

const searchHint = (wrapper) => wrapper.find('[data-testid="hint-search-definitions"]')
const tibetanHint = (wrapper) => wrapper.find('[data-testid="hint-look-up-tibetan"]')

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

  it('should say nothing in the Tibetan mode about looking up Tibetan', () => {
    const wrapper = mountHints({ text: 'bcom', headwordCount: 0 })
    expect(tibetanHint(wrapper).exists()).toBe(false)
  })
})

describe('LookupHints — look up as Tibetan (EN)', () => {
  it('should offer Tibetan when the query reads as Wylie starting a term', async () => {
    const wrapper = mountHints({ mode: 'en', text: 'bcom' })
    expect(tibetanHint(wrapper).exists()).toBe(true)
    expect(tibetanHint(wrapper).text()).toContain('Look up བཅོམ་ as Tibetan')
    await tibetanHint(wrapper).find('button').trigger('click')
    expect(wrapper.emitted('switch')[0][0]).toEqual({ mode: 'bo', text: 'བཅོམ་' })
  })

  it('should offer Tibetan for a query with spaces, apostrophes and plus', () => {
    expect(tibetanHint(mountHints({ mode: 'en', text: "bcom ldan " })).exists()).toBe(true)
  })

  it('should not offer Tibetan for a query with digits', () => {
    expect(tibetanHint(mountHints({ mode: 'en', text: 'bcom2' })).exists()).toBe(false)
  })

  it('should not offer Tibetan for a query with search operators', () => {
    expect(tibetanHint(mountHints({ mode: 'en', text: 'bcom & ldan' })).exists()).toBe(false)
    expect(tibetanHint(mountHints({ mode: 'en', text: '{bcom}' })).exists()).toBe(false)
  })

  it('should not offer Tibetan when the Wylie starts no term', () => {
    expect(tibetanHint(mountHints({ mode: 'en', text: 'zzzq' })).exists()).toBe(false)
  })

  it('should not offer Tibetan for Latin with diacritics', () => {
    expect(tibetanHint(mountHints({ mode: 'en', text: 'kākiṇī' })).exists()).toBe(false)
  })

  it('should not offer Tibetan for an empty query', () => {
    expect(tibetanHint(mountHints({ mode: 'en', text: '  ' })).exists()).toBe(false)
  })

  it('should not offer English search in the English mode', () => {
    const wrapper = mountHints({ mode: 'en', text: 'bcom', asTyped: 'kākiṇī', typedWylie: 'bcom' })
    expect(searchHint(wrapper).exists()).toBe(false)
  })
})

describe('switchLookupMode — text as typed fallback', () => {
  it('should switch to English with the text as typed when the Wylie is unknown', () => {
    expect(
      switchLookupMode({ mode: 'bo', text: 'ཀཱཀིṇī་', typedWylie: '', asTyped: 'kākiṇī' }, 'en')
    ).toBe('kākiṇī')
  })
})

describe('startsAnyTerm', () => {
  const terms = ['ཀ་', 'བཅོམ་', 'བཅོམ་ལྡན་']

  it('should be false for an empty list', () => {
    expect(startsAnyTerm([], 'བཅོམ་')).toBe(false)
  })

  it('should be false when no term starts with the prefix', () => {
    expect(startsAnyTerm(terms, 'ག')).toBe(false)
  })

  it('should be true for an exact term', () => {
    expect(startsAnyTerm(terms, 'ཀ་')).toBe(true)
  })

  it('should be true for the prefix of several terms', () => {
    expect(startsAnyTerm(terms, 'བཅོམ')).toBe(true)
  })

  it('should be false for an empty prefix or no list', () => {
    expect(startsAnyTerm(terms, '')).toBe(false)
    expect(startsAnyTerm(undefined, 'ཀ')).toBe(false)
  })

  it('should not depend on the terms being sorted', () => {
    expect(startsAnyTerm(['ཀ་', 'ཀ་ཀ་', 'ཁ་', 'ཀ'].reverse().concat(['བཅོམ་']), 'བཅོམ')).toBe(true)
  })
})

describe('LookupHints — terms scan', () => {
  it('should not scan the terms again when a miss is rendered again', async () => {
    const original = SqlDatabase.allTerms
    const terms = ['ཀ་']
    const some = vi.spyOn(terms, 'some')
    SqlDatabase.allTerms = terms
    const wrapper = mountHints({ mode: 'en', text: 'zzzq' })
    const scans = some.mock.calls.length
    await wrapper.setProps({ headwordCount: 1 })
    await wrapper.setProps({ definitionCount: 4 })
    await wrapper.setProps({ typedWylie: 'x' })
    expect(some.mock.calls.length).toBe(scans)
    wrapper.unmount()
    SqlDatabase.allTerms = original
  })

  it('should refresh the hint when the terms change', async () => {
    const original = SqlDatabase.allTerms
    SqlDatabase.allTerms = ['ཀ་']
    const wrapper = mountHints({ mode: 'en', text: 'bcom' })
    expect(tibetanHint(wrapper).exists()).toBe(false)
    SqlDatabase.allTerms = ['ཀ་', 'བཅོམ་']
    window._triggerEvent('all-terms-updated')
    await nextTick()
    expect(tibetanHint(wrapper).exists()).toBe(true)
    wrapper.unmount()
    SqlDatabase.allTerms = original
  })
})
