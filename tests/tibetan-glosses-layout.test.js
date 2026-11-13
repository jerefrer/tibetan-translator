/**
 * Glosses that hold Tibetan, in result lists: room above and below the line
 * for stacked letters and vowels, so they are neither cut nor spill over.
 * Layout is not computed in happy-dom, so the rules are read from the sources
 * (checked in Chromium on "{jamyang} & {norbu}").
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { hasTibetan } from '../src/services/glosses'

const source = (file) => fs.readFileSync(path.resolve(__dirname, '../src/components', file), 'utf8')

describe('Tibetan in glosses', () => {
  it('should tell a gloss that holds Tibetan', () => {
    expect(hasTibetan('ka; the first consonant')).toBe(false)
    expect(hasTibetan('བོད་རབ་བྱུང་ (1648)')).toBe(true)
    expect(hasTibetan('')).toBe(false)
  })

  it('should give two-line English results with Tibetan lines tall enough for it', () => {
    const css = source('lookup/DefinitionResults.vue')
    expect(css).toMatch(/\.lookup-result__gloss\.has-tibetan \{\n  line-height: 1\.95;\n\}/)
    expect(css).toMatch(/\.lookup-result__gloss :deep\(\.lookup-result__gloss-tibetan\) \{[^}]*line-height: inherit;/)
  })

  it('should leave one-line glosses room above and below without making the row taller', () => {
    for (const [file, selector] of [
      ['lookup/HeadwordResults.vue', '.lookup-result__gloss'],
      ['lookup/LookupHome.vue', '.lookup-home__gloss'],
    ]) {
      const css = source(file)
      const block = css.slice(css.indexOf(`${selector} {`))
      expect(block.slice(0, block.indexOf('}')), file).toMatch(/padding-block: 0\.4em;\n  margin-block: -0\.4em;/)
    }
  })
})
