#!/usr/bin/env node
/**
 * Print one version's CHANGELOG.md section on stdout.
 *
 *   node scripts/extract-release-notes.js 1.9.2
 *
 * Used by .github/workflows/build.yml to feed `releaseBody`, which tauri-action
 * also writes into the updater's latest.json. Prints nothing when the version
 * has no section, letting the caller fall back to a default.
 */

const fs = require("fs");
const path = require("path");

const { extractSection } = require("./lib/changelog-core");

const version = process.argv[2];
if (!version) {
  console.error("Usage: extract-release-notes.js <version>");
  process.exit(1);
}

const changelogPath = path.join(__dirname, "..", "CHANGELOG.md");
if (!fs.existsSync(changelogPath)) process.exit(0);

process.stdout.write(extractSection(fs.readFileSync(changelogPath, "utf8"), version));
