/**
 * Search's layout on a desktop, read from the styles (jsdom applies none):
 * one wide column, centred past its cap, and results whose rows keep their
 * first definition in place when they unfold.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import fs from 'fs'
import path from 'path'

vi.mock('../src/services/scan-service', () => ({
  getScanInfo: () => null,
}))

import TermEntries from '../src/components/TermEntries.vue'

const read = (file) => fs.readFileSync(path.resolve(__dirname, '../src/components', file), 'utf8')

const entry = (definition) => ({
  term: 'རིག་པ་',
  definition,
  decoratedDefinition: definition,
  dictionary: 'TsepakRigdzin',
  dictionaryId: 1,
})

function mountRow(props = {}) {
  return mount(TermEntries, {
    props: { term: 'རིག་པ་', preview: entry('awareness'), total: 2, ...props },
  })
}

describe('Search — layout', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should let the page grow to 80rem, then centre it on a wider window', () => {
    expect(read('SearchPage.vue')).toMatch(
      /\n\.search-page > :not\(\.ui-visually-hidden\)\n  width 100%\n  max-width 80rem\n  margin-inline auto\n/
    )
  })

  it('should line up a collapsed preview and the open definitions on the same dictionary and definition columns', () => {
    const columns = 'grid-template-columns: var(--dictionary-column) minmax(0, 1fr) 2rem;'
    expect(read('TermEntries.vue').split(columns)).toHaveLength(3)
  })

  it('should widen the term column on a wide screen, so fewer terms wrap', () => {
    expect(read('TermEntries.vue')).toContain('--term-column: clamp(11rem, 22%, 18rem);')
  })

  it('should show the first definition where the preview stood when the row opens', async () => {
    const wrapper = mountRow()
    const body = wrapper.find('.term-entries__body')
    expect(body.element.firstElementChild.dataset.testid).toBe('term-entries-preview')

    await wrapper.setProps({ open: true, preview: null, entries: [entry('awareness'), entry('knowledge')] })

    expect(wrapper.find('.term-entries__body').element).toBe(body.element)
    expect(body.element.firstElementChild.classList).toContain('entry-row')
  })

  it('should name the toggle after the term and its count', () => {
    const wrapper = mountRow()
    const toggle = wrapper.find('[data-testid="term-entries-header"]')
    const names = toggle.attributes('aria-labelledby').split(' ').map((id) => wrapper.find(`#${id}`).text())
    expect(names).toEqual(['རིག་པ་', '2 definitions'])
  })

  it('should emit toggle-open when the toggle is pressed', async () => {
    const wrapper = mountRow()
    await wrapper.find('[data-testid="term-entries-header"]').trigger('click')
    expect(wrapper.emitted('toggle-open')).toHaveLength(1)
  })

  it('should grow the row from its old height to its new one when it opens', async () => {
    const animate = vi.fn()
    HTMLElement.prototype.animate = animate
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function () {
      return this.classList.contains('is-open') ? 240 : 52
    })
    const wrapper = mountRow()

    await wrapper.setProps({ open: true, preview: null, entries: [entry('awareness'), entry('knowledge')] })
    await wrapper.vm.$nextTick()

    expect(animate).toHaveBeenCalledTimes(1)
    expect(animate.mock.calls[0][0]).toEqual([{ height: '52px' }, { height: '240px' }])
    delete HTMLElement.prototype.animate
  })

  it('should not animate when the reader asks for reduced motion', async () => {
    const animate = vi.fn()
    HTMLElement.prototype.animate = animate
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true })
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function () {
      return this.classList.contains('is-open') ? 240 : 52
    })
    const wrapper = mountRow()

    await wrapper.setProps({ open: true, preview: null, entries: [entry('awareness')] })
    await wrapper.vm.$nextTick()

    expect(animate).not.toHaveBeenCalled()
    delete HTMLElement.prototype.animate
  })
})
