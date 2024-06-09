import fs from "fs";
import path from "path";
import _ from "underscore";
import readline from "readline";
import { StringDecoder } from "string_decoder";
const utf8Decoder = new StringDecoder("utf8");

import ProgressBar from "progress";
import { formatDuration, intervalToDuration } from "date-fns";

import initSqlJs from "../public/sql-wasm.js";

import WylieToUnicode from "../src/services/wylie-to-unicode.js";

import DICTIONARIES_DETAILS from "../src/services/dictionaries-details.js";
import {
  cleanTerm,
  strictAndLoosePhoneticsFor,
  convertWylieButKeepNonTibetanParts,
} from "../src/utils.js";

const outputFilename = "TibetanTranslator.sqlite";
const outputFilepath = path.join(__dirname, "..", "public", outputFilename);
const linesWithMissedWylieFilename = "wylieLinesWithMistakes.txt";

var DatabaseBuilder = {
  dictionariesFolder: path.join(__dirname, "dictionaries"),
  linesWithMissedWylieFilePath: path.join(
    __dirname,
    linesWithMissedWylieFilename
  ),

  async build() {
    this.database = await this.initDatabase();
    this.startedAt = Date.now();
    this.printNewLineAtTheBeginning();
    this.cleanup();
    this.setupWylieToUnicode();
    this.loadDictionaries();
    this.computeNumberOfLines();
    this.setupProgressBar();
    this.createTables();
    this.insertDictionaries();
    this.insertEntries();
  },

  async initDatabase() {
    const SQL = await initSqlJs();
    return new SQL.Database();
  },

  exportDatabase() {
    const data = this.database.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(outputFilepath, buffer);
  },

  printNewLineAtTheBeginning() {
    console.log();
  },

  cleanup() {
    if (fs.existsSync(this.linesWithMissedWylieFilePath))
      fs.unlinkSync(this.linesWithMissedWylieFilePath);
  },

  setupWylieToUnicode() {
    this.wylieToUnicode = new WylieToUnicode();
  },

  writeWylieMistakes() {
    const warnings = this.wylieToUnicode.get_warnings();
    if (warnings.length)
      fs.writeFileSync(this.linesWithMissedWylieFilePath, warnings.join("\n"));
  },

  loadDictionaries() {
    this.dictionaries = fs
      .readdirSync(this.dictionariesFolder)
      .map((filename, index) => {
        return {
          id: index + 1,
          filename: filename,
          name: filename.replace(/^\d+-/, ""),
          path: this.dictionariesFolder + "/" + filename,
        };
      });
  },

  computeNumberOfLines() {
    this.totalNumberOfLines = 0;
    this.dictionaries.forEach((dictionary) => {
      var text = utf8Decoder.write(fs.readFileSync(dictionary.path));
      var lines = text.split(/\r?\n/);
      dictionary.numberOfLines = lines.length;
      if (_.last(lines).trim() == "") dictionary.numberOfLines -= 1;
      this.totalNumberOfLines += dictionary.numberOfLines;
    });
  },

  setupProgressBar() {
    this.progressBar = new ProgressBar(
      "Generating database (:percent) [:bar] :elapsed since starting [:current/:total]",
      {
        incomplete: " ",
        width: 30,
        total: this.totalNumberOfLines,
        callback: () => {
          this.writeWylieMistakes();
          this.exportDatabase();
          var totalTime = formatDuration(
            intervalToDuration({ start: Date.now(), end: this.startedAt })
          );
          console.log(
            "\n" +
              "Done !\n" +
              `Database generated as "public/${outputFilename}" in ${totalTime}`
          );
          if (fs.existsSync(this.linesWithMissedWylieFilePath)) {
            console.log(
              "\n" +
                "Some lines contained malformed Wylie that could not be properly " +
                "converted to Unicode.\n" +
                `They were logged to "build/${linesWithMissedWylieFilename}".`
            );
          }
        },
      }
    );
  },

  createTables() {
    this.database.run(`
      CREATE TABLE dictionaries (
        id                              integer primary key,
        name                            text not null,
        position                        integer NOT NULL,
        enabled                         boolean default true
      );
    `);
    this.database.run(`
      CREATE TABLE entries (
        id                              integer primary key,
        term                            text not null,
        termPhoneticsStrict             text not null,
        termPhoneticsLoose              text not null,
        definition                      text not null,
        definitionPhoneticsWordsStrict  text not null,
        definitionPhoneticsWordsLoose   text not null,
        dictionaryId                    integer
      );
    `);
    this.database.run(`
      CREATE VIRTUAL TABLE entries_fts USING fts5(
        term,
        termPhoneticsStrict,
        termPhoneticsLoose,
        definition,
        definitionPhoneticsWordsStrict,
        definitionPhoneticsWordsLoose,
        content='entries',
        content_rowid='id'
      );
    `);
    this.database.run(`
      CREATE TRIGGER entries_after_insert AFTER INSERT ON entries BEGIN
        INSERT INTO entries_fts(
          rowid,
          term,
          termPhoneticsStrict,
          termPhoneticsLoose,
          definition,
          definitionPhoneticsWordsStrict,
          definitionPhoneticsWordsLoose
        ) VALUES (
          new.id,
          new.term,
          new.termPhoneticsStrict,
          new.termPhoneticsLoose,
          new.definition,
          new.definitionPhoneticsWordsStrict,
          new.definitionPhoneticsWordsLoose
        );
      END;
      CREATE TRIGGER entries_after_delete AFTER DELETE ON entries BEGIN
        INSERT INTO entries_fts(
          entries_fts,
          rowid,
          term,
          termPhoneticsStrict,
          termPhoneticsLoose,
          definition,
          definitionPhoneticsWordsStrict,
          definitionPhoneticsWordsLoose
        ) VALUES (
          'delete',
          old.id,
          old.term,
          old.termPhoneticsStrict,
          old.termPhoneticsLoose,
          old.definition,
          old.definitionPhoneticsWordsStrict,
          old.definitionPhoneticsWordsLoose
        );
      END;
      CREATE TRIGGER entries_after_update AFTER UPDATE ON entries BEGIN
        INSERT INTO entries_fts(
          entries_fts,
          rowid,
          term,
          termPhoneticsStrict,
          termPhoneticsLoose,
          definition,
          definitionPhoneticsWordsStrict,
          definitionPhoneticsWordsLoose
        ) VALUES (
          'delete',
          old.id,
          old.term,
          old.termPhoneticsStrict,
          old.termPhoneticsLoose,
          old.definition,
          old.definitionPhoneticsWordsStrict,
          old.definitionPhoneticsWordsLoose
        );
        INSERT INTO entries_fts(
          rowid,
          term,
          termPhoneticsStrict,
          termPhoneticsLoose,
          definition,
          definitionPhoneticsWordsStrict,
          definitionPhoneticsWordsLoose
        ) VALUES (
          new.id,
          new.term,
          new.termPhoneticsStrict,
          new.termPhoneticsLoose,
          new.definition,
          new.definitionPhoneticsWordsStrict,
          new.definitionPhoneticsWordsLoose
        );
      END;
    `);
  },
  insertDictionaries() {
    this.dictionaries.forEach((dictionary) => {
      var id = dictionary.id;
      var position = id;
      var escapedDictionaryName = this.SQLEscape(dictionary.name);
      var statement = `INSERT INTO dictionaries VALUES (${id}, '${escapedDictionaryName}', ${position}, 1);`;
      this.database.run(statement);
    });
  },

  insertEntries() {
    this.dictionaries.forEach((dictionary) => {
      this.eachLineForFile(dictionary.path, (line) => {
        this.processLine(dictionary, line);
        this.progressBar.tick();
      });
    });
  },

  processLine(dictionary, line) {
    line = line.trim();

    if (!line) return;

    var split = line.split("|");
    var wylieTerm = cleanTerm(split[0]);
    var definitionWithMaybeWylie = split[1] && split[1].trim();

    if (line.match(/^#/) || !definitionWithMaybeWylie) return;

    var term = this.wylieToUnicode.convert(wylieTerm);
    var definition;
    var dictionaryDetails = DICTIONARIES_DETAILS[dictionary.name];
    if (dictionaryDetails && dictionaryDetails.containsOnlyTibetan) {
      definition = convertWylieButKeepNonTibetanParts(
        definitionWithMaybeWylie,
        this.wylieToUnicode
      );
    } else
      definition = this.wylieToUnicode.substituteCurlyBrackets(
        definitionWithMaybeWylie,
        (englishPart) => {
          englishPart = englishPart.replace(/([,\.]) */g, "$1 ");
          englishPart = englishPart.replace(/ *- */g, " - ");
          return englishPart;
        }
      );
    var [termPhoneticsStrict, termPhoneticsLoose] =
      strictAndLoosePhoneticsFor(term);
    var [definitionWylieWordsStrict, definitionWylieWordsLoose] =
      strictAndLoosePhoneticsFor(definition);
    var statement =
      "INSERT INTO entries VALUES(NULL, " +
      "'" +
      this.SQLEscape(term) +
      "', " +
      "'" +
      this.SQLEscape(termPhoneticsStrict) +
      "', " +
      "'" +
      this.SQLEscape(termPhoneticsLoose) +
      "', " +
      "'" +
      this.SQLEscape(definition) +
      "', " +
      "'" +
      this.SQLEscape(definitionWylieWordsStrict) +
      "', " +
      "'" +
      this.SQLEscape(definitionWylieWordsLoose) +
      "', " +
      dictionary.id +
      ");";
    this.database.run(statement);
  },

  SQLEscape(text) {
    return text.replace(/'/g, "''");
  },

  eachLineForFile(filepath, callback) {
    const rl = readline.createInterface({
      input: fs.createReadStream(filepath),
      crlfDelay: Infinity,
    });
    rl.on("line", (line) => {
      var utf8Line = utf8Decoder.write(line);
      callback(utf8Line);
    });
  },
};

DatabaseBuilder.build();
