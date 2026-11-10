import { describe, it, expect, beforeEach } from 'vitest'
import { recentTexts, recordText, clearSplitHistory } from '../src/services/split-history'
import Storage from '../src/services/storage'

beforeEach(() => Storage.delete('splitHistory'))

describe('split history service', () => {
  it('should return an empty list when nothing was recorded', () => {
    expect(recentTexts()).toEqual([])
  })

  it('should list the most recent text first when several are recorded', () => {
    recordText('ཀ་ ཁ་')
    recordText('ག་ ང་')
    expect(recentTexts()).toEqual(['ག་ ང་', 'ཀ་ ཁ་'])
  })

  it('should replace the entry without duplicating it when the same text is recorded with other spaces', () => {
    recordText('ཀ་ཁ་ག་')
    recordText('ཆ་ ཇ་')
    recordText('ཀ་ ཁ་ ག་')
    expect(recentTexts()).toEqual(['ཀ་ ཁ་ ག་', 'ཆ་ ཇ་'])
  })

  it('should treat line breaks and tabs as whitespace when comparing texts', () => {
    recordText('ཀ་ཁ་\nག་')
    recordText('ཀ་ཁ་\tག་')
    expect(recentTexts()).toEqual(['ཀ་ཁ་\tག་'])
  })

  it('should keep only the last step when the text is being typed out', () => {
    recordText('ཆ་ ཇ་')
    recordText('སངས་')
    recordText('སངས་རྒྱས་')
    expect(recentTexts()).toEqual(['སངས་རྒྱས་', 'ཆ་ ཇ་'])
  })

  it('should keep only the last step when the text is being shortened', () => {
    recordText('སངས་ རྒྱས་')
    recordText('སངས་')
    expect(recentTexts()).toEqual(['སངས་'])
  })

  it('should ignore empty texts', () => {
    recordText('')
    recordText('   \n ')
    recordText(undefined)
    expect(recentTexts()).toEqual([])
  })

  it('should keep only the 10 most recent texts', () => {
    for (let i = 0; i < 15; i++) recordText('t' + i + 'x'.repeat(i * 2))
    expect(recentTexts()).toHaveLength(10)
    expect(recentTexts()[0]).toBe('t14' + 'x'.repeat(28))
  })

  it('should forget everything when cleared', () => {
    recordText('ཀ་')
    clearSplitHistory()
    expect(recentTexts()).toEqual([])
  })

  it('should persist under the splitHistory key', () => {
    recordText('ཀ་')
    expect(Storage.get('splitHistory')).toEqual(['ཀ་'])
  })
})
