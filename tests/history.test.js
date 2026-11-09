import { describe, it, expect, beforeEach } from 'vitest'
import { recentTerms, recordTerm, clearHistory } from '../src/services/history'
import Storage from '../src/services/storage'

beforeEach(() => Storage.delete('defineHistory'))

describe('history service', () => {
  it('should return an empty list when nothing was recorded', () => {
    expect(recentTerms()).toEqual([])
  })

  it('should list the most recent term first when several are recorded', () => {
    recordTerm('ཀ་')
    recordTerm('ཁ་')
    expect(recentTerms()).toEqual(['ཁ་', 'ཀ་'])
  })

  it('should keep only the last step when the term is being typed out', () => {
    // Define opens the first matching term while you type: སངས་ then སངས་རྒྱས་
    recordTerm('ཀ་')
    recordTerm('སངས་')
    recordTerm('སངས་རྒྱས་')
    expect(recentTerms()).toEqual(['སངས་རྒྱས་', 'ཀ་'])
  })

  it('should keep only the last step when the term is being shortened', () => {
    recordTerm('སངས་རྒྱས་')
    recordTerm('སངས་')
    expect(recentTerms()).toEqual(['སངས་'])
  })

  it('should move a term to the top without duplicating it when it is recorded again', () => {
    recordTerm('ཀ་')
    recordTerm('ཁ་')
    recordTerm('ཀ་')
    expect(recentTerms()).toEqual(['ཀ་', 'ཁ་'])
  })

  it('should ignore empty terms', () => {
    recordTerm('')
    recordTerm('   ')
    recordTerm(undefined)
    expect(recentTerms()).toEqual([])
  })

  it('should keep only the 20 most recent terms', () => {
    for (let i = 0; i < 25; i++) recordTerm('t' + i)
    expect(recentTerms()).toHaveLength(20)
    expect(recentTerms()[0]).toBe('t24')
  })

  it('should forget everything when cleared', () => {
    recordTerm('ཀ་')
    clearHistory()
    expect(recentTerms()).toEqual([])
  })

  it('should persist under the defineHistory key', () => {
    recordTerm('ཀ་')
    expect(Storage.get('defineHistory')).toEqual(['ཀ་'])
  })
})
