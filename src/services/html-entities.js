// Decodes the HTML entities a stored definition may carry (&nbsp; &amp; &#39;)
// so plain-text readers (glosses, In short) see what the definition shows.
// One pass: "&amp;lt;" becomes "&lt;", not "<". No DOM, safe in pure code.

const NAMED = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodeEntities(text) {
  return (text || '').replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (whole, dec, hex, name) => {
    if (name) return NAMED[name.toLowerCase()] ?? whole;
    const code = dec ? parseInt(dec, 10) : parseInt(hex, 16);
    try {
      return String.fromCodePoint(code);
    } catch {
      return whole;
    }
  });
}
