/**
 * Checks that the updater manifest covers every platform the build matrix
 * produces.
 *
 * Each matrix job uploads its own entries into the release's latest.json and
 * merges with what is already there. A job that dies after uploading its
 * binaries but before writing its entry leaves a release that looks complete —
 * every asset is present — while the updater silently stops offering updates to
 * that platform. This turns that into a loud failure.
 *
 * Pure and I/O-free so it can be tested; the download lives in
 * ../check-updater-manifest.js.
 */

/**
 * Platform keys the updater needs, one per matrix entry in
 * .github/workflows/build.yml. Keep in sync when the matrix changes.
 *
 * Only the canonical keys are required. Tauri also emits format variants
 * (`-app`, `-msi`, `-nsis`, `-deb`, `-rpm`, `-appimage`) which depend on the
 * bundles configured per platform and are not a completeness signal.
 */
const REQUIRED_PLATFORMS = [
  "darwin-aarch64",
  "darwin-x86_64",
  "linux-x86_64",
  "windows-x86_64",
];

/**
 * @param {object} manifest Parsed latest.json.
 * @param {string[]} [required] Platform keys to demand.
 * @returns {string[]} The missing keys, in the order they were required.
 */
const missingPlatforms = (manifest, required = REQUIRED_PLATFORMS) => {
  const present = manifest && manifest.platforms ? Object.keys(manifest.platforms) : [];
  return required.filter((platform) => !present.includes(platform));
};

/** Human-readable outcome, for the workflow log. */
const describeManifest = (manifest, required = REQUIRED_PLATFORMS) => {
  const present = manifest && manifest.platforms ? Object.keys(manifest.platforms).sort() : [];
  const missing = missingPlatforms(manifest, required);

  const lines = [
    `version: ${(manifest && manifest.version) || "unknown"}`,
    `platforms present (${present.length}):`,
    ...present.map((platform) => `  - ${platform}`),
  ];

  if (missing.length) {
    lines.push(`MISSING (${missing.length}):`, ...missing.map((p) => `  - ${p}`));
  }

  return lines.join("\n");
};

module.exports = { REQUIRED_PLATFORMS, missingPlatforms, describeManifest };
