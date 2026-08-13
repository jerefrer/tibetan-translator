/**
 * Lexicon — editing custom dictionary packs from inside the app.
 *
 * Layering mirrors custom-pack-importer.js: this is the only module that knows
 * the Tauri lexicon commands exist. Components call it and never invoke directly.
 *
 * Two responsibilities live here rather than in Rust:
 *   - term normalization, because lookups are exact matches and
 *     GlobalLookupWindow.vue / SelectedTibetanEntriesPopup.vue query with
 *     tibetanLookupKey()
 *   - phonetics, because strictAndLoosePhoneticsFor() has no Rust equivalent
 *     and is the same function search and the build scripts use
 */

import { invoke } from '@tauri-apps/api/core';
import { tibetanLookupKey, strictAndLoosePhoneticsFor } from '../utils';
import PackManager from './pack-manager';

const CUSTOM_PREFIX = 'custom-';

/** Derive a valid, unused pack id from a human name. Never shown to the user. */
export function slugForName(name, existingIds = []) {
  const base = String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining accents left by NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  // The pack id regex is ^[a-z0-9][a-z0-9-]*[a-z0-9]$ — at least two characters.
  let root = base || 'lexicon';
  if (root.length < 2) root = `${root}-lexicon`;

  const taken = new Set(
    existingIds.map((id) => String(id).replace(new RegExp(`^${CUSTOM_PREFIX}`), ''))
  );
  if (!taken.has(root)) return root;

  let suffix = 2;
  while (taken.has(`${root}-${suffix}`)) suffix += 1;
  return `${root}-${suffix}`;
}

/**
 * Normalize a term for storage. Returns '' when nothing usable remains.
 *
 * Delegates to tibetanLookupKey() — the same derivation GlobalLookupWindow.vue
 * and SelectedTibetanEntriesPopup.vue use to build their query key — so a
 * stored term is never invisible to the global hotkey or the selection popup.
 * cleanTerm() is NOT used here: it's built for pre-conversion Wylie (where a
 * hyphen is a syllable separator that legitimately becomes a space), not
 * post-conversion Tibetan Unicode, where the lookup path deletes such
 * characters rather than substituting them.
 */
export function normalizeTerm(raw) {
  const key = tibetanLookupKey(String(raw ?? ''));
  return key === '་' ? '' : key;
}

/** Build a write-ready entry, or null when term or definition is unusable. */
export function prepareEntry(rawTerm, rawDefinition) {
  const term = normalizeTerm(rawTerm);
  const definition = String(rawDefinition ?? '').trim();
  if (!term || !definition) return null;

  const [termPhoneticsStrict, termPhoneticsLoose] = strictAndLoosePhoneticsFor(term);
  const [definitionPhoneticsWordsStrict, definitionPhoneticsWordsLoose] =
    strictAndLoosePhoneticsFor(definition);

  return {
    term,
    definition,
    termPhoneticsStrict,
    termPhoneticsLoose,
    definitionPhoneticsWordsStrict,
    definitionPhoneticsWordsLoose,
  };
}

/**
 * Turn confirmed diff rows into the payload lexicon_apply_import expects.
 *
 * Phonetics are computed here because JS owns them — Rust never derives them.
 * The filter is a backstop: diffRows() already drops the rows prepareEntry
 * would reject, so anything falling out here means the two disagree.
 */
export function entriesForImport(rows) {
  return rows.map((row) => prepareEntry(row.term, row.definition)).filter(Boolean);
}

/**
 * Turn a LexiconError from Rust into something worth reading.
 *
 * src-tauri/src/lexicon.rs tags every failure with a `code`; without this the
 * UI collapses all of them into one generic sentence and the user is left
 * guessing — most painfully for `conflict`, where the fix (pick another name)
 * is obvious once stated and invisible otherwise.
 *
 * `fallback` covers the codes that carry no advice for the user, plus anything
 * that isn't a LexiconError at all.
 */
export function messageForError(error, fallback) {
  switch (error?.code) {
    case 'conflict':
      return 'A dictionary with that name already exists. Try another name.';
    case 'notFound':
      return 'That no longer exists — it may have been removed already.';
    case 'notCustom':
      return 'Only your own dictionaries can be edited.';
    case 'corrupt':
      return "This dictionary's file could not be read. It may be damaged.";
    case 'path':
      return 'Could not write to disk. Check that there is space available.';
    default:
      return fallback;
  }
}

export const Lexicon = {
  /** Every dictionary the user is allowed to write to, flattened across packs. */
  editableDictionaries() {
    return PackManager.customPacks.flatMap((pack) =>
      (pack.manifest.dictionaries || []).map((dictionary, index) => ({
        packId: pack.id,
        dictionaryId: index + 1,
        packName: pack.manifest.name,
        name: dictionary.name,
        entriesCount: dictionary.entriesCount ?? 0,
      }))
    );
  },

  async create(name, description = '') {
    const existingIds = PackManager.customPacks.map((pack) => pack.id);
    const id = slugForName(name, existingIds);
    const pack = await invoke('create_lexicon', { id, name: String(name).trim(), description });
    await PackManager.refreshAfterLexiconChange();
    return pack;
  },

  async rename(packId, name, description = '') {
    const manifest = await invoke('rename_lexicon', { packId, name, description });
    await PackManager.refreshAfterLexiconChange();
    return manifest;
  },

  entries(packId, dictionaryId, { search = '', limit = 50, offset = 0 } = {}) {
    return invoke('lexicon_entries', { packId, dictionaryId, search, limit, offset });
  },

  /**
   * Exact-match lookup: null when the term isn't present. Always finds an
   * existing entry regardless of dictionary size, unlike entries()'s
   * paginated substring search — callers deciding "does this term already
   * exist" (e.g. QuickAddDialog, before an upsert) must use this, not
   * entries(), or a match sorted past the page limit reads as absent.
   */
  async findEntry(packId, dictionaryId, rawTerm) {
    const term = normalizeTerm(rawTerm);
    if (!term) return null;
    return invoke('lexicon_find_entry', { packId, dictionaryId, term });
  },

  /** Returns { id, created } or null when the input was unusable. */
  async saveEntry(packId, dictionaryId, rawTerm, rawDefinition) {
    const entry = prepareEntry(rawTerm, rawDefinition);
    if (!entry) return null;
    const outcome = await invoke('lexicon_upsert_entry', { packId, dictionaryId, entry });
    await PackManager.refreshAfterLexiconChange();
    return outcome;
  },

  async deleteEntry(packId, entryId) {
    await invoke('lexicon_delete_entry', { packId, entryId });
    await PackManager.refreshAfterLexiconChange();
  },

  export(packId, destPath) {
    return invoke('lexicon_export', { packId, destPath });
  },

  /** The dictionary as xlsx bytes, ready to be written wherever the user asked.
   *
   * Rust builds the workbook in memory rather than saving it: the save dialog
   * returns a URI on mobile that std::fs cannot create, so the write goes
   * through plugin-fs on the JS side — the mirror of readSpreadsheet(). */
  exportXlsx(packId, dictionaryId) {
    return invoke('lexicon_export_xlsx', { packId, dictionaryId });
  },

  /** Read a spreadsheet into a plain grid.
   *
   * Takes bytes rather than a path because the dialog plugin hands back a
   * content:// URI on Android and a file:// URI on iOS; plugin-fs reads all
   * three platforms' formats, and Rust only ever sees the bytes. */
  readSpreadsheet(data, fileName) {
    return invoke('read_spreadsheet', { data, fileName });
  },

  async applyImport(packId, dictionaryId, rows) {
    const outcome = await invoke('lexicon_apply_import', {
      packId,
      dictionaryId,
      entries: entriesForImport(rows),
    });
    await PackManager.refreshAfterLexiconChange();
    return outcome;
  },
};

export default Lexicon;
