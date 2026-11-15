import DICTIONARIES_DETAILS from './dictionaries-details';

// What a term's entry can play on its own: the recording of the word and of
// the example sentence the Heart of Tibetan Language dictionaries carry in
// their raw definitions as `[sound: file]` markers.

const SOUND = /\[sound:\s*([^\]]+)\]/g;
const EXAMPLE_SOUND = /Example:\s*\[sound:\s*([^\]]+)\]([\s\S]*)$/;

// Audio files are stored re-encoded to mp3, as the decorator does
const mp3 = (file) => file.trim().replace(/\.wav$/i, '.mp3');

// Definitions hold literal "\n" sequences or real newlines
const flatten = (text) => text.replace(/\\+n/g, '\n');

// "<Tibetan>  <English>": the Tibetan is the leading run of Tibetan characters
// (and the spaces inside it) up to two spaces or the first Latin letter
function splitSentence(text) {
  const flat = text.replace(/\s*\n\s*/g, ' ').trim();
  const end = flat.search(/ {2,}|[A-Za-z]/);
  const tibetan = (end === -1 ? flat : flat.slice(0, end)).trim();
  const translation = end === -1 ? '' : flat.slice(end).trim();
  return { tibetan, translation };
}

function audioOf(definition) {
  const text = flatten(definition || '');
  const example = text.match(EXAMPLE_SOUND);
  const exampleFile = example ? example[1] : null;
  let word = null;
  for (const match of text.matchAll(SOUND)) {
    // The example's own marker is not the word's
    if (example && match.index === example.index + example[0].indexOf('[sound:')) continue;
    word = mp3(match[1]);
    break;
  }
  let sentence = null;
  if (example) {
    const { tibetan, translation } = splitSentence(example[2]);
    if (tibetan && translation) sentence = { file: mp3(exampleFile), tibetan, translation };
  }
  return { word, example: sentence };
}

// The recordings of the first entry of an audio dictionary that has some, or
// null: { audioId, label, word, example }. `entries` are rows with the raw
// `definition` and the `dictionary` key, in the order shown.
export function entryAudio(entries) {
  for (const entry of entries || []) {
    const details = DICTIONARIES_DETAILS[entry.dictionary];
    if (!details?.audioId) continue;
    const { word, example } = audioOf(entry.definition);
    if (!word && !example) continue;
    return {
      audioId: details.audioId,
      label: (details.label || '').replace(/\s+\d+$/, ''),
      word,
      example
    };
  }
  return null;
}

// The sentence in parts, the term (less its closing tsheg, plus the one that
// follows it in the sentence) flagged as the match
export function highlightTerm(sentence, term) {
  const stem = (term || '').replace(/་+$/, '');
  const at = stem ? sentence.indexOf(stem) : -1;
  if (at === -1) return [{ text: sentence, match: false }];
  let end = at + stem.length;
  if (sentence[end] === '་') end += 1;
  const parts = [];
  if (at > 0) parts.push({ text: sentence.slice(0, at), match: false });
  parts.push({ text: sentence.slice(at, end), match: true });
  if (end < sentence.length) parts.push({ text: sentence.slice(end), match: false });
  return parts;
}
