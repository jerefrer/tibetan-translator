import { describe, it, expect } from 'vitest';
import { renderReleaseNotes } from '../src/services/release-notes-markdown.js';

describe('renderReleaseNotes', () => {
  it('renders a heading followed by a bullet list', () => {
    expect(renderReleaseNotes('### Fixed\n\n- A thing\n- Another thing')).toBe(
      '<h4>Fixed</h4><ul><li>A thing</li><li>Another thing</li></ul>'
    );
  });

  it('closes a list before the next heading', () => {
    const html = renderReleaseNotes('### Added\n- One\n\n### Fixed\n- Two');
    expect(html).toBe(
      '<h4>Added</h4><ul><li>One</li></ul><h4>Fixed</h4><ul><li>Two</li></ul>'
    );
  });

  it('accepts asterisk bullets as well as hyphens', () => {
    expect(renderReleaseNotes('* One\n* Two')).toBe('<ul><li>One</li><li>Two</li></ul>');
  });

  it('wraps loose text in a paragraph', () => {
    expect(renderReleaseNotes('Maintenance release.')).toBe('<p>Maintenance release.</p>');
  });

  it('accepts headings of any level', () => {
    expect(renderReleaseNotes('# Big\n## Medium')).toBe('<h4>Big</h4><h4>Medium</h4>');
  });

  it('escapes HTML in bullets, headings and paragraphs', () => {
    expect(renderReleaseNotes('- <img src=x onerror=alert(1)>')).toBe(
      '<ul><li>&lt;img src=x onerror=alert(1)&gt;</li></ul>'
    );
    expect(renderReleaseNotes('### <script>')).toBe('<h4>&lt;script&gt;</h4>');
    expect(renderReleaseNotes('a & b')).toBe('<p>a &amp; b</p>');
  });

  it('escapes quotes so attributes cannot be broken out of', () => {
    expect(renderReleaseNotes('- say "hi" and \'bye\'')).toBe(
      '<ul><li>say &quot;hi&quot; and &#39;bye&#39;</li></ul>'
    );
  });

  it('returns an empty string for empty or missing input', () => {
    expect(renderReleaseNotes('')).toBe('');
    expect(renderReleaseNotes(null)).toBe('');
    expect(renderReleaseNotes(undefined)).toBe('');
    expect(renderReleaseNotes('\n\n   \n')).toBe('');
  });

  it('renders a realistic generated section', () => {
    const notes = [
      '### Added',
      '- A new Lexicon section for building your own dictionaries',
      '',
      '### Fixed',
      '- Scan downloads no longer save to the wrong folder',
    ].join('\n');

    expect(renderReleaseNotes(notes)).toBe(
      '<h4>Added</h4>' +
        '<ul><li>A new Lexicon section for building your own dictionaries</li></ul>' +
        '<h4>Fixed</h4>' +
        '<ul><li>Scan downloads no longer save to the wrong folder</li></ul>'
    );
  });
});
