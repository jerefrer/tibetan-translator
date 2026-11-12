import { describe, it, expect } from 'vitest'
import { wylieFor, phoneticsForTerm } from '../src/services/transcription'
import { phoneticsStrictFor } from '../src/utils'

describe('transcription', () => {
  it('should give the Wylie of a term', () => {
    expect(wylieFor('བཅོམ་ལྡན་འདས་')).toBe("bcom ldan 'das")
    expect(wylieFor('སངས་རྒྱས་')).toBe('sangs rgyas')
  })

  it('should give a one-word phonetic transcription', () => {
    const result = phoneticsForTerm('བཅོམ་ལྡན་འདས་')
    expect(result).not.toBe('')
    expect(result).not.toMatch(/\s/)
    expect(result).toBe('chomdendé')
  })

  it('should not disturb phoneticsStrictFor', () => {
    const before = phoneticsStrictFor('བཅོམ་')
    phoneticsForTerm('བཅོམ་ལྡན་འདས་')
    expect(phoneticsStrictFor('བཅོམ་')).toBe(before)
  })
})
