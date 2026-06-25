/**
 * Copy Service
 *
 * Formats dictionary definitions as plain text and writes them to the system
 * clipboard. Platform-agnostic: uses the Tauri clipboard plugin on Tauri,
 * `navigator.clipboard` on the web. No Vue dependency — testable in isolation.
 */

import DICTIONARIES_DETAILS from './dictionaries-details'
import { isTauri } from '../config/platform'

/**
 * Strip HTML tags from a (possibly decorated) definition and return clean text.
 * Uses a temporary DOM element so links, tags and HTML entities are handled
 * correctly.
 *
 * @param {string} html
 * @returns {string}
 */
export function stripHtml(html) {
  if (!html) return ''
  const el = document.createElement('div')
  el.innerHTML = html
  return (el.textContent || '').trim()
}

/**
 * Resolve a clean, plain-text label for a dictionary. Prefers the short label,
 * falls back to the full label, then to the raw dictionary name. Never returns
 * HTML (unlike DictionariesDetailsMixin.dictionaryLabelFor).
 *
 * @param {string} dictionaryName
 * @returns {string}
 */
export function cleanDictionaryLabel(dictionaryName) {
  const details = DICTIONARIES_DETAILS[dictionaryName]
  return details?.shortLabel || details?.label || dictionaryName
}

/**
 * Format a single entry as self-contained plain text: `term (Dico) : definition`.
 *
 * @param {{ term: string, dictionary: string, definition: string }} entry
 * @returns {string}
 */
export function entryToText(entry) {
  const label = cleanDictionaryLabel(entry.dictionary)
  return `${entry.term} (${label}) : ${stripHtml(entry.definition)}`
}

/**
 * Format every definition of a term as a single block: the term on a header
 * line, then one `(Dico) : definition` block per entry, separated by blank
 * lines. The term is not repeated on each block since it heads the output.
 *
 * Scanned-dictionary entries are expected to be filtered out by the caller.
 *
 * @param {string} term
 * @param {Array<{ dictionary: string, definition: string }>} entries
 * @returns {string}
 */
export function entriesToText(term, entries) {
  const blocks = entries.map(
    (entry) => `(${cleanDictionaryLabel(entry.dictionary)}) : ${stripHtml(entry.definition)}`
  )
  return [term, ...blocks].join('\n\n')
}

/**
 * Write text to the system clipboard, choosing the right mechanism for the
 * current platform. Rejects on failure so callers can surface an error.
 *
 * @param {string} text
 * @returns {Promise<void>}
 */
export async function writeToClipboard(text) {
  if (isTauri()) {
    const { writeText } = await import('@tauri-apps/plugin-clipboard-manager')
    await writeText(text)
  } else {
    await navigator.clipboard.writeText(text)
  }
}

export default {
  stripHtml,
  cleanDictionaryLabel,
  entryToText,
  entriesToText,
  writeToClipboard,
}
