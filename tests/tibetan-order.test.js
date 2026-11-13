/**
 * Tibetan order: words filed by root letter, as Tibetan dictionaries do,
 * not by code point (which files བསྒྲུབ་ under its prefix བ).
 */
import { describe, it, expect } from 'vitest'
import fixture from './fixtures/tibetan-order.json'
import { compareTibetan, sortTibetan } from '../src/services/tibetan-order'

const { words } = fixture
const ordered = words.map(([, tibetan]) => tibetan)

// A fixed shuffle, so a failure reads the same every run
function shuffled(list) {
  const copy = [...list]
  let seed = 7
  for (let i = copy.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280
    const j = Math.floor((seed / 233280) * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

const wylieOf = (list) => list.map((tibetan) => words.find(([, word]) => word === tibetan)[0])

describe('Tibetan order', () => {
  it('should sort words the way Tibetan dictionaries file them', () => {
    expect(wylieOf(sortTibetan(shuffled(ordered)))).toEqual(wylieOf(ordered))
  })

  it('should sort the reversed list back into order too', () => {
    expect(wylieOf(sortTibetan([...ordered].reverse()))).toEqual(wylieOf(ordered))
  })

  it('should file a word under its root letter, not its prefix', () => {
    expect(compareTibetan('བསྒྲུབ་', 'ང་')).toBeLessThan(0)
    expect(compareTibetan('བསྒྲུབ་', 'བ་')).toBeLessThan(0)
  })

  it('should read the same word with or without its final tsheg or shad', () => {
    expect(compareTibetan('སངས་རྒྱས', 'སངས་རྒྱས་')).toBe(0)
    expect(compareTibetan('སངས་རྒྱས།', 'སངས་རྒྱས་')).toBe(0)
  })

  it('should put words that are not Tibetan after the Tibetan ones', () => {
    expect(sortTibetan(['dharma', 'ཨོ་', 'ཀ་'])).toEqual(['ཀ་', 'ཨོ་', 'dharma'])
  })

  it('should file a Sanskrit stack under its first letter, precomposed or not', () => {
    expect(sortTibetan(['ཁ་', 'ཀྵ་', 'ཀ་'])).toEqual(['ཀ་', 'ཀྵ་', 'ཁ་'])
    expect(compareTibetan('ཀྵ་', 'ཀྵ་')).toBe(0)
  })

  it('should file a syllable it cannot read after the readable ones of its letter', () => {
    // Five letters in a row: no Tibetan syllable is written so
    expect(sortTibetan(['ཁ་', 'ཀཀཀཀཀ་', 'ཀོ་'])).toEqual(['ཀོ་', 'ཀཀཀཀཀ་', 'ཁ་'])
  })

  it('should not change the list it is given', () => {
    const list = ['ཁ་', 'ཀ་']
    sortTibetan(list)
    expect(list).toEqual(['ཁ་', 'ཀ་'])
  })
})
