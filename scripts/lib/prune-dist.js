/**
 * Removes from the build output what Vite copied from public/ but the
 * installed app never loads.
 *
 * Tauri embeds the whole of `frontendDist` in the app binary, so everything
 * left in dist/ ships to every user: before this, desktop installers carried
 * about 390 MB and the Android bundle 833 MB, over Google Play's limit.
 *
 * - packs/: the core pack ships as a bundle resource and the optional packs
 *   download from the `dictionary-packs` GitHub release, never from here.
 * - TibetanTranslator.sqlite, database.7z.*: the full database of the
 *   browser build, which is not published (see DECISIONS.md).
 * - audio/: the recordings stream from GitHub or are downloaded from Settings
 *   (src/services/audio-service.js).
 *
 * `pnpm dev` serves public/ directly and is unaffected.
 */

const fs = require('fs');
const path = require('path');

const UNUSED_IN_APP = [
  'audio',
  'packs',
  'TibetanTranslator.sqlite',
  'database.7z.001',
  'database.7z.002',
];

/**
 * @param {string} outDir - the Vite build output directory
 * @returns {string[]} the entries that were removed
 */
function pruneDist(outDir) {
  const removed = [];
  for (const entry of UNUSED_IN_APP) {
    const target = path.join(outDir, entry);
    if (!fs.existsSync(target)) continue;
    fs.rmSync(target, { recursive: true, force: true });
    removed.push(entry);
  }
  return removed;
}

module.exports = { pruneDist, UNUSED_IN_APP };
