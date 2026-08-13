#!/usr/bin/env node
/**
 * Generate user-facing release notes into CHANGELOG.md.
 *
 *   node scripts/generate-changelog.js --next 1.9.2
 *       Collect commits since the last published release, have Claude write the
 *       notes, insert them at the top of CHANGELOG.md and open $EDITOR for
 *       review. Exits non-zero if the section comes back empty, which aborts
 *       the release chain in package.json.
 *
 *   node scripts/generate-changelog.js --backfill
 *       Rebuild the whole file from every published GitHub release. One-off.
 *
 * The prose comes from `claude -p`; everything deterministic lives in
 * lib/changelog-core.js and is covered by tests/changelog.test.js.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const {
  FIELD_SEP,
  parseCommits,
  filterCommits,
  renderSection,
  insertSection,
  extractSection,
  cleanNotes,
} = require("./lib/changelog-core");
const { ROOT, sh, fail: die, repoUrl, publishedReleases } = require("./lib/github");

const CHANGELOG_PATH = path.join(ROOT, "CHANGELOG.md");
const NOTHING_MARKER = "NO_USER_VISIBLE_CHANGES";

const PREAMBLE = `# Changelog

All notable changes to Tibetan Translator are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
`;

// -------------------------------------------------------------------- commits

const commitsIn = (range) => {
  const spec = range ? `${range} ` : "";
  const raw = sh(`git log --no-merges --pretty=format:%h${FIELD_SEP}%s ${spec}--`);
  return filterCommits(parseCommits(raw));
};

// --------------------------------------------------------------------- claude

const promptFor = (version, commits) => `You are writing release notes for Tibetan Translator, a desktop and mobile
dictionary app for Tibetan. Its users are translators, students and Buddhist
practitioners. They are not programmers, and most of them will read these notes
inside the app's update prompt.

Below are the commit subjects that went into version ${version}.

Write the release notes in English, as Markdown, following these rules:

- Group bullets under "### Added", "### Changed" and "### Fixed". Omit any
  group that would be empty. Use "### Removed" only if something really was
  taken away.
- One bullet per user-visible change.
- Never repeat the heading's verb in the bullet. The heading already says it.
  Under "### Added", name the thing that now exists: "Copy buttons on every
  definition", not "Added copy buttons".
  Under "### Fixed", describe how it behaves now: "Scan downloads no longer
  save to the wrong folder", not "Fixed scan downloads saving to the wrong
  folder".
  Under "### Changed", describe the new state, not the act of changing it.
- No trailing full stop at the end of a bullet.
- Describe what changed for the person using the app, never how it was built.
  Never mention file names, function names, commit scopes, internal refactors,
  tests, dependencies or CI.
- Silently drop every commit a user could not possibly notice.
- Fold several commits describing the same user-facing change into one bullet.
- At most three bullets per group. A release that touched a lot of code is
  still only a few things from the outside: fold the small ones into the bullet
  they belong with instead of listing them separately.
- About twenty words per bullet. If a bullet needs a comma-separated list to
  stay accurate, it is too detailed — name the thing once and stop.
- Never list file formats, extensions, or every place a feature can be reached
  from. "Import your dictionaries from a spreadsheet" is enough; the reader
  will find the button.
- Say what the reader can now do, not how the app pulls it off. "It works out
  which column is which on its own" is what they get; "automatic detection of
  the header row and the term and definition columns" is machinery, and reads
  like a specification.
- Write it the way you would tell a friend what is new — plain and warm, no
  marketing, no exclamation marks.
- Keep it tight. No preamble, no closing remarks, no code fences.
- If nothing in the list is user-visible, output exactly: ${NOTHING_MARKER}

Commits:
${commits.map((commit) => `- ${commit.subject}`).join("\n")}
`;

const askClaude = (version, commits) => {
  const result = spawnSync(
    "claude",
    ["-p", "--model", "sonnet", "--output-format", "text"],
    {
      input: promptFor(version, commits),
      encoding: "utf8",
      // Run outside the repo so the model has no tree to wander into and no
      // project instructions to absorb: this is a pure writing task.
      cwd: os.tmpdir(),
      maxBuffer: 16 * 1024 * 1024,
    }
  );

  if (result.error && result.error.code === "ENOENT") {
    die("The `claude` CLI is not on PATH. Install Claude Code or run the bump without notes.");
  }
  if (result.status !== 0) {
    die(`claude exited with code ${result.status}.\n${String(result.stderr || "").trim()}`);
  }

  return cleanNotes(result.stdout);
};

// ------------------------------------------------------------------ changelog

const readChangelog = () =>
  fs.existsSync(CHANGELOG_PATH) ? fs.readFileSync(CHANGELOG_PATH, "utf8") : PREAMBLE;

/** A section holding only whitespace or HTML comments counts as empty. */
const isBlank = (body) =>
  body.replace(/<!--[\s\S]*?-->/g, "").trim().length === 0;

const resolveEditor = () => {
  if (process.env.VISUAL) return process.env.VISUAL;
  if (process.env.EDITOR) return process.env.EDITOR;
  try {
    const configured = sh("git config --get core.editor");
    if (configured) return configured;
  } catch {
    // git exits non-zero when the key is unset; fall through to the default.
  }
  return "vi";
};

/** Returns null on success, or a message describing why the edit failed. */
const openEditor = () => {
  const editor = resolveEditor();
  console.log(`\nOpening ${editor} on CHANGELOG.md — save and quit when you are happy.\n`);
  const result = spawnSync(editor, [CHANGELOG_PATH], { stdio: "inherit", shell: true });
  if (result.error) return `Could not start ${editor}: ${result.error.message}`;
  if (result.status !== 0) return `${editor} exited with code ${result.status}.`;
  return null;
};

// ---------------------------------------------------------------------- modes

const runNext = (version) => {
  const releases = publishedReleases().filter((release) => release.version !== version);
  const previous = releases[releases.length - 1];
  const range = previous ? `${previous.tag}..HEAD` : "";

  console.log(
    previous
      ? `Collecting commits since ${previous.tag} (${previous.version})…`
      : "No published release found; collecting the full history…"
  );

  const commits = commitsIn(range);
  if (commits.length === 0) {
    die("No user-facing commits since the last release. Nothing to release.");
  }
  console.log(`${commits.length} candidate commit(s). Asking Claude to write the notes…`);

  const notes = askClaude(version, commits);
  const body =
    notes === NOTHING_MARKER || !notes
      ? `<!-- Claude found nothing user-visible in ${commits.length} commit(s).\n     Write the notes by hand, or leave this empty to abort the release. -->`
      : notes;

  const section = renderSection({
    version,
    date: new Date().toISOString().slice(0, 10),
    body,
    compareUrl: previous ? `${repoUrl()}/compare/${previous.tag}...v${version}` : undefined,
  });

  // Keep the pre-existing file so an aborted review leaves the tree untouched.
  const before = fs.existsSync(CHANGELOG_PATH)
    ? fs.readFileSync(CHANGELOG_PATH, "utf8")
    : null;
  const restore = () => {
    if (before === null) fs.rmSync(CHANGELOG_PATH, { force: true });
    else fs.writeFileSync(CHANGELOG_PATH, before);
  };

  fs.writeFileSync(CHANGELOG_PATH, insertSection(readChangelog(), section, version));

  const editorFailure = openEditor();
  if (editorFailure) {
    restore();
    die(`${editorFailure} Release aborted — CHANGELOG.md is back to its previous state.`);
  }

  const reviewed = extractSection(fs.readFileSync(CHANGELOG_PATH, "utf8"), version);
  if (isBlank(reviewed)) {
    restore();
    die(
      `The ${version} section is empty. Release aborted — nothing was bumped, ` +
        `committed or tagged, and CHANGELOG.md is back to its previous state.`
    );
  }

  console.log(`\n✔ CHANGELOG.md updated for ${version}.\n`);
};

const runBackfill = () => {
  console.log("Fetching tags…");
  sh("git fetch --tags --quiet");

  const releases = publishedReleases();
  if (releases.length === 0) die("No published releases found.");

  const url = repoUrl();
  const sections = [];

  releases.forEach((release, index) => {
    const previous = releases[index - 1];
    const range = previous ? `${previous.tag}..${release.tag}` : release.tag;
    const commits = commitsIn(range);

    console.log(
      `[${index + 1}/${releases.length}] ${release.version} — ${commits.length} commit(s)`
    );

    let body = "- Maintenance and internal improvements.";
    if (commits.length > 0) {
      const notes = askClaude(release.version, commits);
      if (notes && notes !== NOTHING_MARKER) body = notes;
    }

    sections.push(
      renderSection({
        version: release.version,
        date: release.date,
        body,
        compareUrl: previous ? `${url}/compare/${previous.tag}...${release.tag}` : undefined,
      })
    );
  });

  fs.writeFileSync(CHANGELOG_PATH, `${PREAMBLE}\n${sections.reverse().join("\n")}`);
  console.log(`\n✔ CHANGELOG.md rebuilt from ${releases.length} releases.\n`);
};

// ----------------------------------------------------------------------- main

const args = process.argv.slice(2);

if (args.includes("--backfill")) {
  runBackfill();
} else {
  const index = args.indexOf("--next");
  const version = index === -1 ? null : args[index + 1];
  if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
    die("Usage: generate-changelog.js --next <version> | --backfill");
  }
  runNext(version);
}
