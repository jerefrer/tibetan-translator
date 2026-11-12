/**
 * The gloss of an English-mode result (DefinitionResults' highlightedGloss):
 * plain text, hits in <em>, Tibetan runs in a span set in the Tibetan font,
 * and nothing else ever read as markup.
 */
import { describe, it, expect } from 'vitest'
import { highlightedGloss } from '../src/components/lookup/DefinitionResults.vue'

const NO_TERMS = { regular: [], phoneticsStrict: [], phoneticsLoose: [] }
const render = (html) => {
  const element = document.createElement('div')
  element.innerHTML = html
  return element
}

describe('highlightedGloss', () => {
  it('should wrap Tibetan runs in a Tibetan span when the gloss holds Tibetan', () => {
    const gloss = highlightedGloss('wisdom, ཡེ་ཤེས་ in Tibetan', NO_TERMS)

    const spans = render(gloss).querySelectorAll('.lookup-result__gloss-tibetan')
    expect([...spans].map((span) => span.textContent)).toEqual(['ཡེ་ཤེས་'])
    expect(render(gloss).textContent).toBe('wisdom, ཡེ་ཤེས་ in Tibetan')
  })

  it('should keep an image tag as text when the gloss holds markup and Tibetan', () => {
    // An entity-encoded tag survives plainGloss's tag stripping as text
    const gloss = highlightedGloss('&lt;img src=x onerror=alert(1)&gt; ཀ་ wisdom', { ...NO_TERMS, regular: ['wisdom'] })

    const element = render(gloss)
    expect(element.querySelector('img')).toBeNull()
    expect(element.textContent).toBe('<img src=x onerror=alert(1)> ཀ་ wisdom')
    expect(element.querySelector('.lookup-result__gloss-tibetan').textContent).toBe('ཀ་')
    expect(element.querySelector('em').textContent).toBe('wisdom')
    // Only the em and the Tibetan span are elements
    expect([...element.querySelectorAll('*')].map((child) => child.tagName)).toEqual(['SPAN', 'EM'])
  })

  it('should mark a hit inside Tibetan without breaking the markup when the query is Tibetan', () => {
    const gloss = highlightedGloss('see ཡེ་ཤེས་', { ...NO_TERMS, regular: ['ཤེས'] })

    const element = render(gloss)
    expect(element.textContent).toBe('see ཡེ་ཤེས་')
    expect(element.querySelector('em').textContent).toBe('ཤེས')
  })
})
