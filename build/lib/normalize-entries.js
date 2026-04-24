/**
 * Normalize raw APKG notes into clean { term, definition } entries.
 *
 * Rules applied (in order):
 *   1. Clean HTML tags/entities, trim whitespace.
 *   2. Auto-flip inverted notes (Tibetan ended up in the "fr" field and vice-versa).
 *   3. Skip grammar patterns — any term containing " + " (e.g. "V + ... + ...").
 *   4. Extract annotations from the term — parenthesized blocks with Latin letters ("(H)",
 *      "(phugu)") or slash-delimited phonetics ("/bètte/") — and append them to the definition.
 *   5. Split space-separated alternatives (e.g. "དུས་སང་།   ལོ་རྗེས་མ།") into one entry per alternative.
 *   6. Expand ༼...༽ optional parenthetical parts into variants (with and without). "/" inside
 *      the parens produces multiple alternatives (cartesian). Tibetan-ellipsis placeholders
 *      "༼་་་༽" at the start or end of the term are dropped; in the middle they are kept.
 *   7. Tidy up trailing/internal tshegs and shads, then deduplicate exact (term, definition) pairs.
 */

const TIBETAN_CHAR_RE = /[ༀ-࿿]/;
const TIBETAN_LETTER_RE = /[ཀ-ཿ]/;

export function normalizeEntries(notes, { reversed }) {
  const seen = new Set();
  const out = [];

  for (const [field0, field1] of notes) {
    const [fRaw, tRaw] = reversed ? [field1, field0] : [field0, field1];
    let fr = cleanText(fRaw);
    let tib = cleanText(tRaw);

    // Auto-flip cards that are inverted against their deck's declared direction
    if (!hasTibetan(tib) && hasTibetan(fr)) {
      [fr, tib] = [tib, fr];
    }

    if (!tib || !hasTibetanLetter(tib)) continue;

    const { strippedTerm, annotations } = extractAnnotations(tib);
    let definition = annotations.length
      ? `${fr}${fr ? ' ' : ''}${annotations.join(' ')}`.trim()
      : fr;

    // A "+" in the term marks a grammar composition template (e.g. "V + ཀར་ + འགྲོ་བ་"
    // or "adj + ཞེ་དྲགས། / ཞེ་པོ།"). In that mode, whitespace-separated Tibetan
    // chunks are pieces to concatenate (not alternatives) — "/" remains the only
    // alternative separator. Without "+", whitespace-separated chunks are alternatives.
    const compositional = /\+/.test(strippedTerm);

    // Preserve the original grammar template (with its English hints, "+" signs and
    // Tibetan pieces in context) in the definition so no info is lost. The user can
    // always see the full pattern the normalized term came from.
    if (compositional) {
      definition = definition
        ? `${definition}\n\n${strippedTerm}`
        : strippedTerm;
    }

    // Strip non-Tibetan noise: Latin grammar hints ("adj", "V", "présent", …)
    // and the "+" attachment marker itself. Whatever Tibetan remains is usable.
    const withoutHints = strippedTerm
      .replace(/[A-Za-zÀ-ſ][A-Za-zÀ-ſ.]*/g, '')
      .replace(/\+/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // First split on "/" (always alternatives, except inside ༼...༽ which expandOptionalParens handles).
    const altPieces = splitPreservingOptionalParens(withoutHints, '/');

    const alternatives = [];
    for (const piece of altPieces) {
      const trimmed = piece.trim();
      if (!trimmed) continue;
      const wsChunks = trimmed.split(/\s+/).filter(Boolean);
      if (compositional) {
        // Join chunks into one term; preserve the user's example where
        // "V + ཀར་ + འགྲོ་བ་" becomes "ཀར་འགྲོ་བ་".
        alternatives.push(joinCompositionalChunks(wsChunks));
      } else {
        for (const c of wsChunks) alternatives.push(c);
      }
    }

    const tibetanAlternatives = alternatives.filter(
      (c) => hasTibetanLetter(c) || c.startsWith('༼')
    );

    if (tibetanAlternatives.length === 0) continue;

    const finalTerms = [];
    for (const alt of tibetanAlternatives) {
      for (const variant of expandOptionalParens(alt)) {
        const cleaned = cleanupTerm(variant);
        if (cleaned && hasTibetanLetter(cleaned)) {
          finalTerms.push(cleaned);
        }
      }
    }

    for (const term of finalTerms) {
      const key = term + '\x00' + definition;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ term, definition });
    }
  }

  return out;
}

function cleanText(s) {
  if (typeof s !== 'string') return '';
  let out = s;
  out = out.replace(/<br\s*\/?>/gi, '\n');
  out = out.replace(/<[^>]+>/g, '');
  out = out.replace(/&nbsp;/g, ' ');
  out = out.replace(/&amp;/g, '&');
  out = out.replace(/&lt;/g, '<');
  out = out.replace(/&gt;/g, '>');
  out = out.replace(/&quot;/g, '"');
  out = out.replace(/&#39;/g, "'");
  return out.trim();
}

function hasTibetan(s) {
  return TIBETAN_CHAR_RE.test(s);
}

function hasTibetanLetter(s) {
  return TIBETAN_LETTER_RE.test(s);
}

/** Split `s` on `sep` but keep ༼...༽ blocks untouched (their "/" belongs to expandOptionalParens). */
function splitPreservingOptionalParens(s, sep) {
  const out = [];
  let buf = '';
  let depth = 0;
  for (const ch of s) {
    if (ch === '༼') { depth++; buf += ch; continue; }
    if (ch === '༽') { depth = Math.max(0, depth - 1); buf += ch; continue; }
    if (ch === sep && depth === 0) { out.push(buf); buf = ''; continue; }
    buf += ch;
  }
  out.push(buf);
  return out;
}

/** Join whitespace-split Tibetan pieces of a compositional template into one term.
 *  Strips any shad-at-end of an intermediate piece (since shads are word-enders and
 *  don't belong mid-term), preserves tshegs, and lets cleanupTerm handle the final. */
function joinCompositionalChunks(chunks) {
  return chunks
    .map((c) => c.replace(/[།༑༔]+[་]*$/g, ''))
    .map((c, i, arr) => (i < arr.length - 1 && !/་$/.test(c) ? c + '་' : c))
    .join('');
}

function extractAnnotations(term) {
  const annotations = [];
  let out = term;

  // Parenthesized annotations containing at least one Latin letter.
  out = out.replace(/\(([^)]*[A-Za-zÀ-ſ][^)]*)\)/g, (_, inner) => {
    annotations.push(`(${inner.trim()})`);
    return '';
  });

  // Slash-delimited phonetic annotations (at least one Latin letter inside).
  out = out.replace(/\/([^/\s][^/]*[A-Za-zÀ-ſ][^/]*)\//g, (_, inner) => {
    annotations.push(`/${inner.trim()}/`);
    return '';
  });

  return {
    strippedTerm: out.replace(/\s+/g, ' ').trim(),
    annotations,
  };
}

function expandOptionalParens(term) {
  const match = term.match(/༼([^༽]*)༽/);
  if (!match) return [term];

  const content = match[1];
  const before = term.substring(0, match.index);
  const after = term.substring(match.index + match[0].length);

  // Placeholder like ༼་་་༽ — only tshegs/shads inside.
  if (content && /^[་༌།༎༑༔]+$/.test(content)) {
    const beforeHasLetter = hasTibetanLetter(before);
    const afterHasLetter = hasTibetanLetter(after);
    if (!beforeHasLetter) return expandOptionalParens(after);
    if (!afterHasLetter) return expandOptionalParens(before);
    // Middle: preserve the placeholder, recurse on the rest of the string
    const suffixes = expandOptionalParens(after);
    return suffixes.map((s) => before + match[0] + s);
  }

  // Normal optional content: "/" inside the parens splits into alternatives.
  const alternatives = content
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);

  const variants = new Set();

  for (const alt of alternatives) {
    for (const sub of expandOptionalParens(before + alt + after)) {
      variants.add(sub);
    }
  }
  for (const sub of expandOptionalParens(before + after)) {
    variants.add(sub);
  }

  return [...variants];
}

function cleanupTerm(t) {
  const trimmed = t.trim();
  let out = trimmed.replace(/[།༑༔]+[་]*$/g, ''); // always strip trailing shads
  // Preserve the placeholder contents verbatim (the tshegs inside "༼་་་༽" carry meaning).
  if (!trimmed.includes('༼')) {
    out = out.replace(/་{2,}/g, '་');            // collapse runs of tshegs from removed optional middles
  }
  // Ensure a single trailing tsheg so "ང་།" and "ང།" canonicalize to the same term.
  if (out && !/་$/.test(out)) out += '་';
  return out;
}
