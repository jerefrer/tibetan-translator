/**
 * SearchBuilder Component Tests
 *
 * Tests the SearchBuilder component's bidirectional synchronization
 * between the text input and the query builder rows.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import SearchBuilder from '../src/components/SearchBuilder.vue'
import SearchBuilderRow from '../src/components/SearchBuilderRow.vue'
import UiSelect from '../src/ui/UiSelect.vue'

describe('SearchBuilder Component', () => {
  const mounted = []
  afterEach(() => {
    mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  })

  const mountSearchBuilder = (props = {}) => {
    const wrapper = mount(SearchBuilder, {
      props: {
        modelValue: '',
        visible: true,
        ...props,
      },
      attachTo: document.body,
    })
    mounted.push(wrapper)
    return wrapper
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

  describe('Markup (board "B · Search, query builder open")', () => {
    const rows = (wrapper) => wrapper.findAll('[data-testid="search-builder-row"]')
    const terms = (wrapper) => wrapper.findAll('[data-testid="search-builder-term"]')

    it('renders nothing while hidden', () => {
      const wrapper = mountSearchBuilder({ visible: false })
      expect(wrapper.find('[data-testid="search-builder"]').exists()).toBe(false)
    })

    it('shows its title, one row per condition and the AND note', () => {
      const wrapper = mountSearchBuilder({ modelValue: '(ye shes) & wakefulness' })
      expect(wrapper.text()).toContain('Query builder')
      expect(rows(wrapper)).toHaveLength(2)
      expect(terms(wrapper).map((input) => input.element.value)).toEqual(['ye shes', 'wakefulness'])
      expect(wrapper.text()).toContain('An entry must match every condition.')
    })

    it('shows the mode of each row by its label', () => {
      const wrapper = mountSearchBuilder({ modelValue: '(ye shes) & wakefulness & [sangye] & {cho}' })
      const labels = wrapper
        .findAll('[data-testid="ui-select-trigger"]')
        .map((trigger) => trigger.text())
      expect(labels).toEqual([
        'contains (Wylie)',
        'contains',
        'sounds precisely like',
        'sounds more or less like',
      ])
    })

    it('offers the four modes', () => {
      const wrapper = mountSearchBuilder({ modelValue: 'x' })
      const select = wrapper.findComponent(UiSelect)
      expect(select.props('options').map((option) => option.label)).toEqual([
        'contains',
        'contains (Wylie)',
        'sounds precisely like',
        'sounds more or less like',
      ])
    })

    it('rewrites the query when a mode is picked', async () => {
      const wrapper = mountSearchBuilder({ modelValue: 'ye shes' })
      wrapper.findComponent(UiSelect).vm.$emit('update:modelValue', 'wylie')
      await nextTick()
      expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['(ye shes)'])
    })

    it('rewrites the query as a row is typed in, without running it', async () => {
      const wrapper = mountSearchBuilder({ modelValue: '' })
      await terms(wrapper)[0].setValue('wakefulness')
      expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['wakefulness'])
      expect(wrapper.emitted('submit')).toBeFalsy()
    })

    it('keeps Wylie typed in a row as typed (no conversion)', async () => {
      const wrapper = mountSearchBuilder({ modelValue: '' })
      await terms(wrapper)[0].setValue('sangs rgyas ')
      await terms(wrapper)[0].trigger('keyup', { key: ' ' })
      expect(terms(wrapper)[0].element.value).toBe('sangs rgyas ')
    })

    it('runs the search on Enter in a row', async () => {
      const wrapper = mountSearchBuilder({ modelValue: 'buddha' })
      await terms(wrapper)[0].trigger('keyup', { key: 'Enter' })
      expect(wrapper.emitted('submit')).toHaveLength(1)
    })

    it('uses a placeholder that suits the mode', () => {
      const wrapper = mountSearchBuilder({ modelValue: 'x & (y) & [z] & {w}' })
      expect(terms(wrapper).map((input) => input.attributes('placeholder'))).toEqual([
        'བོད་ཡིག་ or text',
        'sangs rgyas',
        'sangye',
        'sangye',
      ])
    })

    it('adds a condition and puts the caret in it', async () => {
      const wrapper = mountSearchBuilder({ modelValue: 'buddha' })
      await wrapper.find('[data-testid="search-builder-add"]').trigger('click')
      await nextTick()
      expect(rows(wrapper)).toHaveLength(2)
      expect(document.activeElement).toBe(terms(wrapper)[1].element)
    })

    it('shows a remove button on each row only when there are two rows or more', async () => {
      const wrapper = mountSearchBuilder({ modelValue: 'buddha' })
      expect(wrapper.findAll('[data-testid="search-builder-remove"]')).toHaveLength(0)
      await wrapper.setProps({ modelValue: 'buddha & dharma' })
      const removes = wrapper.findAll('[data-testid="search-builder-remove"]')
      expect(removes).toHaveLength(2)
      expect(removes[0].attributes('aria-label')).toBe('Remove this condition')
    })

    it('removes a condition and rewrites the query', async () => {
      const wrapper = mountSearchBuilder({ modelValue: 'buddha & dharma' })
      await wrapper.findAll('[data-testid="search-builder-remove"]')[0].trigger('click')
      await nextTick()
      expect(rows(wrapper)).toHaveLength(1)
      expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['dharma'])
    })

    it('hides with its Hide button', async () => {
      const wrapper = mountSearchBuilder({ modelValue: '' })
      await wrapper.find('[data-testid="search-builder-hide"]').trigger('click')
      expect(wrapper.emitted('update:visible')).toEqual([[false]])
    })

    it('stacks each row and shortens the note on a phone', async () => {
      window.innerWidth = 390
      const wrapper = mountSearchBuilder({ modelValue: 'a & b' })
      expect(wrapper.find('[data-testid="search-builder"]').classes()).toContain('is-phone')
      expect(wrapper.findComponent(SearchBuilderRow).classes()).toContain('is-phone')
      expect(wrapper.text()).toContain('Match every condition')
      expect(wrapper.text()).not.toContain('An entry must match every condition.')
    })
  })
})
