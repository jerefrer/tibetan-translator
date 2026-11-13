/**
 * Dictionary catalog: a searchable, filterable view of every dictionary the app
 * ships, whether or not its pack is installed, and the Dictionaries page's
 * rows built from it. Pure functions only, so the page and the "not searched"
 * notice share one source of truth.
 */

export const LANGUAGE_LABELS = {
  tib: 'Tibetan',
  en: 'English',
  skt: 'Sanskrit',
  zh: 'Chinese',
  mn: 'Mongolian',
  fr: 'French',
  pt: 'Portuguese',
  es: 'Spanish',
  it: 'Italian',
  de: 'German',
  pl: 'Polish',
};

// Languages the catalog knows by name. A dictionary with any other language
// falls under "Other". Tibetan is in every dictionary, so it is not a filter of
// its own; "tib-only" separates the monolingual ones instead.
export const MAIN_LANGUAGE_CODES = ['tib', 'en', 'skt', 'zh'];

const DIRECTION_MARKERS = ['<->', '->', '<-'];
const DIRECTION_ARROWS = { '<->': ' ↔ ', '->': ' → ', '<-': ' ← ' };

/**
 * "Tibetan → English" from a details entry's language, e.g. ["tib", "->",
 * "en"]: each pair keeps its arrow, languages listed without one are joined
 * with a comma.
 */
export function directionLabel(language) {
  if (!Array.isArray(language)) return '';
  let label = '';
  let joiner = '';
  for (const part of language) {
    if (DIRECTION_MARKERS.includes(part)) {
      joiner = DIRECTION_ARROWS[part];
      continue;
    }
    label += (label ? joiner || ', ' : '') + (LANGUAGE_LABELS[part] || part);
    joiner = '';
  }
  return label;
}

/** Lowercase and drop diacritics, so "mahavyutpatti" finds "Mahāvyutpatti". */
export function foldForSearch(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

const tokensOf = (query) => foldForSearch(query).split(/\s+/).filter(Boolean);

// Whether every search word appears in the name, description, subject tags,
// pack or languages of a catalog entry or a page row
const matchesTokens = (entry, tokens) => {
  if (!tokens.length) return true;
  const haystack = foldForSearch(
    [
      entry.label,
      entry.id ?? entry.key,
      entry.about,
      entry.keywords.join(' '),
      entry.packName,
      entry.languageNames.join(' '),
    ].join(' ')
  );
  return tokens.every((token) => haystack.includes(token));
};

/**
 * One entry per dictionary, in pack order and then the order each pack lists.
 * Dictionaries without details are skipped rather than shown half-empty.
 */
export function buildCatalog(details, packDefinitions) {
  const entries = [];
  for (const pack of Object.values(packDefinitions)) {
    for (const id of pack.dictionaries) {
      const detail = details[id];
      if (!detail) continue;

      const languages = [
        ...new Set(
          (detail.language || []).filter((code) => !DIRECTION_MARKERS.includes(code))
        ),
      ];
      const aboutLines = (detail.about || '')
        .split('|')
        .map((line) => line.trim())
        .filter(Boolean);

      entries.push({
        id,
        label: (detail.label || id).trim(),
        summary: aboutLines[0] || '',
        about: aboutLines.join(' '),
        aboutLines,
        language: detail.language || [],
        languages,
        languageNames: languages.map((code) => LANGUAGE_LABELS[code] || code),
        keywords: detail.keywords || [],
        packId: pack.id,
        packName: pack.name,
      });
    }
  }
  return entries;
}

const matchesLanguage = (entry, language) => {
  if (language === 'all') return true;
  if (language === 'tib-only') {
    return entry.languages.length === 1 && entry.languages[0] === 'tib';
  }
  if (language === 'other') {
    return entry.languages.some((code) => !MAIN_LANGUAGE_CODES.includes(code));
  }
  return entry.languages.includes(language);
};

const matchesStatus = (installed, status) =>
  status === 'all' ||
  (status === 'installed' && installed) ||
  (status === 'available' && !installed);

/**
 * Entries matching every search word and every active filter.
 * A search word may appear in the name, description, subject tags, pack or
 * language of a dictionary.
 */
export function filterCatalog(
  entries,
  { query = '', status = 'all', language = 'all', packId = 'all' } = {},
  isPackInstalled = () => true
) {
  const tokens = tokensOf(query);
  return entries.filter((entry) => {
    if (packId !== 'all' && entry.packId !== packId) return false;
    if (!matchesStatus(isPackInstalled(entry.packId), status)) return false;
    if (!matchesLanguage(entry, language)) return false;
    return matchesTokens(entry, tokens);
  });
}

/**
 * The Dictionaries page's rows: the dictionaries on this device (`stored`,
 * Storage's `dictionaries`) in the order lookups use them, then the catalog's
 * dictionaries whose pack is not installed. A stored dictionary the catalog
 * does not know is one of the user's own (a glossary).
 */
export function buildDictionaryRows({ stored = [], catalog = [], isPackInstalled = () => true }) {
  const byId = new Map(catalog.map((entry) => [entry.id, entry]));
  const sorted = [...stored].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const storedNames = new Set(sorted.map((dictionary) => dictionary.name));

  const rowOf = (entry, dictionary) => {
    const aboutLines = entry ? splitAbout(entry) : [];
    return {
      key: entry?.id ?? dictionary.name,
      storedId: dictionary?.id ?? null,
      label: entry?.label ?? dictionary.name,
      summary: aboutLines[0] || '',
      aboutLines,
      about: entry?.about ?? '',
      languages: entry?.languages ?? [],
      languageNames: entry?.languageNames ?? [],
      direction: entry ? directionLabel(entry.language) : '',
      keywords: entry?.keywords ?? [],
      packId: entry?.packId ?? dictionary?._sourcePackId ?? null,
      packName: entry?.packName ?? 'My glossary',
      installed: !!dictionary,
      enabled: !!dictionary && dictionary.enabled !== false,
      custom: !entry,
    };
  };

  return [
    ...sorted.map((dictionary) => rowOf(byId.get(dictionary.name), dictionary)),
    ...catalog
      .filter((entry) => !storedNames.has(entry.id) && !isPackInstalled(entry.packId))
      .map((entry) => rowOf(entry, null)),
  ];
}

const splitAbout = (entry) => entry.aboutLines || [];

const matchesRowStatus = (row, status) =>
  status === 'all' ||
  (status === 'on' && row.enabled) ||
  (status === 'off' && row.installed && !row.enabled) ||
  (status === 'available' && !row.installed);

/** The rows matching the search words, the status, the language and the purpose. */
export function filterDictionaryRows(rows, { query = '', status = 'all', language = 'all', purpose = '' } = {}) {
  const tokens = tokensOf(query);
  const wanted = foldForSearch(purpose);
  return rows.filter(
    (row) =>
      matchesRowStatus(row, status) &&
      (language === 'all' || matchesLanguage(row, language)) &&
      (!wanted || row.keywords.some((keyword) => foldForSearch(keyword) === wanted)) &&
      matchesTokens(row, tokens)
  );
}

/** The place of a dictionary among those switched on (1 for the first), 0 when it is off. */
export function enabledRank(rows, key) {
  const enabled = rows.filter((row) => row.enabled);
  return enabled.findIndex((row) => row.key === key) + 1;
}

/**
 * `sorted` (stored dictionaries in their order) with the one at `from` moved
 * to `to`, positions numbered again from 1. A move outside the list changes
 * nothing.
 */
export function moveDictionary(sorted, from, to) {
  if (from < 0 || from >= sorted.length || to < 0 || to >= sorted.length) return sorted;
  const moved = [...sorted];
  const [dictionary] = moved.splice(from, 1);
  moved.splice(to, 0, dictionary);
  return moved.map((entry, index) => ({ ...entry, position: index + 1 }));
}

/** The subject tags of an entry that the query matched, to highlight them. */
export function matchedKeywords(entry, query) {
  const tokens = tokensOf(query);
  return entry.keywords.filter((keyword) =>
    tokens.some((token) => foldForSearch(keyword).includes(token))
  );
}

/** Packs the user has not installed, with what a lookup is therefore missing. */
export function getUninstalledPacks(packDefinitions, isPackInstalled) {
  return Object.values(packDefinitions)
    .filter((pack) => !isPackInstalled(pack.id))
    .map((pack) => ({
      id: pack.id,
      name: pack.name,
      size: pack.estimatedSize,
      dictionaryCount: pack.dictionaries.length,
    }));
}

/**
 * The notable dictionaries of a pack, as labels, plus how many others it holds.
 * Highlights that have no details are skipped.
 */
export function getPackHighlights(pack, details) {
  const labels = (pack.highlights || [])
    .filter((id) => details[id])
    .map((id) => (details[id].label || id).trim());
  return { labels, moreCount: Math.max(pack.dictionaries.length - labels.length, 0) };
}
