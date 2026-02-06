/**
 * Build individual dictionary pack databases
 *
 * This script generates separate SQLite databases for each dictionary pack,
 * along with a manifest file for the download system.
 *
 * Usage: pnpm run build:packs
 */

import fs from "fs";
import path from "path";
import _ from "underscore";
import readline from "readline";
import { StringDecoder } from "string_decoder";
import crypto from "crypto";
const utf8Decoder = new StringDecoder("utf8");

import ProgressBar from "progress";
import { formatDuration, intervalToDuration } from "date-fns";
import _7z from '7zip-min';

import initSqlJs from "../public/sql-wasm.js";

import WylieToUnicode from "../src/services/wylie-to-unicode.js";

import DICTIONARIES_DETAILS from "../src/services/dictionaries-details.js";
import {
  cleanTerm,
  strictAndLoosePhoneticsFor,
  convertWylieButKeepNonTibetanParts,
} from "../src/utils.js";

import { PACK_DEFINITIONS } from "./config/pack-dictionaries.js";

const packsFolder = path.join(__dirname, "..", "public", "packs");
const manifestPath = path.join(packsFolder, "pack-manifest.json");

// Ensure packs folder exists
if (!fs.existsSync(packsFolder)) {
  fs.mkdirSync(packsFolder, { recursive: true });
}

var PackDatabaseBuilder = {
  dictionariesFolder: path.join(__dirname, "dictionaries"),

  async build() {
    this.startedAt = Date.now();
    console.log("\n=== Building Dictionary Packs ===\n");

    this.setupWylieToUnicode();
    this.loadAllDictionaries();

    // Build each pack
    for (const [packId, packDef] of Object.entries(PACK_DEFINITIONS)) {
      await this.buildPack(packId, packDef);
    }

    // Generate manifest
    await this.generateManifest();

    const totalTime = formatDuration(
      intervalToDuration({ start: Date.now(), end: this.startedAt })
    );
    console.log(`\n=== All packs built in ${totalTime} ===\n`);
  },

  setupWylieToUnicode() {
    this.wylieToUnicode = new WylieToUnicode();
  },

  loadAllDictionaries() {
    this.allDictionaries = fs
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

  async buildPack(packId, packDef) {
    console.log(`\nBuilding pack: ${packDef.name}`);

    const outputFilename = `${packId}.sqlite`;
    const outputFilepath = path.join(packsFolder, outputFilename);

    // Filter dictionaries for this pack
    const packDictionaries = this.allDictionaries.filter(dict =>
      packDef.dictionaries.includes(dict.name)
    );

    if (packDictionaries.length === 0) {
      console.log(`  Warning: No dictionaries found for pack ${packId}`);
      return;
    }

    console.log(`  Dictionaries: ${packDictionaries.length}`);

    // Compute total lines
    let totalLines = 0;
    packDictionaries.forEach((dictionary) => {
      var text = utf8Decoder.write(fs.readFileSync(dictionary.path));
      var lines = text.split(/\r?\n/);
      dictionary.numberOfLines = lines.length;
      if (_.last(lines).trim() == "") dictionary.numberOfLines -= 1;
      totalLines += dictionary.numberOfLines;
    });

    console.log(`  Entries: ~${totalLines}`);

    // Initialize database
    const SQL = await initSqlJs();
    const database = new SQL.Database();

    // Create tables
    this.createTables(database);

    // Insert dictionaries with pack-local IDs
    packDictionaries.forEach((dictionary, index) => {
      const id = index + 1;
      const position = id;
      const escapedName = this.SQLEscape(dictionary.name);
      database.run(`INSERT INTO dictionaries VALUES (${id}, '${escapedName}', ${position}, 1);`);
      dictionary.packLocalId = id;
    });

    // Setup progress bar
    const progressBar = new ProgressBar(
      `  Generating [:bar] :percent :elapsed s`,
      {
        incomplete: " ",
        width: 30,
        total: totalLines,
      }
    );

    // Insert entries
    for (const dictionary of packDictionaries) {
      await this.insertEntriesForDictionary(database, dictionary, progressBar);
    }

    // Export database
    const data = database.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(outputFilepath, buffer);

    const sizeBytes = fs.statSync(outputFilepath).size;
    const sizeMB = (sizeBytes / 1024 / 1024).toFixed(1);
    console.log(`  Database size: ${sizeMB} MB`);

    // Compress with 7z
    await this.compressPack(packId, outputFilepath);
  },

  createTables(database) {
    database.run(`
      CREATE TABLE dictionaries (
        id                              integer primary key,
        name                            text not null,
        position                        integer NOT NULL,
        enabled                         boolean default true
      );
    `);
    database.run(`
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
    database.run(`
      CREATE VIRTUAL TABLE entries_fts USING fts5(
        term,
        termPhoneticsStrict,
        termPhoneticsLoose,
        definition,
        definitionPhoneticsWordsStrict,
        definitionPhoneticsWordsLoose,
        content = 'entries',
        content_rowid = 'id',
        tokenize = 'unicode61'
      );
    `);
    database.run(`
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
    // Index for fast LIKE queries on Tibetan terms (hybrid search approach)
    database.run(`CREATE INDEX idx_entries_term ON entries(term);`);
  },

  async insertEntriesForDictionary(database, dictionary, progressBar) {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: fs.createReadStream(dictionary.path),
        crlfDelay: Infinity,
      });

      rl.on("line", (line) => {
        const utf8Line = utf8Decoder.write(line);
        this.processLine(database, dictionary, utf8Line);
        progressBar.tick();
      });

      rl.on("close", resolve);
    });
  },

  processLine(database, dictionary, line) {
    line = line.trim();

    if (!line) return;

    var split = line.split("|");
    var wylieTerm = cleanTerm(split[0]);
    var definitionWithMaybeWylie = split[1] && split[1].trim();

    if (line.match(/^#/) || !definitionWithMaybeWylie) return;

    var term = this.wylieToUnicode.convert(wylieTerm);
    if (!term.match(/[་།༑༔]$/))
      term += "་";
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
      "'" + this.SQLEscape(term) + "', " +
      "'" + this.SQLEscape(termPhoneticsStrict) + "', " +
      "'" + this.SQLEscape(termPhoneticsLoose) + "', " +
      "'" + this.SQLEscape(definition) + "', " +
      "'" + this.SQLEscape(definitionWylieWordsStrict) + "', " +
      "'" + this.SQLEscape(definitionWylieWordsLoose) + "', " +
      dictionary.packLocalId +
      ");";
    database.run(statement);
  },

  SQLEscape(text) {
    return text.replace(/'/g, "''");
  },

  async compressPack(packId, sqlitePath) {
    const compressedPath = path.join(packsFolder, `${packId}.7z`);

    // Remove existing compressed file
    if (fs.existsSync(compressedPath)) {
      fs.unlinkSync(compressedPath);
    }

    return new Promise((resolve, reject) => {
      _7z.cmd(['a', '-mx=9', compressedPath, sqlitePath], (error) => {
        if (error) {
          console.error(`  7z error: ${error.message}`);
          reject(error);
          return;
        }

        const compressedSize = fs.statSync(compressedPath).size;
        const compressedMB = (compressedSize / 1024 / 1024).toFixed(1);
        console.log(`  Compressed: ${compressedMB} MB`);
        resolve();
      });
    });
  },

  async generateManifest() {
    console.log("\nGenerating manifest...");

    // Schema version - bump this when database structure changes incompatibly
    // Apps will only download packs with matching schema version
    // v2: Added schema version tracking
    // v3: Hybrid search - unicode61 FTS for phonetics/English, LIKE with term index for Tibetan
    const SCHEMA_VERSION = 3;

    const manifest = {
      schemaVersion: SCHEMA_VERSION,
      generated: new Date().toISOString(),
      packs: {}
    };

    for (const [packId, packDef] of Object.entries(PACK_DEFINITIONS)) {
      const sqlitePath = path.join(packsFolder, `${packId}.sqlite`);
      const compressedPath = path.join(packsFolder, `${packId}.7z`);

      if (!fs.existsSync(sqlitePath) || !fs.existsSync(compressedPath)) {
        console.log(`  Skipping ${packId}: files not found`);
        continue;
      }

      const sqliteSize = fs.statSync(sqlitePath).size;
      const compressedSize = fs.statSync(compressedPath).size;
      const checksum = await this.computeChecksum(compressedPath);

      manifest.packs[packId] = {
        id: packId,
        name: packDef.name,
        description: packDef.description,
        required: packDef.required,
        dictionaryCount: packDef.dictionaries.length,
        files: {
          sqlite: {
            filename: `${packId}.sqlite`,
            size: sqliteSize,
            sizeMB: (sqliteSize / 1024 / 1024).toFixed(1)
          },
          compressed: {
            filename: `${packId}.7z`,
            size: compressedSize,
            sizeMB: (compressedSize / 1024 / 1024).toFixed(1)
          }
        },
        checksum: checksum
      };
    }

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`Manifest written to: ${manifestPath}`);
  },

  async computeChecksum(filepath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filepath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }
};

PackDatabaseBuilder.build();
