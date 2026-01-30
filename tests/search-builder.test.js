/**
 * SearchBuilder Component Tests
 *
 * Tests the SearchBuilder component's bidirectional synchronization
 * between the text input and the query builder rows.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import SearchBuilder from '../src/components/SearchBuilder.vue'

// Create Vuetify instance for tests
const vuetify = createVuetify({
  components,
  directives,
})

describe('SearchBuilder Component', () => {
  const mountSearchBuilder = (props = {}) => {
    return mount(SearchBuilder, {
      props: {
        modelValue: '',
        visible: true,
        ...props,
      },
      global: {
        plugins: [vuetify],
      },
    })
  }

  describe('Query parsing (text -> rows)', () => {
    it('initializes with empty row when no query', () => {
      const wrapper = mountSearchBuilder({ modelValue: '' })
      expect(wrapper.vm.rows).toEqual([{ term: '', mode: 'contains' }])
    })

    it('parses single regular term', async () => {
      const wrapper = mountSearchBuilder({ modelValue: 'buddha' })
      expect(wrapper.vm.rows).toEqual([{ term: 'buddha', mode: 'contains' }])
    })

    it('parses strict phonetics term [term]', async () => {
      const wrapper = mountSearchBuilder({ modelValue: '[sangye]' })
      expect(wrapper.vm.rows).toEqual([{ term: 'sangye', mode: 'phonetic-strict' }])
    })

    it('parses loose phonetics term {term}', async () => {
      const wrapper = mountSearchBuilder({ modelValue: '{sangye}' })
      expect(wrapper.vm.rows).toEqual([{ term: 'sangye', mode: 'phonetic-loose' }])
    })

    it('parses Wylie term (term)', async () => {
      const wrapper = mountSearchBuilder({ modelValue: '(bsam gtan)' })
      expect(wrapper.vm.rows).toEqual([{ term: 'bsam gtan', mode: 'wylie' }])
    })

    it('parses multiple terms with & operator', async () => {
      const wrapper = mountSearchBuilder({ modelValue: 'buddha & dharma' })
      expect(wrapper.vm.rows).toEqual([
        { term: 'buddha', mode: 'contains' },
        { term: 'dharma', mode: 'contains' },
      ])
    })

    it('parses mixed term types', async () => {
      const wrapper = mountSearchBuilder({ modelValue: 'buddha & [sangye] & {cho}' })
      expect(wrapper.vm.rows).toEqual([
        { term: 'buddha', mode: 'contains' },
        { term: 'sangye', mode: 'phonetic-strict' },
        { term: 'cho', mode: 'phonetic-loose' },
      ])
    })

    it('handles whitespace around & operator', async () => {
      const wrapper = mountSearchBuilder({ modelValue: '  buddha  &  dharma  ' })
      expect(wrapper.vm.rows).toEqual([
        { term: 'buddha', mode: 'contains' },
        { term: 'dharma', mode: 'contains' },
      ])
    })

    it('handles Tibetan script', async () => {
      const wrapper = mountSearchBuilder({ modelValue: 'བསམ་གཏན་' })
      expect(wrapper.vm.rows).toEqual([{ term: 'བསམ་གཏན་', mode: 'contains' }])
    })
  })

  describe('Query generation (rows -> text)', () => {
    it('generates empty string for empty rows', async () => {
      const wrapper = mountSearchBuilder({ modelValue: '' })
      wrapper.vm.rows = [{ term: '', mode: 'contains' }]
      await wrapper.vm.$nextTick()
      // Empty term should result in empty query
      expect(wrapper.vm.rowsToQuery()).toBe('')
    })

    it('generates regular term', async () => {
      const wrapper = mountSearchBuilder({ modelValue: '' })
      wrapper.vm.rows = [{ term: 'buddha', mode: 'contains' }]
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.rowsToQuery()).toBe('buddha')
    })

    it('generates strict phonetics term with brackets', async () => {
      const wrapper = mountSearchBuilder({ modelValue: '' })
      wrapper.vm.rows = [{ term: 'sangye', mode: 'phonetic-strict' }]
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.rowsToQuery()).toBe('[sangye]')
    })

    it('generates loose phonetics term with braces', async () => {
      const wrapper = mountSearchBuilder({ modelValue: '' })
      wrapper.vm.rows = [{ term: 'sangye', mode: 'phonetic-loose' }]
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.rowsToQuery()).toBe('{sangye}')
    })

    it('generates Wylie term with parentheses', async () => {
      const wrapper = mountSearchBuilder({ modelValue: '' })
      wrapper.vm.rows = [{ term: 'bsam gtan', mode: 'wylie' }]
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.rowsToQuery()).toBe('(bsam gtan)')
    })

    it('generates multiple terms with & operator', async () => {
      const wrapper = mountSearchBuilder({ modelValue: '' })
      wrapper.vm.rows = [
        { term: 'buddha', mode: 'contains' },
        { term: 'dharma', mode: 'contains' },
      ]
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.rowsToQuery()).toBe('buddha & dharma')
    })

    it('filters out empty terms', async () => {
      const wrapper = mountSearchBuilder({ modelValue: '' })
      wrapper.vm.rows = [
        { term: 'buddha', mode: 'contains' },
        { term: '', mode: 'contains' },
        { term: 'dharma', mode: 'contains' },
      ]
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.rowsToQuery()).toBe('buddha & dharma')
    })
  })

  describe('Bidirectional synchronization', () => {
    it('updates rows when modelValue changes', async () => {
      const wrapper = mountSearchBuilder({ modelValue: '' })
      expect(wrapper.vm.rows).toEqual([{ term: '', mode: 'contains' }])

      await wrapper.setProps({ modelValue: 'buddha' })
      expect(wrapper.vm.rows).toEqual([{ term: 'buddha', mode: 'contains' }])
    })

    it('emits update:modelValue when rows change', async () => {
      const wrapper = mountSearchBuilder({ modelValue: '' })

      // Manually update a row (simulating user input)
      wrapper.vm.isUpdatingFromText = false
      wrapper.vm.rows[0] = { term: 'buddha', mode: 'contains' }
      await wrapper.vm.$nextTick()

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeTruthy()
    })

    it('prevents circular updates (text -> rows -> text)', async () => {
      const wrapper = mountSearchBuilder({ modelValue: 'buddha' })

      // Change modelValue multiple times rapidly
      await wrapper.setProps({ modelValue: 'dharma' })
      await wrapper.setProps({ modelValue: 'sangha' })
      await wrapper.setProps({ modelValue: 'buddha' })

      // Rows should update correctly (no infinite loop)
      expect(wrapper.vm.rows).toEqual([{ term: 'buddha', mode: 'contains' }])
    })

    it('prevents circular updates (rows -> text -> rows)', async () => {
      const wrapper = mountSearchBuilder({ modelValue: '' })

      // Simulate rapid row updates (no infinite loop)
      wrapper.vm.rows = [{ term: 'buddha', mode: 'contains' }]
      await wrapper.vm.$nextTick()
      wrapper.vm.rows = [{ term: 'dharma', mode: 'contains' }]
      await wrapper.vm.$nextTick()

      // Should settle to final value (no infinite loop)
      expect(wrapper.vm.rows[0].term).toBe('dharma')
    })
  })

  describe('Row management', () => {
    it('adds a new row', async () => {
      const wrapper = mountSearchBuilder({ modelValue: 'buddha' })
      expect(wrapper.vm.rows.length).toBe(1)

      wrapper.vm.addRow()
      expect(wrapper.vm.rows.length).toBe(2)
      expect(wrapper.vm.rows[1]).toEqual({ term: '', mode: 'contains' })
    })

    it('removes a row when multiple rows exist', async () => {
      const wrapper = mountSearchBuilder({ modelValue: 'buddha & dharma' })
      expect(wrapper.vm.rows.length).toBe(2)

      wrapper.vm.removeRow(0)
      expect(wrapper.vm.rows.length).toBe(1)
      expect(wrapper.vm.rows[0]).toEqual({ term: 'dharma', mode: 'contains' })
    })

    it('clears the row instead of removing when only one row', async () => {
      const wrapper = mountSearchBuilder({ modelValue: 'buddha' })
      expect(wrapper.vm.rows.length).toBe(1)

      wrapper.vm.removeRow(0)
      expect(wrapper.vm.rows.length).toBe(1)
      expect(wrapper.vm.rows[0]).toEqual({ term: '', mode: 'contains' })
    })

    it('updates row term', async () => {
      const wrapper = mountSearchBuilder({ modelValue: 'buddha' })
      wrapper.vm.updateRowTerm(0, 'dharma')
      expect(wrapper.vm.rows[0].term).toBe('dharma')
    })

    it('updates row mode', async () => {
      const wrapper = mountSearchBuilder({ modelValue: 'buddha' })
      wrapper.vm.updateRowMode(0, 'phonetic-strict')
      expect(wrapper.vm.rows[0].mode).toBe('phonetic-strict')
    })
  })

  describe('Visibility control', () => {
    it('emits hide event', async () => {
      const wrapper = mountSearchBuilder({ modelValue: '', visible: true })
      wrapper.vm.hide()

      expect(wrapper.emitted('update:visible')).toBeTruthy()
      expect(wrapper.emitted('update:visible')[0]).toEqual([false])
    })
  })

  describe('Submit handling', () => {
    it('emits submit event', async () => {
      const wrapper = mountSearchBuilder({ modelValue: 'buddha' })
      wrapper.vm.handleSubmit()

      expect(wrapper.emitted('submit')).toBeTruthy()
    })
  })

  describe('Edge cases', () => {
    it('handles query with only &', async () => {
      const wrapper = mountSearchBuilder({ modelValue: '&' })
      expect(wrapper.vm.rows).toEqual([{ term: '', mode: 'contains' }])
    })

    it('handles multiple & without terms', async () => {
      const wrapper = mountSearchBuilder({ modelValue: '& & &' })
      expect(wrapper.vm.rows).toEqual([{ term: '', mode: 'contains' }])
    })

    it('handles unclosed brackets as regular term', async () => {
      const wrapper = mountSearchBuilder({ modelValue: '[unclosed' })
      expect(wrapper.vm.rows).toEqual([{ term: '[unclosed', mode: 'contains' }])
    })

    it('handles nested brackets - outer brackets match', async () => {
      const wrapper = mountSearchBuilder({ modelValue: '[[nested]]' })
      // Outer brackets match the pattern [.+], inner brackets become part of term
      expect(wrapper.vm.rows[0].mode).toBe('phonetic-strict')
      expect(wrapper.vm.rows[0].term).toBe('[nested]')
    })

    it('handles empty brackets as regular term (regex requires .+)', async () => {
      const wrapper = mountSearchBuilder({ modelValue: '[]' })
      // Empty brackets don't match [.+] pattern, treated as regular text
      expect(wrapper.vm.rows).toEqual([{ term: '[]', mode: 'contains' }])
    })

    it('handles empty braces as regular term (regex requires .+)', async () => {
      const wrapper = mountSearchBuilder({ modelValue: '{}' })
      // Empty braces don't match {.+} pattern, treated as regular text
      expect(wrapper.vm.rows).toEqual([{ term: '{}', mode: 'contains' }])
    })

    it('handles empty parentheses as regular term (regex requires .+)', async () => {
      const wrapper = mountSearchBuilder({ modelValue: '()' })
      // Empty parens don't match (.+) pattern, treated as regular text
      expect(wrapper.vm.rows).toEqual([{ term: '()', mode: 'contains' }])
    })
  })

  describe('Integration with SearchPage state', () => {
    it('preserves complex query through parse/generate cycle', async () => {
      const complexQuery = 'enlightenment & [sangye] & {cho} & (byang chub)'
      const wrapper = mountSearchBuilder({ modelValue: complexQuery })

      // Parse
      expect(wrapper.vm.rows).toEqual([
        { term: 'enlightenment', mode: 'contains' },
        { term: 'sangye', mode: 'phonetic-strict' },
        { term: 'cho', mode: 'phonetic-loose' },
        { term: 'byang chub', mode: 'wylie' },
      ])

      // Generate
      expect(wrapper.vm.rowsToQuery()).toBe(complexQuery)
    })

    it('handles Tibetan mixed with English and phonetics', async () => {
      const mixedQuery = 'བསམ་གཏན་ & meditation & [samten]'
      const wrapper = mountSearchBuilder({ modelValue: mixedQuery })

      expect(wrapper.vm.rows).toEqual([
        { term: 'བསམ་གཏན་', mode: 'contains' },
        { term: 'meditation', mode: 'contains' },
        { term: 'samten', mode: 'phonetic-strict' },
      ])

      expect(wrapper.vm.rowsToQuery()).toBe(mixedQuery)
    })
  })
})
