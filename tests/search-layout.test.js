/**
 * Search's layout on a desktop, read from the styles (jsdom applies none):
 * one wide column, and results whose rows, collapsed or open, share their
 * term, dictionary and definition columns.
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const read = (file) => fs.readFileSync(path.resolve(__dirname, '../src/components', file), 'utf8')

describe('Search — layout', () => {
  it('should let the page grow to 80rem, its results keeping their lines short with their own columns', () => {
    expect(read('SearchPage.vue')).toMatch(/\n\.search-page > \*\n  max-width 80rem\n/)
  })

  it('should line up a row and its open definitions on the same term and dictionary columns', () => {
    const columns = 'grid-template-columns: var(--term-column) var(--dictionary-column) minmax(0, 1fr) auto;'
    const source = read('TermEntries.vue')
    expect(source.split(columns)).toHaveLength(3)
  })

  it('should widen the term column on a wide screen, so fewer terms wrap', () => {
    expect(read('TermEntries.vue')).toContain('--term-column: clamp(11rem, 22%, 18rem);')
  })
})
