/**
 * Dictionary catalog: a searchable, filterable view of every dictionary the app
 * ships, whether or not its pack is installed. Pure functions only, so the
 * Settings catalog and the "not searched" notice share one source of truth.
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

/** Lowercase and drop diacritics, so "mahavyutpatti" finds "Mahāvyutpatti". */
export function foldForSearch(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

const tokensOf = (query) => foldForSearch(query).split(/\s+/).filter(Boolean);

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
    if (!tokens.length) return true;

    const haystack = foldForSearch(
      [
        entry.label,
        entry.id,
        entry.about,
        entry.keywords.join(' '),
        entry.packName,
        entry.languageNames.join(' '),
      ].join(' ')
    );
    return tokens.every((token) => haystack.includes(token));
  });
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
