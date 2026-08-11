import { describe, it, expect } from 'vitest';
import {
  FIELD_SEP,
  parseCommits,
  isNoiseCommit,
  filterCommits,
  renderSection,
  insertSection,
  extractSection,
  cleanNotes,
} from '../scripts/lib/changelog-core.js';

const log = (...pairs) =>
  pairs.map(([hash, subject]) => `${hash}${FIELD_SEP}${subject}`).join('\n');

describe('parseCommits', () => {
  it('splits hash and subject on the field separator', () => {
    const commits = parseCommits(
      log(['abc1234', 'feat(lexicon): adds the entry editor dialog'])
    );
    expect(commits).toEqual([
      { hash: 'abc1234', subject: 'feat(lexicon): adds the entry editor dialog' },
    ]);
  });

  it('skips blank lines and lines without a separator', () => {
    const raw = [
      `abc1234${FIELD_SEP}feat: one`,
      '',
      'garbage line with no separator',
      `def5678${FIELD_SEP}fix: two`,
    ].join('\n');
    expect(parseCommits(raw).map((c) => c.subject)).toEqual(['feat: one', 'fix: two']);
  });

  it('drops entries whose subject is empty', () => {
    expect(parseCommits(`abc1234${FIELD_SEP}   `)).toEqual([]);
  });

  it('returns an empty array for empty or missing input', () => {
    expect(parseCommits('')).toEqual([]);
    expect(parseCommits(undefined)).toEqual([]);
  });
});

describe('isNoiseCommit', () => {
  it('drops version bump commits', () => {
    expect(isNoiseCommit('Bumps to 1.9.1')).toBe(true);
    expect(isNoiseCommit('Bump to 1.9.1')).toBe(true);
  });

  it('drops merge commits', () => {
    expect(isNoiseCommit('Merge: editable personal dictionaries')).toBe(true);
    expect(isNoiseCommit('Merge branch main into feature/x')).toBe(true);
  });

  it.each(['chore', 'docs', 'test', 'refactor', 'build', 'ci'])(
    'drops the %s conventional type',
    (type) => {
      expect(isNoiseCommit(`${type}: something internal`)).toBe(true);
      expect(isNoiseCommit(`${type}(lexicon): something internal`)).toBe(true);
    }
  );

  it.each(['feat', 'fix', 'perf', 'style'])('keeps the %s conventional type', (type) => {
    expect(isNoiseCommit(`${type}(lexicon): something a user sees`)).toBe(false);
  });

  it('keeps breaking-change markers on user-facing types', () => {
    expect(isNoiseCommit('feat(api)!: removes the v1 endpoints')).toBe(false);
  });

  it('keeps commits with no conventional prefix, leaving the call to the model', () => {
    expect(isNoiseCommit('Fixes bug with drag & drop in Tauri')).toBe(false);
    expect(isNoiseCommit('Makes pack icons consistently use primary color')).toBe(false);
  });

  it('treats an empty subject as noise', () => {
    expect(isNoiseCommit('')).toBe(true);
    expect(isNoiseCommit(undefined)).toBe(true);
  });
});

describe('filterCommits', () => {
  it('removes noise while preserving order', () => {
    const commits = parseCommits(
      log(
        ['a', 'Bumps to 1.9.1'],
        ['b', 'fix(lexicon): stops Save clobbering an entry'],
        ['c', 'chore(serena): updates the project config'],
        ['d', 'feat(lexicon): adds quick add from Define']
      )
    );
    expect(filterCommits(commits).map((c) => c.subject)).toEqual([
      'fix(lexicon): stops Save clobbering an entry',
      'feat(lexicon): adds quick add from Define',
    ]);
  });
});

describe('renderSection', () => {
  it('links the version to the compare URL when one is given', () => {
    const section = renderSection({
      version: '1.9.2',
      date: '2026-08-11',
      body: '### Fixed\n\n- Something',
      compareUrl: 'https://example.com/compare/v1.9.1...v1.9.2',
    });
    expect(section).toBe(
      '## [1.9.2](https://example.com/compare/v1.9.1...v1.9.2) - 2026-08-11\n\n' +
        '### Fixed\n\n- Something\n'
    );
  });

  it('falls back to a plain heading with no compare URL', () => {
    const section = renderSection({
      version: '0.9.2',
      date: '2024-07-12',
      body: '- First release',
    });
    expect(section).toBe('## [0.9.2] - 2024-07-12\n\n- First release\n');
  });
});

const PREAMBLE = '# Changelog\n\nAll notable changes are documented here.\n';

const existing = (version, body) =>
  `## [${version}](https://example.com/${version}) - 2026-01-01\n\n${body}\n`;

describe('insertSection', () => {
  it('appends below the preamble when no sections exist yet', () => {
    const result = insertSection(
      PREAMBLE,
      renderSection({ version: '1.0.0', date: '2026-01-20', body: '- First' }),
      '1.0.0'
    );
    expect(result).toContain('# Changelog');
    expect(result).toContain('## [1.0.0] - 2026-01-20');
    expect(result.indexOf('# Changelog')).toBeLessThan(result.indexOf('## [1.0.0]'));
  });

  it('places a new section above the existing ones', () => {
    const changelog = `${PREAMBLE}\n${existing('1.9.1', '- Older')}`;
    const result = insertSection(
      changelog,
      renderSection({ version: '1.9.2', date: '2026-08-11', body: '- Newer' }),
      '1.9.2'
    );
    expect(result.indexOf('## [1.9.2]')).toBeLessThan(result.indexOf('## [1.9.1]'));
    expect(result).toContain('- Older');
  });

  it('replaces a section for the same version instead of duplicating it', () => {
    const changelog = `${PREAMBLE}\n${existing('1.9.2', '- Draft body')}${existing(
      '1.9.1',
      '- Older'
    )}`;
    const result = insertSection(
      changelog,
      renderSection({ version: '1.9.2', date: '2026-08-11', body: '- Reviewed body' }),
      '1.9.2'
    );
    expect(result).toContain('- Reviewed body');
    expect(result).not.toContain('- Draft body');
    expect(result.match(/## \[1\.9\.2\]/g)).toHaveLength(1);
    expect(result).toContain('- Older');
  });

  it('is idempotent when applied twice', () => {
    const section = renderSection({
      version: '1.9.2',
      date: '2026-08-11',
      body: '- Same',
    });
    const once = insertSection(`${PREAMBLE}\n${existing('1.9.1', '- Older')}`, section, '1.9.2');
    const twice = insertSection(once, section, '1.9.2');
    expect(twice).toBe(once);
  });
});

describe('extractSection', () => {
  const changelog = `${PREAMBLE}
## [1.9.2](https://example.com/c) - 2026-08-11

### Fixed

- The popup no longer shows two close buttons

## [1.9.1](https://example.com/d) - 2026-08-10

- Older entry
`;

  it('returns the body for a version, stopping at the next heading', () => {
    expect(extractSection(changelog, '1.9.2')).toBe(
      '### Fixed\n\n- The popup no longer shows two close buttons'
    );
  });

  it('returns the last section when nothing follows it', () => {
    expect(extractSection(changelog, '1.9.1')).toBe('- Older entry');
  });

  it('returns an empty string for a version that is absent', () => {
    expect(extractSection(changelog, '2.0.0')).toBe('');
  });

  it('does not confuse a version with a prefix of another', () => {
    const tricky = `${PREAMBLE}
## [1.9] - 2026-08-11

- The 1.9 line

## [1.9.2] - 2026-08-12

- The 1.9.2 line
`;
    expect(extractSection(tricky, '1.9')).toBe('- The 1.9 line');
    expect(extractSection(tricky, '1.9.2')).toBe('- The 1.9.2 line');
  });

  it('round-trips what insertSection wrote', () => {
    const body = '### Added\n\n- A new thing';
    const result = insertSection(
      PREAMBLE,
      renderSection({ version: '1.2.3', date: '2026-02-02', body }),
      '1.2.3'
    );
    expect(extractSection(result, '1.2.3')).toBe(body);
  });
});

describe('cleanNotes', () => {
  it.each([
    ['plain markdown', '### Fixed\n\n- A thing', '### Fixed\n\n- A thing'],
    ['a fenced block', '```markdown\n### Fixed\n\n- A thing\n```', '### Fixed\n\n- A thing'],
    ['an unlabelled fence', '```\n- A thing\n```', '- A thing'],
    [
      'lead-in prose',
      'Here are the release notes:\n\n### Fixed\n\n- A thing',
      '### Fixed\n\n- A thing',
    ],
    ['a bare bullet list', '- A thing\n- Another', '- A thing\n- Another'],
    ['empty input', '', ''],
  ])('handles %s', (_label, input, expected) => {
    expect(cleanNotes(input)).toBe(expected);
  });

  it('keeps prose that follows the first heading', () => {
    expect(cleanNotes('### Added\n\nA sentence about it.\n\n- A thing')).toBe(
      '### Added\n\nA sentence about it.\n\n- A thing'
    );
  });
});
