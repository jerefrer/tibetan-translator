import _ from "underscore";
import { v4 as uuid } from "uuid";

import Storage from "./storage";

const worker = new Worker("/worker.sql-wasm.js");
window.worker = worker;

export default {
  allTerms: [],

  async init() {
    let response = await fetch("./TibetanTranslator.sqlite");
    let buffer = await response.arrayBuffer();
    await postMessageAsync({ action: "open", buffer: buffer });
    await this.loadDictionariesIntoLocalStorage();
    let terms = await this.exec(
      "SELECT DISTINCT term FROM entries ORDER BY term"
    );
    this.allTerms = terms.map((row) => row.term);
  },

  async loadDictionariesIntoLocalStorage() {
    let databaseDictionaries = await this.exec("SELECT * FROM dictionaries");
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
    return postMessageAsync({
      action: "exec",
      sql: query,
      params: params,
    });
  },

  setAllTermsVariable() {
    return new Promise((resolve, reject) => {
      this.exec("SELECT DISTINCT term FROM entries ORDER BY term")
        .then((terms) => (this.allTerms = terms.map((row) => row.term)))
        .catch((error) => {}) // Do nothing, this will happen before DB is initialized
        .finally(resolve);
    });
  },

  getEntriesFor(term) {
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
  },
};

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
