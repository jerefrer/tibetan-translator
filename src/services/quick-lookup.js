/**
 * Pure logic of the quick lookup window (GlobalLookupWindow.vue): what to do
 * with the clipboard, which entries to show and in which order, how to
 * highlight a full-text match. No Vue and no Tauri here, so it is testable on
 * its own.
 */
import { convertWylieInText, tibetanLookupKey } from '../utils';

export const TIBETAN_CHAR_RE = /[ༀ-࿿]/;

export function wylieToTibetan(text) {
  return convertWylieInText(text, {
    normalizeTrailingPunctuation: true,
    normalizeMultipleTshegs: true,
    preserveWhitespace: false,
  });
}

/** Sorted terms starting with `prefix`. */
export function termsStartingWith(allTerms, prefix) {
  if (!prefix || !allTerms) return [];
  return allTerms.filter((term) => term.indexOf(prefix) === 0).sort();
}

/**
 * Decides what the clipboard text (already repaired if it was in a legacy
 * font) is: Tibetan goes to Define as its lookup key; Wylie that converts to
 * the start of a known term goes to Define as Tibetan; anything else
 * (English, Sanskrit, a sentence) goes to Search as it is.
 *
 * Returns { mode, text, wylie } or null when there is nothing to look up.
 * `wylie` is the Wylie the text was converted from, when it was.
 */
export function classifyClipboardText(raw, allTerms) {
  const text = (raw || '').trim();
  if (!text) return null;

  if (TIBETAN_CHAR_RE.test(text)) {
    const key = tibetanLookupKey(text);
    return key ? { mode: 'define', text: key, wylie: '' } : null;
  }

  const converted = wylieToTibetan(text);
  if (
    converted &&
    TIBETAN_CHAR_RE.test(converted) &&
    (allTerms || []).some((term) => term.startsWith(converted))
  ) {
    return { mode: 'define', text: converted, wylie: text };
  }
  return { mode: 'search', text, wylie: '' };
}

/**
 * The entries of the dictionaries enabled in Settings, in the Settings order.
 * `dictionaries` is the stored list ({ id, position, enabled }). When it is
 * empty (nothing stored yet), every entry is kept, in the order it came.
 */
export function entriesForEnabledDictionaries(entries, dictionaries) {
  const list = entries || [];
  if (!dictionaries || !dictionaries.length) return [...list];
  const byId = {};
  for (const dictionary of dictionaries) byId[dictionary.id] = dictionary;
  return list
    .filter((entry) => byId[entry.dictionaryId] && byId[entry.dictionaryId].enabled !== false)
    .sort(
      (a, b) =>
        (byId[a.dictionaryId].position ?? Number.MAX_SAFE_INTEGER) -
        (byId[b.dictionaryId].position ?? Number.MAX_SAFE_INTEGER)
    );
}

/**
 * Full-text results: terms starting with the query first, then shorter
 * terms, then the dictionary's position. Mirrors the Search page's sort
 * without BM25, which pack_search_entries does not return.
 */
export function sortSearchEntries(entries, query) {
  const q = (query || '').toLowerCase();
  return [...(entries || [])].sort((a, b) => {
    const aStarts = a.term.toLowerCase().startsWith(q) ? 0 : 1;
    const bStarts = b.term.toLowerCase().startsWith(q) ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    if (a.term.length !== b.term.length) return a.term.length - b.term.length;
    return (a.dictionaryPosition || 999) - (b.dictionaryPosition || 999);
  });
}

export function escapeForRegExp(text) {
  return (
    text
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      // Treat ASCII apostrophe and curly right-single-quote as interchangeable
      // so "d'après" highlights "d'après" in the text and vice-versa.
      .replace(/['’]/g, "['’]")
  );
}

/** Wraps each match of `query` in <mark>, in text nodes only (never inside a tag). */
export function highlightInHtml(html, query) {
  const q = (query || '').trim();
  if (!q || !html) return html;
  const re = new RegExp(`(${escapeForRegExp(q)})`, 'gi');
  return html
    .split(/(<[^>]+>)/)
    .map((part) => (part.startsWith('<') && part.endsWith('>') ? part : part.replace(re, '<mark>$1</mark>')))
    .join('');
}

export function highlightInText(text, query) {
  const q = (query || '').trim();
  if (!q || !text) return text;
  return text.replace(new RegExp(`(${escapeForRegExp(q)})`, 'gi'), '<mark>$1</mark>');
}

/**
 * The next state when switching between Define and Search.
 * Tibetan flows freely between the two. Latin text in Search is not brought
 * back to Define: the clipboard reading already decided it was not Wylie for
 * a known term, and converting `kind` would give `ཀིནད་`. Define gets back the
 * last value it had in this session instead.
 */
export function switchMode({ mode, text, lastDefineText }, newMode) {
  if ((newMode !== 'define' && newMode !== 'search') || newMode === mode) {
    return { mode, text, lastDefineText };
  }
  if (newMode === 'define') {
    if (text && TIBETAN_CHAR_RE.test(text)) return { mode: newMode, text, lastDefineText: text };
    return { mode: newMode, text: lastDefineText || '', lastDefineText };
  }
  return { mode: newMode, text, lastDefineText: text };
}

/** "1 entry", "17 entries" */
export function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
