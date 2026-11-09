/**
 * Builds the description of the recordings the app can download for offline
 * use: one archive per dictionary, with its number of recordings and size.
 *
 * Free of I/O so it can be tested directly; ../build-audio-archives.js reads
 * public/audio, zips each folder and writes src/config/audio-manifest.json.
 */

/**
 * @param {string[]} names - the entries of one public/audio/<audioId> folder
 * @returns {string[]} its recordings, sorted
 */
function listRecordings(names) {
  return names.filter((name) => name.endsWith('.mp3') && !name.startsWith('.')).sort();
}

/**
 * @param {Object<string, string[]>} recordingsByAudioId
 * @param {Object<string, number>} archiveBytesByAudioId
 * @returns {Object<string, {count: number, bytes: number}>}
 */
function buildAudioManifest(recordingsByAudioId, archiveBytesByAudioId) {
  const manifest = {};
  for (const [audioId, recordings] of Object.entries(recordingsByAudioId)) {
    if (!recordings.length) continue;
    manifest[audioId] = { count: recordings.length, bytes: archiveBytesByAudioId[audioId] };
  }
  return manifest;
}

module.exports = { listRecordings, buildAudioManifest };
