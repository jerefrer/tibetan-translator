import _ from 'underscore'
import TibetanRegExps from 'tibetan-regexps'
import TibetanNormalizer from 'tibetan-normalizer'
import { TibetanToPhonetics, Settings } from 'tibetan-to-phonetics'

import { Tokenizer } from './services/tokenizer'
import WylieToUnicode from './services/wylie-to-unicode'

const wylieToUnicode = new WylieToUnicode();

export const phoneticsForGroups = function (setting, groups) {
  return groups.map((group) => {
    return (
      setting == 'strict'
      ? phoneticsStrictFor(group)
      : phoneticsLooseFor(group)
    )
  }).join(' === ')
}

export const strictAndLoosePhoneticsFor = function (text) {
  var tibetanGroups = text.match(TibetanRegExps.tibetanGroups) || [];
  return [
    phoneticsForGroups('strict', tibetanGroups),
    phoneticsForGroups('loose', tibetanGroups)
  ];
}

// The strict setting never changes, so build it once instead of re-extending
// the shared rules object on every call.
const strictSetting = Settings.find('english-semi-strict');
_.extend(strictSetting.rules, {
  drengbu: 'e',
  aKikuI: 'e',
  baAsWa: 'p'
})

// Both functions are pure (hardcoded settings), and highlighting calls them
// with the same few syllable groups over and over. The cap exists because the
// DB build pipeline runs them over millions of entries: unbounded, the Maps
// would exhaust memory during `pnpm build:packs`.
const PHONETICS_CACHE_LIMIT = 20000;
const strictCache = new Map();
const looseCache = new Map();

const memoized = function (cache, compute, text) {
  if (cache.has(text)) return cache.get(text);
  var result = compute(text);
  if (cache.size >= PHONETICS_CACHE_LIMIT) cache.clear();
  cache.set(text, result);
  return result;
}

export const phoneticsStrictFor = function(text) {
  return memoized(strictCache, (t) => phoneticsFor(strictSetting, t), text);
}
export const phoneticsLooseFor = function(text) {
  return memoized(looseCache, (t) => phoneticsFor('english-super-loose', t), text);
}

// Constructing a converter is expensive (2.6x slower than reusing one), so
// reuse it while the setting stays the same. Only the LAST one built may be
// reused: tibetan-to-phonetics keeps its rules lookup in module-level state
// that every `new TibetanToPhonetics` overwrites, so an older converter would
// silently convert with the newest converter's setting.
var lastSetting = null;
var lastConverter = null;

export const phoneticsFor = function(setting, text) {
  if (!lastConverter || lastSetting !== setting) {
    lastConverter = new TibetanToPhonetics({ setting: setting });
    lastSetting = setting;
  }
  var phonetics = lastConverter;
  return syllablesFor(text).map(
    (syllable) => phonetics.convert(syllable)
  ).join(' ')
}

export const convertWylieButKeepNonTibetanParts = function (text, wylieToUnicode) {
  var result = '';
  var tokenizer = new Tokenizer(
    [
      /{[^}]*}/,        // Everything between {} (rules are reversed in tibetan only dictionaries)
      /\([A-Z:,\d]+\)/, // Things like (1234) or (WP:1,194)
    ],
    (chunk, isSeparator) => {
      if (isSeparator)
        result += chunk;
      else
        result += wylieToUnicode.convert(chunk);
    }
  );
  tokenizer.parse(text);
  return result;
}

export const tibetanWithPunctuationAsTsheks = function (tibetan) {
  return tibetan.replace(TibetanRegExps.punctuation, '་').replace(/་+/g, '་');
}

export const replaceTibetanGroups = function (text, handler) {
  return text.replace(TibetanRegExps.tibetanGroups, handler);
}

export const syllablesFor = function (tibetan) {
  return _.compact(tibetanWithPunctuationAsTsheks(tibetan).split('་'));
}

export const cleanTerm = function (text) {
  return text
    .replace(/\"/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/­/g, '')     // Deletes zero-width non-joiner
    .replace(/\s+/g, ' ') // Removes consecutive spaces
    .trim();
}

export const withTrailingTshek = function (tibetan) {
  return tibetan.replace(TibetanRegExps.endPunctuation, '') + '་';
}

/**
 * Strip everything that isn't Tibetan script, then drop any punctuation left
 * exposed at the start (e.g. a leading tsheg once neighboring text is gone).
 *
 * This is the "cleaned but not yet tsheg-terminated" text GlobalLookupWindow
 * and SelectedTibetanEntriesPopup keep around for display before querying.
 */
export const strippedTibetanText = function (text) {
  return text
    .replace(TibetanRegExps.anythingNonTibetan, '')
    .replace(TibetanRegExps.beginningPunctuation, '');
}

/**
 * The canonical lookup key for a Tibetan term: strip everything non-Tibetan,
 * drop leading punctuation, and end with exactly one tsheg.
 *
 * Entry lookups are exact string matches, so anything that STORES a term and
 * anything that SEARCHES for one must derive it identically. Keep this the
 * only place that rule is expressed for any new call site.
 *
 * It is not, as of this writing, the only place it's ALREADY expressed —
 * two known, tracked divergences predate this function and are out of scope
 * for the lexicon work to touch:
 *   - SegmentPage.vue independently re-implements a narrower version of it
 *     four times (`replace(/[་།]+$/, "") + "་"` — a 2-character class,
 *     where endPunctuation here covers 8).
 *   - decorator.js's wrapAllTibetanWithSpansAndAddTshekIfMissing holds a
 *     fifth, partial copy that only appends a tsheg when no ending
 *     punctuation is present at all, rather than replacing whatever is
 *     there.
 * Neither is a call site to keep in sync with this function — they're
 * pre-existing, separate implementations this comment can't truthfully
 * claim don't exist.
 */
export const tibetanLookupKey = function (text) {
  return withTrailingTshek(strippedTibetanText(text));
}

export const arrayPositionInArray = function (termArray, array) {
  var firstElement = termArray[0];
  var indexesForFirstElement = array.reduce((indexes, value, index) => {
    if (value == firstElement)
      indexes.push(index);
    return indexes;
  }, []);
  var position = indexesForFirstElement.find((index) => {
    return _.isEqual(
      termArray,
      array.slice(index).slice(0, termArray.length)
    );
  });
  if (position >= 0)
    return position;
  else
    return -1;
}

export const substituteLinksWithATags = function(text) {
  return text.replace(
    /((?:https?:\/\/)|(?:www\.))+([-0-9a-zA-Z\/\.\?=&#%_]+)/g,
    (wholeMatch, httpAndWWW, domain) => {
      if (!httpAndWWW.match(/https?:\/\//))
        httpAndWWW = 'http://' + httpAndWWW;
      return `<a target="_blank" href="${httpAndWWW}${domain}">${domain}</a>`;
    }
  )
}

/**
 * Convert Wylie romanization to Tibetan Unicode within text.
 * Converts Latin alphabet sequences (Wylie) embedded in text.
 *
 * @param {string} text - Input text possibly containing Wylie
 * @param {Object} options - Conversion options
 * @param {boolean} options.normalizeTrailingPunctuation - Replace trailing punctuation with single tsheg (default: true)
 * @param {boolean} options.normalizeMultipleTshegs - Replace consecutive tshegs with single tsheg (default: true)
 * @param {boolean} options.preserveWhitespace - Preserve whitespace characters in multiline text (default: false)
 * @returns {string} Text with Wylie converted to Tibetan Unicode
 */
export const convertWylieInText = function(text, options = {}) {
  const {
    normalizeTrailingPunctuation = true,
    normalizeMultipleTshegs = true,
    preserveWhitespace = false
  } = options;

  // Build regex: match non-Tibetan characters (excluding newlines, optionally whitespace)
  const regexPattern = preserveWhitespace
    ? `[^${TibetanRegExps.expressions.allTibetanCharacters}\\r\\n\\s]+`
    : `[^${TibetanRegExps.expressions.allTibetanCharacters}\\r\\n]+`;

  let result = (text || '').replace(
    new RegExp(regexPattern, 'iug'),
    (wylie) => wylieToUnicode.convert(wylie)
  );

  if (normalizeMultipleTshegs) {
    result = result.replace(/་+/g, '་');
  }

  if (normalizeTrailingPunctuation) {
    result = result.replace(/[་།༑༔ ]*$/, '་');
  }

  return TibetanNormalizer.normalize(result);
}

/**
 * Convert Wylie within parentheses in search queries.
 * Used for search syntax like "(sangs rgyas)" -> "སངས་རྒྱས"
 *
 * @param {string} text - Search query text
 * @returns {string} Text with parenthesized Wylie converted
 */
export const convertWylieInParentheses = function(text) {
  return text.replace(/\(([^)]*)\)/g, (match, wylie) => {
    return wylieToUnicode.convert(wylie);
  });
}