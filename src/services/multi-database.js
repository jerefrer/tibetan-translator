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
  if (!supportsModularPacks()) {
    // Web version: load full database as before
    return initFullDatabase();
  }

  // Tauri: initialize pack manager first
  await PackManager.init();

  // Load all installed packs
  for (const packId of PackManager.installedPacks) {
    await loadPackDatabase(packId);
  }

  // Load dictionaries into localStorage
  await loadAllDictionariesIntoLocalStorage();
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
 * Load a pack database into a worker
 */
async function loadPackDatabase(packId) {
  if (loadedPacks.has(packId)) {
    return; // Already loaded
  }

  const worker = new Worker('/worker.sql-wasm.js');
  workers.set(packId, worker);

  // Get database bytes from Tauri
  const bytes = await PackManager.getPackDatabase(packId);
  const buffer = new Uint8Array(bytes).buffer;

  await postMessageToWorker(packId, { action: 'open', buffer });
  loadedPacks.add(packId);

  console.log(`Loaded pack database: ${packId}`);
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

  for (const [packId, worker] of workers) {
    try {
      const packResults = await postMessageToWorker(packId, {
        action: 'exec',
        sql: query,
        params,
      });

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
