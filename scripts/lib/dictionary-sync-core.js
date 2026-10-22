/**
 * Pure helpers for syncing dictionaries from christiansteinert/tibetan-dictionary:
 * name matching, parsing the upstream TypeScript config, and diffing.
 *
 * Everything here is free of I/O so it can be tested directly. The git, fs and
 * logging live in ../sync-dictionaries.mjs.
 */

// Upstream spellings that changed in ways punctuation-stripping cannot catch.
// Maps the upstream canonical name to the canonical name we have locally.
const NAME_ALIASES = {
  yogacharabhumiglossary: 'yoghacharabhumiglossary',
};

const NUMERIC_PREFIX = /^\d+-/;

/**
 * Reduce a dictionary filename to what identifies it: no numeric prefix, no
 * case, no punctuation. Upstream dropped commas and apostrophes from its
 * filenames, which would otherwise make every such dictionary look brand new.
 */
const canonicalName = (name) =>
  name
    .replace(NUMERIC_PREFIX, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/**
 * Find the local dictionary an upstream name corresponds to, so a rename
 * upstream keeps our stable local name (pack definitions, stored settings and
 * dictionary ids all depend on it). Accepts filenames or bare dictlist keys.
 */
const matchLocalName = (upstreamName, localNames) => {
  if (localNames.includes(upstreamName)) return upstreamName;
  const wanted = canonicalName(upstreamName);
  const target = NAME_ALIASES[wanted] || wanted;
  return localNames.find((local) => canonicalName(local) === target) || null;
};

/**
 * Return the source text of the object literal assigned after `marker`
 * (e.g. /export const FOO[^=]*=/), found by balancing braces. Skips strings
 * and comments, so braces inside either don't end the literal early.
 */
const extractObjectLiteral = (source, marker) => {
  const match = marker.exec(source);
  if (!match) return null;
  const start = source.indexOf('{', match.index + match[0].length);
  if (start === -1) return null;

  let depth = 0;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '"' || ch === "'" || ch === '`') {
      i++;
      while (i < source.length && source[i] !== ch) {
        if (source[i] === '\\') i++;
        i++;
      }
    } else if (ch === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i++;
    } else if (ch === '/' && next === '*') {
      i = source.indexOf('*/', i + 2);
      if (i === -1) return null;
      i++;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}' && --depth === 0) {
      return source.slice(start, i + 1);
    }
  }
  return null;
};

// The upstream literals are plain JavaScript once the type annotations around
// them are cut away, so evaluating them is enough to read them.
const evaluateLiteral = (literal) => new Function(`return ${literal}`)();

const cleanLabel = (entry) =>
  entry.label ? { ...entry, label: entry.label.replace(/&shy;/g, '') } : entry;

/** Parse GROUPED_DICTLIST from dictlist.ts into a flat { name: details } map. */
const parseDictlist = (source) => {
  const literal = extractObjectLiteral(
    source,
    /GROUPED_DICTLIST\s*(?::[^=]+)?=/
  );
  if (!literal) throw new Error('Could not find GROUPED_DICTLIST');

  const flat = {};
  for (const [key, value] of Object.entries(evaluateLiteral(literal))) {
    if (value.type === 'group' && value.items) {
      for (const [itemKey, item] of Object.entries(value.items)) {
        flat[itemKey] = cleanLabel({ ...item });
      }
    } else if (!key.startsWith('_')) {
      flat[key] = cleanLabel({ ...value });
    }
  }
  return flat;
};

/** Parse the ABBREVIATIONS constant from abbreviations.ts. */
const parseAbbreviations = (source) => {
  const literal = extractObjectLiteral(source, /ABBREVIATIONS\s*(?::[^=]+)?=/);
  if (!literal) throw new Error('Could not find ABBREVIATIONS');
  return evaluateLiteral(literal);
};

/** Rename upstream keys to our local dictionary names where one matches. */
const remapKeys = (details, localNames) => {
  const out = {};
  for (const [key, value] of Object.entries(details)) {
    const local = matchLocalName(key, localNames);
    out[local ? local.replace(NUMERIC_PREFIX, '') : key] = value;
  }
  return out;
};

/**
 * Re-apply our deliberate departures from upstream's metadata. A value
 * overrides the field; `undefined` removes it. Entries not present are skipped.
 */
const applyOverrides = (details, overrides) => {
  const out = { ...details };
  for (const [name, fields] of Object.entries(overrides)) {
    if (!out[name]) continue;
    out[name] = { ...out[name] };
    for (const [field, value] of Object.entries(fields)) {
      if (value === undefined) delete out[name][field];
      else out[name][field] = value;
    }
  }
  return out;
};

/** Combine override tables field by field, so one dictionary can appear in several. */
const mergeOverrides = (...tables) => {
  const merged = {};
  for (const table of tables) {
    for (const [name, fields] of Object.entries(table)) {
      merged[name] = { ...merged[name], ...fields };
    }
  }
  return merged;
};

/** Whether a dictionary is one we have chosen not to take from upstream. */
const isIgnored = (name, ignored) =>
  ignored.some((entry) => canonicalName(entry) === canonicalName(name));

/** Which keys were added, removed or changed between two details maps. */
const diffDetails = (before, after) => ({
  added: Object.keys(after).filter((key) => !(key in before)),
  removed: Object.keys(before).filter((key) => !(key in after)),
  changed: Object.keys(after).filter(
    (key) =>
      key in before && JSON.stringify(before[key]) !== JSON.stringify(after[key])
  ),
});

export {
  canonicalName,
  matchLocalName,
  extractObjectLiteral,
  parseDictlist,
  parseAbbreviations,
  remapKeys,
  diffDetails,
  applyOverrides,
  isIgnored,
  mergeOverrides,
};
