/**
 * Pure changelog helpers: parsing, filtering and CHANGELOG.md surgery.
 *
 * Everything here is free of I/O so it can be tested directly. The git, gh,
 * claude and editor calls live in ../generate-changelog.js.
 */

// Field separator used in the `git log --pretty` format. Chosen because it
// cannot appear in a commit subject.
const FIELD_SEP = "\x1f";

// Conventional-commit types whose commits never change anything a user can
// perceive. Types outside this list (feat, fix, perf, style, ...) are kept.
const NOISE_TYPES = ["chore", "docs", "test", "refactor", "build", "ci"];

const CONVENTIONAL_PREFIX = /^([a-z]+)(\([^)]*\))?!?:\s*/i;

/** Turn raw `git log` output into commit records. */
const parseCommits = (rawLog) =>
  String(rawLog || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const sep = line.indexOf(FIELD_SEP);
      if (sep === -1) return null;
      const subject = line.slice(sep + 1).trim();
      if (!subject) return null;
      return { hash: line.slice(0, sep).trim(), subject };
    })
    .filter(Boolean);

/**
 * True when a commit is invisible to end users on prefix evidence alone.
 *
 * This only catches what can be decided mechanically. Commits predating the
 * conventional-commit convention carry no prefix, so they fall through to the
 * model, which drops the ones a user cannot perceive.
 */
const isNoiseCommit = (subject) => {
  const text = String(subject || "").trim();
  if (!text) return true;
  if (/^bumps? to\s/i.test(text)) return true;
  if (/^merge\b/i.test(text)) return true;

  const match = text.match(CONVENTIONAL_PREFIX);
  return Boolean(match && NOISE_TYPES.includes(match[1].toLowerCase()));
};

const filterCommits = (commits) =>
  commits.filter((commit) => !isNoiseCommit(commit.subject));

/** Render one Keep a Changelog block. */
const renderSection = ({ version, date, body, compareUrl }) => {
  const heading = compareUrl
    ? `## [${version}](${compareUrl}) - ${date}`
    : `## [${version}] - ${date}`;
  return `${heading}\n\n${String(body).trim()}\n`;
};

const escapeForRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Matches a `## [version]...` heading, with or without a compare link. */
const headingPatternFor = (version) =>
  new RegExp(`^## \\[${escapeForRegex(version)}\\](\\([^)]*\\))? `, "m");

const NEXT_HEADING = /^## \[/m;

/**
 * Insert a section below the preamble. When a section for the same version is
 * already present it is replaced in place, so re-running is idempotent.
 */
const insertSection = (changelog, section, version) => {
  const content = String(changelog || "");
  const block = `${section.trimEnd()}\n`;
  const existing = content.match(headingPatternFor(version));

  if (existing) {
    const start = existing.index;
    const rest = content.slice(start + existing[0].length);
    const next = rest.match(NEXT_HEADING);
    const end =
      next === null
        ? content.length
        : start + existing[0].length + next.index;
    return `${content.slice(0, start)}${block}\n${content.slice(end)}`.trimEnd() + "\n";
  }

  const firstHeading = content.match(NEXT_HEADING);
  if (firstHeading === null) {
    return `${content.trimEnd()}\n\n${block}`.replace(/^\n+/, "");
  }
  const head = content.slice(0, firstHeading.index);
  const tail = content.slice(firstHeading.index);
  return `${head.trimEnd()}\n\n${block}\n${tail}`;
};

/** Pull one version's body back out, for the release workflow. */
const extractSection = (changelog, version) => {
  const content = String(changelog || "");
  const heading = content.match(headingPatternFor(version));
  if (!heading) return "";

  const afterHeadingLine = content.indexOf("\n", heading.index);
  if (afterHeadingLine === -1) return "";

  const rest = content.slice(afterHeadingLine + 1);
  const next = rest.match(NEXT_HEADING);
  return (next === null ? rest : rest.slice(0, next.index)).trim();
};

/**
 * Strip everything the model may wrap around the markdown we asked for: code
 * fences, and any lead-in prose before the first heading or bullet.
 */
const cleanNotes = (raw) => {
  let text = String(raw || "").trim();

  const fenced = text.match(/^```(?:markdown|md)?\n([\s\S]*?)\n?```$/);
  if (fenced) text = fenced[1].trim();

  const lines = text.split("\n");
  const firstContent = lines.findIndex((line) =>
    /^\s*(###?#?\s|[-*]\s)/.test(line)
  );
  if (firstContent > 0) text = lines.slice(firstContent).join("\n");

  return text.trim();
};

module.exports = {
  FIELD_SEP,
  NOISE_TYPES,
  parseCommits,
  isNoiseCommit,
  filterCommits,
  renderSection,
  insertSection,
  extractSection,
  cleanNotes,
};
