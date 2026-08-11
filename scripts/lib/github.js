/**
 * Shared GitHub/git lookups for the release scripts.
 *
 * Kept apart from changelog-core.js, which stays free of I/O so it can be
 * tested directly.
 */

const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..", "..");

const sh = (command) =>
  execSync(command, { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }).trim();

const fail = (message) => {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
};

/** `https://github.com/owner/repo`, parsed from the origin remote. */
const repoUrl = () => {
  const remote = sh("git remote get-url origin");
  const match = remote.match(/github\.com[:/](.+?)(?:\.git)?$/);
  if (!match) fail(`Cannot parse a GitHub repository out of the origin remote: ${remote}`);
  return `https://github.com/${match[1]}`;
};

/** `app-v1.9.1` and `v1.9.1` both yield `1.9.1`. */
const versionOfTag = (tag) => tag.replace(/^app-v/, "").replace(/^v/, "");

const compareSemver = (a, b) => {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
};

/**
 * Published releases that map to a version, oldest first.
 *
 * Both tag schemes are accepted: the oldest releases sit on `v*`, the ones
 * created while `tagName: app-v__VERSION__` was in the workflow sit on `app-v*`.
 */
const publishedReleases = () => {
  let raw;
  try {
    raw = sh("gh release list --limit 200 --json tagName,publishedAt,isDraft");
  } catch (error) {
    fail(
      "`gh release list` failed. Run `gh auth login` first.\n" +
        String(error.stderr || error.message).trim()
    );
  }

  return JSON.parse(raw)
    .filter((release) => !release.isDraft)
    .filter((release) => /^(app-)?v\d+\.\d+\.\d+$/.test(release.tagName))
    .map((release) => ({
      tag: release.tagName,
      version: versionOfTag(release.tagName),
      date: release.publishedAt.slice(0, 10),
    }))
    .sort((a, b) => compareSemver(a.version, b.version));
};

module.exports = { ROOT, sh, fail, repoUrl, versionOfTag, compareSemver, publishedReleases };
