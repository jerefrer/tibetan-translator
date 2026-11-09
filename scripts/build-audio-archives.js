#!/usr/bin/env node
/**
 * Zips each dictionary's recordings from public/audio into build/audio-archives
 * and writes src/config/audio-manifest.json (count and archive size of each).
 *
 * The app does not ship the recordings: it streams them one at a time from
 * GitHub, and downloads a dictionary's archive for offline listening. Run after
 * adding or changing recordings, `pnpm build:audio`, then upload the archives
 * to the `dictionary-packs` release (see AUDIO_ARCHIVE_BASE in
 * src/services/audio-service.js).
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { listRecordings, buildAudioManifest } = require('./lib/audio-manifest');

const ROOT = path.join(__dirname, '..');
const AUDIO_DIR = path.join(ROOT, 'public', 'audio');
const ARCHIVE_DIR = path.join(ROOT, 'build', 'audio-archives');
const MANIFEST = path.join(ROOT, 'src', 'config', 'audio-manifest.json');

fs.mkdirSync(ARCHIVE_DIR, { recursive: true });

const recordingsByAudioId = {};
const archiveBytesByAudioId = {};
for (const audioId of fs.readdirSync(AUDIO_DIR)) {
  const dir = path.join(AUDIO_DIR, audioId);
  if (!fs.statSync(dir).isDirectory()) continue;
  const recordings = listRecordings(fs.readdirSync(dir));
  recordingsByAudioId[audioId] = recordings;
  if (!recordings.length) continue;

  // Stored, not deflated: mp3 does not compress, and storing keeps the
  // extraction on the phone fast. -X leaves out file attributes.
  const archive = path.join(ARCHIVE_DIR, `${audioId}.zip`);
  fs.rmSync(archive, { force: true });
  execFileSync('zip', ['-0', '-X', '-q', archive, ...recordings], { cwd: dir });
  archiveBytesByAudioId[audioId] = fs.statSync(archive).size;
}

const manifest = buildAudioManifest(recordingsByAudioId, archiveBytesByAudioId);
fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

for (const [audioId, { count, bytes }] of Object.entries(manifest)) {
  console.log(`${audioId}.zip: ${count} recordings, ${Math.round(bytes / 1048576)} MB`);
}
console.log(`Archives in ${path.relative(ROOT, ARCHIVE_DIR)}/`);
