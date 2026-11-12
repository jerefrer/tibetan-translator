import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const tokenizer = vi.hoisted(() => ({ created: 0 }))
vi.mock('tibetan-word-tokenizer', () => ({
  createTokenizer: () => {
    tokenizer.created++
    return {
      tokenize: () => [
        { text: 'ཤེས་རབ་', chunkType: 'TEXT' },
        { text: '།', chunkType: 'PUNCT' },
        { text: 'ཀྱི', chunkType: 'TEXT' },
        { text: '་', chunkType: 'TEXT' },
      ],
    }
  },
}))

import {
  createTokenizerSession,
  tokenizerError,
  splitIntoWords,
  wordsFromSpacedText,
  findMerges,
  mergeLanes,
} from '../src/services/segmenter'

describe('segmenter — splitting', () => {
  beforeEach(() => {
    tokenizer.created = 0
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('should split with the tokenizer and keep only text chunks', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) }))
    const session = createTokenizerSession()

    const words = await splitIntoWords('ཤེས་རབ་ཀྱི།', session)

    expect(words).toEqual(['ཤེས་རབ་', 'ཀྱི་'])
    expect(globalThis.fetch).toHaveBeenCalledWith('/botok-dictionary.json')
    await splitIntoWords('ཤེས་རབ་', session)
    expect(tokenizer.created).toBe(1)
  })

  it('should fall back to tsheg splitting when the dictionary fails to load', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false }))
    const session = createTokenizerSession()

    const words = await splitIntoWords('ཤེས་རབ་ཀྱི།', session)

    expect(words).toEqual(['ཤེས་', 'རབ་', 'ཀྱི་'])
    expect(tokenizerError(session)).toBe(
      'Dictionary not found. Please ensure botok-dictionary.json is in the public folder.'
    )
  })

  it('should read word breaks from spaces', () => {
    expect(wordsFromSpacedText('  ཤེས་རབ་ ཀྱི །  ༔ ཕ་རོལ་ ')).toEqual(['ཤེས་རབ་', 'ཀྱི་', 'ཕ་རོལ་'])
    expect(wordsFromSpacedText('   ')).toEqual([])
  })
})

describe('segmenter — expressions', () => {
  const words = ['ཀ་', 'ཁ་', 'ག་', 'ང་', 'ཅ་', 'ཆ་']
  const knowing = (...known) => vi.fn(async (term) => known.includes(term))

  it('should find a two-word expression that has entries', async () => {
    const merges = await findMerges(words, knowing('ཁ་ག་'))

    expect(merges).toEqual([{ start: 1, count: 2, term: 'ཁ་ག་' }])
  })

  it('should not look beyond five words', async () => {
    const hasEntries = knowing('ཀ་ཁ་ག་ང་ཅ་ཆ་')

    const merges = await findMerges(words, hasEntries)

    expect(merges).toEqual([])
    expect(hasEntries).not.toHaveBeenCalledWith('ཀ་ཁ་ག་ང་ཅ་ཆ་')
    expect(hasEntries).toHaveBeenCalledWith('ཀ་ཁ་ག་ང་ཅ་')
  })

  it('should recheck only around a changed index', async () => {
    const many = Array.from({ length: 20 }, () => 'ཀ་')
    const hasEntries = knowing('ཀ་ཀ་')

    const merges = await findMerges(many, hasEntries, { around: 10 })

    expect(merges.map((m) => m.start)).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14])
  })

  it('should stack overlapping merges in lanes', () => {
    const lanes = mergeLanes([
      { start: 1, count: 2, term: 'a' },
      { start: 0, count: 3, term: 'b' },
      { start: 0, count: 2, term: 'c' },
      { start: 3, count: 2, term: 'd' },
    ])

    expect(lanes.map(({ term, lane }) => [term, lane])).toEqual([
      ['b', 0],
      ['c', 1],
      ['a', 2],
      ['d', 0],
    ])
  })
})
