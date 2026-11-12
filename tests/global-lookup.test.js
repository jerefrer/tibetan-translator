/**
 * The hotkey service (src/services/global-lookup.js): the quick lookup
 * window's size on a given screen, and the text selected in the main window
 * that the hotkey looks up instead of the clipboard.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { appSelectionText, defaultPopupSize } from '../src/services/global-lookup'

describe('defaultPopupSize', () => {
  it('should open wider than the minimum on a large screen, up to 820 × 600', () => {
    expect(defaultPopupSize(1728, 1117)).toEqual({ width: 820, height: 600 })
  })

  it('should keep to 60% of the width and 70% of the height of a smaller screen', () => {
    expect(defaultPopupSize(1280, 800)).toEqual({ width: 768, height: 560 })
  })

  it('should never go below the old 650 × 500 when the screen is tiny', () => {
    expect(defaultPopupSize(800, 600)).toEqual({ width: 650, height: 500 })
  })
})

describe('appSelectionText', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  function select(text) {
    document.body.innerHTML = `<p>${text}</p>`
    const range = document.createRange()
    range.selectNodeContents(document.body.firstChild)
    const selection = document.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
  }

  it('should give the selected text when the main window has the focus', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    select(' ཡེ་ཤེས་ ')
    expect(appSelectionText()).toBe('ཡེ་ཤེས་')
  })

  it('should give nothing when another app has the focus, so the clipboard is used', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(false)
    select('ཡེ་ཤེས་')
    expect(appSelectionText()).toBe('')
  })

  it('should give nothing when nothing is selected', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    document.getSelection().removeAllRanges()
    expect(appSelectionText()).toBe('')
  })
})
