import { describe, it, expect } from 'vitest'
import { inShort } from '../src/services/in-short'

describe('inShort', () => {
  it('should keep glosses at least two dictionaries share', () => {
    const entries = [
      { dictionaryId: 1, definition: 'Bhagavat; Blessed One' },
      { dictionaryId: 2, definition: 'Supramundane Victor; Blessed One; Buddha' },
      { dictionaryId: 3, definition: 'blessed one' },
    ]
    expect(inShort(entries)).toEqual(['Blessed One'])
  })

  it('should rank by how many dictionaries agree', () => {
    const entries = [
      { dictionaryId: 1, definition: 'mind; thought' },
      { dictionaryId: 2, definition: 'thought; mind; intellect' },
      { dictionaryId: 3, definition: 'thought' },
    ]
    expect(inShort(entries)).toEqual(['thought', 'mind'])
  })

  it('should ignore bracketed notes and long phrases', () => {
    const entries = [
      { dictionaryId: 1, definition: '<b>mind</b> (Skt. citta) [note]; one two three four five' },
      { dictionaryId: 2, definition: 'mind {x}; one two three four five' },
    ]
    expect(inShort(entries)).toEqual(['mind'])
  })

  it('should return nothing when no gloss is shared', () => {
    const entries = [
      { dictionaryId: 1, definition: 'mind' },
      { dictionaryId: 2, definition: 'thought' },
    ]
    expect(inShort(entries)).toEqual([])
  })

  it('should not count one dictionary twice', () => {
    const entries = [
      { dictionaryId: 1, definition: 'mind' },
      { dictionaryId: 1, definition: 'mind, mind' },
    ]
    expect(inShort(entries)).toEqual([])
  })

  it('should cap at max', () => {
    const entries = [
      { dictionaryId: 1, definition: 'a; b; c; d; e' },
      { dictionaryId: 2, definition: 'a; b; c; d; e' },
    ]
    expect(inShort(entries)).toEqual(['a', 'b', 'c', 'd'])
    expect(inShort(entries, { max: 2 })).toEqual(['a', 'b'])
  })
})

describe('inShort and HTML entities', () => {
  it('should decode entities before splitting so &nbsp; and &amp; do not break a gloss', () => {
    const entries = [
      { dictionaryId: 1, definition: 'Blessed&nbsp;One; fire &amp; water' },
      { dictionaryId: 2, definition: 'blessed one; fire&nbsp;&amp;&nbsp;water' },
    ]
    expect(inShort(entries)).toEqual(['Blessed One'])
  })

  it('should read &#39; as an apostrophe', () => {
    const entries = [
      { dictionaryId: 1, definition: 'Buddha&#39;s word' },
      { dictionaryId: 2, definition: "buddha's word" },
    ]
    expect(inShort(entries)).toEqual(['Buddha\'s word'])
  })
})
