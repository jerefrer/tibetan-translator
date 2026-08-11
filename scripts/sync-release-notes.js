#!/usr/bin/env node
/**
 * Push each CHANGELOG.md section to the body of its GitHub release.
 *
 *   node scripts/sync-release-notes.js            # dry run, changes nothing
 *   node scripts/sync-release-notes.js --apply    # actually edit the releases
 *
 * Only the release body is touched. Assets — including the updater's
 * latest.json — are left alone: they are written once at build time and are
 * not rewritten by an edit.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const { ROOT, sh, fail, publishedReleases } = require("./lib/github");
const { extractSection } = require("./lib/changelog-core");

const CHANGELOG_PATH = path.join(ROOT, "CHANGELOG.md");
const apply = process.argv.includes("--apply");

if (!fs.existsSync(CHANGELOG_PATH)) {
  fail("No CHANGELOG.md yet. Run `node scripts/generate-changelog.js --backfill` first.");
}
const changelog = fs.readFileSync(CHANGELOG_PATH, "utf8");

const currentBodyOf = (tag) => {
  try {
    return JSON.parse(sh(`gh release view ${tag} --json body`)).body || "";
  } catch {
    return null;
  }
};

const setBody = (tag, body) => {
  const result = spawnSync("gh", ["release", "edit", tag, "--notes-file", "-"], {
    input: body,
    encoding: "utf8",
    cwd: ROOT,
  });
  if (result.status !== 0) {
    throw new Error(String(result.stderr || "").trim() || `gh exited ${result.status}`);
  }
};

const preview = (body) => {
  const lines = body.split("\n").filter(Boolean);
  const head = lines.slice(0, 3).join(" / ");
  return lines.length > 3 ? `${head} … (+${lines.length - 3} lines)` : head;
};

const releases = publishedReleases().reverse(); // newest first, easier to read
const summary = { updated: 0, unchanged: 0, missing: 0, failed: 0 };

console.log(
  apply
    ? `Applying CHANGELOG.md to ${releases.length} GitHub releases.\n`
    : `Dry run over ${releases.length} GitHub releases — nothing will be modified.\n` +
        `Re-run with --apply to push these changes.\n`
);

for (const release of releases) {
  const body = extractSection(changelog, release.version);

  if (!body) {
    console.log(`  ⃠  ${release.tag.padEnd(14)} no CHANGELOG.md section — skipped`);
    summary.missing += 1;
    continue;
  }

  const current = currentBodyOf(release.tag);
  if (current !== null && current.trim() === body.trim()) {
    console.log(`  =  ${release.tag.padEnd(14)} already up to date`);
    summary.unchanged += 1;
    continue;
  }

  if (!apply) {
    console.log(`  →  ${release.tag.padEnd(14)} ${preview(body)}`);
    summary.updated += 1;
    continue;
  }

  try {
    setBody(release.tag, body);
    console.log(`  ✔  ${release.tag.padEnd(14)} updated`);
    summary.updated += 1;
  } catch (error) {
    console.log(`  ✖  ${release.tag.padEnd(14)} ${error.message}`);
    summary.failed += 1;
  }
}

console.log(
  `\n${apply ? "Updated" : "Would update"}: ${summary.updated} · ` +
    `unchanged: ${summary.unchanged} · no section: ${summary.missing}` +
    (summary.failed ? ` · failed: ${summary.failed}` : "")
);

if (summary.failed) process.exit(1);
