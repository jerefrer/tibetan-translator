#!/usr/bin/env node
/**
 * Writes src/config/audio-manifest.json from the recordings in public/audio.
 *
 * The app does not ship the recordings: it streams them from GitHub and can
 * download a dictionary's set for offline use, which needs the file list.
 * Run after adding or changing recordings: `pnpm build:audio-manifest`.
 */

const fs = require('fs');
const path = require('path');
const { buildAudioManifest } = require('./lib/audio-manifest');

const AUDIO_DIR = path.join(__dirname, '..', 'public', 'audio');
const OUTPUT = path.join(__dirname, '..', 'src', 'config', 'audio-manifest.json');

const entriesByAudioId = {};
for (const audioId of fs.readdirSync(AUDIO_DIR)) {
  const dir = path.join(AUDIO_DIR, audioId);
  if (!fs.statSync(dir).isDirectory()) continue;
  entriesByAudioId[audioId] = fs.readdirSync(dir).map((name) => ({
    name,
    size: fs.statSync(path.join(dir, name)).size,
  }));
}

const manifest = buildAudioManifest(entriesByAudioId);
fs.writeFileSync(OUTPUT, `${JSON.stringify(manifest)}\n`);

for (const [audioId, { files, bytes }] of Object.entries(manifest)) {
  console.log(`${audioId}: ${files.length} recordings, ${Math.round(bytes / 1048576)} MB`);
}
