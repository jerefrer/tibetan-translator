/**
 * The Wylie echo of the Define field ("typed ye shes"), following the field's
 * own conversion steps: each space turns the Latin tail into Tibetan.
 */

import { describe, it, expect } from 'vitest'
import { initialTypedWylie, nextTypedWylie, typedWylieFor } from '../src/services/typed-wylie'

function type(...values) {
  let state = initialTypedWylie()
  values.forEach((value) => {
    state = nextTypedWylie(state, value)
  })
  return { state, shown: typedWylieFor(state, values[values.length - 1]) }
}

describe('typed Wylie', () => {
  it('should remember one converted syllable', () => {
    expect(type('y', 'ye', 'ye ', 'ཡེ་').shown).toBe('ye')
  })

  it('should add each syllable as the field converts it', () => {
    expect(type('y', 'ye', 'ye ', 'ཡེ་', 'ཡེ་s', 'ཡེ་shes', 'ཡེ་shes ', 'ཡེ་ཤེས་').shown).toBe('ye shes')
  })

  it('should keep a whole phrase typed before the first space', () => {
    expect(type('ye shes kyi', 'ye shes kyi tshogs', 'ཡེ་ཤེས་ཀྱི་ཚོགས་').shown).toBe('ye shes kyi tshogs')
  })

  it('should keep text typed with Sanskrit diacritics as typed', () => {
    expect(type('kāka', 'ཀཱཀ་').shown).toBe('kāka')
  })

  it('should show nothing while the Latin is not converted yet', () => {
    expect(type('ye', 'ye').shown).toBe('')
  })

  it('should show nothing for Tibetan typed or pasted directly', () => {
    expect(type('ཡེ་ཤེས་').shown).toBe('')
  })

  it('should forget the Wylie once the Tibetan is edited', () => {
    expect(type('ye ', 'ཡེ་', 'ཡེ').shown).toBe('')
  })

  it('should not attach new Wylie to Tibetan whose Wylie it does not know', () => {
    expect(type('ཡེ་', 'ཡེ་shes', 'ཡེ་ཤེས་').shown).toBe('')
  })

  it('should start over when everything is selected and retyped', () => {
    expect(type('ye ', 'ཡེ་', 'chos ', 'ཆོས་').shown).toBe('chos')
  })

  it('should forget everything when the field is cleared', () => {
    const { state } = type('ye ', 'ཡེ་', '')
    expect(state).toEqual(initialTypedWylie())
  })

  it('should only answer for the value it was computed for', () => {
    const { state } = type('ye ', 'ཡེ་')
    expect(typedWylieFor(state, 'ཡེ་ཤེས་')).toBe('')
  })
})
