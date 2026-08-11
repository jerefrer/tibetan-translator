#!/usr/bin/env node
/**
 * Fail the build when a release's latest.json does not cover every platform.
 *
 *   node scripts/check-updater-manifest.js v1.9.2
 *
 * Run after the build matrix. Needs `gh` authenticated, which it is inside the
 * workflow via GITHUB_TOKEN.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync, execSync } = require("child_process");

const {
  REQUIRED_PLATFORMS,
  missingPlatforms,
  describeManifest,
} = require("./lib/updater-manifest");

// Release assets can lag briefly behind the upload that created them, so a
// single 404 is not proof the manifest is absent.
const ATTEMPTS = 5;
const DELAY_MS = 10000;

const tag = process.argv[2];
if (!tag) {
  console.error("Usage: check-updater-manifest.js <tag>");
  process.exit(1);
}

const sleep = (ms) => {
  // Synchronous so the retry loop stays flat and readable in a CI log.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};

const downloadManifest = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "updater-manifest-"));
  const target = path.join(dir, "latest.json");

  const result = spawnSync(
    "gh",
    ["release", "download", tag, "--pattern", "latest.json", "--output", target, "--clobber"],
    { encoding: "utf8" }
  );

  if (result.status !== 0) {
    return { error: String(result.stderr || "").trim() || `gh exited ${result.status}` };
  }
  return { manifest: JSON.parse(fs.readFileSync(target, "utf8")) };
};

let manifest = null;
let lastError = null;

for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
  const outcome = downloadManifest();
  if (outcome.manifest) {
    manifest = outcome.manifest;
    break;
  }
  lastError = outcome.error;
  console.log(`latest.json not readable yet (attempt ${attempt}/${ATTEMPTS}): ${lastError}`);
  if (attempt < ATTEMPTS) sleep(DELAY_MS);
}

if (!manifest) {
  console.error(`\n✖ Could not read latest.json from release ${tag}.\n  ${lastError}`);
  console.error("  The updater cannot offer this release to anyone.");
  process.exit(1);
}

console.log(describeManifest(manifest));

const missing = missingPlatforms(manifest);
if (missing.length === 0) {
  console.log(`\n✔ latest.json covers all ${REQUIRED_PLATFORMS.length} platforms.`);
  process.exit(0);
}

// Surfaced in the run summary, not just buried in the step log.
console.error(
  `::error::latest.json for ${tag} is missing ${missing.join(", ")}. ` +
    "Those platforms will not be offered the update. Re-run the matching " +
    "matrix job, which merges its entry into the existing manifest."
);
process.exit(1);
