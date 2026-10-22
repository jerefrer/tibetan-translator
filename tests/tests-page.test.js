/**
 * The developer page at /tests: runs the phonetic search examples and lists
 * the result of each group, without Vuetify.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

import TestsPage from '../src/components/TestsPage.vue'
import TestsPageGroupResult from '../src/components/TestsPageGroupResult.vue'
import { diffChars } from '../src/components/TestsPageGroupResultDiff.vue'
import SplitSyllablesTests from './phonetic-search/split-syllables.js'
import LooseMatchingTests from './phonetic-search/prepare-term-for-loose-matching.js'

const groups = [LooseMatchingTests, SplitSyllablesTests]
const total = SplitSyllablesTests.tests.length + LooseMatchingTests.tests.length
const passing = (group) =>
  group.tests.filter((t) => JSON.stringify(group.method(t.input)) === JSON.stringify(t.expected)).length
const passed = passing(LooseMatchingTests) + passing(SplitSyllablesTests)
const percentage = ((passed / total) * 100).toPrecision(3)

describe('TestsPage', () => {
  it('runs every example and shows the total', () => {
    const wrapper = mount(TestsPage)
    const text = wrapper.find('[data-testid="tests-total"]').text()
    expect(text).toContain(`${percentage}% (${passed}/${total})`)
    expect(text).toMatch(/Ran in:\s*\d+\s*ms/)
    expect(document.title).toBe(`Tests / ${percentage}% (${passed}/${total})`)
  })

  it('lists one row per group with its count; results show when a group fails, and the name toggles them', async () => {
    const wrapper = mount(TestsPage)
    const rows = wrapper.findAll('[data-testid="tests-group"]')
    expect(rows.map((g) => g.find('.header').text())).toEqual(groups.map((g) => g.name))
    for (const [index, group] of groups.entries()) {
      const row = rows[index]
      const ok = passing(group)
      const all = group.tests.length
      expect(row.find('.count').text()).toBe(`${ok}/${all}`)
      expect(row.classes()).toContain(ok === all ? 'results-group--passed' : 'results-group--failed')
      const shown = ok === all ? 0 : all
      expect(row.findAll('[data-testid="tests-result"]')).toHaveLength(shown)
      await row.find('.header').trigger('click')
      expect(row.findAll('[data-testid="tests-result"]')).toHaveLength(all - shown)
    }
  })

  it('renders no Vuetify component', () => {
    const wrapper = mount(TestsPage)
    expect(wrapper.html()).not.toMatch(/<v-|class="v-/)
  })
})

describe('TestsPageGroupResult', () => {
  it('shows a character diff for a failing string result', () => {
    const test = { pass: false, expected: 'sang gye', value: 'sanggye', runTest() {} }
    const wrapper = mount(TestsPageGroupResult, { props: { test } })
    expect(wrapper.classes()).toContain('test--failed')
    expect(wrapper.find('.diff').exists()).toBe(true)
    expect(wrapper.find('.diff').text().replace(/\s+/g, '')).toBe('sang_gye')
  })

  it('diffs characters, marking added and removed runs', () => {
    expect(diffChars('jo mo la ri', 'jo mo lari')).toEqual([
      { value: 'jo mo la', added: false, removed: false },
      { value: ' ', added: false, removed: true },
      { value: 'ri', added: false, removed: false },
    ])
    expect(diffChars('ab', 'acb')).toEqual([
      { value: 'a', added: false, removed: false },
      { value: 'c', added: true, removed: false },
      { value: 'b', added: false, removed: false },
    ])
  })

  it('shows expected and actual for a failing non-string result', () => {
    const test = { pass: false, expected: ['a'], value: ['b'], runTest() {} }
    const wrapper = mount(TestsPageGroupResult, { props: { test } })
    expect(wrapper.find('.test__expected').text()).toContain('a')
    expect(wrapper.find('.test__actual').text()).toContain('b')
  })

  it('runs the example again on click', async () => {
    let runs = 0
    const test = { pass: true, expected: 'x', value: 'x', runTest() { runs++ } }
    const wrapper = mount(TestsPageGroupResult, { props: { test } })
    await wrapper.trigger('click')
    expect(runs).toBe(1)
  })
})
