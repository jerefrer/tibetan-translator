#!/usr/bin/env node

/**
 * Dictionary Sync Script
 *
 * Syncs dictionaries from christiansteinert/tibetan-dictionary repository.
 *
 * Usage:
 *   node scripts/sync-dictionaries.mjs
 *   pnpm sync:dictionaries
 *
 * Options:
 *   --dry-run    Show what would be changed without making changes
 *   --rebuild    Automatically rebuild database after sync
 *
 * Upstream renames some dictionaries (it dropped the commas and apostrophes
 * from filenames). We keep our own names, because pack definitions, stored
 * settings and dictionary ids all depend on them, so a rename upstream is
 * reported but never creates a duplicate. Dictionaries we added ourselves, or
 * that upstream removed, are left alone.
 */

import { execSync } from 'child_process';
import { createHash } from 'crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { PACK_DEFINITIONS } from '../build/config/pack-dictionaries.js';
import {
  applyOverrides,
  diffDetails,
  isIgnored,
  matchLocalName,
  mergeOverrides,
  parseAbbreviations,
  parseDictlist,
  remapKeys,
} from './lib/dictionary-sync-core.js';
import { KEYWORDS } from './lib/dictionary-keywords.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPO_URL = 'https://github.com/christiansteinert/tibetan-dictionary.git';
const REPO_BRANCH = 'master';
const TEMP_DIR = join(__dirname, '../.dict-sync-temp');
const DICT_DIR = join(__dirname, '../build/dictionaries');
const CHANGELOG_FILE = join(__dirname, '../build/dictionaries-changelog.json');
const DETAILS_FILE = join(__dirname, '../src/services/dictionaries-details.js');
const ABBREVIATIONS_FILE = join(
  __dirname,
  '../src/services/dictionaries-abbreviations-list.js'
);

// Dictionary source paths within the christiansteinert repo
const DICT_SOURCE_PATHS = ['_input/dictionaries/public'];

// Settings files in the christiansteinert repo
const DICTLIST_SOURCE = 'webapp/src/config/dictlist.ts';
const ABBREVIATIONS_SOURCE = 'webapp/src/config/abbreviations.ts';

// Audio files
const AUDIO_SOURCE_PATH = 'backend/audio';

// Upstream dictionaries we choose not to ship.
const IGNORED_DICTIONARIES = [
  // A single entry ("Definitions by Jongbok Yi"), nothing worth a dictionary
  'JongbokYi',
];

// Where we deliberately differ from upstream's metadata, re-applied on every
// sync. `undefined` removes the field.
const LOCAL_DETAIL_OVERRIDES = mergeOverrides(
  {
    // Upstream hides its scanned dictionaries outside the web app. Ours work
    // offline (see scan-service.js), so they must not carry the flag.
    'ChandraDas_Scan': { webOnly: undefined },
    'Jaeschke_Scan': { webOnly: undefined },
    'Mahavyutpatti-Scan-1989': { webOnly: undefined },
    'sgra-sbyor-bam-po-gnyis-pa': { webOnly: undefined },
  },
  // Subject tags for the catalog (see lib/dictionary-keywords.js)
  Object.fromEntries(
    Object.entries(KEYWORDS).map(([name, keywords]) => [name, { keywords }])
  )
);

// The only parts of the repo we read. The rest (old releases, scans, the other
// dictionary folders) is over a gigabyte we have no use for.
const SPARSE_PATHS = [
  ...DICT_SOURCE_PATHS,
  'webapp/src/config',
  AUDIO_SOURCE_PATH,
];
const AUDIO_DEST_DIR = join(__dirname, '../public/audio');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const shouldRebuild = args.includes('--rebuild');

function log(message, type = 'info') {
  const prefix = {
    info: '\x1b[36mℹ\x1b[0m',
    success: '\x1b[32m✓\x1b[0m',
    warning: '\x1b[33m⚠\x1b[0m',
    error: '\x1b[31m✗\x1b[0m',
    change: '\x1b[35m→\x1b[0m',
  };
  console.log(`${prefix[type] || prefix.info} ${message}`);
}

function hashFile(filePath) {
  try {
    const content = readFileSync(filePath);
    return createHash('sha256').update(content).digest('hex');
  } catch {
    return null;
  }
}

function getExistingDictionaries() {
  if (!existsSync(DICT_DIR)) {
    return {};
  }

  const files = readdirSync(DICT_DIR);
  const dictionaries = {};

  for (const file of files) {
    const filePath = join(DICT_DIR, file);
    const stat = statSync(filePath);
    if (stat.isFile()) {
      dictionaries[file] = {
        path: filePath,
        hash: hashFile(filePath),
        size: stat.size,
      };
    }
  }

  return dictionaries;
}

function cloneOrPullRepo() {
  if (existsSync(TEMP_DIR)) {
    log('Updating existing repository clone...');
    try {
      execSync(`git -C "${TEMP_DIR}" fetch origin`, { stdio: 'pipe' });
      execSync(`git -C "${TEMP_DIR}" reset --hard origin/${REPO_BRANCH}`, {
        stdio: 'pipe',
      });
      // Idempotent, and picks up folders added to SPARSE_PATHS since the clone
      setSparsePaths();
      log('Repository updated', 'success');
    } catch (error) {
      log('Failed to update, re-cloning...', 'warning');
      rmSync(TEMP_DIR, { recursive: true, force: true });
      cloneRepo();
    }
  } else {
    cloneRepo();
  }
}

function setSparsePaths() {
  execSync(
    `git -C "${TEMP_DIR}" sparse-checkout set ${SPARSE_PATHS.map((p) => `"${p}"`).join(' ')}`,
    { stdio: 'pipe' }
  );
}

function cloneRepo() {
  log(`Cloning ${REPO_URL} (sparse checkout)...`);
  try {
    mkdirSync(TEMP_DIR, { recursive: true });
    execSync(
      `git clone --depth 1 --branch ${REPO_BRANCH} --filter=blob:none --sparse "${REPO_URL}" "${TEMP_DIR}"`,
      { stdio: 'pipe' }
    );
    setSparsePaths();
    log('Repository cloned (dictionaries, config and audio only)', 'success');
  } catch (error) {
    log(`Failed to clone repository: ${error.message}`, 'error');
    process.exit(1);
  }
}

function findDictionaryFiles() {
  const dictFiles = [];

  // Try each possible source path
  for (const sourcePath of DICT_SOURCE_PATHS) {
    const fullPath = join(TEMP_DIR, sourcePath);
    if (existsSync(fullPath)) {
      try {
        const files = readdirSync(fullPath);
        for (const file of files) {
          const filePath = join(fullPath, file);
          const stat = statSync(filePath);
          // Dictionary files are typically plain text without extensions or with .txt
          if (stat.isFile() && !file.startsWith('.') && !file.endsWith('.md')) {
            // Check if it looks like a dictionary file (starts with NN- pattern or has dictionary-like content)
            if (
              /^\d{2}-/.test(file) ||
              file.includes('Dictionary') ||
              file.includes('dict')
            ) {
              dictFiles.push({
                name: file,
                sourcePath: filePath,
                hash: hashFile(filePath),
                size: stat.size,
              });
            }
          }
        }
      } catch {
        // Continue to next path
      }
    }
  }

  return dictFiles;
}

function compareAndSync(existing, source) {
  const changes = {
    added: [],
    updated: [],
    unchanged: [],
    renamed: [],
    missingUpstream: [],
  };

  const localNames = Object.keys(existing);
  const claimed = new Set();

  for (const upstream of source) {
    if (isIgnored(upstream.name, IGNORED_DICTIONARIES)) continue;

    // From here on `name` is the local name, so a rename upstream updates the
    // file we already have instead of adding a second copy under the new name.
    const localName = matchLocalName(upstream.name, localNames);
    const dict = { ...upstream, name: localName || upstream.name };

    if (localName && localName !== upstream.name) {
      changes.renamed.push({ from: upstream.name, to: localName });
    }
    if (claimed.has(dict.name)) {
      log(`Two upstream files match ${dict.name}, skipping ${upstream.name}`, 'warning');
      continue;
    }
    claimed.add(dict.name);

    const existingDict = existing[dict.name];
    if (!existingDict) {
      changes.added.push(dict);
    } else if (existingDict.hash !== dict.hash) {
      changes.updated.push({
        ...dict,
        oldHash: existingDict.hash,
        oldSize: existingDict.size,
      });
    } else {
      changes.unchanged.push(dict);
    }
  }

  // Ours alone: added by us, or removed upstream. Reported, never deleted.
  changes.missingUpstream = localNames.filter((name) => !claimed.has(name));

  return changes;
}

function applyChanges(changes) {
  if (!existsSync(DICT_DIR)) {
    mkdirSync(DICT_DIR, { recursive: true });
  }

  for (const dict of changes.added) {
    const destPath = join(DICT_DIR, dict.name);
    log(`Adding: ${dict.name} (${formatSize(dict.size)})`, 'change');
    if (!isDryRun) {
      copyFileSync(dict.sourcePath, destPath);
    }
  }

  for (const dict of changes.updated) {
    const destPath = join(DICT_DIR, dict.name);
    const sizeDiff = dict.size - dict.oldSize;
    const sizeChange =
      sizeDiff > 0 ? `+${formatSize(sizeDiff)}` : formatSize(sizeDiff);
    log(`Updating: ${dict.name} (${sizeChange})`, 'change');
    if (!isDryRun) {
      copyFileSync(dict.sourcePath, destPath);
    }
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Read the default export of one of our generated `export default {...}`
 * modules without importing it, which would print a module-type warning.
 */
function readGeneratedModule(path) {
  if (!existsSync(path)) return {};
  const source = readFileSync(path, 'utf-8').replace('export default', 'return');
  return new Function(source)();
}

function describeDiff(label, diff) {
  const parts = [
    ['added', diff.added],
    ['changed', diff.changed],
    ['not in upstream, kept', diff.removed],
  ];
  for (const [what, keys] of parts) {
    if (keys.length) log(`${label} ${what}: ${keys.join(', ')}`, 'change');
  }
}

/**
 * Parse upstream's dictlist.ts and write dictionaries-details.js.
 *
 * Upstream keys are renamed to our local dictionary names, and entries that
 * only exist here (dictionaries we added ourselves) are carried over untouched.
 *
 * @param {string[]} localFiles dictionary filenames present after the sync
 * @returns {boolean} whether the details file differs from what it was
 */
function syncDictionariesDetails(localFiles) {
  const sourcePath = join(TEMP_DIR, DICTLIST_SOURCE);
  if (!existsSync(sourcePath)) {
    log(`${DICTLIST_SOURCE} not found in source repository`, 'error');
    return false;
  }

  log('Syncing dictionaries details...');

  try {
    const upstream = Object.fromEntries(
      Object.entries(
        remapKeys(parseDictlist(readFileSync(sourcePath, 'utf-8')), localFiles)
      ).filter(([key]) => !isIgnored(key, IGNORED_DICTIONARIES))
    );
    const current = readGeneratedModule(DETAILS_FILE);

    const localOnly = Object.fromEntries(
      Object.entries(current).filter(([key]) => !(key in upstream))
    );
    const merged = applyOverrides(
      { ...upstream, ...localOnly },
      LOCAL_DETAIL_OVERRIDES
    );

    const diff = diffDetails(current, merged);
    // Local-only entries are preserved, so they are not a removal
    diff.removed = Object.keys(localOnly);
    describeDiff('Details', diff);

    if (!isDryRun) {
      writeFileSync(
        DETAILS_FILE,
        'export default ' + JSON.stringify(merged, null, 2) + '\n'
      );
    }

    log(`Synced ${Object.keys(merged).length} dictionary details`, 'success');
    return diff.added.length > 0 || diff.changed.length > 0;
  } catch (error) {
    log(`Error syncing dictionaries details: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Parse upstream's abbreviations.ts and write dictionaries-abbreviations-list.js
 *
 * @returns {boolean} whether the abbreviations differ from what they were
 */
function syncAbbreviations() {
  const sourcePath = join(TEMP_DIR, ABBREVIATIONS_SOURCE);
  if (!existsSync(sourcePath)) {
    log(`${ABBREVIATIONS_SOURCE} not found in source repository`, 'error');
    return false;
  }

  log('Syncing abbreviations...');

  try {
    const abbreviations = parseAbbreviations(readFileSync(sourcePath, 'utf-8'));
    const diff = diffDetails(readGeneratedModule(ABBREVIATIONS_FILE), abbreviations);
    describeDiff('Abbreviations', diff);

    if (!isDryRun) {
      writeFileSync(
        ABBREVIATIONS_FILE,
        'export default ' + JSON.stringify(abbreviations, null, 2) + '\n'
      );
    }

    log(
      `Synced ${Object.keys(abbreviations).length} abbreviation sets`,
      'success'
    );
    return diff.added.length > 0 || diff.changed.length > 0 || diff.removed.length > 0;
  } catch (error) {
    log(`Error syncing abbreviations: ${error.message}`, 'error');
    return false;
  }
}

function saveChangelog(changes) {
  if (isDryRun) return;

  const changelog = {
    lastSync: new Date().toISOString(),
    source: REPO_URL,
    changes: {
      added: changes.added.map((d) => d.name),
      updated: changes.updated.map((d) => d.name),
    },
  };

  let history = [];
  if (existsSync(CHANGELOG_FILE)) {
    try {
      history = JSON.parse(readFileSync(CHANGELOG_FILE, 'utf-8'));
    } catch {
      history = [];
    }
  }

  if (!Array.isArray(history)) {
    history = [history];
  }

  history.unshift(changelog);
  // Keep last 10 syncs
  history = history.slice(0, 10);

  writeFileSync(CHANGELOG_FILE, JSON.stringify(history, null, 2));
}

function rebuildDatabase() {
  log('Rebuilding database...', 'info');
  try {
    const result = execSync('pnpm run build:database', {
      cwd: join(__dirname, '..'),
      stdio: 'inherit',
    });
    log('Database rebuilt successfully', 'success');
  } catch (error) {
    log('Failed to rebuild database', 'error');
    process.exit(1);
  }
}

/**
 * Check if ffmpeg is available for audio re-encoding
 */
function checkFfmpegAvailable() {
  try {
    execSync('ffmpeg -version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Scan public/audio for existing audio files
 * @returns {Object} Map of relative paths to file info
 */
function getExistingAudioFiles() {
  const existing = {};

  if (!existsSync(AUDIO_DEST_DIR)) {
    return existing;
  }

  const dictDirs = readdirSync(AUDIO_DEST_DIR);
  for (const dictKey of dictDirs) {
    const dictPath = join(AUDIO_DEST_DIR, dictKey);
    const stat = statSync(dictPath);
    if (!stat.isDirectory()) continue;

    const files = readdirSync(dictPath);
    for (const file of files) {
      if (!file.endsWith('.mp3')) continue;
      const filePath = join(dictPath, file);
      const fileStat = statSync(filePath);
      existing[`${dictKey}/${file}`] = {
        path: filePath,
        size: fileStat.size,
      };
    }
  }

  return existing;
}

/**
 * Find audio files in the source repository
 * @returns {Array} Array of audio file info objects
 */
function findSourceAudioFiles() {
  const audioFiles = [];
  const sourcePath = join(TEMP_DIR, AUDIO_SOURCE_PATH);

  if (!existsSync(sourcePath)) {
    return audioFiles;
  }

  const dictDirs = readdirSync(sourcePath);
  for (const dictKey of dictDirs) {
    const dictPath = join(sourcePath, dictKey);
    const stat = statSync(dictPath);
    if (!stat.isDirectory()) continue;

    const files = readdirSync(dictPath);
    for (const file of files) {
      // Accept .wav and .mp3 files
      if (!file.endsWith('.wav') && !file.endsWith('.mp3')) continue;
      const filePath = join(dictPath, file);
      const fileStat = statSync(filePath);
      audioFiles.push({
        dictKey,
        filename: file,
        sourcePath: filePath,
        size: fileStat.size,
      });
    }
  }

  return audioFiles;
}

/**
 * Compare existing and source audio files to determine changes
 * Uses file size comparison (faster than hashing for audio)
 */
function compareAudioFiles(existing, source) {
  const changes = {
    added: [],
    updated: [],
    unchanged: [],
  };

  for (const audio of source) {
    // Convert .wav to .mp3 for destination filename
    const mp3Filename = audio.filename.replace(/\.wav$/i, '.mp3');
    const destKey = `${audio.dictKey}/${mp3Filename}`;
    const existingAudio = existing[destKey];

    if (!existingAudio) {
      changes.added.push({ ...audio, destKey, mp3Filename });
    } else {
      // For .wav files being re-encoded, we can't compare sizes directly
      // So we compare source file size to detect changes in the source
      // We'll use a marker file to track source sizes
      const markerPath = join(AUDIO_DEST_DIR, audio.dictKey, `.${mp3Filename}.src-size`);
      let lastSourceSize = 0;
      if (existsSync(markerPath)) {
        try {
          lastSourceSize = parseInt(readFileSync(markerPath, 'utf-8'), 10);
        } catch {
          lastSourceSize = 0;
        }
      }

      if (audio.size !== lastSourceSize) {
        changes.updated.push({ ...audio, destKey, mp3Filename, oldSize: existingAudio.size });
      } else {
        changes.unchanged.push({ ...audio, destKey, mp3Filename });
      }
    }
  }

  return changes;
}

/**
 * Re-encode audio file to MP3 using ffmpeg
 */
function reencodeAudio(sourcePath, destPath) {
  // ffmpeg settings: mono, 44100Hz sample rate, 64kbps bitrate
  execSync(
    `ffmpeg -i "${sourcePath}" -ac 1 -ar 44100 -b:a 64k -y "${destPath}"`,
    { stdio: 'pipe' }
  );
}

/**
 * Write marker file to track source file size for incremental updates
 */
function writeSourceSizeMarker(destDir, mp3Filename, sourceSize) {
  const markerPath = join(destDir, `.${mp3Filename}.src-size`);
  writeFileSync(markerPath, String(sourceSize));
}

/**
 * Sync audio files from source repository
 */
function syncAudioFiles() {
  const sourcePath = join(TEMP_DIR, AUDIO_SOURCE_PATH);
  if (!existsSync(sourcePath)) {
    log('No audio directory found in source repository', 'info');
    return { added: [], updated: [], unchanged: [] };
  }

  // Get existing and source audio files
  const existing = getExistingAudioFiles();
  const source = findSourceAudioFiles();

  if (source.length === 0) {
    log('No audio files found in source', 'info');
    return { added: [], updated: [], unchanged: [] };
  }

  // Compare to find changes
  const changes = compareAudioFiles(existing, source);

  // Process new and updated files
  for (const audio of [...changes.added, ...changes.updated]) {
    const destDir = join(AUDIO_DEST_DIR, audio.dictKey);
    const destPath = join(destDir, audio.mp3Filename);
    const isNew = changes.added.includes(audio);

    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }

    log(
      `${isNew ? 'Adding' : 'Updating'}: ${audio.dictKey}/${audio.mp3Filename}`,
      'change'
    );

    if (!isDryRun) {
      reencodeAudio(audio.sourcePath, destPath);
      writeSourceSizeMarker(destDir, audio.mp3Filename, audio.size);
    }
  }

  return changes;
}

function cleanup() {
  // if (existsSync(TEMP_DIR)) {
  //   log('Cleaning up temporary files...');
  //   rmSync(TEMP_DIR, { recursive: true, force: true });
  // }
}

/**
 * Say what the name matching did: files renamed upstream (kept under our
 * name) and files upstream no longer has (kept, never deleted).
 */
function reportRenamesAndStrays(changes) {
  for (const { from, to } of changes.renamed) {
    log(`Renamed upstream: ${from} -> kept as ${to}`, 'info');
  }
  for (const name of changes.missingUpstream) {
    log(`Not in upstream, kept: ${name}`, 'warning');
  }
}

/**
 * A dictionary no pack lists is built into nothing: it would sit in
 * build/dictionaries and never reach a user. Flag new ones so that is a
 * decision, not a surprise.
 */
function warnAboutUnpackedDictionaries(added) {
  const packed = new Set(
    Object.values(PACK_DEFINITIONS).flatMap((pack) => pack.dictionaries)
  );
  for (const { name } of added) {
    if (!packed.has(name.replace(/^\d+-/, ''))) {
      log(
        `${name} is in no pack. Add it to build/config/pack-dictionaries.js and src/config/pack-definitions.js to ship it.`,
        'warning'
      );
    }
  }
}

async function main() {
  console.log('\n📚 Tibetan Dictionary Sync Script\n');

  if (isDryRun) {
    log('Running in dry-run mode (no changes will be made)', 'warning');
  }

  try {
    // Step 1: Get existing dictionaries
    log('Scanning existing dictionaries...');
    const existing = getExistingDictionaries();
    log(
      `Found ${Object.keys(existing).length} existing dictionaries`,
      'success'
    );

    // Step 2: Clone/pull the source repository
    cloneOrPullRepo();

    // Step 3: Find dictionary files in the source
    log('Scanning source repository for dictionaries...');
    const sourceFiles = findDictionaryFiles();
    log(`Found ${sourceFiles.length} dictionary files in source`, 'success');

    if (sourceFiles.length === 0) {
      log('No dictionary files found in the source repository.', 'warning');
      log('The repository structure may have changed.', 'warning');
      log(`Please check ${REPO_URL} manually.`, 'info');
      cleanup();
      return;
    }

    // Step 4: Compare and determine changes
    const changes = compareAndSync(existing, sourceFiles);

    // Step 5: Report changes
    console.log('\n📊 Sync Summary:');
    log(`New dictionaries: ${changes.added.length}`);
    log(`Updated dictionaries: ${changes.updated.length}`);
    log(`Unchanged dictionaries: ${changes.unchanged.length}`);
    reportRenamesAndStrays(changes);
    warnAboutUnpackedDictionaries(changes.added);

    // Step 6: Apply dictionary changes
    if (changes.added.length > 0 || changes.updated.length > 0) {
      console.log('\n📝 Dictionary Changes:');
      applyChanges(changes);
    } else {
      log('\nAll dictionary files are up to date!', 'success');
    }

    // Step 7: Always sync settings files (dictlist.ts and abbreviations.ts)
    console.log('\n📋 Settings:');
    const detailsSynced = syncDictionariesDetails([
      ...Object.keys(existing),
      ...changes.added.map((d) => d.name),
    ]);
    const abbreviationsSynced = syncAbbreviations();

    // Step 8: Sync audio files
    console.log('\n🔊 Audio:');
    let audioChanges = { added: [], updated: [], unchanged: [] };
    if (!checkFfmpegAvailable()) {
      log('ffmpeg not found - skipping audio sync', 'warning');
      log('Install ffmpeg to enable audio sync: brew install ffmpeg', 'info');
    } else {
      audioChanges = syncAudioFiles();
      log(`New audio files: ${audioChanges.added.length}`);
      log(`Updated audio files: ${audioChanges.updated.length}`);
      log(`Unchanged audio files: ${audioChanges.unchanged.length}`);
    }

    const hasAudioChanges = audioChanges.added.length > 0 || audioChanges.updated.length > 0;
    const hasChanges = changes.added.length > 0 || changes.updated.length > 0 || detailsSynced || abbreviationsSynced || hasAudioChanges;

    // Step 9: Save changelog
    saveChangelog(changes);

    if (!isDryRun && hasChanges) {
      log('\nSync completed successfully!', 'success');

      // Step 10: Optionally rebuild database
      if (shouldRebuild) {
        console.log('');
        rebuildDatabase();
      } else {
        log(
          '\nRun `pnpm build:packs` (app) and `pnpm build:database` (web) to rebuild with the new dictionaries.',
          'info'
        );
      }
    } else if (!hasChanges) {
      log('\nEverything is already up to date!', 'success');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  } finally {
    cleanup();
  }
}

main();
