import _ from "underscore";
import { v4 as uuid } from "uuid";

import Storage from "./storage";
import MultiDatabase from "./multi-database";
import { isTauri, isMobile, supportsModularPacks } from "../config/platform";

// Web Worker for sql.js (only initialized if not using modular packs)
let worker = null;

// Tauri invoke function (lazy loaded)
let invoke = null;

// Track initialization mode
// 'tauri-packs-native' = mobile with native SQLite (fast)
// 'tauri-packs' = desktop with sql.js workers (modular but slower on mobile)
// 'tauri-native' = legacy single database
// 'web' = web browser with sql.js
let _initMode = null;

async function determineInitMode() {
  if (_initMode !== null) return _initMode;

  if (isTauri()) {
    // Check if we should use modular packs
    if (supportsModularPacks()) {
      // On mobile, use native SQLite for performance
      // On desktop, use sql.js workers (allows hot-swapping packs)
      if (isMobile()) {
        try {
          const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
          invoke = tauriInvoke;
          _initMode = "tauri-packs-native";
          console.log("[Database] Mobile detected, using native SQLite for packs");
        } catch (e) {
          console.log("[Database] Mobile Tauri import failed, falling back to sql.js workers:", e);
          _initMode = "tauri-packs";
        }
      } else {
        _initMode = "tauri-packs";
        console.log("[Database] Desktop detected with modular packs, using sql.js workers");
      }
    } else {
      // Fallback to native SQLite (unlikely path)
      try {
        const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
        invoke = tauriInvoke;
        _initMode = "tauri-native";
        console.log("[Database] Tauri detected, using native SQLite");
      } catch (e) {
        console.log("[Database] Tauri import failed, falling back to web mode:", e);
        _initMode = "web";
      }
    }
  } else {
    _initMode = "web";
    console.log("[Database] Web browser detected, using sql.js");
  }

  return _initMode;
}

async function getInvoke() {
  if (invoke) return invoke;
  const mode = await determineInitMode();
  if (mode === "tauri-native") {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
    invoke = tauriInvoke;
  }
  return invoke;
}

// ============================================
// Unified Database Implementation
// Supports: tauri-packs (multi-DB), tauri-native, web (full DB)
// ============================================

const database = {
  allTerms: [],
  _initialized: false,

  async init() {
    if (this._initialized) return;

    const mode = await determineInitMode();
    console.log('[SqlDatabase.init] Mode:', mode);

    if (mode === "tauri-packs-native") {
      // Mobile: Use native SQLite for packs (fast, no memory loading)
      console.log('[SqlDatabase.init] Using native SQLite for packs...');
      const inv = await getInvoke();
      // Load dictionaries into localStorage
      const dictionaries = await inv("pack_get_dictionaries");
      this.loadDictionariesFromNative(dictionaries);
      // Load all terms for autocomplete
      console.log('[SqlDatabase.init] Loading all terms via native SQLite...');
      this.allTerms = await inv("pack_get_all_terms");
      console.log('[SqlDatabase.init] allTerms.length:', this.allTerms.length);
    } else if (mode === "tauri-packs") {
      // Desktop: Use multi-database system with sql.js workers per pack
      console.log('[SqlDatabase.init] Calling MultiDatabase.initDatabases()...');
      await MultiDatabase.initDatabases();
      console.log('[SqlDatabase.init] Calling setAllTermsVariable()...');
      await this.setAllTermsVariable();
      console.log('[SqlDatabase.init] allTerms.length:', this.allTerms.length);
    } else if (mode === "tauri-native") {
      // Use Tauri native SQLite (fallback)
      const inv = await getInvoke();
      await inv("init_database");
      await this.loadDictionariesIntoLocalStorage();
      this.allTerms = await inv("get_all_terms");
    } else {
      // Web: Use sql.js WebAssembly with full database
      console.log("[Database] Using sql.js WebAssembly");
      if (!worker) {
        worker = new Worker("/worker.sql-wasm.js");
        window.worker = worker;
      }

      let response = await fetch("/TibetanTranslator.sqlite");
      let buffer = await response.arrayBuffer();
      await postMessageAsync({ action: "open", buffer: buffer });
      await this.loadDictionariesIntoLocalStorage();
      let terms = await this.exec(
        "SELECT DISTINCT term FROM entries ORDER BY term"
      );
      this.allTerms = terms.map((row) => row.term);
    }

    this._initialized = true;
  },

  async loadDictionariesIntoLocalStorage() {
    const mode = await determineInitMode();
    let databaseDictionaries;

    if (mode === "tauri-packs") {
      // Already handled by MultiDatabase.initDatabases()
      return;
    } else if (mode === "tauri-native") {
      const inv = await getInvoke();
      databaseDictionaries = await inv("get_dictionaries");
    } else {
      databaseDictionaries = await this.exec("SELECT * FROM dictionaries");
    }

    let existingDictionaries = Storage.get("dictionaries") || [];
    Storage.set(
      "dictionaries",
      databaseDictionaries.map((databaseDictionary, index) => {
        let existingDictionary = existingDictionaries.find(
          (existingDictionary) =>
            existingDictionary.name == databaseDictionary.name
        );
        return {
          ...databaseDictionary,
          enabled: existingDictionary
            ? existingDictionary.enabled != false
            : true,
          position: existingDictionary
            ? existingDictionary.position
            : index + 1,
        };
      })
    );
  },

  /**
   * Load dictionaries from native pack query results into localStorage
   */
  loadDictionariesFromNative(dictionaries) {
    const existingDictionaries = Storage.get("dictionaries") || [];
    Storage.set(
      "dictionaries",
      dictionaries.map((dict, index) => {
        const existing = existingDictionaries.find((d) => d.name === dict.name);
        return {
          ...dict,
          enabled: existing ? existing.enabled !== false : true,
          position: existing ? existing.position : index + 1,
        };
      })
    );
    // Emit event to notify UI components
    window.dispatchEvent(new CustomEvent('dictionaries-updated'));
  },

  async exec(query, params) {
    const mode = await determineInitMode();

    if (mode === "tauri-packs-native") {
      // Mobile: Use native SQLite pack query command
      const inv = await getInvoke();
      const paramsJson = JSON.stringify(params || []);
      return await inv("pack_execute_query", { sql: query, paramsJson });
    } else if (mode === "tauri-packs") {
      // Query all pack databases and merge results
      return MultiDatabase.execAll(query, params);
    } else if (mode === "tauri-native") {
      const inv = await getInvoke();
      const paramsJson = JSON.stringify(params || []);
      return await inv("execute_query", { sql: query, paramsJson });
    } else {
      return postMessageAsync({
        action: "exec",
        sql: query,
        params: params,
      });
    }
  },

  async setAllTermsVariable() {
    try {
      const mode = await determineInitMode();

      if (mode === "tauri-packs-native") {
        // Mobile: Use native SQLite
        const inv = await getInvoke();
        this.allTerms = await inv("pack_get_all_terms");
        console.log('[Database] Loaded', this.allTerms.length, 'terms via native SQLite');
      } else if (mode === "tauri-packs") {
        const terms = await MultiDatabase.execAll(
          "SELECT DISTINCT term FROM entries ORDER BY term"
        );
        // Deduplicate terms from multiple packs
        this.allTerms = [...new Set(terms.map((row) => row.term))].sort();
        console.log('[Database] Loaded', this.allTerms.length, 'terms');
      } else if (mode === "tauri-native") {
        const inv = await getInvoke();
        this.allTerms = await inv("get_all_terms");
      } else {
        const terms = await this.exec("SELECT DISTINCT term FROM entries ORDER BY term");
        this.allTerms = terms.map((row) => row.term);
      }
    } catch (error) {
      console.error('[Database] Failed to load terms:', error);
    }
  },

  async getEntriesFor(term) {
    const mode = await determineInitMode();

    if (mode === "tauri-packs-native") {
      // Mobile: Use native SQLite for fast queries
      const inv = await getInvoke();
      return await inv("pack_get_entries_for_term", { term });
    } else if (mode === "tauri-packs") {
      // Use exact term matching (not FTS) for Define page
      // Escape single quotes for SQL safety
      const escapedTerm = term.replace(/'/g, "''");

      const query = `
        SELECT entries.*, dictionaries.name AS dictionary, dictionaries.position AS dictionaryPosition
        FROM entries
        INNER JOIN dictionaries ON dictionaries.id = entries.dictionaryId
        WHERE entries.term = '${escapedTerm}'
        ORDER BY dictionaries.position
      `;

      const results = await MultiDatabase.execAll(query, []);
      return results.sort((a, b) => (a.dictionaryPosition || 0) - (b.dictionaryPosition || 0));
    } else if (mode === "tauri-native") {
      const inv = await getInvoke();
      return await inv("get_entries_for_term", { term });
    } else {
      return this.exec(
        `
        SELECT entries.*, dictionaries.name AS dictionary
        FROM entries
        INNER JOIN dictionaries ON dictionaries.id = dictionaryId
        WHERE term = ?
        ORDER BY dictionaries.position
        `,
        [term]
      );
    }
  },

  async searchEntries(query, searchType = "regular") {
    const mode = await determineInitMode();

    if (mode === "tauri-packs-native") {
      // Mobile: Use native SQLite for fast FTS queries
      const inv = await getInvoke();
      return await inv("pack_search_entries", { query, searchType });
    } else if (mode === "tauri-packs") {
      // Search across all packs
      // Note: We interpolate the query directly instead of using parameterized queries
      // because iOS WebWorkers have issues with postMessage serialization of params
      const escapedQuery = query.replace(/'/g, "''").replace(/%/g, "\\%").replace(/_/g, "\\_");
      const results = await MultiDatabase.execAll(
        `
        SELECT entries.*, dictionaries.name AS dictionary, dictionaries.position AS dictionaryPosition
        FROM entries
        INNER JOIN dictionaries ON dictionaries.id = entries.dictionaryId
        WHERE entries.term LIKE '%${escapedQuery}%' ESCAPE '\\'
        LIMIT 5000
        `,
        [] // Empty params array - required for iOS WebWorker compatibility
      );
      return results;
    } else if (mode === "tauri-native") {
      const inv = await getInvoke();
      return await inv("search_entries", { query, searchType });
    } else {
      // Fall back to standard exec for web
      return this.exec(
        `
        SELECT entries.*, dictionaries.name AS dictionary, dictionaries.position AS dictionaryPosition
        FROM entries
        INNER JOIN dictionaries ON dictionaries.id = entries.dictionaryId
        WHERE entries.term LIKE ?
        LIMIT 5000
        `,
        [`%${query}%`]
      );
    }
  },

  /**
   * Check if database is ready for queries
   */
  isReady() {
    if (!this._initialized) return false;
    // For tauri-packs mode, also check if workers are loaded
    // For tauri-packs-native, native SQLite is always ready after init
    if (_initMode === "tauri-packs") {
      return MultiDatabase.hasLoadedDatabases();
    }
    return true;
  },

  /**
   * Reload databases after pack installation/removal
   */
  async reloadPack(packId) {
    if (_initMode === "tauri-packs-native") {
      // Mobile: Reload dictionaries and terms from native SQLite
      const inv = await getInvoke();
      const dictionaries = await inv("pack_get_dictionaries");
      this.loadDictionariesFromNative(dictionaries);
      await this.setAllTermsVariable();
    } else if (_initMode === "tauri-packs") {
      await MultiDatabase.reloadPack(packId);
      await this.setAllTermsVariable();
    }
  },

  /**
   * Unload a pack after removal
   */
  async unloadPack(packId) {
    if (_initMode === "tauri-packs-native") {
      // Mobile: Reload dictionaries and terms after pack removal
      const inv = await getInvoke();
      const dictionaries = await inv("pack_get_dictionaries");
      this.loadDictionariesFromNative(dictionaries);
      await this.setAllTermsVariable();
    } else if (_initMode === "tauri-packs") {
      MultiDatabase.unloadPack(packId);
    }
  },
};

// ============================================
// Web Worker Helper Functions
// ============================================

function postMessageAsync(message) {
  return new Promise((resolve, reject) => {
    const messageId = uuid();
    message.id = messageId;
    console.log(message);
    const handler = function (event) {
      if (event.data.id === messageId) {
        worker.removeEventListener("message", handler);
        let results = event.data.results;
        let result = results && results[0];
        let response = result ? buildObjectsFrom(result) : [];
        resolve(response);
      }
    };

    worker.addEventListener("message", handler);
    worker.postMessage(message);
  });
}

function buildObjectsFrom(object) {
  let result = [];
  for (let i = 0; i < object.values.length; i++) {
    let tempObject = {};
    for (let j = 0; j < object.columns.length; j++) {
      tempObject[object.columns[j]] = object.values[i][j];
    }
    result.push(tempObject);
  }
  return result;
}

// ============================================
// Export Unified Database Implementation
// ============================================

export default database;
