import _ from "underscore";
import { v4 as uuid } from "uuid";

import Storage from "./storage";

// Web Worker for sql.js (only initialized if not using Tauri)
let worker = null;

// Tauri invoke function (lazy loaded)
let invoke = null;

// Lazy detection of Tauri - check on first use, not at module load
let _isTauri = null;

async function checkIsTauri() {
  if (_isTauri !== null) return _isTauri;

  // Check for Tauri internals (more reliable than __TAURI__)
  if (window.__TAURI_INTERNALS__ || window.__TAURI__) {
    try {
      const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
      invoke = tauriInvoke;
      _isTauri = true;
      console.log("[Database] Tauri detected, using native SQLite");
    } catch (e) {
      console.log("[Database] Tauri import failed, falling back to sql.js:", e);
      _isTauri = false;
    }
  } else {
    _isTauri = false;
  }
  return _isTauri;
}

async function getInvoke() {
  if (invoke) return invoke;
  await checkIsTauri();
  return invoke;
}

// ============================================
// Unified Database Implementation
// Dynamically switches between Tauri native and sql.js
// ============================================

const database = {
  allTerms: [],
  _initialized: false,

  async init() {
    if (this._initialized) return;

    const isTauri = await checkIsTauri();

    if (isTauri) {
      // Use Tauri native SQLite
      const inv = await getInvoke();
      await inv("init_database");
      await this.loadDictionariesIntoLocalStorage();
      this.allTerms = await inv("get_all_terms");
    } else {
      // Use sql.js WebAssembly
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
    const isTauri = await checkIsTauri();
    let databaseDictionaries;

    if (isTauri) {
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
    const isTauri = await checkIsTauri();

    if (isTauri) {
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
      const isTauri = await checkIsTauri();

      if (isTauri) {
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
    const isTauri = await checkIsTauri();

    if (isTauri) {
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
    const isTauri = await checkIsTauri();

    if (isTauri) {
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
