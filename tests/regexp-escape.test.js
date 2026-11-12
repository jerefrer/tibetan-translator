/**
 * quick-lookup's escapeForRegExp: every character a RegExp reads specially is
 * matched as itself, so a query typed so far never throws or matches wrongly.
 */
import { describe, it, expect } from 'vitest'
import { escapeForRegExp, highlightInText } from '../src/services/quick-lookup'

const METACHARACTERS = '.*+?^${}()|[]\\'

describe('escapeForRegExp', () => {
  it.each([...METACHARACTERS])('should match %s literally when the query holds it', (character) => {
    const pattern = new RegExp(`^${escapeForRegExp(character)}$`)

    expect(pattern.test(character)).toBe(true)
    expect(pattern.test('a')).toBe(false)
  })

  it('should match the whole metacharacter set literally when the query holds all of it', () => {
    const pattern = new RegExp(`^${escapeForRegExp(METACHARACTERS)}$`)

    expect(pattern.test(METACHARACTERS)).toBe(true)
  })

  it('should highlight an unfinished group when the query is still being typed', () => {
    expect(highlightInText('the (ye shes of', '(ye')).toBe('the <mark>(ye</mark> shes of')
  })
})
