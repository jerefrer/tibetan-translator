# Custom Dictionary Packs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users install personal dictionary packs (`.tibdict` files) via drag-and-drop or a file picker, reusing the existing pack SQLite format; and provide a build-time script to convert Anki `.apkg` decks into `.tibdict` files.

**Architecture:** A `.tibdict` is a ZIP containing `manifest.json` + `data.sqlite` (same SQLite schema as official packs). Rust exposes new Tauri commands for install/list/remove; custom packs are stored under `packs/custom/<id>/` and the existing pack-discovery function is extended to find them, so all existing search/query code keeps working. Frontend adds a new "Dictionnaires personnalisés" section in `ConfigurePage` and listens to Tauri's drag-drop events.

**Tech Stack:** Node.js (build script), vitest (tests), Vue 3 Options API + Vuetify 3 (UI), Rust + rusqlite + `zip` crate (Tauri backend), Tauri 2 v2 drag-drop API.

**Spec:** [`docs/superpowers/specs/2026-04-23-custom-dictionary-packs-design.md`](../specs/2026-04-23-custom-dictionary-packs-design.md)

---

## File structure

**New files**

| Path | Responsibility |
|---|---|
| `build/convert-anki-to-tibdict.js` | CLI entry point for APKG → .tibdict conversion |
| `build/lib/apkg-reader.js` | Parse an `.apkg` file and return its notes |
| `build/lib/pack-schema.js` | Shared SQLite schema/trigger setup (used by build-packs.js and convert script) |
| `build/lib/tibdict-writer.js` | Package `manifest.json` + `data.sqlite` into a `.tibdict` ZIP |
| `build/inalco.tibdict-config.json` | Config describing the INALCO pack build |
| `src-tauri/src/custom_packs.rs` | Tauri commands: install_custom_pack, list_custom_packs, remove_custom_pack + validation |
| `src/services/custom-pack-importer.js` | Frontend orchestration: pick/drop file → invoke Rust → refresh state |
| `src/components/CustomPackSection.vue` | UI section in ConfigurePage |
| `src/components/CustomPackConflictModal.vue` | Modal asking whether to replace existing pack |
| `tests/apkg-reader.test.js` | Tests for APKG reader |
| `tests/convert-anki-to-tibdict.test.js` | Tests for the conversion pipeline |
| `tests/custom-pack-importer.test.js` | Tests for frontend import validation logic |

**Modified files**

| Path | Change |
|---|---|
| `build/build-packs.js` | Extract schema creation into `build/lib/pack-schema.js` (no behavior change) |
| `package.json` | Add dev deps (`adm-zip`, `@mongodb-js/zstd`) and `build:tibdict` script |
| `src-tauri/Cargo.toml` | Add `zip = "2"` dependency |
| `src-tauri/src/main.rs` | Register new custom-pack commands |
| `src-tauri/src/packs.rs` | Extend `get_all_pack_db_paths` and `get_pack_path` to find custom packs under `packs/custom/<id>/data.sqlite` |
| `src/config/pack-definitions.js` | Export `MAX_SUPPORTED_FORMAT_VERSION = 1` for `.tibdict` envelope |
| `src/services/pack-manager.js` | Load custom packs at init, expose `installCustomPack` / `removeCustomPack` / `customPacks` getter |
| `src/components/ConfigurePage.vue` | Render `CustomPackSection` (hidden in web mode) |
| `src/App.vue` | Subscribe to drag-drop events and route `.tibdict` files to the importer |

---

## Phase A — Build-time conversion script (standalone)

Produces a working `.tibdict` file from `.apkg` inputs. Does not touch the app.

### Task A1: Set up the build folder structure and dependencies

**Files:**
- Modify: `package.json`
- Create: `build/lib/.gitkeep`

- [ ] **Step 1: Add the two new dev dependencies**

```bash
pnpm add -D adm-zip@^0.5 @mongodb-js/zstd@^2
```

- [ ] **Step 2: Add a `build:tibdict` script to `package.json`**

Open `package.json`, locate the `"scripts"` block (around line 32), and add this line right after `"build:packs": ...`:

```json
"build:tibdict": "node build/convert-anki-to-tibdict.js",
```

- [ ] **Step 3: Create the lib folder placeholder**

```bash
mkdir -p build/lib
touch build/lib/.gitkeep
```

- [ ] **Step 4: Verify install succeeded**

Run: `pnpm install` (should already be done by step 1) and `node -e "require('adm-zip'); require('@mongodb-js/zstd')"`
Expected: no output (success)

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml build/lib/.gitkeep
git commit -m "chore(tibdict): add deps and script for .tibdict builder"
```

---

### Task A2: Extract shared pack SQLite schema

Pulls the table/trigger/index creation logic out of `build-packs.js` into a reusable module so the conversion script can use the exact same schema.

**Files:**
- Create: `build/lib/pack-schema.js`
- Modify: `build/build-packs.js` (around lines 158-274)
- Test: `tests/pack-schema.test.js` (new file)

- [ ] **Step 1: Write the failing test**

Create `tests/pack-schema.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import initSqlJs from '../public/sql-wasm.js';
import { createPackTables } from '../build/lib/pack-schema.js';

describe('createPackTables', () => {
  it('creates the expected tables, triggers, and index', async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    createPackTables(db);

    const tables = db
      .exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")[0]
      .values.flat();
    expect(tables).toEqual(expect.arrayContaining(['dictionaries', 'entries', 'entries_fts']));

    const triggers = db
      .exec("SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name")[0]
      .values.flat();
    expect(triggers).toEqual([
      'entries_after_delete',
      'entries_after_insert',
      'entries_after_update',
    ]);

    const indexes = db
      .exec("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_entries_term'")[0];
    expect(indexes).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test (should fail)**

Run: `pnpm test -- tests/pack-schema.test.js`
Expected: FAIL because `build/lib/pack-schema.js` does not exist.

- [ ] **Step 3: Create `build/lib/pack-schema.js`**

```javascript
/**
 * Shared SQLite schema for dictionary packs (official and custom).
 *
 * Both build-packs.js and convert-anki-to-tibdict.js use this to guarantee
 * the exact same schema in every pack.
 */

export function createPackTables(database) {
  database.run(`
    CREATE TABLE dictionaries (
      id        integer primary key,
      name      text not null,
      position  integer NOT NULL,
      enabled   boolean default true
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
        rowid, term, termPhoneticsStrict, termPhoneticsLoose,
        definition, definitionPhoneticsWordsStrict, definitionPhoneticsWordsLoose
      ) VALUES (
        new.id, new.term, new.termPhoneticsStrict, new.termPhoneticsLoose,
        new.definition, new.definitionPhoneticsWordsStrict, new.definitionPhoneticsWordsLoose
      );
    END;
    CREATE TRIGGER entries_after_delete AFTER DELETE ON entries BEGIN
      INSERT INTO entries_fts(
        entries_fts, rowid, term, termPhoneticsStrict, termPhoneticsLoose,
        definition, definitionPhoneticsWordsStrict, definitionPhoneticsWordsLoose
      ) VALUES (
        'delete', old.id, old.term, old.termPhoneticsStrict, old.termPhoneticsLoose,
        old.definition, old.definitionPhoneticsWordsStrict, old.definitionPhoneticsWordsLoose
      );
    END;
    CREATE TRIGGER entries_after_update AFTER UPDATE ON entries BEGIN
      INSERT INTO entries_fts(
        entries_fts, rowid, term, termPhoneticsStrict, termPhoneticsLoose,
        definition, definitionPhoneticsWordsStrict, definitionPhoneticsWordsLoose
      ) VALUES (
        'delete', old.id, old.term, old.termPhoneticsStrict, old.termPhoneticsLoose,
        old.definition, old.definitionPhoneticsWordsStrict, old.definitionPhoneticsWordsLoose
      );
      INSERT INTO entries_fts(
        rowid, term, termPhoneticsStrict, termPhoneticsLoose,
        definition, definitionPhoneticsWordsStrict, definitionPhoneticsWordsLoose
      ) VALUES (
        new.id, new.term, new.termPhoneticsStrict, new.termPhoneticsLoose,
        new.definition, new.definitionPhoneticsWordsStrict, new.definitionPhoneticsWordsLoose
      );
    END;
  `);

  database.run(`CREATE INDEX idx_entries_term ON entries(term);`);
}
```

- [ ] **Step 4: Run the test (should pass)**

Run: `pnpm test -- tests/pack-schema.test.js`
Expected: PASS

- [ ] **Step 5: Replace the inline schema in `build-packs.js`**

Open `build/build-packs.js`. Near the top (after the other imports), add:

```javascript
import { createPackTables } from "./lib/pack-schema.js";
```

Then replace the entire `createTables(database) { ... }` method (around lines 158-274) with:

```javascript
  createTables(database) {
    createPackTables(database);
  },
```

- [ ] **Step 6: Sanity check — build-packs.js still parses**

Run: `node --check build/build-packs.js`
Expected: no output (success)

- [ ] **Step 7: Commit**

```bash
git add build/lib/pack-schema.js build/build-packs.js tests/pack-schema.test.js
git commit -m "refactor(packs): extract shared SQLite schema to build/lib/pack-schema"
```

---

### Task A3: Implement the APKG reader

Reads notes (as `[field0, field1]` pairs) from an `.apkg` file.

**Files:**
- Create: `build/lib/apkg-reader.js`
- Test: `tests/apkg-reader.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/apkg-reader.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { readApkgNotes } from '../build/lib/apkg-reader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '../INALCO_L1_voca.apkg');

describe('readApkgNotes', () => {
  it('returns an array of [field0, field1] note pairs from a real APKG', async () => {
    const notes = await readApkgNotes(FIXTURES);
    expect(Array.isArray(notes)).toBe(true);
    expect(notes.length).toBeGreaterThan(0);
    for (const n of notes) {
      expect(Array.isArray(n)).toBe(true);
      expect(n.length).toBe(2);
      expect(typeof n[0]).toBe('string');
      expect(typeof n[1]).toBe('string');
    }
    // First entry of INALCO_L1_voca is "je ; moi" → "ང་།"
    const first = notes.find(([a, b]) => a.startsWith('je'));
    expect(first).toBeDefined();
    expect(first[1]).toContain('ང'); // Tibetan NGA
  });

  it('rejects when given a non-existent file', async () => {
    await expect(readApkgNotes('/does/not/exist.apkg')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the test (should fail)**

Run: `pnpm test -- tests/apkg-reader.test.js`
Expected: FAIL because `build/lib/apkg-reader.js` does not exist.

- [ ] **Step 3: Implement `readApkgNotes`**

Create `build/lib/apkg-reader.js`:

```javascript
/**
 * APKG reader.
 *
 * Newer Anki .apkg archives contain a zstd-compressed `collection.anki21b`
 * SQLite database (in addition to the legacy placeholder `collection.anki2`).
 * We extract that file, decompress it, open it, and read the `notes` table.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import AdmZip from 'adm-zip';
import { decompress } from '@mongodb-js/zstd';
import initSqlJs from '../../public/sql-wasm.js';

/**
 * Read all notes from an .apkg file.
 *
 * @param {string} apkgPath - absolute path to the .apkg file
 * @returns {Promise<Array<[string, string]>>} - array of [field0, field1] pairs
 *
 * Notes whose `flds` has more than 2 fields return only the first two.
 * Notes with fewer than 2 fields are skipped silently.
 */
export async function readApkgNotes(apkgPath) {
  if (!fs.existsSync(apkgPath)) {
    throw new Error(`APKG not found: ${apkgPath}`);
  }

  const zip = new AdmZip(apkgPath);
  const entries = zip.getEntries();
  const dbEntry = entries.find((e) => e.entryName === 'collection.anki21b');

  if (!dbEntry) {
    throw new Error(`APKG ${apkgPath} does not contain collection.anki21b`);
  }

  const compressed = dbEntry.getData();
  const rawSqlite = await decompress(compressed);

  const SQL = await initSqlJs();
  const db = new SQL.Database(new Uint8Array(rawSqlite));

  try {
    const result = db.exec('SELECT flds FROM notes WHERE flds IS NOT NULL');
    if (!result.length) return [];

    const [{ values }] = result;
    const notes = [];
    for (const row of values) {
      const flds = row[0];
      if (typeof flds !== 'string') continue;
      const parts = flds.split('\x1f'); // ASCII unit separator
      if (parts.length < 2) continue;
      notes.push([parts[0], parts[1]]);
    }
    return notes;
  } finally {
    db.close();
  }
}
```

- [ ] **Step 4: Run the test (should pass)**

Run: `pnpm test -- tests/apkg-reader.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add build/lib/apkg-reader.js tests/apkg-reader.test.js
git commit -m "feat(tibdict): add apkg reader for .apkg to notes extraction"
```

---

### Task A4: Implement entry normalization and deduplication

Turns raw `[field0, field1]` note pairs into clean `{ term, definition }` entries.

**Files:**
- Create: `build/lib/normalize-entries.js`
- Test: `tests/normalize-entries.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/normalize-entries.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { normalizeEntries } from '../build/lib/normalize-entries.js';

describe('normalizeEntries', () => {
  it('maps non-reversed notes [fr, tib] to { term: tib, definition: fr }', () => {
    const notes = [['je ; moi', 'ང་།']];
    const out = normalizeEntries(notes, { reversed: false });
    expect(out).toEqual([{ term: 'ང་།', definition: 'je ; moi' }]);
  });

  it('maps reversed notes [tib, fr] to { term: tib, definition: fr }', () => {
    const notes = [['ང་།', 'je ; moi']];
    const out = normalizeEntries(notes, { reversed: true });
    expect(out).toEqual([{ term: 'ང་།', definition: 'je ; moi' }]);
  });

  it('replaces <br> and <br/> with newlines', () => {
    const notes = [['line1<br>line2<br/>line3', 'ང་།']];
    const out = normalizeEntries(notes, { reversed: false });
    expect(out[0].definition).toBe('line1\nline2\nline3');
  });

  it('decodes HTML entities', () => {
    const notes = [['&nbsp;hello&amp;world&lt;&gt;&quot;&#39;', 'ང་།']];
    const out = normalizeEntries(notes, { reversed: false });
    expect(out[0].definition).toBe(' hello&world<>"\'');
  });

  it('trims surrounding whitespace', () => {
    const notes = [['   spaced   ', '   ང་།   ']];
    const out = normalizeEntries(notes, { reversed: false });
    expect(out[0]).toEqual({ term: 'ང་།', definition: 'spaced' });
  });

  it('skips entries with empty Tibetan', () => {
    const notes = [['fr', ''], ['fr', '   ']];
    const out = normalizeEntries(notes, { reversed: false });
    expect(out).toEqual([]);
  });

  it('deduplicates exact (term, definition) pairs', () => {
    const notes = [
      ['je', 'ང་།'],
      ['je', 'ང་།'],
      ['moi', 'ང་།'],
    ];
    const out = normalizeEntries(notes, { reversed: false });
    expect(out).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the test (should fail)**

Run: `pnpm test -- tests/normalize-entries.test.js`
Expected: FAIL because `build/lib/normalize-entries.js` does not exist.

- [ ] **Step 3: Implement `normalizeEntries`**

Create `build/lib/normalize-entries.js`:

```javascript
/**
 * Normalize raw APKG notes into clean { term, definition } entries.
 *
 * - decodes <br>, <br/>, &nbsp;, &amp;, &lt;, &gt;, &quot;, &#39;
 * - trims whitespace
 * - maps reversed decks (deck has [tib, fr] instead of [fr, tib])
 * - drops notes with empty Tibetan
 * - deduplicates exact (term, definition) pairs
 */

export function normalizeEntries(notes, { reversed }) {
  const seen = new Set();
  const out = [];

  for (const [field0, field1] of notes) {
    const [fr, tib] = reversed ? [field1, field0] : [field0, field1];
    const cleanedTerm = cleanText(tib);
    const cleanedDef = cleanText(fr);

    if (!cleanedTerm) continue;

    const key = cleanedTerm + '\x00' + cleanedDef;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ term: cleanedTerm, definition: cleanedDef });
  }

  return out;
}

function cleanText(s) {
  if (typeof s !== 'string') return '';
  let out = s;
  out = out.replace(/<br\s*\/?>/gi, '\n');
  out = out.replace(/&nbsp;/g, ' ');
  out = out.replace(/&amp;/g, '&');
  out = out.replace(/&lt;/g, '<');
  out = out.replace(/&gt;/g, '>');
  out = out.replace(/&quot;/g, '"');
  out = out.replace(/&#39;/g, "'");
  return out.trim();
}
```

- [ ] **Step 4: Run the test (should pass)**

Run: `pnpm test -- tests/normalize-entries.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add build/lib/normalize-entries.js tests/normalize-entries.test.js
git commit -m "feat(tibdict): add entry normalization and dedup"
```

---

### Task A5: Build the SQLite database for a `.tibdict`

Takes normalized entries and produces a single-dictionary `data.sqlite` buffer, using the shared schema. Also adds the final tsheg and computes phonetics like the official pipeline.

**Files:**
- Create: `build/lib/build-tibdict-sqlite.js`
- Test: `tests/build-tibdict-sqlite.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/build-tibdict-sqlite.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import initSqlJs from '../public/sql-wasm.js';
import { buildTibdictSqlite } from '../build/lib/build-tibdict-sqlite.js';

describe('buildTibdictSqlite', () => {
  it('creates a SQLite buffer with one dictionary and the given entries', async () => {
    const buffer = await buildTibdictSqlite({
      dictionaryName: 'Test',
      entries: [
        { term: 'ང', definition: 'je' },
        { term: 'ཁོང་', definition: 'il' },
      ],
    });

    const SQL = await initSqlJs();
    const db = new SQL.Database(new Uint8Array(buffer));

    const dicts = db.exec('SELECT id, name, position, enabled FROM dictionaries')[0].values;
    expect(dicts).toEqual([[1, 'Test', 1, 1]]);

    const entries = db.exec('SELECT term, definition, dictionaryId FROM entries ORDER BY term')[0].values;
    // First term "ང" got a tsheg appended. Second "ཁོང་" already had one.
    expect(entries[0][0]).toBe('ཁོང་');
    expect(entries[1][0]).toBe('ང་');
    expect(entries[0][2]).toBe(1); // dictionaryId
    expect(entries[1][2]).toBe(1);
  });

  it('writes non-empty phonetics columns for Tibetan terms', async () => {
    const buffer = await buildTibdictSqlite({
      dictionaryName: 'Test',
      entries: [{ term: 'ང', definition: 'je' }],
    });

    const SQL = await initSqlJs();
    const db = new SQL.Database(new Uint8Array(buffer));
    const row = db.exec('SELECT termPhoneticsStrict, termPhoneticsLoose FROM entries')[0].values[0];
    expect(row[0].length).toBeGreaterThan(0);
    expect(row[1].length).toBeGreaterThan(0);
  });

  it('escapes single quotes in definitions without failing', async () => {
    const buffer = await buildTibdictSqlite({
      dictionaryName: 'Test',
      entries: [{ term: 'ང', definition: "aujourd'hui" }],
    });

    const SQL = await initSqlJs();
    const db = new SQL.Database(new Uint8Array(buffer));
    const row = db.exec('SELECT definition FROM entries')[0].values[0];
    expect(row[0]).toBe("aujourd'hui");
  });
});
```

- [ ] **Step 2: Run the test (should fail)**

Run: `pnpm test -- tests/build-tibdict-sqlite.test.js`
Expected: FAIL because `build/lib/build-tibdict-sqlite.js` does not exist.

- [ ] **Step 3: Implement `buildTibdictSqlite`**

Create `build/lib/build-tibdict-sqlite.js`:

```javascript
/**
 * Build the data.sqlite buffer for a .tibdict pack.
 *
 * Uses the shared pack schema and mirrors build-packs.js:
 *   - ensures each term ends with a Tibetan punctuation mark (adds tsheg otherwise)
 *   - computes strict/loose phonetics for both term and definition
 *   - inserts all entries under a single dictionary with id=1
 */

import initSqlJs from '../../public/sql-wasm.js';
import { createPackTables } from './pack-schema.js';
import { strictAndLoosePhoneticsFor } from '../../src/utils.js';

export async function buildTibdictSqlite({ dictionaryName, entries }) {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  createPackTables(db);

  const dictId = 1;
  const escName = sqlEscape(dictionaryName);
  db.run(`INSERT INTO dictionaries VALUES (${dictId}, '${escName}', 1, 1);`);

  for (const entry of entries) {
    const term = ensureTrailingTsheg(entry.term);
    const [ts, tl] = strictAndLoosePhoneticsFor(term);
    const [ds, dl] = strictAndLoosePhoneticsFor(entry.definition);

    db.run(
      `INSERT INTO entries VALUES (
        NULL,
        '${sqlEscape(term)}',
        '${sqlEscape(ts)}',
        '${sqlEscape(tl)}',
        '${sqlEscape(entry.definition)}',
        '${sqlEscape(ds)}',
        '${sqlEscape(dl)}',
        ${dictId}
      );`
    );
  }

  const data = db.export();
  db.close();
  return Buffer.from(data);
}

function ensureTrailingTsheg(term) {
  if (!term.match(/[་།༑༔]$/)) return term + '་';
  return term;
}

function sqlEscape(text) {
  return String(text).replace(/'/g, "''");
}
```

- [ ] **Step 4: Run the test (should pass)**

Run: `pnpm test -- tests/build-tibdict-sqlite.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add build/lib/build-tibdict-sqlite.js tests/build-tibdict-sqlite.test.js
git commit -m "feat(tibdict): build data.sqlite for custom packs"
```

---

### Task A6: Package manifest + sqlite into a `.tibdict` ZIP

**Files:**
- Create: `build/lib/tibdict-writer.js`
- Test: `tests/tibdict-writer.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/tibdict-writer.test.js`:

```javascript
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import AdmZip from 'adm-zip';
import { writeTibdict } from '../build/lib/tibdict-writer.js';

let tmpFile;

afterEach(() => {
  if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
});

describe('writeTibdict', () => {
  it('writes a ZIP with manifest.json and data.sqlite', async () => {
    tmpFile = path.join(os.tmpdir(), `test-${Date.now()}.tibdict`);
    const sqlite = Buffer.from([0x53, 0x51, 0x4c, 0x69, 0x74, 0x65]); // fake header
    const manifest = { format: 'tibdict', formatVersion: 1, id: 'x', name: 'X' };

    await writeTibdict(tmpFile, manifest, sqlite);

    const zip = new AdmZip(tmpFile);
    const names = zip.getEntries().map((e) => e.entryName).sort();
    expect(names).toEqual(['data.sqlite', 'manifest.json']);

    const parsed = JSON.parse(zip.readAsText('manifest.json'));
    expect(parsed.format).toBe('tibdict');
    expect(parsed.id).toBe('x');

    expect(zip.readFile('data.sqlite').slice(0, 6).toString()).toBe('SQLite');
  });
});
```

- [ ] **Step 2: Run the test (should fail)**

Run: `pnpm test -- tests/tibdict-writer.test.js`
Expected: FAIL because `build/lib/tibdict-writer.js` does not exist.

- [ ] **Step 3: Implement `writeTibdict`**

Create `build/lib/tibdict-writer.js`:

```javascript
/**
 * Package a manifest object and a data.sqlite buffer into a .tibdict ZIP file.
 */

import fs from 'fs';
import AdmZip from 'adm-zip';

export async function writeTibdict(outputPath, manifest, sqliteBuffer) {
  const zip = new AdmZip();
  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf-8'));
  zip.addFile('data.sqlite', sqliteBuffer);
  await new Promise((resolve, reject) => {
    zip.writeZip(outputPath, (err) => (err ? reject(err) : resolve()));
  });
}
```

- [ ] **Step 4: Run the test (should pass)**

Run: `pnpm test -- tests/tibdict-writer.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add build/lib/tibdict-writer.js tests/tibdict-writer.test.js
git commit -m "feat(tibdict): write .tibdict archive"
```

---

### Task A7: Wire up the CLI entry point

Composes A3, A4, A5, A6 into a runnable script driven by a config file.

**Files:**
- Create: `build/convert-anki-to-tibdict.js`
- Create: `build/inalco.tibdict-config.json`

- [ ] **Step 1: Create the INALCO config**

Create `build/inalco.tibdict-config.json`:

```json
{
  "id": "inalco-fr-tib",
  "name": "INALCO Français-Tibétain",
  "description": "Vocabulaire L1 et L2 du cursus INALCO, tiré de decks Anki personnels.",
  "author": "Jérémy Frère",
  "version": "1.0.0",
  "icon": "mdi-school-outline",
  "dictionary": {
    "name": "INALCO Français-Tibétain",
    "sources": [
      { "file": "INALCO_L1_voca.apkg",         "reversed": false },
      { "file": "INALCO_L1_expression.apkg",   "reversed": false },
      { "file": "INALCO_L2.apkg",              "reversed": false },
      { "file": "INALCO - L2 - Leçon 3.apkg",  "reversed": true  }
    ]
  }
}
```

- [ ] **Step 2: Create the CLI script**

Create `build/convert-anki-to-tibdict.js`:

```javascript
#!/usr/bin/env node
/**
 * APKG → .tibdict converter.
 *
 * Usage:
 *   node build/convert-anki-to-tibdict.js --config <file.json> [--output <file.tibdict>]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readApkgNotes } from './lib/apkg-reader.js';
import { normalizeEntries } from './lib/normalize-entries.js';
import { buildTibdictSqlite } from './lib/build-tibdict-sqlite.js';
import { writeTibdict } from './lib/tibdict-writer.js';
import { SUPPORTED_SCHEMA_VERSION } from '../src/config/pack-definitions.js';

const FORMAT_VERSION = 1;

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    args[key] = argv[i + 1];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.config) {
    console.error('Usage: node build/convert-anki-to-tibdict.js --config <config.json> [--output <file.tibdict>]');
    process.exit(1);
  }

  const configPath = path.resolve(process.cwd(), args.config);
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const configDir = path.dirname(configPath);
  const projectRoot = path.resolve(fileURLToPath(import.meta.url), '..', '..');

  const outputPath = path.resolve(
    process.cwd(),
    args.output || `${config.id}.tibdict`
  );

  console.log(`\n=== Converting to ${path.basename(outputPath)} ===\n`);

  // Collect notes from all sources
  const allNotes = [];
  for (const source of config.dictionary.sources) {
    // Resolve source file: try config dir first, then project root
    let sourcePath = path.resolve(configDir, source.file);
    if (!fs.existsSync(sourcePath)) {
      sourcePath = path.resolve(projectRoot, source.file);
    }

    console.log(`  Reading: ${source.file} (reversed=${source.reversed})`);
    try {
      const notes = await readApkgNotes(sourcePath);
      const normalized = normalizeEntries(notes, { reversed: !!source.reversed });
      console.log(`    → ${notes.length} raw notes, ${normalized.length} kept after normalization`);
      for (const entry of normalized) allNotes.push(entry);
    } catch (err) {
      console.warn(`    ⚠️  Skipping ${source.file}: ${err.message}`);
    }
  }

  // Deduplicate across sources too
  const seen = new Set();
  const finalEntries = [];
  for (const e of allNotes) {
    const key = e.term + '\x00' + e.definition;
    if (seen.has(key)) continue;
    seen.add(key);
    finalEntries.push(e);
  }

  if (finalEntries.length === 0) {
    console.error('\n❌ No entries collected. Aborting.\n');
    process.exit(2);
  }

  console.log(`\n  Total entries: ${finalEntries.length}`);

  // Build SQLite
  const sqliteBuffer = await buildTibdictSqlite({
    dictionaryName: config.dictionary.name,
    entries: finalEntries,
  });

  // Build manifest
  const manifest = {
    format: 'tibdict',
    formatVersion: FORMAT_VERSION,
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    id: config.id,
    name: config.name,
    description: config.description,
    ...(config.author && { author: config.author }),
    ...(config.version && { version: config.version }),
    createdAt: new Date().toISOString(),
    ...(config.icon && { icon: config.icon }),
    dictionaries: [{ name: config.dictionary.name, entriesCount: finalEntries.length }],
  };

  // Write archive
  await writeTibdict(outputPath, manifest, sqliteBuffer);
  const sizeKB = (fs.statSync(outputPath).size / 1024).toFixed(1);
  console.log(`\n✅ Wrote ${outputPath} (${sizeKB} kB)\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Run the script on the real INALCO files**

Run:
```bash
node build/convert-anki-to-tibdict.js --config build/inalco.tibdict-config.json --output inalco-fr-tib.tibdict
```

Expected: console output listing 4 source files and a final entry count ≥ 150, plus a new `inalco-fr-tib.tibdict` file in the project root.

- [ ] **Step 4: Verify the output archive structure**

Run:
```bash
unzip -l inalco-fr-tib.tibdict
```

Expected output contains both `manifest.json` and `data.sqlite`.

Run:
```bash
unzip -p inalco-fr-tib.tibdict manifest.json | head -20
```

Expected: valid JSON with `"format": "tibdict"`, `"schemaVersion": 3`, `"id": "inalco-fr-tib"`.

- [ ] **Step 5: Commit**

```bash
git add build/convert-anki-to-tibdict.js build/inalco.tibdict-config.json
git commit -m "feat(tibdict): add APKG to .tibdict CLI converter"
```

---

## Phase B — Rust backend for custom packs

Adds install/list/remove commands and extends pack discovery.

### Task B1: Add the `zip` crate dependency

**Files:**
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Add the dependency**

Open `src-tauri/Cargo.toml`. In the `[dependencies]` block (below line 36), add:

```toml
zip = { version = "2", default-features = false, features = ["deflate"] }
```

- [ ] **Step 2: Verify the crate resolves**

Run: `cd src-tauri && cargo check`
Expected: compiles (may take a while the first time).

- [ ] **Step 3: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "chore(tauri): add zip crate for custom pack support"
```

---

### Task B2: Implement `custom_packs` module (install/list/remove)

**Files:**
- Create: `src-tauri/src/custom_packs.rs`
- Modify: `src-tauri/src/main.rs` (register module and commands)

- [ ] **Step 1: Create the module file**

Create `src-tauri/src/custom_packs.rs`:

```rust
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Read;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use zip::ZipArchive;

/// Format version this app supports for .tibdict envelopes
const MAX_SUPPORTED_FORMAT_VERSION: u32 = 1;

/// SQLite schema version this app supports
/// MUST match SUPPORTED_SCHEMA_VERSION in src/config/pack-definitions.js
const SUPPORTED_SCHEMA_VERSION: u32 = 3;

const CUSTOM_ID_PREFIX: &str = "custom-";

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TibdictManifest {
    pub format: String,
    pub format_version: u32,
    pub schema_version: u32,
    pub id: String,
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub author: Option<String>,
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub icon: Option<String>,
    pub dictionaries: Vec<TibdictManifestDictionary>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TibdictManifestDictionary {
    pub name: String,
    #[serde(default)]
    #[serde(rename = "entriesCount")]
    pub entries_count: Option<u32>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InstalledCustomPack {
    pub id: String,
    pub manifest: TibdictManifest,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallError {
    pub code: String,
    pub message: String,
}

impl InstallError {
    fn new(code: &str, message: &str) -> Self {
        Self { code: code.into(), message: message.into() }
    }
}

fn custom_packs_dir(app: &AppHandle) -> Result<PathBuf, InstallError> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| InstallError::new("path", &format!("app_data_dir: {e}")))?;
    Ok(base.join("packs").join("custom"))
}

fn is_valid_id(id: &str) -> bool {
    if id.is_empty() { return false; }
    let re = regex_lite::Regex::new(r"^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$").ok();
    match re {
        Some(r) => r.is_match(id),
        None => id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-'),
    }
}

/// Install a .tibdict file.
/// Returns the installed pack info, or an error with a structured code:
///   - "format"    : not a tibdict / bad envelope
///   - "schema"    : schema version mismatch
///   - "corrupt"   : unreadable ZIP / SQLite
///   - "conflict"  : id already installed (use force=true to override)
///   - "path"      : filesystem error
#[tauri::command]
pub async fn install_custom_pack(
    app: AppHandle,
    file_path: String,
    force: Option<bool>,
) -> Result<InstalledCustomPack, InstallError> {
    let force = force.unwrap_or(false);
    let src = PathBuf::from(&file_path);
    if !src.exists() {
        return Err(InstallError::new("path", &format!("File not found: {file_path}")));
    }

    // 1. Open ZIP
    let file = fs::File::open(&src)
        .map_err(|e| InstallError::new("corrupt", &format!("open zip: {e}")))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|e| InstallError::new("corrupt", &format!("read zip: {e}")))?;

    // 2. Extract entries into memory
    let mut manifest_bytes: Option<Vec<u8>> = None;
    let mut sqlite_bytes: Option<Vec<u8>> = None;
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)
            .map_err(|e| InstallError::new("corrupt", &format!("zip entry: {e}")))?;
        let name = entry.name().to_string();
        let mut buf = Vec::new();
        entry.read_to_end(&mut buf)
            .map_err(|e| InstallError::new("corrupt", &format!("zip read: {e}")))?;
        if name == "manifest.json" { manifest_bytes = Some(buf); }
        else if name == "data.sqlite" { sqlite_bytes = Some(buf); }
    }

    let manifest_bytes = manifest_bytes
        .ok_or_else(|| InstallError::new("format", "missing manifest.json"))?;
    let sqlite_bytes = sqlite_bytes
        .ok_or_else(|| InstallError::new("format", "missing data.sqlite"))?;

    // 3. Parse and validate manifest
    let manifest: TibdictManifest = serde_json::from_slice(&manifest_bytes)
        .map_err(|e| InstallError::new("format", &format!("bad manifest json: {e}")))?;

    if manifest.format != "tibdict" {
        return Err(InstallError::new("format", "not a tibdict archive"));
    }
    if manifest.format_version > MAX_SUPPORTED_FORMAT_VERSION {
        return Err(InstallError::new("schema", "format version not supported"));
    }
    if manifest.schema_version != SUPPORTED_SCHEMA_VERSION {
        return Err(InstallError::new("schema", "schema version mismatch"));
    }
    if !is_valid_id(&manifest.id) {
        return Err(InstallError::new("format", "invalid id"));
    }

    // 4. Write temp dir and validate SQLite
    let packs_dir = custom_packs_dir(&app)?;
    fs::create_dir_all(&packs_dir)
        .map_err(|e| InstallError::new("path", &format!("mkdir: {e}")))?;

    let prefixed_id = format!("{CUSTOM_ID_PREFIX}{}", manifest.id);
    let final_dir = packs_dir.join(&prefixed_id);
    let temp_dir = packs_dir.join(format!(".tmp-{prefixed_id}"));

    if temp_dir.exists() {
        let _ = fs::remove_dir_all(&temp_dir);
    }
    fs::create_dir_all(&temp_dir)
        .map_err(|e| InstallError::new("path", &format!("mkdir tmp: {e}")))?;

    fs::write(temp_dir.join("data.sqlite"), &sqlite_bytes)
        .map_err(|e| InstallError::new("path", &format!("write sqlite: {e}")))?;
    fs::write(temp_dir.join("manifest.json"), &manifest_bytes)
        .map_err(|e| InstallError::new("path", &format!("write manifest: {e}")))?;

    // Validate SQLite opens and has expected tables
    match Connection::open(temp_dir.join("data.sqlite")) {
        Ok(conn) => {
            let check = conn.query_row::<i64, _, _>(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('dictionaries','entries')",
                [],
                |r| r.get(0),
            );
            match check {
                Ok(2) => {}
                _ => {
                    let _ = fs::remove_dir_all(&temp_dir);
                    return Err(InstallError::new("format", "sqlite missing expected tables"));
                }
            }
        }
        Err(e) => {
            let _ = fs::remove_dir_all(&temp_dir);
            return Err(InstallError::new("corrupt", &format!("bad sqlite: {e}")));
        }
    }

    // 5. Conflict handling
    if final_dir.exists() {
        if !force {
            let _ = fs::remove_dir_all(&temp_dir);
            return Err(InstallError::new("conflict", "pack already installed"));
        }
        fs::remove_dir_all(&final_dir)
            .map_err(|e| InstallError::new("path", &format!("replace existing: {e}")))?;
    }

    // 6. Atomic-ish move
    fs::rename(&temp_dir, &final_dir)
        .map_err(|e| InstallError::new("path", &format!("move into place: {e}")))?;

    Ok(InstalledCustomPack { id: prefixed_id, manifest })
}

/// List all installed custom packs
#[tauri::command]
pub async fn list_custom_packs(app: AppHandle) -> Result<Vec<InstalledCustomPack>, String> {
    let packs_dir = match custom_packs_dir(&app) {
        Ok(p) => p,
        Err(e) => return Err(e.message),
    };

    if !packs_dir.exists() {
        return Ok(Vec::new());
    }

    let mut out = Vec::new();
    let entries = fs::read_dir(&packs_dir).map_err(|e| format!("read_dir: {e}"))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() { continue; }

        let name = match path.file_name().and_then(|s| s.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };
        if name.starts_with('.') || !name.starts_with(CUSTOM_ID_PREFIX) { continue; }

        let manifest_path = path.join("manifest.json");
        let sqlite_path = path.join("data.sqlite");
        if !manifest_path.exists() || !sqlite_path.exists() {
            eprintln!("[list_custom_packs] skipping broken pack: {name}");
            continue;
        }

        match fs::read_to_string(&manifest_path) {
            Ok(contents) => match serde_json::from_str::<TibdictManifest>(&contents) {
                Ok(manifest) => out.push(InstalledCustomPack { id: name, manifest }),
                Err(e) => eprintln!("[list_custom_packs] bad manifest in {name}: {e}"),
            },
            Err(e) => eprintln!("[list_custom_packs] cannot read manifest in {name}: {e}"),
        }
    }

    out.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(out)
}

/// Remove an installed custom pack
#[tauri::command]
pub async fn remove_custom_pack(app: AppHandle, pack_id: String) -> Result<(), String> {
    if !pack_id.starts_with(CUSTOM_ID_PREFIX) {
        return Err("pack_id must start with 'custom-'".into());
    }
    let packs_dir = custom_packs_dir(&app).map_err(|e| e.message)?;
    let target = packs_dir.join(&pack_id);
    if target.exists() {
        fs::remove_dir_all(&target).map_err(|e| format!("remove: {e}"))?;
    }
    Ok(())
}

/// Public helper used by packs.rs to discover custom pack paths
pub fn get_custom_pack_paths(app: &AppHandle) -> Vec<(String, PathBuf)> {
    let packs_dir = match custom_packs_dir(app) {
        Ok(p) => p,
        Err(_) => return Vec::new(),
    };
    if !packs_dir.exists() { return Vec::new(); }

    let mut out = Vec::new();
    if let Ok(entries) = fs::read_dir(&packs_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() { continue; }
            let name = match path.file_name().and_then(|s| s.to_str()) {
                Some(n) => n.to_string(),
                None => continue,
            };
            if name.starts_with('.') || !name.starts_with(CUSTOM_ID_PREFIX) { continue; }
            let sqlite = path.join("data.sqlite");
            if sqlite.exists() {
                out.push((name, sqlite));
            }
        }
    }
    out
}
```

> **Note on the regex crate:** `regex_lite` is a light-weight regex implementation. If it isn't already a dependency, swap the `is_valid_id` body for a hand-rolled check (the fallback is already inline).

- [ ] **Step 2: Replace the regex with a hand-rolled validator (no new crate needed)**

Replace the body of `is_valid_id` in `src-tauri/src/custom_packs.rs` with:

```rust
fn is_valid_id(id: &str) -> bool {
    if id.is_empty() { return false; }
    let bytes = id.as_bytes();
    let valid_char = |b: u8| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-';
    if !bytes.iter().all(|b| valid_char(*b)) { return false; }
    // first and last must be alphanumeric
    let first = bytes[0];
    let last = bytes[bytes.len() - 1];
    (first.is_ascii_lowercase() || first.is_ascii_digit())
        && (last.is_ascii_lowercase() || last.is_ascii_digit())
}
```

Also remove the `use regex_lite::Regex;` line if present (it isn't in the snippet above but double-check there's no `regex_lite` reference).

- [ ] **Step 3: Register the module in `main.rs`**

Open `src-tauri/src/main.rs`. After the existing `mod packs;` line (around line 4), add:

```rust
mod custom_packs;
```

Then, in the imports block (around line 11), add a new `use` statement:

```rust
use custom_packs::{install_custom_pack, list_custom_packs, remove_custom_pack};
```

Find the `.invoke_handler(tauri::generate_handler![ ... ])` block (further down in `main.rs`) and add these three names to the list:

```rust
install_custom_pack,
list_custom_packs,
remove_custom_pack,
```

- [ ] **Step 4: Verify compilation**

Run: `cd src-tauri && cargo check`
Expected: compiles (warnings OK, no errors).

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/custom_packs.rs src-tauri/src/main.rs
git commit -m "feat(tauri): add custom pack install/list/remove commands"
```

---

### Task B3: Extend pack discovery to include custom packs

Makes the existing query commands (`pack_get_all_terms`, `pack_search_entries`, `pack_get_dictionaries`, etc.) work transparently with custom packs.

**Files:**
- Modify: `src-tauri/src/packs.rs` (around lines 560-600 and 318-330)

- [ ] **Step 1: Add the use statement**

Open `src-tauri/src/packs.rs`. At the top (with the other imports), add:

```rust
use crate::custom_packs::get_custom_pack_paths;
```

- [ ] **Step 2: Extend `get_all_pack_db_paths`**

Find `fn get_all_pack_db_paths` (around line 561). Just before the final `Ok(pack_paths)` line, add:

```rust
    // Also include custom packs from packs/custom/<id>/data.sqlite
    for (id, path) in get_custom_pack_paths(app) {
        pack_paths.push((id, path));
    }
```

- [ ] **Step 3: Extend `get_pack_path` to resolve custom IDs**

Find `pub async fn get_pack_path` (around line 318). Replace the body with:

```rust
pub async fn get_pack_path(
    app: AppHandle,
    pack_id: String,
) -> Result<String, String> {
    let packs_dir = get_packs_dir(&app)?;

    // Custom packs live under packs/custom/<id>/data.sqlite
    if pack_id.starts_with("custom-") {
        let custom_path = packs_dir.join("custom").join(&pack_id).join("data.sqlite");
        if custom_path.exists() {
            return Ok(custom_path.to_string_lossy().to_string());
        }
        return Err(format!("Pack {} not installed", pack_id));
    }

    let sqlite_path = packs_dir.join(format!("{}.sqlite", pack_id));
    if sqlite_path.exists() {
        Ok(sqlite_path.to_string_lossy().to_string())
    } else {
        Err(format!("Pack {} not installed", pack_id))
    }
}
```

- [ ] **Step 4: Verify compilation**

Run: `cd src-tauri && cargo check`
Expected: compiles cleanly.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/packs.rs
git commit -m "feat(tauri): discover custom packs alongside official ones"
```

---

## Phase C — Frontend service layer

### Task C1: Export `MAX_SUPPORTED_FORMAT_VERSION` from pack-definitions

**Files:**
- Modify: `src/config/pack-definitions.js`

- [ ] **Step 1: Add the export**

Open `src/config/pack-definitions.js`. After line 14 (the existing `SUPPORTED_SCHEMA_VERSION` export), add:

```javascript
/**
 * Maximum .tibdict envelope format version this app can read.
 * Bump only when we make a non-backwards-compatible change to the .tibdict ZIP layout
 * (NOT the inner SQLite schema — that's schemaVersion).
 */
export const MAX_SUPPORTED_FORMAT_VERSION = 1;
```

- [ ] **Step 2: Commit**

```bash
git add src/config/pack-definitions.js
git commit -m "feat(config): expose MAX_SUPPORTED_FORMAT_VERSION for .tibdict"
```

---

### Task C2: Create the `CustomPackImporter` service

**Files:**
- Create: `src/services/custom-pack-importer.js`
- Test: `tests/custom-pack-importer.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/custom-pack-importer.test.js`:

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock @tauri-apps/api/core BEFORE importing the service
const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args) => invokeMock(...args) }));

// Mock platform detection
vi.mock('../src/config/platform.js', () => ({
  isTauri: () => true,
  supportsModularPacks: () => true,
}));

import { CustomPackImporter } from '../src/services/custom-pack-importer.js';

describe('CustomPackImporter', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('returns the installed pack on success', async () => {
    invokeMock.mockResolvedValue({ id: 'custom-x', manifest: { name: 'X' } });
    const result = await CustomPackImporter.install('/path/to/x.tibdict');
    expect(result.status).toBe('installed');
    expect(result.pack.id).toBe('custom-x');
    expect(invokeMock).toHaveBeenCalledWith('install_custom_pack', {
      filePath: '/path/to/x.tibdict',
      force: false,
    });
  });

  it('classifies schema errors as incompatible', async () => {
    invokeMock.mockRejectedValue({ code: 'schema', message: 'schema version mismatch' });
    const result = await CustomPackImporter.install('/path/to/x.tibdict');
    expect(result.status).toBe('error');
    expect(result.errorKind).toBe('incompatible');
  });

  it('classifies format errors as notADictionary', async () => {
    invokeMock.mockRejectedValue({ code: 'format', message: 'missing manifest' });
    const result = await CustomPackImporter.install('/path/to/x.tibdict');
    expect(result.status).toBe('error');
    expect(result.errorKind).toBe('notADictionary');
  });

  it('classifies corrupt errors as corrupt', async () => {
    invokeMock.mockRejectedValue({ code: 'corrupt', message: 'bad zip' });
    const result = await CustomPackImporter.install('/path/to/x.tibdict');
    expect(result.errorKind).toBe('corrupt');
  });

  it('returns status=conflict when the pack already exists', async () => {
    invokeMock.mockRejectedValue({ code: 'conflict', message: 'pack already installed' });
    const result = await CustomPackImporter.install('/path/to/x.tibdict');
    expect(result.status).toBe('conflict');
  });

  it('forces install when force=true is passed', async () => {
    invokeMock.mockResolvedValue({ id: 'custom-x', manifest: { name: 'X' } });
    await CustomPackImporter.install('/path/to/x.tibdict', { force: true });
    expect(invokeMock).toHaveBeenCalledWith('install_custom_pack', {
      filePath: '/path/to/x.tibdict',
      force: true,
    });
  });
});
```

- [ ] **Step 2: Run the test (should fail)**

Run: `pnpm test -- tests/custom-pack-importer.test.js`
Expected: FAIL because `src/services/custom-pack-importer.js` does not exist.

- [ ] **Step 3: Implement the service**

Create `src/services/custom-pack-importer.js`:

```javascript
/**
 * CustomPackImporter — orchestrates .tibdict installation from the frontend.
 *
 * Returns a normalized result object:
 *   { status: 'installed', pack }
 *   { status: 'conflict', message }  -- caller should ask user to confirm, then retry with force=true
 *   { status: 'error', errorKind, message }
 *
 * errorKind is one of:
 *   - 'incompatible'   : schema or format version mismatch
 *   - 'corrupt'        : ZIP or SQLite unreadable
 *   - 'notADictionary' : not a .tibdict / missing files / bad id
 *   - 'unknown'        : anything else
 */

import { invoke } from '@tauri-apps/api/core';

function classifyError(err) {
  const code = err?.code || '';
  if (code === 'schema') return 'incompatible';
  if (code === 'corrupt') return 'corrupt';
  if (code === 'format') return 'notADictionary';
  return 'unknown';
}

export const CustomPackImporter = {
  async install(filePath, options = {}) {
    const force = !!options.force;
    try {
      const pack = await invoke('install_custom_pack', { filePath, force });
      return { status: 'installed', pack };
    } catch (err) {
      const code = err?.code || '';
      const message = err?.message || String(err);

      if (code === 'conflict') {
        return { status: 'conflict', message };
      }
      return { status: 'error', errorKind: classifyError(err), message };
    }
  },
};

export default CustomPackImporter;
```

- [ ] **Step 4: Run the test (should pass)**

Run: `pnpm test -- tests/custom-pack-importer.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/custom-pack-importer.js tests/custom-pack-importer.test.js
git commit -m "feat(custom-packs): add frontend importer service"
```

---

### Task C3: Extend `PackManager` to load custom packs

**Files:**
- Modify: `src/services/pack-manager.js`

- [ ] **Step 1: Add a `customPacks` field to reactive state**

In `src/services/pack-manager.js`, modify the `reactive({...})` block (starting line 17) to include a new field. Replace:

```javascript
const state = reactive({
  manifest: null,
  installedPacks: [],
  downloadingPacks: {}, // packId -> progress object
  updatingPacks: {}, // packId -> progress object for updates
  availableUpdates: {}, // packId -> { checksum, sizeMB }
  initialized: false,
  error: null,
  lastUpdateCheck: null,
});
```

with:

```javascript
const state = reactive({
  manifest: null,
  installedPacks: [],
  customPacks: [], // [{ id, manifest }]
  downloadingPacks: {}, // packId -> progress object
  updatingPacks: {}, // packId -> progress object for updates
  availableUpdates: {}, // packId -> { checksum, sizeMB }
  initialized: false,
  error: null,
  lastUpdateCheck: null,
});
```

- [ ] **Step 2: Add a `customPacks` getter**

Near the other getters (around line 37, after `get installedPacks()`), add:

```javascript
  get customPacks() {
    return state.customPacks;
  },
```

- [ ] **Step 3: Load custom packs in `init()`**

In `PackManager.init()`, find the `Promise.all([fetch_pack_manifest, get_installed_packs])` call (around line 150) and replace it with:

```javascript
      // Fetch manifest, installed packs, and custom packs in parallel
      const [manifest, installed, customPacks] = await Promise.all([
        invoke('fetch_pack_manifest').catch((e) => {
          console.warn('Could not fetch pack manifest:', e);
          return null;
        }),
        invoke('get_installed_packs'),
        invoke('list_custom_packs').catch((e) => {
          console.warn('Could not list custom packs:', e);
          return [];
        }),
      ]);

      state.manifest = manifest;
      state.installedPacks = installed;
      state.customPacks = customPacks || [];
      state.initialized = true;
```

(Replaces the existing block that only assigns `manifest`, `installedPacks`, `initialized`.)

- [ ] **Step 4: Add install/remove methods**

Near the end of the `PackManager` object, just before the closing `};` (around line 537), add:

```javascript
  // ============================================
  // Custom Packs
  // ============================================

  /**
   * Install a .tibdict file. See CustomPackImporter for return shape.
   * On success, updates the in-memory custom pack list.
   */
  async installCustomPack(filePath, options = {}) {
    const { CustomPackImporter } = await import('./custom-pack-importer');
    const result = await CustomPackImporter.install(filePath, options);
    if (result.status === 'installed') {
      // Refresh the in-memory list
      state.customPacks = await invoke('list_custom_packs');
    }
    return result;
  },

  /**
   * Remove a custom pack by id (must start with 'custom-').
   */
  async removeCustomPack(packId) {
    if (!supportsModularPacks()) return;
    await invoke('remove_custom_pack', { packId });
    state.customPacks = state.customPacks.filter((p) => p.id !== packId);
  },

  /**
   * Refresh the custom pack list (useful after external changes).
   */
  async refreshCustomPacks() {
    state.customPacks = await invoke('list_custom_packs').catch(() => []);
  },
```

- [ ] **Step 5: Sanity check — no syntax error**

Run: `node --check src/services/pack-manager.js`
Expected: no output (success).

- [ ] **Step 6: Commit**

```bash
git add src/services/pack-manager.js
git commit -m "feat(custom-packs): load and manage custom packs in PackManager"
```

---

### Task C4: Refresh `allTerms` after custom pack install/remove

The existing `SqlDatabase.setAllTermsVariable()` re-queries all packs (including custom ones, thanks to the Rust `get_all_pack_db_paths` extension in Task B3). We just need to call it after install/remove and dispatch the existing events.

**Files:**
- Modify: `src/services/pack-manager.js`

- [ ] **Step 1: Find where other operations trigger the refresh**

Open `src/services/pack-manager.js` and search for `'all-terms-updated'` or `setAllTermsVariable`. These events are currently dispatched by `SqlDatabase` or by `reloadPack`/`unloadPack` elsewhere. For custom packs we need an equivalent path.

- [ ] **Step 2: Trigger a full refresh after install/remove**

In the `installCustomPack` method added in C3, replace the success path with:

```javascript
    if (result.status === 'installed') {
      state.customPacks = await invoke('list_custom_packs');
      await reloadAllTermsAndDispatch();
    }
    return result;
  },
```

In `removeCustomPack`, after `state.customPacks = ...`, add:

```javascript
    await reloadAllTermsAndDispatch();
```

Then, at the top of the file (just after the imports, around line 15), add:

```javascript
/**
 * Ask SqlDatabase to rebuild its allTerms list and notify listeners.
 * Imported lazily to avoid a circular dependency at module load time.
 */
async function reloadAllTermsAndDispatch() {
  try {
    const { default: SqlDatabase } = await import('./sql-database');
    if (typeof SqlDatabase.setAllTermsVariable === 'function') {
      await SqlDatabase.setAllTermsVariable();
    }
    window.dispatchEvent(new CustomEvent('all-terms-updated'));
    window.dispatchEvent(new CustomEvent('dictionaries-updated'));
  } catch (e) {
    console.warn('[PackManager] reloadAllTermsAndDispatch failed:', e);
  }
}
```

> **Note:** `SqlDatabase.setAllTermsVariable` already exists per the existing code (the `tauri-packs` mode calls it in `init()`). If that method is named differently in `sql-database.js`, substitute the correct name.

- [ ] **Step 3: Sanity check**

Run: `node --check src/services/pack-manager.js`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/services/pack-manager.js
git commit -m "feat(custom-packs): refresh terms and notify listeners after install/remove"
```

---

## Phase D — UI integration

### Task D1: Conflict confirmation modal

**Files:**
- Create: `src/components/CustomPackConflictModal.vue`

- [ ] **Step 1: Create the component**

```vue
<template>
  <v-dialog v-model="visible" max-width="420" persistent>
    <v-card>
      <v-card-title>Remplacer le dictionnaire ?</v-card-title>
      <v-card-text>
        <p>«&nbsp;<strong>{{ existingName }}</strong>&nbsp;» {{ existingVersionSuffix }} est déjà installé.</p>
        <p v-if="newVersion">Le nouveau fichier est {{ newVersion }}.</p>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="onCancel">Annuler</v-btn>
        <v-btn color="primary" @click="onConfirm">Remplacer</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
export default {
  name: 'CustomPackConflictModal',
  props: {
    modelValue: { type: Boolean, default: false },
    existingName: { type: String, default: '' },
    existingVersion: { type: String, default: '' },
    newVersion: { type: String, default: '' },
  },
  emits: ['update:modelValue', 'confirm', 'cancel'],
  computed: {
    visible: {
      get() { return this.modelValue; },
      set(v) { this.$emit('update:modelValue', v); },
    },
    existingVersionSuffix() {
      return this.existingVersion ? `(${this.existingVersion})` : '';
    },
  },
  methods: {
    onConfirm() {
      this.visible = false;
      this.$emit('confirm');
    },
    onCancel() {
      this.visible = false;
      this.$emit('cancel');
    },
  },
};
</script>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/CustomPackConflictModal.vue
git commit -m "feat(ui): add custom pack conflict modal"
```

---

### Task D2: Custom pack section for ConfigurePage

**Files:**
- Create: `src/components/CustomPackSection.vue`

- [ ] **Step 1: Create the component**

```vue
<template>
  <div class="custom-pack-section">
    <div class="section-header">
      <h3>Dictionnaires personnalisés</h3>
      <v-btn
        prepend-icon="mdi-file-upload"
        variant="outlined"
        size="small"
        @click="onImportClick"
      >
        Importer un dictionnaire…
      </v-btn>
    </div>

    <div v-if="!packs.length" class="empty-state">
      Aucun dictionnaire personnalisé. Glissez un fichier .tibdict sur la fenêtre
      ou cliquez sur Importer…
    </div>

    <ul v-else class="pack-list">
      <li v-for="pack in packs" :key="pack.id" class="pack-item">
        <div class="pack-title">
          <span class="name">{{ pack.manifest.name }}</span>
          <span v-if="packSubtitle(pack)" class="subtitle">{{ packSubtitle(pack) }}</span>
        </div>
        <v-btn
          variant="text"
          size="small"
          color="error"
          @click="onRemove(pack)"
        >
          Supprimer
        </v-btn>
      </li>
    </ul>

    <CustomPackConflictModal
      v-model="conflictOpen"
      :existing-name="conflictContext.existingName"
      :existing-version="conflictContext.existingVersion"
      :new-version="conflictContext.newVersion"
      @confirm="onConfirmReplace"
      @cancel="onCancelReplace"
    />
  </div>
</template>

<script>
import { open } from '@tauri-apps/plugin-dialog';
import PackManager from '../services/pack-manager';
import CustomPackConflictModal from './CustomPackConflictModal.vue';

export default {
  name: 'CustomPackSection',
  components: { CustomPackConflictModal },
  inject: ['snackbar'],
  data() {
    return {
      conflictOpen: false,
      conflictContext: { existingName: '', existingVersion: '', newVersion: '', filePath: '' },
    };
  },
  computed: {
    packs() {
      return PackManager.customPacks;
    },
  },
  methods: {
    packSubtitle(pack) {
      const parts = [];
      if (pack.manifest.version) parts.push(`v${pack.manifest.version}`);
      const dictCount = Array.isArray(pack.manifest.dictionaries)
        ? pack.manifest.dictionaries.length
        : 0;
      if (dictCount > 1) parts.push(`${dictCount} dicos`);
      return parts.join(' · ');
    },
    async onImportClick() {
      try {
        const selected = await open({
          multiple: false,
          filters: [{ name: 'Dictionnaire Tibetan', extensions: ['tibdict'] }],
        });
        if (!selected) return;
        await this.installFile(typeof selected === 'string' ? selected : selected.path);
      } catch (e) {
        console.error('[CustomPackSection] import failed:', e);
        this.snackbar.show('Fichier invalide ou corrompu.');
      }
    },
    async installFile(filePath) {
      const result = await PackManager.installCustomPack(filePath);
      this.handleResult(result, filePath);
    },
    handleResult(result, filePath) {
      if (result.status === 'installed') {
        this.snackbar.show(`${result.pack.manifest.name} installé`);
        return;
      }
      if (result.status === 'conflict') {
        const existing = this.packs.find((p) => {
          // Can't easily know the pack's id beforehand; show a generic title
          return false;
        });
        this.conflictContext = {
          existingName: 'Ce dictionnaire',
          existingVersion: existing?.manifest?.version ? `v${existing.manifest.version}` : '',
          newVersion: '',
          filePath,
        };
        this.conflictOpen = true;
        return;
      }
      // Error cases
      if (result.errorKind === 'incompatible') {
        this.snackbar.show(
          "Fichier incompatible avec cette version de l'app. Essayez de vous procurer une version à jour du fichier."
        );
      } else if (result.errorKind === 'corrupt') {
        this.snackbar.show('Fichier invalide ou corrompu.');
      } else {
        this.snackbar.show("Ce fichier n'est pas un dictionnaire valide.");
      }
    },
    async onConfirmReplace() {
      const { filePath } = this.conflictContext;
      const result = await PackManager.installCustomPack(filePath, { force: true });
      this.handleResult(result, filePath);
    },
    onCancelReplace() {
      this.conflictContext = { existingName: '', existingVersion: '', newVersion: '', filePath: '' };
    },
    async onRemove(pack) {
      await PackManager.removeCustomPack(pack.id);
      this.snackbar.show(`${pack.manifest.name} supprimé`);
    },
  },
};
</script>

<style lang="stylus" scoped>
.custom-pack-section
  margin-top 1.5em

  .section-header
    display flex
    align-items center
    justify-content space-between
    margin-bottom .75em

    h3
      margin 0
      font-size 1.1em

  .empty-state
    font-size .9em
    color rgba(0, 0, 0, .6)
    padding 1em
    border 1px dashed rgba(0, 0, 0, .2)
    border-radius 4px

  .pack-list
    list-style none
    padding 0
    margin 0

  .pack-item
    display flex
    align-items center
    justify-content space-between
    padding .5em .75em
    border-bottom 1px solid rgba(0, 0, 0, .08)

  .pack-title
    display flex
    flex-direction column

    .name
      font-weight 500

    .subtitle
      font-size .85em
      color rgba(0, 0, 0, .6)
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/CustomPackSection.vue
git commit -m "feat(ui): add custom pack management section"
```

---

### Task D3: Render the section in ConfigurePage

**Files:**
- Modify: `src/components/ConfigurePage.vue`

- [ ] **Step 1: Import the component**

Open `src/components/ConfigurePage.vue`. In the `<script>` block, next to the existing `import PackManagerCard from './PackManagerCard.vue';` line (around line 17), add:

```javascript
import CustomPackSection from './CustomPackSection.vue';
import { isTauri } from '../config/platform';
```

(The `isTauri` import may already exist — check and don't duplicate.)

- [ ] **Step 2: Register the component**

In the `components` block (around line 39), add `CustomPackSection`:

```javascript
  components: {
    draggable,
    PackManagerCard,
    CustomPackSection,
  },
```

- [ ] **Step 3: Add a computed for web-mode gate**

In the `computed: {}` block (find it or create it right after `data()`), add:

```javascript
  computed: {
    isTauriMode() {
      return isTauri();
    },
  },
```

If `computed` already exists, add just the `isTauriMode` method inside it.

- [ ] **Step 4: Render the section in the template**

In the `<template>` part of `ConfigurePage.vue`, find the area where the pack management UI is rendered (look for `<PackManagerCard`). Immediately after that block, add:

```vue
<CustomPackSection v-if="isTauriMode" />
```

> The exact location depends on the current template layout. If `PackManagerCard` is inside a list/section, place `CustomPackSection` as a sibling right after it.

- [ ] **Step 5: Manually verify in dev mode**

Run: `pnpm tauri:dev`
Expected: in the settings page, a new "Dictionnaires personnalisés" section appears below the official packs with an empty state and an "Importer…" button.

- [ ] **Step 6: Commit**

```bash
git add src/components/ConfigurePage.vue
git commit -m "feat(ui): render custom pack section in settings"
```

---

### Task D4: Wire up drag-and-drop in App.vue (desktop)

**Files:**
- Modify: `src/App.vue`

- [ ] **Step 1: Add the drag-drop subscription**

Open `src/App.vue`. In the `<script>` block, add imports at the top:

```javascript
import { isTauri } from './config/platform';
import PackManager from './services/pack-manager';
```

(Only add if not already present.)

In the `mounted()` lifecycle hook (find it in the Options API component definition), add a call to a new method:

```javascript
  mounted() {
    // ... existing code ...
    this.setupTibdictDragDrop();
  },
```

- [ ] **Step 2: Implement `setupTibdictDragDrop`**

In the `methods: {}` block of `App.vue`, add:

```javascript
    async setupTibdictDragDrop() {
      if (!isTauri()) return;
      try {
        const { getCurrentWebview } = await import('@tauri-apps/api/webview');
        const webview = getCurrentWebview();
        this._tibdictUnlisten = await webview.onDragDropEvent((event) => {
          if (event.payload.type !== 'drop') return;
          const files = event.payload.paths || [];
          const tibdicts = files.filter((f) => f.toLowerCase().endsWith('.tibdict'));
          if (tibdicts.length > 0) {
            this.installTibdictQueue(tibdicts);
          }
        });
      } catch (e) {
        console.warn('[App] Could not set up drag-drop:', e);
      }
    },

    async installTibdictQueue(filePaths) {
      let installed = 0;
      let cancelled = 0;

      for (const filePath of filePaths) {
        const result = await PackManager.installCustomPack(filePath);

        if (result.status === 'installed') {
          installed++;
          if (filePaths.length === 1) {
            this.snackbar?.show?.(`${result.pack.manifest.name} installé`);
          }
          continue;
        }

        if (result.status === 'conflict') {
          // For multi-file drops, bail out silently on conflict; user can retry via button.
          // For single-file, the UI section handles confirmation. Here we only handle drag-drop flow.
          if (filePaths.length === 1) {
            // Delegate to section — re-use PackManager with force after user confirms via UI.
            // We simplify: show a snackbar saying user should use the Import button for replacement.
            this.snackbar?.show?.('Ce dictionnaire est déjà installé. Utilisez Importer… pour le remplacer.');
            cancelled++;
          } else {
            cancelled++;
          }
          continue;
        }

        cancelled++;
        if (filePaths.length === 1) {
          if (result.errorKind === 'incompatible') {
            this.snackbar?.show?.(
              "Fichier incompatible avec cette version de l'app. Essayez de vous procurer une version à jour du fichier."
            );
          } else if (result.errorKind === 'corrupt') {
            this.snackbar?.show?.('Fichier invalide ou corrompu.');
          } else {
            this.snackbar?.show?.("Ce fichier n'est pas un dictionnaire valide.");
          }
        }
      }

      if (filePaths.length > 1) {
        const parts = [];
        if (installed > 0) parts.push(`${installed} installé${installed > 1 ? 's' : ''}`);
        if (cancelled > 0) parts.push(`${cancelled} annulé${cancelled > 1 ? 's' : ''}`);
        if (parts.length) this.snackbar?.show?.(parts.join(', '));
      }
    },
```

- [ ] **Step 3: Clean up the listener in `beforeUnmount`**

In `App.vue`, find `beforeUnmount()` (or create it inside the component) and add:

```javascript
    if (typeof this._tibdictUnlisten === 'function') {
      this._tibdictUnlisten();
      this._tibdictUnlisten = null;
    }
```

> If there is no `beforeUnmount` hook, add:
>
> ```javascript
>   beforeUnmount() {
>     if (typeof this._tibdictUnlisten === 'function') {
>       this._tibdictUnlisten();
>       this._tibdictUnlisten = null;
>     }
>   },
> ```

- [ ] **Step 4: Manually verify**

Run: `pnpm tauri:dev`
- Drag the `inalco-fr-tib.tibdict` file produced in Task A7 onto the app window.
- Verify snackbar `"INALCO Français-Tibétain installé"`.
- Verify pack appears in the "Dictionnaires personnalisés" section.
- Verify searching for `ང་` returns results from the INALCO dictionary.

- [ ] **Step 5: Commit**

```bash
git add src/App.vue
git commit -m "feat(ui): install .tibdict files via drag-and-drop"
```

---

## Phase E — End-to-end validation

### Task E1: Full INALCO flow

No new code — just run through the system end-to-end.

- [ ] **Step 1: Regenerate the INALCO .tibdict**

Run:
```bash
pnpm run build:tibdict -- --config build/inalco.tibdict-config.json --output inalco-fr-tib.tibdict
```

Expected: file produced with ~180-200 entries.

- [ ] **Step 2: Launch the desktop app**

Run: `pnpm tauri:dev`

- [ ] **Step 3: Walk the manual checklist**

Verify each of:
1. Drag `inalco-fr-tib.tibdict` onto the window → snackbar install confirmation.
2. Search `ང་` → at least one INALCO entry appears with definition `je ; moi`.
3. Search `bonjour` → entries from INALCO expressions appear via FTS on definition.
4. Go to settings → "Dictionnaires personnalisés" → pack listed with `v1.0.0`, no dico count (only one dictionary in this pack), no author, no size.
5. Drag the dictionaries ordering list → move INALCO between two official dictionaries → confirm it stays in place after restart.
6. Click Supprimer → pack is gone from section, folder `packs/custom/custom-inalco-fr-tib/` is removed.
7. Drag the file again → it reinstalls.
8. Drag it a third time → conflict snackbar.
9. Use the "Importer…" button on the same file → confirmation modal appears → click "Remplacer" → success.
10. Try dragging a non-`.tibdict` file → nothing happens (silent).

- [ ] **Step 4: If any step fails**

Halt and report the failure. Do not proceed to commit without a fix.

- [ ] **Step 5: If all steps pass, commit the INALCO test file (optional)**

If Jérémy wants to keep the `.tibdict` in the repo for himself, add it:

```bash
# Only if Jérémy confirms he wants it committed — otherwise add to .gitignore
echo "inalco-fr-tib.tibdict" >> .gitignore
git add .gitignore
git commit -m "chore: ignore generated .tibdict files"
```

---

## Self-review notes

**Spec coverage verified:**
- §4.1 (APKG → .tibdict script) → Phase A
- §4.2 (drag-drop + button + UI section) → Phase D
- §6 (.tibdict format + validation) → Task A5, A6, B2
- §7 (conversion pipeline) → Phase A
- §8 (on-disk layout, Tauri commands, frontend integration, drag-drop, multi-file) → Phase B, C, D
- §9 (UI layout, conflict modal, snackbars) → Task D1, D2
- §10 (schema versioning) → constants in pack-definitions.js and custom_packs.rs
- §11 (edge cases) → handled in install_custom_pack and setupTibdictDragDrop
- §12 (tests) → unit test tasks throughout Phases A and C, manual checklist in Phase E

**Ambiguity resolved:** conflict flow in drag-drop. For multi-file drops, conflicts are silently skipped and counted in the recap. For single-file drops, the user is told to use the "Importer" button instead (which has the confirmation modal). This avoids nesting async modal flow inside the drag-drop queue.

**Type consistency check:**
- `installCustomPack(filePath, options?)` signature consistent across Rust command, PackManager, CustomPackImporter.
- `InstalledCustomPack` shape `{ id, manifest }` consistent across Rust serialization, `customPacks` state, and UI iteration.
- `result` shape from CustomPackImporter: `{ status, pack? , message?, errorKind? }` — UI handlers in D2 and D4 both match.
