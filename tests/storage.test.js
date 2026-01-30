/**
 * Storage Service Tests
 *
 * Tests the Storage service for localStorage/cookie abstraction.
 * Focuses on the Storage API behavior rather than internal localStorage interactions.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import Storage from '../src/services/storage.js'

describe('Storage Service', () => {
  describe('localStorageSupported', () => {
    it('returns true when localStorage is available', () => {
      expect(Storage.localStorageSupported()).toBe(true)
    })
  })

  describe('scopedKey', () => {
    it('prefixes key with app name', () => {
      expect(Storage.scopedKey('testKey')).toBe('tibetan-translator.testKey')
    })

    it('handles empty key', () => {
      expect(Storage.scopedKey('')).toBe('tibetan-translator.')
    })
  })

  describe('get/set round-trip', () => {
    it('stores and retrieves string value', () => {
      Storage.set('testString', 'testValue')
      expect(Storage.get('testString')).toBe('testValue')
    })

    it('stores and retrieves object value', () => {
      const obj = { foo: 'bar', num: 42 }
      Storage.set('testObj', obj)
      expect(Storage.get('testObj')).toEqual(obj)
    })

    it('stores and retrieves array value', () => {
      const arr = [1, 2, 3]
      Storage.set('testArr', arr)
      expect(Storage.get('testArr')).toEqual(arr)
    })

    it('stores and retrieves boolean false', () => {
      Storage.set('testBool', false)
      expect(Storage.get('testBool')).toBe(false)
    })

    it('stores and retrieves boolean true', () => {
      Storage.set('testBoolTrue', true)
      expect(Storage.get('testBoolTrue')).toBe(true)
    })

    it('stores and retrieves null value', () => {
      Storage.set('testNull', null)
      expect(Storage.get('testNull')).toBe(null)
    })

    it('stores and retrieves number value', () => {
      Storage.set('testNum', 42)
      expect(Storage.get('testNum')).toBe(42)
    })

    it('stores and retrieves zero', () => {
      Storage.set('testZero', 0)
      expect(Storage.get('testZero')).toBe(0)
    })

    it('stores and retrieves empty string', () => {
      Storage.set('testEmpty', '')
      expect(Storage.get('testEmpty')).toBe('')
    })

    it('stores and retrieves nested objects', () => {
      const nested = { a: { b: { c: 'deep' } } }
      Storage.set('testNested', nested)
      expect(Storage.get('testNested')).toEqual(nested)
    })

    it('stores and retrieves array of objects', () => {
      const arr = [{ id: 1 }, { id: 2 }]
      Storage.set('testArrObj', arr)
      expect(Storage.get('testArrObj')).toEqual(arr)
    })
  })

  describe('get defaults', () => {
    it('returns default value when key not found', () => {
      expect(Storage.get('nonexistent', 'default')).toBe('default')
    })

    it('returns null as default when no default specified', () => {
      expect(Storage.get('nonexistent')).toBe(null)
    })

    it('returns custom default for non-existent key', () => {
      expect(Storage.get('missing', { fallback: true })).toEqual({ fallback: true })
    })

    it('returns stored value even when default is provided', () => {
      Storage.set('exists', 'stored')
      expect(Storage.get('exists', 'default')).toBe('stored')
    })

    it('returns stored false over default', () => {
      Storage.set('isFalse', false)
      expect(Storage.get('isFalse', true)).toBe(false)
    })
  })

  describe('set with undefined', () => {
    it('deletes key when value is undefined', () => {
      Storage.set('toDelete', 'value')
      expect(Storage.get('toDelete')).toBe('value')

      Storage.set('toDelete', undefined)
      expect(Storage.get('toDelete')).toBe(null)
    })

    it('returns true on successful set', () => {
      expect(Storage.set('key', 'value')).toBe(true)
    })
  })

  describe('delete', () => {
    it('removes stored key', () => {
      Storage.set('deleteMe', 'value')
      expect(Storage.get('deleteMe')).toBe('value')

      Storage.delete('deleteMe')
      expect(Storage.get('deleteMe')).toBe(null)
    })

    it('handles deleting non-existent key', () => {
      expect(() => Storage.delete('nonexistent')).not.toThrow()
    })
  })

  describe('Integration: SearchPage state persistence', () => {
    it('stores and retrieves searchQuery', () => {
      Storage.set('searchQuery', 'བསམ་གཏན་')
      expect(Storage.get('searchQuery')).toBe('བསམ་གཏན་')
    })

    it('stores and retrieves previousQueries array', () => {
      const queries = ['query1', 'query2', 'བོད་ཡིག་']
      Storage.set('previousQueries', queries)
      expect(Storage.get('previousQueries')).toEqual(queries)
    })

    it('handles empty previousQueries', () => {
      Storage.set('previousQueries', [])
      expect(Storage.get('previousQueries')).toEqual([])
    })

    it('stores and retrieves searchBuilderVisible boolean', () => {
      Storage.set('searchBuilderVisible', false)
      expect(Storage.get('searchBuilderVisible')).toBe(false)

      Storage.set('searchBuilderVisible', true)
      expect(Storage.get('searchBuilderVisible')).toBe(true)
    })

    it('handles complex search queries with special characters', () => {
      const query = 'buddha & [sangye] & {cho}'
      Storage.set('searchQuery', query)
      expect(Storage.get('searchQuery')).toBe(query)
    })
  })

  describe('Integration: DefinePage state persistence', () => {
    it('stores and retrieves selectedTerm', () => {
      Storage.set('selectedTerm', 'བསམ་གཏན་')
      expect(Storage.get('selectedTerm')).toBe('བསམ་གཏན་')
    })

    it('handles Tibetan terms with punctuation', () => {
      Storage.set('selectedTerm', 'སངས་རྒྱས་')
      expect(Storage.get('selectedTerm')).toBe('སངས་རྒྱས་')
    })
  })

  describe('Integration: dictionary settings', () => {
    it('stores and retrieves disabledDictionaries', () => {
      const disabled = ['dict1', 'dict2']
      Storage.set('disabledDictionaries', disabled)
      expect(Storage.get('disabledDictionaries')).toEqual(disabled)
    })

    it('stores and retrieves dictionaryOrder', () => {
      const order = ['dict3', 'dict1', 'dict2']
      Storage.set('dictionaryOrder', order)
      expect(Storage.get('dictionaryOrder')).toEqual(order)
    })

    it('handles empty dictionary lists', () => {
      Storage.set('disabledDictionaries', [])
      expect(Storage.get('disabledDictionaries')).toEqual([])
    })
  })

  describe('Edge cases', () => {
    it('handles very long strings', () => {
      const longString = 'a'.repeat(10000)
      Storage.set('longString', longString)
      expect(Storage.get('longString')).toBe(longString)
    })

    it('handles unicode characters', () => {
      const unicode = '🙏 བོད་ཡིག་ 日本語 العربية'
      Storage.set('unicode', unicode)
      expect(Storage.get('unicode')).toBe(unicode)
    })

    it('handles keys with special characters', () => {
      Storage.set('key.with.dots', 'value1')
      Storage.set('key-with-dashes', 'value2')
      Storage.set('key_with_underscores', 'value3')

      expect(Storage.get('key.with.dots')).toBe('value1')
      expect(Storage.get('key-with-dashes')).toBe('value2')
      expect(Storage.get('key_with_underscores')).toBe('value3')
    })

    it('handles rapid set/get operations', () => {
      for (let i = 0; i < 100; i++) {
        Storage.set(`rapid${i}`, i)
      }
      for (let i = 0; i < 100; i++) {
        expect(Storage.get(`rapid${i}`)).toBe(i)
      }
    })

    it('overwrites existing values', () => {
      Storage.set('overwrite', 'first')
      expect(Storage.get('overwrite')).toBe('first')

      Storage.set('overwrite', 'second')
      expect(Storage.get('overwrite')).toBe('second')
    })
  })
})
