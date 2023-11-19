import "sugar";
import _ from "underscore";
import { v4 as uuid } from "uuid";

const worker = new Worker("/worker.sql-wasm.js");
window.worker = worker;

export default {
  allTerms: [],
  dictionaries: [],

  async init() {
    let response = await fetch("./TibetanTranslator.sqlite");
    let buffer = await response.arrayBuffer();
    await postMessageAsync({ action: "open", buffer: buffer });
    let terms = await this.exec("SELECT DISTINCT term FROM entries ORDER BY term");
    this.allTerms = terms.map("term");
    this.dictionaries = await this.exec("SELECT * FROM dictionaries");
  },

  async exec(query, params) {
    return postMessageAsync({
      action: "exec",
      sql: query,
      params: params
    });
  },

  setAllTermsVariable() {
    return new Promise((resolve, reject) => {
      this.exec("SELECT DISTINCT term FROM entries ORDER BY term")
        .then((terms) => (this.allTerms = terms.map("term")))
        .catch((error) => {}) // Do nothing, this will happen before DB is initialized
        .finally(resolve);
    });
  },

  getEntriesFor(term) {
    console.log("getEntriesFor", term);
    return this.exec(
      `SELECT entries.*, dictionaries.name AS dictionary
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
        let response = result ? buildObjectsFrom(result) : true;
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
