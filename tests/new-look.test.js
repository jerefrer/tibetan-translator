/**
 * New look: who gets the "A new look" card, decided once at launch.
 */
import { describe, it, expect, beforeEach } from 'vitest'

import Storage from '../src/services/storage'
import { clearHistory, recordTerm } from '../src/services/history'
import { setSavedTerms } from '../src/services/saved-terms'
import { dismissNewLook, newLookPending, recordReturningUser } from '../src/services/new-look'

beforeEach(() => {
  for (const key of ['newLook', 'onboardingComplete', 'autoFillWords', 'dictionaries', 'savedTerms']) Storage.delete(key)
  clearHistory()
})

describe('recordReturningUser', () => {
  it('should mark a new user as seen when nothing was stored before', () => {
    recordReturningUser()
    expect(Storage.get('newLook')).toBe('seen')
    expect(newLookPending()).toBe(false)
  })

  const signals = {
    'finished onboarding': () => Storage.set('onboardingComplete', true),
    'has the autoFillWords default': () => Storage.set('autoFillWords', true),
    'has dictionaries stored': () => Storage.set('dictionaries', []),
    'has recent terms': () => recordTerm('ཀ་'),
    'has saved terms': () => setSavedTerms(['ཀ་']),
  }
  for (const [name, setUp] of Object.entries(signals)) {
    it(`should mark the user as pending when they ${name}`, () => {
      setUp()
      recordReturningUser()
      expect(newLookPending()).toBe(true)
    })
  }

  it('should leave the choice alone when it was already recorded', () => {
    Storage.set('newLook', 'seen')
    Storage.set('onboardingComplete', true)
    recordReturningUser()
    expect(Storage.get('newLook')).toBe('seen')
  })
})

describe('dismissNewLook', () => {
  it('should set seen when the card is dismissed', () => {
    Storage.set('newLook', 'pending')
    dismissNewLook()
    expect(Storage.get('newLook')).toBe('seen')
    expect(newLookPending()).toBe(false)
  })
})
