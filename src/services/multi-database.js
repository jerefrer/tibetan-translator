/**
 * Multi-Database Service
 *
 * Manages multiple SQLite database workers for dictionary packs.
 * Provides unified query interface that merges results from all loaded packs.
 */

import { v4 as uuid } from 'uuid';
import Storage from './storage';
import PackManager from './pack-manager';
import { isTauri, supportsModularPacks } from '../config/platform';

// Worker pool: packId -> worker
const workers = new Map();

// Track which packs are loaded
const loadedPacks = new Set();

/**
 * Initialize databases based on platform
 * - Web: Load full bundled database
 * - Tauri: Load installed pack databases
 */
export async function initDatabases() {
  console.log('[initDatabases] Starting...');
  console.log('[initDatabases] supportsModularPacks:', supportsModularPacks());

  if (!supportsModularPacks()) {
    // Web version: load full database as before
    console.log('[initDatabases] Using full database (web mode)');
    return initFullDatabase();
  }

  // Tauri: initialize pack manager first
  console.log('[initDatabases] Initializing PackManager...');
  await PackManager.init();
  console.log('[initDatabases] Installed packs:', PackManager.installedPacks);

  // Load all installed packs in parallel for faster startup
  console.log('[initDatabases] Loading all packs in parallel...');
  await Promise.all(
    PackManager.installedPacks.map((packId) => loadPackDatabase(packId))
  );
  console.log('[initDatabases] All packs loaded. Workers count:', workers.size);

  // Load dictionaries into localStorage
  console.log('[initDatabases] Loading dictionaries into localStorage...');
  await loadAllDictionariesIntoLocalStorage();
  console.log('[initDatabases] Complete!');
}

/**
 * Initialize full database for web version
 */
async function initFullDatabase() {
  const worker = new Worker('/worker.sql-wasm.js');
  workers.set('full', worker);
  loadedPacks.add('full');

  const response = await fetch('./TibetanTranslator.sqlite');
  const buffer = await response.arrayBuffer();
  await postMessageToWorker('full', { action: 'open', buffer });

  await loadDictionariesFromPack('full');
}

/**
 * Load a pack database into a worker with timeout protection
 * IMPORTANT: Worker is only added to the map AFTER database is fully loaded
 * to prevent queries hitting uninitialized workers (race condition fix)
 */
async function loadPackDatabase(packId) {
  console.log(`[loadPackDatabase] Starting for pack: ${packId}`);

  if (loadedPacks.has(packId)) {
    console.log(`[loadPackDatabase] Pack ${packId} already loaded, skipping`);
    return; // Already loaded
  }

  const LOAD_TIMEOUT_MS = 300000; // 5 minutes timeout (mobile chunked loading is slow)

  console.log(`[loadPackDatabase] Creating worker for pack: ${packId}`);
  const worker = new Worker('/worker.sql-wasm.js');

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout loading pack ${packId}`)), LOAD_TIMEOUT_MS)
    );

    console.log(`[loadPackDatabase] Fetching database bytes for pack: ${packId}`);
    // Get database bytes with timeout protection
    const bytes = await Promise.race([
      PackManager.getPackDatabase(packId),
      timeoutPromise,
    ]);

    const buffer = new Uint8Array(bytes).buffer;
    console.log(`[loadPackDatabase] Got ${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB for pack: ${packId}`);

    // Load database into worker using direct message (worker not in map yet)
    console.log(`[loadPackDatabase] Opening database in worker for pack: ${packId}`);
    await sendMessageDirect(worker, { action: 'open', buffer });
    console.log(`[loadPackDatabase] Database opened successfully for pack: ${packId}`);

    // Only NOW add worker to map - database is loaded and ready for queries
    workers.set(packId, worker);
    loadedPacks.add(packId);

    console.log(`[loadPackDatabase] Pack ${packId} fully loaded and added to workers map`);
    console.log(`[loadPackDatabase] Current workers count: ${workers.size}`);
  } catch (error) {
    console.error(`[loadPackDatabase] Failed to load pack ${packId}:`, error);
    // Clean up worker
    worker.terminate();
    // Don't rethrow - allow other packs to continue loading
  }
}

/**
 * Reload a pack after installation
 */
export async function reloadPack(packId) {
  // Close existing worker if any
  unloadPack(packId);

  // Load the pack
  await loadPackDatabase(packId);

  // Reload dictionaries
  await loadAllDictionariesIntoLocalStorage();
}

/**
 * Unload a pack after removal
 */
export function unloadPack(packId) {
  if (workers.has(packId)) {
    workers.get(packId).terminate();
    workers.delete(packId);
  }
  loadedPacks.delete(packId);
}

/**
 * Execute query across all loaded databases
 * Results are merged and tagged with source pack
 */
export async function execAll(query, params) {
  const results = [];

  console.log('[execAll] Workers count:', workers.size);
  console.log('[execAll] Query (first 200 chars):', query.substring(0, 200));

  for (const [packId, worker] of workers) {
    try {
      console.log(`[execAll] Querying pack: ${packId}`);
      const packResults = await postMessageToWorker(packId, {
        action: 'exec',
        sql: query,
        params,
      });

      console.log(`[execAll] Pack ${packId} returned ${packResults.length} results`);

      // Tag results with source pack for debugging/filtering
      results.push(
        ...packResults.map((row) => ({
          ...row,
          _sourcePackId: packId,
        }))
      );
    } catch (error) {
      console.warn(`Query failed for pack ${packId}:`, error);
    }
  }

  console.log('[execAll] Total results:', results.length);
  return results;
}

/**
 * Execute query on a specific pack
 */
export async function execPack(packId, query, params) {
  const worker = workers.get(packId);
  if (!worker) {
    throw new Error(`Pack ${packId} not loaded`);
  }

  return postMessageToWorker(packId, {
    action: 'exec',
    sql: query,
    params,
  });
}

/**
 * Get all loaded pack IDs
 */
export function getLoadedPacks() {
  return Array.from(loadedPacks);
}

/**
 * Check if any database is loaded
 */
export function hasLoadedDatabases() {
  return workers.size > 0;
}

// ============================================
// Dictionary Loading
// ============================================

/**
 * Load dictionaries from all packs into localStorage
 */
async function loadAllDictionariesIntoLocalStorage() {
  const allDictionaries = [];
  let globalPosition = 1;

  for (const packId of loadedPacks) {
    const packDictionaries = await execPack(packId, 'SELECT * FROM dictionaries');

    for (const dict of packDictionaries) {
      allDictionaries.push({
        ...dict,
        _sourcePackId: packId,
        _globalPosition: globalPosition++,
      });
    }
  }

  // Merge with existing user preferences
  const existingDictionaries = Storage.get('dictionaries') || [];

  Storage.set(
    'dictionaries',
    allDictionaries.map((dict) => {
      const existing = existingDictionaries.find((d) => d.name === dict.name);
      return {
        ...dict,
        enabled: existing ? existing.enabled !== false : true,
        position: existing ? existing.position : dict._globalPosition,
      };
    })
  );

  // Emit event to notify UI components
  window.dispatchEvent(new CustomEvent('dictionaries-updated'));
}

/**
 * Load dictionaries from a specific pack
 */
async function loadDictionariesFromPack(packId) {
  const databaseDictionaries = await execPack(packId, 'SELECT * FROM dictionaries');
  const existingDictionaries = Storage.get('dictionaries') || [];

  Storage.set(
    'dictionaries',
    databaseDictionaries.map((databaseDictionary, index) => {
      const existingDictionary = existingDictionaries.find(
        (existing) => existing.name === databaseDictionary.name
      );
      return {
        ...databaseDictionary,
        enabled: existingDictionary ? existingDictionary.enabled !== false : true,
        position: existingDictionary ? existingDictionary.position : index + 1,
      };
    })
  );
}

// ============================================
// Worker Communication
// ============================================

/**
 * Send message directly to a worker (not in the workers map)
 * Used during initialization before worker is ready for queries
 */
function sendMessageDirect(worker, message) {
  return new Promise((resolve, reject) => {
    const messageId = uuid();
    message.id = messageId;

    const handler = (event) => {
      if (event.data.id === messageId) {
        worker.removeEventListener('message', handler);
        worker.removeEventListener('error', errorHandler);
        resolve(event.data.results);
      }
    };

    const errorHandler = (error) => {
      worker.removeEventListener('message', handler);
      worker.removeEventListener('error', errorHandler);
      reject(error);
    };

    worker.addEventListener('message', handler);
    worker.addEventListener('error', errorHandler);
    worker.postMessage(message);
  });
}

/**
 * Send message to worker and wait for response
 */
function postMessageToWorker(packId, message) {
  return new Promise((resolve, reject) => {
    const worker = workers.get(packId);
    if (!worker) {
      reject(new Error(`No worker for pack ${packId}`));
      return;
    }

    const messageId = uuid();
    message.id = messageId;

    const handler = (event) => {
      if (event.data.id === messageId) {
        worker.removeEventListener('message', handler);
        const results = event.data.results;
        const result = results && results[0];
        resolve(result ? buildObjectsFrom(result) : []);
      }
    };

    const errorHandler = (error) => {
      worker.removeEventListener('error', errorHandler);
      reject(error);
    };

    worker.addEventListener('message', handler);
    worker.addEventListener('error', errorHandler);
    worker.postMessage(message);
  });
}

/**
 * Convert SQLite result format to array of objects
 */
function buildObjectsFrom(result) {
  const objects = [];
  for (let i = 0; i < result.values.length; i++) {
    const obj = {};
    for (let j = 0; j < result.columns.length; j++) {
      obj[result.columns[j]] = result.values[i][j];
    }
    objects.push(obj);
  }
  return objects;
}

export default {
  initDatabases,
  execAll,
  execPack,
  reloadPack,
  unloadPack,
  getLoadedPacks,
  hasLoadedDatabases,
};
