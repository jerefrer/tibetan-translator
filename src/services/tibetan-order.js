// Tibetan order: words filed as Tibetan dictionaries file them, by root
// letter, rather than by code point (Intl.Collator('bo') has no Tibetan rules
// and files བསྒྲུབ་ under its prefix བ). src-tauri/src/tibetan_order.rs is the
// same algorithm, for the glossary's SQL; tests/fixtures/tibetan-order.json
// holds them both to one order.
//
// Each syllable is read into its parts and compared part by part:
//   root letter, then which of prefix and superscript it has (neither, a
//   prefix, a superscript, both), the prefix, the superscript, the subscripts,
//   the vowel (none, i, u, e, o), the suffix, the second suffix, and a vowel
//   particle fused to the syllable (དགའི་ after དགའ་).
// The letters' own Unicode order is the traditional one (ཀ ཁ ག ང … ཧ ཨ), and
// so is that of the prefixes, superscripts and suffixes, so a part's rank is
// its letter's place in the block. A syllable that cannot be read this way
// (a Sanskrit stack, a number) goes after the readable syllables of its first
// letter; a word that is not Tibetan goes after every Tibetan one. Equal keys
// fall back to the text itself, so the order is total.

const LETTERS = 0x0f40;
const SUBJOINED = 0x0f90;
const LAST_LETTER = 0x0f6c;
const LAST_SUBJOINED = 0x0fbc;

// Precomposed letters and vowels, written out (their canonical decomposition)
const DECOMPOSED = {
  'གྷ': 'གྷ', 'ཌྷ': 'ཌྷ', 'དྷ': 'དྷ',
  'བྷ': 'བྷ', 'ཛྷ': 'ཛྷ', 'ཀྵ': 'ཀྵ',
  'ྒྷ': 'ྒྷ', 'ྜྷ': 'ྜྷ', 'ྡྷ': 'ྡྷ',
  'ྦྷ': 'ྦྷ', 'ྫྷ': 'ྫྷ', 'ྐྵ': 'ྐྵ',
  'ཱི': 'ཱི', 'ཱུ': 'ཱུ', 'ཱྀ': 'ཱྀ',
};

const RA = 0x0f62;
const LA = 0x0f63;
const SA = 0x0f66;
const ACHUNG = 0x0f60;
const FIXED_RA = 0x0f6a;
// Subscripts in their order: ya, ra, la, wa, and the ha of ལྷ
const SUBSCRIPT_RANKS = { 0x0fb1: 1, 0x0fbb: 1, 0x0fb2: 2, 0x0fbc: 2, 0x0fb3: 3, 0x0fad: 4, 0x0fba: 4, 0x0fb7: 5 };
const VOWEL_RANKS = { 0x0f72: 1, 0x0f74: 2, 0x0f7a: 3, 0x0f7c: 4 };
// A vowel on a final འ is a particle: དགའི་, དགའུ་, དགའོ་
const PARTICLE_RANKS = { 0x0f72: 1, 0x0f74: 2, 0x0f7c: 3 };
// Which letters each prefix can stand before (ག ད བ མ འ)
const PREFIXABLE = {
  0x0f42: 'ཅཉཏདནཞཟཡཤས',
  0x0f51: 'ཀགངཔབམ',
  0x0f56: 'ཀགཅཏདཙཞཟཤས',
  0x0f58: 'ཁགངཆཇཉཐདནཚཛ',
  0x0f60: 'ཁགཆཇཐདཕབཚཛ',
};

// After every Tibetan letter's rank
const NOT_TIBETAN = 200;
// After the four prefix/superscript groups (0 to 3)
const UNREADABLE = 9;

const isLetter = (code) => code >= LETTERS && code <= LAST_LETTER;
const isSubjoined = (code) => code >= SUBJOINED && code <= LAST_SUBJOINED;
const isSign = (code) => code >= 0x0f71 && code <= 0x0f87;
const rankOf = (code) => (code === FIXED_RA ? RA : code) - LETTERS + 1;
const baseOf = (code) => code - (SUBJOINED - LETTERS);

function decompose(text) {
  return text.replace(/[གྷཌྷདྷབྷཛྷཀྵྒྷྜྷྡྷྦྷྫྷྐྵཱཱཱིྀུ]/g, (char) => DECOMPOSED[char]);
}

// A syllable's letters, each with what is written under and on it
function stacksOf(syllable) {
  const stacks = [];
  for (const char of syllable) {
    const code = char.codePointAt(0);
    if (isLetter(code)) stacks.push({ base: code, subjoined: [], vowels: [] });
    else if (isSubjoined(code) && stacks.length) stacks[stacks.length - 1].subjoined.push(code);
    else if (isSign(code) && stacks.length) stacks[stacks.length - 1].vowels.push(code);
    else return null;
  }
  return stacks.length ? stacks : null;
}

const isPlain = (stack) => !stack.subjoined.length && !stack.vowels.length;
const canPrefix = (prefix, root) => (PREFIXABLE[prefix] || '').includes(String.fromCodePoint(root));

// The stack that holds the root: the one with a vowel or something under
// it, or, in a syllable of plain letters, the one that reads as the root
function rootIndex(stacks) {
  const marked = stacks.findIndex((stack) => !isPlain(stack));
  if (marked >= 0) return marked;
  if (stacks.length <= 2) return 0;
  if (stacks.length === 3) return canPrefix(stacks[0].base, stacks[1].base) ? 1 : 0;
  if (stacks.length === 4) return 1;
  return -1;
}

function unreadable(syllable) {
  const first = syllable.codePointAt(0);
  const root = isLetter(first) ? rankOf(first) : isSubjoined(first) ? rankOf(baseOf(first)) : NOT_TIBETAN;
  return [root, UNREADABLE, 0, 0, 0, 0, 0, 0, 0, 0];
}

/** One syllable's key: ten numbers, compared in order. */
function syllableKey(syllable) {
  const stacks = stacksOf(syllable);
  if (!stacks) return unreadable(syllable);

  let particle = 0;
  const last = stacks[stacks.length - 1];
  if (stacks.length > 1 && last.base === ACHUNG && !last.subjoined.length && last.vowels.length === 1 && PARTICLE_RANKS[last.vowels[0]]) {
    particle = PARTICLE_RANKS[last.vowels[0]];
    stacks[stacks.length - 1] = { ...last, vowels: [] };
  }

  const index = rootIndex(stacks);
  if (index < 0 || index > 1) return unreadable(syllable);
  const prefix = index === 1 ? stacks[0] : null;
  if (prefix && !isPlain(prefix)) return unreadable(syllable);
  const suffixes = stacks.slice(index + 1);
  if (suffixes.length > 2 || !suffixes.every(isPlain)) return unreadable(syllable);

  const main = stacks[index];
  let root = main.base;
  let superscript = 0;
  let subjoined = main.subjoined;
  const head = subjoined[0];
  if ([RA, LA, SA, FIXED_RA].includes(root) && head !== undefined && !SUBSCRIPT_RANKS[head]) {
    superscript = root;
    root = baseOf(head);
    subjoined = subjoined.slice(1);
  }
  if (subjoined.length > 2 || main.vowels.length > 1) return unreadable(syllable);

  const subscriptRank = (code) => (code === undefined ? 0 : SUBSCRIPT_RANKS[code] || 10 + rankOf(baseOf(code)));
  const vowel = main.vowels[0];
  return [
    rankOf(root),
    (prefix ? 1 : 0) + (superscript ? 2 : 0),
    prefix ? rankOf(prefix.base) : 0,
    superscript ? rankOf(superscript) : 0,
    subscriptRank(subjoined[0]),
    subscriptRank(subjoined[1]),
    vowel === undefined ? 0 : VOWEL_RANKS[vowel] || 10 + (vowel - 0x0f70),
    suffixes[0] ? rankOf(suffixes[0].base) : 0,
    suffixes[1] ? rankOf(suffixes[1].base) : 0,
    particle,
  ];
}

/** A word's key: its syllables' keys one after the other. */
export function tibetanSortKey(text) {
  const syllables = decompose(String(text || ''))
    .split(/[\s་༌།-༔]+/)
    .filter(Boolean);
  return syllables.flatMap(syllableKey);
}

function compareKeys(a, b) {
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

const normalized = (text) => decompose(String(text || '')).replace(/[\s་༌།-༔]+$/, '');

/** A comparator for Array.prototype.sort: negative when `a` comes first. */
export function compareTibetan(a, b) {
  const byKey = compareKeys(tibetanSortKey(a), tibetanSortKey(b));
  if (byKey) return byKey;
  const [x, y] = [normalized(a), normalized(b)];
  return x < y ? -1 : x > y ? 1 : 0;
}

/** A sorted copy of `list`; `textOf` reads the Tibetan of an item. */
export function sortTibetan(list, textOf = (item) => item) {
  return list
    .map((item) => ({ item, key: tibetanSortKey(textOf(item)), text: normalized(textOf(item)) }))
    .sort((a, b) => compareKeys(a.key, b.key) || (a.text < b.text ? -1 : a.text > b.text ? 1 : 0))
    .map(({ item }) => item);
}
