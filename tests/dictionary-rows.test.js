/**
 * The Dictionaries page's rows: the dictionaries on this device in the order
 * lookups use them, then those of packs not installed, each with what the
 * catalog knows about it; filtered, ranked and reordered by pure functions.
 */
import { describe, it, expect } from 'vitest';
import {
  buildCatalog,
  buildDictionaryRows,
  directionLabel,
  enabledRank,
  filterDictionaryRows,
  moveDictionary,
} from '../src/services/dictionary-catalog.js';

const PACKS = {
  core: { id: 'core', name: 'Core Dictionaries', included: true, dictionaries: ['Hopkins2015', 'RangjungYeshe'] },
  mono: { id: 'mono', name: 'Tibetan Monolingual', dictionaries: ['brda'] },
};

const DETAILS = {
  Hopkins2015: { label: 'Hopkins 2015', about: 'Tibetan-Sanskrit-English Dictionary|Jeffrey Hopkins', language: ['tib', '<->', 'en', '<->', 'skt'], keywords: ['comprehensive'] },
  RangjungYeshe: { label: 'Rangjung Yeshe', about: 'Rangjung Yeshe Dictionary|Erik Pema Kunsang', language: ['tib', '->', 'en'], keywords: ['Dharma terms'] },
  brda: { label: 'Brda dkrol gser gyi me long', about: 'Golden Mirror', language: ['tib'], keywords: ['archaic'] },
};

const STORED = [
  { id: 7, name: 'RangjungYeshe', enabled: true, position: 2 },
  { id: 3, name: 'Hopkins2015', enabled: true, position: 1 },
  { id: 12, name: 'Practice terms', enabled: false, position: 3, _sourcePackId: 'custom-1' },
];

const catalog = buildCatalog(DETAILS, PACKS);
const installed = (ids) => (packId) => ids.includes(packId);
const rowsFor = (stored = STORED, packs = ['core']) =>
  buildDictionaryRows({ stored, catalog, isPackInstalled: installed(packs) });
const keys = (rows) => rows.map((row) => row.key);

describe('directionLabel', () => {
  it('should name the languages and keep the direction of each pair', () => {
    expect(directionLabel(['tib', '->', 'en'])).toBe('Tibetan → English');
    expect(directionLabel(['tib', '<->', 'en', '<->', 'skt'])).toBe('Tibetan ↔ English ↔ Sanskrit');
  });

  it('should join languages given without a direction with a comma', () => {
    expect(directionLabel(['tib', '<->', 'skt', 'mn'])).toBe('Tibetan ↔ Sanskrit, Mongolian');
  });

  it('should name a monolingual dictionary by its one language, and nothing without languages', () => {
    expect(directionLabel(['tib'])).toBe('Tibetan');
    expect(directionLabel(undefined)).toBe('');
  });
});

describe('buildDictionaryRows', () => {
  it('should list the dictionaries on this device in their saved order, then the ones of packs not installed', () => {
    expect(keys(rowsFor())).toEqual(['Hopkins2015', 'RangjungYeshe', 'Practice terms', 'brda']);
  });

  it('should carry what the catalog knows about a dictionary', () => {
    const row = rowsFor()[1];
    expect(row).toMatchObject({
      storedId: 7,
      label: 'Rangjung Yeshe',
      summary: 'Rangjung Yeshe Dictionary',
      aboutLines: ['Rangjung Yeshe Dictionary', 'Erik Pema Kunsang'],
      direction: 'Tibetan → English',
      keywords: ['Dharma terms'],
      packId: 'core',
      packName: 'Core Dictionaries',
      installed: true,
      enabled: true,
      custom: false,
    });
  });

  it('should name a glossary of the user by its own name, as one of theirs', () => {
    expect(rowsFor()[2]).toMatchObject({ label: 'Practice terms', custom: true, installed: true, enabled: false, packId: 'custom-1' });
  });

  it('should mark a dictionary of a pack not installed as such, with no switch state', () => {
    expect(rowsFor()[3]).toMatchObject({ key: 'brda', installed: false, enabled: false, storedId: null, packName: 'Tibetan Monolingual' });
  });

  it('should not list a dictionary twice once its pack is installed', () => {
    const stored = [...STORED, { id: 20, name: 'brda', enabled: true, position: 4 }];
    expect(keys(rowsFor(stored, ['core', 'mono']))).toEqual(['Hopkins2015', 'RangjungYeshe', 'Practice terms', 'brda']);
  });
});

describe('filterDictionaryRows', () => {
  const rows = rowsFor();
  const filter = (filters) => keys(filterDictionaryRows(rows, filters));

  it('should keep every row without filters', () => {
    expect(filter({})).toEqual(['Hopkins2015', 'RangjungYeshe', 'Practice terms', 'brda']);
  });

  it('should keep the dictionaries switched on, or off, or not installed', () => {
    expect(filter({ status: 'on' })).toEqual(['Hopkins2015', 'RangjungYeshe']);
    expect(filter({ status: 'off' })).toEqual(['Practice terms']);
    expect(filter({ status: 'available' })).toEqual(['brda']);
  });

  it('should find words in the name, the description, the tags and the languages, without accents', () => {
    expect(filter({ query: 'kunsang' })).toEqual(['RangjungYeshe']);
    expect(filter({ query: 'sanskrit' })).toEqual(['Hopkins2015']);
    expect(filter({ query: 'ARCHAIC' })).toEqual(['brda']);
    expect(filter({ query: 'practice' })).toEqual(['Practice terms']);
  });

  it('should filter by the language a dictionary gives and by its purpose', () => {
    expect(filter({ language: 'tib-only' })).toEqual(['brda']);
    expect(filter({ language: 'skt' })).toEqual(['Hopkins2015']);
    expect(filter({ purpose: 'Dharma terms' })).toEqual(['RangjungYeshe']);
  });
});

describe('enabledRank', () => {
  it('should give the place of a dictionary among those switched on, or 0 when it is off', () => {
    const rows = rowsFor();
    expect(enabledRank(rows, 'RangjungYeshe')).toBe(2);
    expect(enabledRank(rows, 'Practice terms')).toBe(0);
  });
});

describe('moveDictionary', () => {
  it('should move a stored dictionary and number the positions again from 1', () => {
    const sorted = [...STORED].sort((a, b) => a.position - b.position);
    const moved = moveDictionary(sorted, 2, 0);
    expect(moved.map((entry) => [entry.name, entry.position])).toEqual([
      ['Practice terms', 1],
      ['Hopkins2015', 2],
      ['RangjungYeshe', 3],
    ]);
  });

  it('should leave the list as it is for a move outside it', () => {
    const sorted = [...STORED].sort((a, b) => a.position - b.position);
    expect(moveDictionary(sorted, 0, 5).map((entry) => entry.name)).toEqual(['Hopkins2015', 'RangjungYeshe', 'Practice terms']);
  });
});
