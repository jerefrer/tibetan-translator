// "In short": the short glosses several dictionaries agree on for a term.
// Pure functions, no Vue, no database.
import { decodeEntities } from './html-entities';

const WORD = /^[\p{Script=Latin}'-]+$/u;

function stripNotes(text) {
  let out = decodeEntities(text.replace(/<[^>]*>/g, ' '));
  // Repeat so that nested notes disappear too
  let previous;
  do {
    previous = out;
    out = out.replace(/\[[^\[\]]*\]|\([^()]*\)|\{[^{}]*\}/g, ' ');
  } while (out !== previous);
  return out;
}

function candidates(definition) {
  return stripNotes(definition || '')
    .split(/[;,]/)
    .map((part) => part.replace(/\s+/g, ' ').trim().replace(/\.+$/, '').trim())
    .filter((part) => {
      const words = part.split(' ');
      return part && words.length <= 4 && words.every((word) => WORD.test(word));
    });
}

/** The glosses at least `minDictionaries` dictionaries share, most agreed
 *  first. `entries` arrive in the user's dictionary order. */
export function inShort(entries, { max = 4, minDictionaries = 2 } = {}) {
  const found = new Map();
  for (const { dictionaryId, definition } of entries) {
    for (const gloss of candidates(definition)) {
      const key = gloss.toLowerCase();
      if (!found.has(key)) found.set(key, { gloss, ids: new Set(), order: found.size });
      found.get(key).ids.add(dictionaryId);
    }
  }
  return [...found.values()]
    .filter((item) => item.ids.size >= minDictionaries)
    .sort((a, b) => b.ids.size - a.ids.size || a.order - b.order)
    .slice(0, max)
    .map((item) => item.gloss);
}
