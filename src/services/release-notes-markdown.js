/**
 * Minimal Markdown renderer for release notes.
 *
 * The notes arrive from the updater's latest.json, so they are remote content:
 * everything is HTML-escaped and the markup is rebuilt here, rather than the
 * input being trusted and passed through.
 *
 * Only the subset scripts/generate-changelog.js produces is supported —
 * `### headings` and `- bullets`. A full Markdown dependency would be
 * disproportionate for that.
 */

const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (char) => ESCAPES[char]);

/**
 * @param {string} markdown Release notes as Markdown.
 * @returns {string} HTML safe to pass to v-html.
 */
export const renderReleaseNotes = (markdown) => {
  const lines = String(markdown || '').split('\n');
  const html = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      closeList();
      continue;
    }

    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      closeList();
      html.push(`<h4>${escapeHtml(heading[1])}</h4>`);
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${escapeHtml(bullet[1])}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${escapeHtml(line)}</p>`);
  }

  closeList();
  return html.join('');
};

export default renderReleaseNotes;
