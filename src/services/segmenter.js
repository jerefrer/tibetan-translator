import { MAX_MERGE_TERM_COUNT } from "../config/constants";
import { withTrailingTshek } from "../utils";

// Word splitting and expression detection for Tibetan text, shared by the
// Split page and anything else that has to cut a passage into words.

// The tokenizer is built once from the Botok dictionary in the public folder.
// A session holds that tokenizer and the last load error; callers that need
// their own (a page instance, a test) make one, everyone else shares the
// default session.
export function createTokenizerSession() {
  return { tokenizer: null, loading: null, error: null };
}

const defaultSession = createTokenizerSession();

// Resolves once the tokenizer is ready, or leaves session.error set and
// session.tokenizer null when it could not be built (tried again next time).
async function loadTokenizer(session) {
  if (session.tokenizer) return session.tokenizer;
  if (!session.loading) {
    session.error = null;
    session.loading = (async () => {
      try {
        const { createTokenizer } = await import("tibetan-word-tokenizer");
        const response = await fetch("/botok-dictionary.json");
        if (!response.ok) {
          throw new Error("Dictionary not found. Please ensure botok-dictionary.json is in the public folder.");
        }
        const dictionary = await response.json();
        session.tokenizer = createTokenizer({ dictionary });
      } catch (error) {
        console.error("Failed to initialize tokenizer:", error);
        session.error = error.message;
      } finally {
        session.loading = null;
      }
      return session.tokenizer;
    })();
  }
  return session.loading;
}

// The message of the last failed load, or null
export function tokenizerError(session = defaultSession) {
  return session.error;
}

// Words of a passage, each ending in a tsheg (or a shad); only TEXT chunks
export async function splitIntoWords(text, session = defaultSession) {
  const tokenizer = await loadTokenizer(session);
  let tokens;
  if (!tokenizer) {
    // Fallback: simple syllable splitting if the tokenizer failed
    tokens = text
      .split(/[་།\s]+/)
      .filter((t) => t.trim())
      .map((syllable) => ({ text: syllable + "་", chunkType: "TEXT" }));
  } else {
    tokens = tokenizer.tokenize(text);
  }

  const words = [];
  for (const token of tokens) {
    if (token.chunkType === "TEXT" && token.text) {
      let word = token.text.trim();
      if (!word.endsWith("་") && !word.endsWith("།")) word = word + "་";
      if (word && word !== "་") words.push(word);
    }
  }
  return words;
}

// Words as the user spaced them (respects their edits); pure punctuation is skipped
export function wordsFromSpacedText(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return [];

  const words = [];
  for (let part of trimmed.split(/\s+/).filter((p) => p.trim())) {
    part = part.trim();
    if (/^[།༔༑]+$/.test(part)) continue;
    if (!part.endsWith("་") && !part.endsWith("།")) part = part + "་";
    if (part && part !== "་") words.push(part);
  }
  return words;
}

// Merges of 2 to maxCount consecutive words that make a known expression:
// [{ start, count, term }], by start then count. `around` limits the check to
// the starts within maxCount - 1 words of that index.
export async function findMerges(
  words,
  hasEntries,
  { maxCount = MAX_MERGE_TERM_COUNT, around = null } = {}
) {
  const first = around === null ? 0 : Math.max(0, around - (maxCount - 1));
  const last = around === null
    ? words.length - 2
    : Math.min(words.length - 2, around + (maxCount - 1));

  const merges = [];
  for (let start = first; start <= last; start++) {
    for (let count = 2; count <= Math.min(maxCount, words.length - start); count++) {
      const term = words.slice(start, start + count).map(withTrailingTshek).join("");
      if (await hasEntries(term)) merges.push({ start, count, term });
    }
  }
  return merges;
}

// Lays merges out in lanes so that those covering the same rows do not
// overlap: [{ start, count, term, lane }], longest first at each start.
export function mergeLanes(merges) {
  const ordered = [...merges].sort((a, b) => a.start - b.start || b.count - a.count);
  const laneEnds = [];
  return ordered.map((merge) => {
    let lane = laneEnds.findIndex((end) => end <= merge.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = merge.start + merge.count;
    return { ...merge, lane };
  });
}
