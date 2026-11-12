/**
 * convertWylieInParentheses (src/utils.js): the search syntax "(sangs rgyas)",
 * Wylie written inside parentheses and searched as Tibetan.
 */
import { describe, it, expect } from 'vitest'
import { convertWylieInParentheses } from '../src/utils.js'

describe('convertWylieInParentheses', () => {
  it('should convert the Wylie inside a closed pair of parentheses', () => {
    expect(convertWylieInParentheses('(sangs rgyas)')).toBe('སངས་རྒྱས')
  })

  it('should convert every pair and leave the text around them', () => {
    expect(convertWylieInParentheses('a (ye shes) & (chos) b')).toBe('a ཡེ་ཤེས & ཆོས b')
  })

  it('should leave text without parentheses as it is', () => {
    expect(convertWylieInParentheses('no parens')).toBe('no parens')
  })

  it('should leave an unclosed parenthesis as it is', () => {
    expect(convertWylieInParentheses('(sangs rgyas')).toBe('(sangs rgyas')
  })
})
