import _ from "underscore";
import { v4 as uuid } from "uuid";

import Storage from "./storage";
import MultiDatabase from "./multi-database";
import { isTauri, supportsModularPacks } from "../config/platform";

// Web Worker for sql.js (only initialized if not using modular packs)
let worker = null;

// Tauri invoke function (lazy loaded)
let invoke = null;

// Track initialization mode
let _initMode = null; // 'tauri-native' | 'tauri-packs' | 'web'

async function determineInitMode() {
  if (_initMode !== null) return _initMode;

  if (isTauri()) {
    // Check if we should use modular packs
    if (supportsModularPacks()) {
      _initMode = "tauri-packs";
      console.log("[Database] Tauri detected with modular packs, using sql.js workers");
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

    if (mode === "tauri-packs") {
      // Use multi-database system with sql.js workers per pack
      await MultiDatabase.initDatabases();
      await this.setAllTermsVariable();
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

  async exec(query, params) {
    const mode = await determineInitMode();

    if (mode === "tauri-packs") {
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

      if (mode === "tauri-packs") {
        const terms = await MultiDatabase.execAll(
          "SELECT DISTINCT term FROM entries ORDER BY term"
        );
        this.allTerms = terms.map((row) => row.term);
      } else if (mode === "tauri-native") {
        const inv = await getInvoke();
        this.allTerms = await inv("get_all_terms");
      } else {
        const terms = await this.exec("SELECT DISTINCT term FROM entries ORDER BY term");
        this.allTerms = terms.map((row) => row.term);
      }
    } catch (error) {
      // Do nothing, this will happen before DB is initialized
    }
  },

  async getEntriesFor(term) {
    const mode = await determineInitMode();

    if (mode === "tauri-packs") {
      // Query all packs for this term
      const results = await MultiDatabase.execAll(
        `
        SELECT entries.*, dictionaries.name AS dictionary
        FROM entries
        INNER JOIN dictionaries ON dictionaries.id = dictionaryId
        WHERE term = ?
        ORDER BY dictionaries.position
        `,
        [term]
      );
      // Sort by dictionary position across all packs
      return results.sort((a, b) => (a.position || 0) - (b.position || 0));
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

    if (mode === "tauri-packs") {
      // Search across all packs
      const results = await MultiDatabase.execAll(
        `
        SELECT entries.*, dictionaries.name AS dictionary, dictionaries.position AS dictionaryPosition
        FROM entries
        INNER JOIN dictionaries ON dictionaries.id = entries.dictionaryId
        WHERE entries.term LIKE ?
        LIMIT 5000
        `,
        [`%${query}%`]
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
    return this._initialized && (
      _initMode === "tauri-packs" ? MultiDatabase.hasLoadedDatabases() : true
    );
  },

  /**
   * Reload databases after pack installation/removal
   */
  async reloadPack(packId) {
    if (_initMode === "tauri-packs") {
      await MultiDatabase.reloadPack(packId);
      await this.setAllTermsVariable();
    }
  },

  /**
   * Unload a pack after removal
   */
  unloadPack(packId) {
    if (_initMode === "tauri-packs") {
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
