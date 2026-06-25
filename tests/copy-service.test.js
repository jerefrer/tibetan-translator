/**
 * Copy Service Tests
 *
 * Tests plain-text formatting of definitions and clipboard writing.
 * The HTML-stripping path relies on happy-dom's document; the clipboard path
 * runs the web branch (window.__TAURI__ is undefined in the test setup).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  stripHtml,
  cleanDictionaryLabel,
  entryToText,
  entriesToText,
  writeToClipboard,
} from '../src/services/copy-service.js'

describe('Copy Service', () => {
  describe('stripHtml', () => {
    it('returns empty string for empty or nullish input', () => {
      expect(stripHtml('')).toBe('')
      expect(stripHtml(null)).toBe('')
      expect(stripHtml(undefined)).toBe('')
    })

    it('removes tags and keeps the text content', () => {
      expect(stripHtml('a <strong>bold</strong> word')).toBe('a bold word')
    })

    it('keeps link text but drops the markup', () => {
      expect(stripHtml('see <a href="http://x">this</a>')).toBe('see this')
    })

    it('decodes HTML entities', () => {
      expect(stripHtml('A &amp; B &lt;c&gt;')).toBe('A & B <c>')
    })

    it('trims surrounding whitespace', () => {
      expect(stripHtml('  <span>hi</span>  ')).toBe('hi')
    })
  })

  describe('cleanDictionaryLabel', () => {
    it('returns the full label for a known dictionary', () => {
      // TsepakRigdzin has label "Tsepak Rigdzin" and no shortLabel
      expect(cleanDictionaryLabel('TsepakRigdzin')).toBe('Tsepak Rigdzin')
    })

    it('falls back to the raw name for an unknown dictionary', () => {
      expect(cleanDictionaryLabel('NotARealDictionary')).toBe('NotARealDictionary')
    })

    it('never returns HTML', () => {
      expect(cleanDictionaryLabel('TsepakRigdzin')).not.toMatch(/</)
    })
  })

  describe('entryToText', () => {
    it('formats a single entry as "term (Dico) : definition"', () => {
      const entry = {
        term: 'བ་ཟློ་',
        dictionary: 'TsepakRigdzin',
        definition: 'a <em>clean</em> definition',
      }
      expect(entryToText(entry)).toBe('བ་ཟློ་ (Tsepak Rigdzin) : a clean definition')
    })
  })

  describe('entriesToText', () => {
    it('puts the term as a header then one block per entry', () => {
      const entries = [
        { dictionary: 'TsepakRigdzin', definition: 'first <b>def</b>' },
        { dictionary: 'NotARealDictionary', definition: 'second def' },
      ]
      expect(entriesToText('བ་ཟློ་', entries)).toBe(
        'བ་ཟློ་\n\n(Tsepak Rigdzin) : first def\n\n(NotARealDictionary) : second def'
      )
    })

    it('returns just the term when there are no entries', () => {
      expect(entriesToText('བ་ཟློ་', [])).toBe('བ་ཟློ་')
    })
  })

  describe('writeToClipboard (web path)', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        writable: true,
        configurable: true,
      })
    })

    it('writes the given text via navigator.clipboard', async () => {
      await writeToClipboard('hello')
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello')
    })

    it('propagates a clipboard failure', async () => {
      navigator.clipboard.writeText.mockRejectedValueOnce(new Error('denied'))
      await expect(writeToClipboard('x')).rejects.toThrow('denied')
    })
  })
})
