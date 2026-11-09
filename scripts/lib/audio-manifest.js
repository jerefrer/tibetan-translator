/**
 * Builds the list of recordings the app can download for offline use.
 *
 * Free of I/O so it can be tested directly; ../build-audio-manifest.js reads
 * public/audio and writes the result to src/config/audio-manifest.json.
 */

/**
 * @param {Object<string, {name: string, size: number}[]>} entriesByAudioId
 *   the directory entries of each public/audio/<audioId> folder
 * @returns {Object<string, {files: string[], bytes: number}>}
 */
function buildAudioManifest(entriesByAudioId) {
  const manifest = {};
  for (const [audioId, entries] of Object.entries(entriesByAudioId)) {
    const recordings = entries.filter(
      (entry) => entry.name.endsWith('.mp3') && !entry.name.startsWith('.'),
    );
    if (!recordings.length) continue;
    manifest[audioId] = {
      files: recordings.map((entry) => entry.name).sort(),
      bytes: recordings.reduce((sum, entry) => sum + entry.size, 0),
    };
  }
  return manifest;
}

module.exports = { buildAudioManifest };
