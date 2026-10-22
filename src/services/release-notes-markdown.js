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

/**
 * The Markdown body of one version's section in CHANGELOG.md, or '' when the
 * file has no section for it. Sections open with `## [1.12.0](…) - date` (or
 * `## 1.12.0`); the body runs to the next `## ` heading.
 *
 * @param {string} changelog Contents of CHANGELOG.md.
 * @param {string} version   Version without a leading "v".
 * @returns {string}
 */
export const releaseNotesFor = (changelog, version) => {
  if (!version) return '';
  const wanted = String(version).replace(/^v/, '');
  const lines = String(changelog || '').split('\n');
  const body = [];
  let inSection = false;

  for (const line of lines) {
    const section = line.match(/^##\s+\[?v?([^\]\s]+)\]?/);
    if (section && !line.startsWith('###')) {
      if (inSection) break;
      inSection = section[1] === wanted;
      continue;
    }
    if (inSection) body.push(line);
  }

  return body.join('\n').trim();
};

export default renderReleaseNotes;
