import { describe, it, expect } from 'vitest';
import {
  buildCatalog,
  filterCatalog,
  foldForSearch,
  getPackHighlights,
  getUninstalledPacks,
  matchedKeywords,
} from '../src/services/dictionary-catalog.js';
import { hasLatinDiacritics } from '../src/services/non-wylie-input.js';

const PACKS = {
  core: { id: 'core', name: 'Core Dictionaries', estimatedSize: '146 MB', dictionaries: ['Hopkins2015', 'Verbinator'] },
  mono: { id: 'mono', name: 'Tibetan Monolingual', estimatedSize: '65 MB', dictionaries: ['brda', 'Missing'] },
  skt: { id: 'skt', name: 'Sanskrit & Academic', estimatedSize: '26 MB', dictionaries: ['MVY', 'Padmakara'] },
};

const DETAILS = {
  Hopkins2015: { label: 'Hopkins 2015', about: 'Tibetan-Sanskrit-English Dictionary|Jeffrey Hopkins', language: ['tib', '<->', 'en'], keywords: ['comprehensive'] },
  Verbinator: { label: 'Verbinator Verb Dictionary', about: 'Tibetan Verb Dictionary', language: ['tib', '<->', 'en'], keywords: ['verbs', 'conjugation'] },
  brda: { label: 'Brda dkrol gser gyi me long', about: 'Golden Mirror for the Elucidation of Words|Beijing', language: ['tib'], keywords: ['archaic', 'rare words'] },
  MVY: { label: 'Mahāvyutpatti', about: 'Digital edition', language: ['tib', '<->', 'skt'], keywords: ['Mahāvyutpatti'] },
  Padmakara: { label: 'Padmakara Glossary', about: 'Multilingual glossary', language: ['tib', '<->', 'fr'], keywords: [] },
};

const installed = (ids) => (packId) => ids.includes(packId);
const catalog = buildCatalog(DETAILS, PACKS);
const idsOf = (entries) => entries.map((e) => e.id);

describe('buildCatalog', () => {
  it('should list dictionaries in pack order', () => {
    expect(idsOf(catalog)).toEqual(['Hopkins2015', 'Verbinator', 'brda', 'MVY', 'Padmakara']);
  });

  it('should skip dictionaries that have no details', () => {
    expect(idsOf(catalog)).not.toContain('Missing');
  });

  it('should drop direction markers from the languages', () => {
    expect(catalog[0].languages).toEqual(['tib', 'en']);
  });

  it('should use the first description line as the summary', () => {
    expect(catalog[2].summary).toBe('Golden Mirror for the Elucidation of Words');
  });
});

describe('filterCatalog', () => {
  it('should find a dictionary by a subject tag', () => {
    expect(idsOf(filterCatalog(catalog, { query: 'archaic' }))).toEqual(['brda']);
  });

  it('should find a dictionary by a word in its description', () => {
    expect(idsOf(filterCatalog(catalog, { query: 'golden mirror' }))).toEqual(['brda']);
  });

  it('should require every word of the query to match', () => {
    expect(filterCatalog(catalog, { query: 'verb archaic' })).toEqual([]);
  });

  it('should match across diacritics in both directions', () => {
    expect(idsOf(filterCatalog(catalog, { query: 'mahavyutpatti' }))).toEqual(['MVY']);
    expect(idsOf(filterCatalog(catalog, { query: 'Mahāvyutpatti' }))).toEqual(['MVY']);
  });

  it('should find a dictionary by its pack name', () => {
    expect(idsOf(filterCatalog(catalog, { query: 'monolingual' }))).toEqual(['brda']);
  });

  it('should keep only installed dictionaries when asked', () => {
    const result = filterCatalog(catalog, { status: 'installed' }, installed(['core']));
    expect(idsOf(result)).toEqual(['Hopkins2015', 'Verbinator']);
  });

  it('should keep only available dictionaries when asked', () => {
    const result = filterCatalog(catalog, { status: 'available' }, installed(['core']));
    expect(idsOf(result)).toEqual(['brda', 'MVY', 'Padmakara']);
  });

  it('should filter by a main language', () => {
    expect(idsOf(filterCatalog(catalog, { language: 'skt' }))).toEqual(['MVY']);
  });

  it('should find the dictionaries that are Tibetan only', () => {
    expect(idsOf(filterCatalog(catalog, { language: 'tib-only' }))).toEqual(['brda']);
  });

  it('should group languages without their own chip under other', () => {
    expect(idsOf(filterCatalog(catalog, { language: 'other' }))).toEqual(['Padmakara']);
  });

  it('should filter by pack', () => {
    expect(idsOf(filterCatalog(catalog, { packId: 'core' }))).toEqual(['Hopkins2015', 'Verbinator']);
  });

  it('should combine the query with the filters', () => {
    const result = filterCatalog(catalog, { query: 'glossary', status: 'available', language: 'other' }, installed(['core']));
    expect(idsOf(result)).toEqual(['Padmakara']);
  });

  it('should return everything when nothing is set', () => {
    expect(filterCatalog(catalog)).toHaveLength(5);
  });
});

describe('matchedKeywords', () => {
  it('should return only the tags the query matched', () => {
    expect(matchedKeywords(catalog[2], 'archaic')).toEqual(['archaic']);
  });

  it('should return nothing when the query matched elsewhere', () => {
    expect(matchedKeywords(catalog[2], 'golden')).toEqual([]);
  });
});

describe('getUninstalledPacks', () => {
  it('should list the packs that are not installed with their dictionary counts', () => {
    expect(getUninstalledPacks(PACKS, installed(['core']))).toEqual([
      { id: 'mono', name: 'Tibetan Monolingual', size: '65 MB', dictionaryCount: 2 },
      { id: 'skt', name: 'Sanskrit & Academic', size: '26 MB', dictionaryCount: 2 },
    ]);
  });

  it('should list nothing when every pack is installed', () => {
    expect(getUninstalledPacks(PACKS, () => true)).toEqual([]);
  });
});

describe('foldForSearch', () => {
  it('should lowercase and remove diacritics', () => {
    expect(foldForSearch('Mahāvyutpatti ṇ')).toBe('mahavyutpatti n');
  });
});

describe('hasLatinDiacritics', () => {
  it('should detect Sanskrit diacritics', () => {
    expect(hasLatinDiacritics('kāka')).toBe(true);
    expect(hasLatinDiacritics('kākiṇī')).toBe(true);
  });

  it('should leave plain Wylie alone', () => {
    expect(hasLatinDiacritics("sangs rgyas 'phrin las")).toBe(false);
  });

  it('should leave Tibetan script alone', () => {
    expect(hasLatinDiacritics('སངས་རྒྱས་')).toBe(false);
  });

  it('should treat empty input as having none', () => {
    expect(hasLatinDiacritics(undefined)).toBe(false);
  });
});

describe('getPackHighlights', () => {
  it('should return the labels of the highlighted dictionaries and the count of the rest', () => {
    const pack = { ...PACKS.core, highlights: ['Hopkins2015'] };
    expect(getPackHighlights(pack, DETAILS)).toEqual({
      labels: ['Hopkins 2015'],
      moreCount: 1,
    });
  });

  it('should skip a highlight that has no details', () => {
    const pack = { ...PACKS.mono, highlights: ['Missing', 'brda'] };
    expect(getPackHighlights(pack, DETAILS).labels).toEqual(['Brda dkrol gser gyi me long']);
  });

  it('should return nothing for a pack without highlights', () => {
    expect(getPackHighlights(PACKS.core, DETAILS)).toEqual({ labels: [], moreCount: 2 });
  });
});
