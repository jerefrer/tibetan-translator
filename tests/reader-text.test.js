/**
 * ReaderText: hovering an expression's bracket shows which words it covers,
 * so the reader sees what a click will look up.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

import ReaderText from '../src/components/reader/ReaderText.vue'

const words = ['སངས་རྒྱས་', 'ཆོས་', 'དང་', 'ཚོགས་']
const merges = [{ start: 0, count: 2, term: 'སངས་རྒྱས་ཆོས་', lane: 0 }]

const previewed = (wrapper) =>
  wrapper.findAll('[data-testid="reader-word"]').map((word) => word.classes().includes('is-previewed'))

describe('ReaderText — expression preview', () => {
  it('should mark the words of an expression while its bracket is hovered', async () => {
    const wrapper = mount(ReaderText, { props: { words, merges } })

    await wrapper.find('[data-testid="reader-merge"]').trigger('mouseenter')

    expect(previewed(wrapper)).toEqual([true, true, false, false])
  })

  it('should clear the mark when the pointer leaves the bracket', async () => {
    const wrapper = mount(ReaderText, { props: { words, merges } })
    const bracket = wrapper.find('[data-testid="reader-merge"]')

    await bracket.trigger('mouseenter')
    await bracket.trigger('mouseleave')

    expect(previewed(wrapper)).toEqual([false, false, false, false])
  })
})
