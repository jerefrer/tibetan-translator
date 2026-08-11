/**
 * Detection and conversion of pre-Unicode ("legacy") Tibetan text.
 *
 * Fonts like TibetanChogyal, Ededris/Dedris and Sambhota predate Unicode: they
 * encode each Tibetan glyph as a Latin-1 byte, so their text copies out of a
 * PDF or a Word document as Latin gibberish (སངས་རྒྱས་ comes out as `<$<-{<-`).
 *
 * Conversion is delegated to tibetan-ansi-to-unicode. That package statically
 * pulls in BUDA's 194 font tables (~430 KB), so it is only ever loaded through
 * a dynamic import, behind the cheap synchronous gate below.
 */

// Every code point that at least one BUDA table maps to a tsheg (U+0F0B), the
// Tibetan syllable separator. Kept as a literal so the gate stays synchronous
// and free of the 430 KB table import; tests assert it still matches the
// tables, so a future package version that adds an encoding will fail loudly.
const SEPARATOR_ENCODINGS = "-,.'`|}üÍ";

// Below this many non-whitespace characters there is not enough signal: a
// punctuation-only scrap like "(?!)" scores a perfect symbol ratio.
const MIN_LENGTH = 6;

// Calibrated against a real Ededris pecha and Chogyal round-trips (0.62–0.75)
// versus Wylie, IAST transliteration and ordinary prose (all ≤ 0.44).
const MIN_SYMBOL_RATIO = 0.5;

// Tibetan is a dense sequence of short syllables, so the separator recurs every
// few characters. Symbol-heavy prose that never encodes one is not a pecha.
const MIN_SEPARATOR_RATIO = 0.08;

const TIBETAN_UNICODE = /[ༀ-࿿]/;
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/**
 * Does this text look like Tibetan encoded in a pre-Unicode font?
 *
 * Cheap, synchronous and deliberately conservative: the one input that must
 * never be mistaken for legacy is Wylie, since that is the app's main typed
 * input and it flows on to convertWylieInText().
 *
 * @param {string} text
 * @returns {boolean}
 */
export function looksLegacyTibetan(text) {
  if (!text) return false;

  const chars = [...text].filter((char) => !/\s/.test(char));
  if (chars.length < MIN_LENGTH) return false;

  // Already Unicode Tibetan: nothing to repair.
  if (TIBETAN_UNICODE.test(text)) return false;

  let symbols = 0;
  let separators = 0;
  for (const char of chars) {
    if (!LETTER_OR_DIGIT.test(char)) symbols++;
    if (SEPARATOR_ENCODINGS.includes(char)) separators++;
  }

  return (
    symbols / chars.length >= MIN_SYMBOL_RATIO &&
    separators / chars.length >= MIN_SEPARATOR_RATIO
  );
}

export { SEPARATOR_ENCODINGS };

const IGNORED_TAGS = new Set(['STYLE', 'SCRIPT']);

// "Ededris-a, Helvetica, sans-serif" and '"Ededris-a"' both name Ededris-a.
function firstFamily(value) {
  if (!value) return '';
  return value.split(',')[0].replace(/['"]/g, '').trim();
}

function declaredFont(element) {
  return (
    firstFamily(element.style && element.style.fontFamily) ||
    firstFamily(element.getAttribute && element.getAttribute('face'))
  );
}

/**
 * Split pasted clipboard HTML into font-tagged runs.
 *
 * This is what makes correct conversion possible at all. Legacy fonts reuse the
 * same code points for different glyphs, and a single pecha routinely mixes
 * several of them — consonants in Ededris-a, vowels in Ededris-vowa — so the
 * plain-text flavour of the clipboard is genuinely ambiguous while the HTML
 * flavour still carries the font of every run.
 *
 * @param {string} html
 * @returns {Array<{text: string, font: string}>}
 */
export function htmlToRuns(html) {
  if (!html) return [];

  const document = new DOMParser().parseFromString(html, 'text/html');
  const runs = [];

  const walk = (node, inheritedFont) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        if (child.data) runs.push({ text: child.data, font: inheritedFont });
      } else if (child.nodeType === 1 && !IGNORED_TAGS.has(child.tagName)) {
        walk(child, declaredFont(child) || inheritedFont);
      }
    }
  };
  walk(document.body, '');

  return runs;
}

// ~430 KB of BUDA font tables, so it is fetched on the first legacy paste only
// and never during a normal session.
let converterPromise = null;
function loadConverter() {
  if (!converterPromise) converterPromise = import('tibetan-ansi-to-unicode');
  return converterPromise;
}

// Only the font tables can say whether a font is legacy. Markup that names any
// font gets to consult them, whatever the text looks like: a legacy fragment
// quoted inside a paragraph of English dilutes the symbol ratio far below
// anything blind conversion would accept, yet its font still names it exactly.
// Text confident enough to convert without any markup also qualifies.
function inspect({ text, html } = {}) {
  const runs = htmlToRuns(html);
  const plain = text || runs.map((run) => run.text).join('');
  const worth =
    looksLegacyTibetan(plain) ||
    (runs.some((run) => run.font) && !TIBETAN_UNICODE.test(plain));
  return { runs, plain, worth };
}

/**
 * Could this paste need repairing?
 *
 * A paste handler has to call preventDefault() synchronously, long before the
 * asynchronous conversion below can answer. This is the same decision, made
 * from the same signals, so the two can never disagree.
 *
 * @param {{text?: string, html?: string}} clipboard
 * @returns {boolean}
 */
export function mayNeedLegacyRepair(clipboard) {
  return inspect(clipboard).worth;
}

/**
 * Turn a legacy-font paste into Unicode Tibetan.
 *
 * @param {{text?: string, html?: string}} clipboard The plain-text and HTML
 *   flavours of what was pasted, as `event.clipboardData` exposes them.
 * @returns {Promise<string|null>} The repaired Unicode, or null when the paste
 *   is not legacy Tibetan and should be handled the way it always has been.
 */
export async function convertLegacyPaste(clipboard = {}) {
  const { runs, plain, worth } = inspect(clipboard);
  if (!worth) return null;

  const {
    convertRun,
    isKnownFont,
    default: TibetanUnicodeConverter,
  } = await loadConverter();

  // The HTML flavour is the only one that survives a document mixing several
  // legacy fonts, so prefer it whenever it actually names one.
  if (runs.some((run) => isKnownFont(run.font))) {
    return runs
      .map((run) =>
        isKnownFont(run.font) ? convertRun(run.text, run.font) : run.text
      )
      .join('');
  }

  if (!looksLegacyTibetan(plain)) return null;
  return new TibetanUnicodeConverter(plain).convert();
}

/**
 * Repair a paste and splice it into a field at the caret.
 *
 * For fields that want the repair and nothing else — the Search query has a
 * syntax of its own, in which Wylie is only converted inside parentheses, so
 * running TibetanTextField's blanket Wylie conversion over it would break
 * queries like "(sangs rgyas)".
 *
 * @param {{text?: string, html?: string}} clipboard
 * @param {{value?: string, start?: number, end?: number}} selection The field's
 *   current value and the range the paste replaces.
 * @returns {Promise<{value: string, caret: number}|null>} The field's new value
 *   and where to put the caret, or null when the paste was not legacy Tibetan.
 */
export async function repairPasteInto(clipboard, { value, start, end } = {}) {
  const repaired = await convertLegacyPaste(clipboard);
  if (repaired == null) return null;

  const current = value || '';
  const before = current.substring(0, start);
  return {
    value: before + repaired + current.substring(end),
    caret: before.length + repaired.length,
  };
}
