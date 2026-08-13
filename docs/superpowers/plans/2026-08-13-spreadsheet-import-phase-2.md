# Spreadsheet Import (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user load a `.xlsx`/`.xls`/`.ods`/`.csv` file into a personal dictionary — both into an existing one (adding and updating entries) and as a one-step "new dictionary from a spreadsheet".

**Architecture:** Rust parses the file and returns a plain grid of strings, making no decisions about it. JS decides which row is a header, which columns are term and definition, and diffs the result against the target dictionary. A preview dialog shows the diff and lets the user arbitrate conflicts before a single transactional write.

**Tech Stack:** Rust (`calamine` for xlsx/xls/ods, `csv` + `encoding_rs` for delimited text), Vue 3 Options API, Vuetify 3, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-10-editable-personal-lexicons-design.md` — §6 (term normalization), §9 (import flow and diff rules), §13 (command contracts), §14 (phasing).

## Global Constraints

- Every lexicon command takes a `packId` that **must start with `custom-`**; anything else is rejected. This is the guard that keeps official packs read-only — `is_lexicon_pack_id` in `src-tauri/src/lexicon.rs:83`.
- **All six phonetic columns are computed in JS**, never in Rust. `LexiconEntryInput` (`src-tauri/src/lexicon.rs:49`) carries `term`, `termPhoneticsStrict`, `termPhoneticsLoose`, `definition`, `definitionPhoneticsWordsStrict`, `definitionPhoneticsWordsLoose`.
- **The diff key is `tibetanLookupKey`** (`src/utils.js`). Storage and lookup must be byte-identical or the entry is invisible to the global hotkey. Never use `cleanTerm` — it *substitutes* `-`, `"` and newlines with a space where the lookup path *deletes* them (spec §6).
- `lexicon_apply_import` wraps every row in **one transaction**. A failure mid-way rolls back entirely; the lexicon is never left half-imported.
- **Import overwrites by default.** Modified entries are listed with checkboxes **checked by default**; unchecked ones are excluded from the payload. New entries are never unchecked-able.
- **Unchanged entries are counted, never rendered.**
- Rust does **not** decide whether a header row exists. `read_spreadsheet` returns every row in `rows` and puts spreadsheet column letters (`A`, `B`, `C`…) in `headers`.
- **Every command must be registered in BOTH `src-tauri/src/main.rs` and `src-tauri/src/lib.rs`.** A command in only one compiles cleanly, passes `cargo test` and `pnpm build`, then fails at runtime on mobile. `tests/tauri-command-registration.test.js` is the guard.
- The feature is **Tauri-only** (`supportsModularPacks() === isTauri()`). Nothing in this plan may load in web mode — keep `calamine` behind the Rust boundary and the JS import module behind a dynamic import from the dialog.
- **Mobile works, but only through bytes.** The dialog plugin returns a `content://` URI on Android and a `file://` URI on iOS; `std::fs` cannot open either. So `read_spreadsheet` takes **bytes, not a path**, and JS reads the file with `@tauri-apps/plugin-fs` (documented to work "with any path format out of the box"). This mirrors `install_custom_pack_from_bytes`, which already exists for the same reason. `calamine`, `csv` and `encoding_rs` are pure Rust and compile for iOS and Android unchanged.
- **Drag-and-drop is desktop-only** and must be guarded, not ported.
- **Vuetify native components only.** Form fields use `variant="outlined"` `color="primary"` `density="comfortable"`; primary buttons use `variant="flat"`. This matches the convention established in `QuickAddDialog.vue` and `LexiconEntryDialog.vue`.
- Commit style: Conventional Commits with conjugated verbs ("Adds…", "Fixes…").

---

## File Structure

| File | Responsibility |
|---|---|
| `src-tauri/src/spreadsheet.rs` (create) | `read_spreadsheet` only. Format dispatch, decoding, grid extraction. Knows nothing about lexicons. |
| `src-tauri/src/lexicon.rs` (modify) | Gains `lexicon_apply_import`, reusing `upsert_entry_in` and `touch_manifest`. |
| `src-tauri/src/main.rs`, `src-tauri/src/lib.rs` (modify) | Register both new commands in both handler lists. |
| `src/services/lexicon-import.js` (create) | Pure functions: header detection, column auto-detection, diff. No Tauri, no Vue — this is the testable core. |
| `src/services/lexicon.js` (modify) | Gains `readSpreadsheet()` and `applyImport()` bindings. |
| `src/components/ImportPreviewDialog.vue` (create) | Mapping step + recap + conflict arbitration. |
| `src/components/LexiconPage.vue` (modify) | "Import" toolbar action — into the dictionary being viewed. |
| `src/components/CustomPackSection.vue` (modify) | "New dictionary from a spreadsheet" — creates and fills in one step. |
| `tests/lexicon-import.test.js` (create) | Detection and diff rules. |
| `tests/import-preview-dialog.test.js` (create) | Dialog behaviour. |

---

### Task 1: `read_spreadsheet` — Rust parsing

**Files:**
- Create: `src-tauri/src/spreadsheet.rs`
- Modify: `src-tauri/Cargo.toml` (dependencies)
- Modify: `src-tauri/src/main.rs` (`mod spreadsheet;` + handler list), `src-tauri/src/lib.rs` (handler list)
- Test: `#[cfg(test)]` module at the bottom of `src-tauri/src/spreadsheet.rs`

**Interfaces:**
- Produces: `read_spreadsheet(data: Vec<u8>, fileName: String) -> Result<SpreadsheetGrid, String>` where `SpreadsheetGrid` serializes camelCase as `{ sheetName: String, headers: Vec<String>, rows: Vec<Vec<String>> }`. Takes bytes rather than a path so the same command serves desktop, iOS and Android — see Global Constraints.
- Produces (pure, for tests): `column_letters(width: usize) -> Vec<String>`, `sniff_delimiter(sample: &str) -> u8`, `decode_bytes(bytes: &[u8]) -> String`.

- [ ] **Step 1: Add the dependencies**

In `src-tauri/Cargo.toml` under `[dependencies]`:

```toml
calamine = "0.36"
csv = "1.3"
encoding_rs = "0.8"
```

- [ ] **Step 2: Write the failing tests for the pure helpers**

Create `src-tauri/src/spreadsheet.rs` containing only the test module:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn column_letters_walk_past_z() {
        assert_eq!(column_letters(3), vec!["A", "B", "C"]);
        assert_eq!(column_letters(27)[25], "Z");
        assert_eq!(column_letters(27)[26], "AA");
    }

    #[test]
    fn sniff_delimiter_prefers_the_commonest_on_the_first_line() {
        assert_eq!(sniff_delimiter("a;b;c\n1;2;3"), b';');
        assert_eq!(sniff_delimiter("a,b,c\n1,2,3"), b',');
        assert_eq!(sniff_delimiter("a\tb\tc"), b'\t');
    }

    #[test]
    fn sniff_delimiter_falls_back_to_comma_when_nothing_repeats() {
        assert_eq!(sniff_delimiter("single column"), b',');
    }

    #[test]
    fn decode_bytes_reads_utf8_unchanged() {
        assert_eq!(decode_bytes("སངས་རྒྱས་".as_bytes()), "སངས་རྒྱས་");
    }

    #[test]
    fn decode_bytes_falls_back_to_cp1252_for_invalid_utf8() {
        // 0xE9 is "é" in CP1252 and invalid on its own in UTF-8 — the byte
        // Excel for Windows writes when it saves a French CSV.
        assert_eq!(decode_bytes(&[b'c', b'l', b'\xE9']), "clé");
    }
}
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd src-tauri && cargo test spreadsheet`
Expected: FAIL — `cannot find function column_letters in this scope`.

- [ ] **Step 4: Implement the pure helpers**

Above the test module in `src-tauri/src/spreadsheet.rs`:

```rust
use serde::Serialize;
use std::path::Path;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpreadsheetGrid {
    pub sheet_name: String,
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
}

/// Spreadsheet column labels: A..Z, then AA, AB, … Rust returns these rather
/// than the first row's values because deciding whether a header row exists is
/// the frontend's job (spec §9).
pub fn column_letters(width: usize) -> Vec<String> {
    (0..width)
        .map(|mut index| {
            let mut label = String::new();
            loop {
                label.insert(0, (b'A' + (index % 26) as u8) as char);
                if index < 26 {
                    break;
                }
                index = index / 26 - 1;
            }
            label
        })
        .collect()
}

/// Excel for Windows writes semicolons in locales where the comma is the
/// decimal separator, so the delimiter has to be sniffed rather than assumed.
pub fn sniff_delimiter(sample: &str) -> u8 {
    let first_line = sample.lines().next().unwrap_or("");
    [b';', b'\t', b',']
        .into_iter()
        .max_by_key(|delimiter| first_line.matches(*delimiter as char).count())
        .filter(|delimiter| first_line.contains(*delimiter as char))
        .unwrap_or(b',')
}

/// UTF-8 when it is valid, CP1252 otherwise — the two encodings a spreadsheet
/// exported from Excel actually arrives in.
pub fn decode_bytes(bytes: &[u8]) -> String {
    match std::str::from_utf8(bytes) {
        Ok(text) => text.to_string(),
        Err(_) => encoding_rs::WINDOWS_1252.decode(bytes).0.into_owned(),
    }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd src-tauri && cargo test spreadsheet`
Expected: PASS (5 tests).

- [ ] **Step 6: Implement the command itself**

Append to `src-tauri/src/spreadsheet.rs`, above the test module:

```rust
use calamine::{open_workbook_auto, Data, Reader};

fn pad(rows: Vec<Vec<String>>) -> (usize, Vec<Vec<String>>) {
    let width = rows.iter().map(|row| row.len()).max().unwrap_or(0);
    let padded = rows
        .into_iter()
        .map(|mut row| {
            row.resize(width, String::new());
            row
        })
        .collect();
    (width, padded)
}

fn read_delimited(path: &Path) -> Result<SpreadsheetGrid, String> {
    let bytes = std::fs::read(path).map_err(|e| format!("readFailed: {e}"))?;
    let text = decode_bytes(&bytes);
    let mut reader = csv::ReaderBuilder::new()
        .delimiter(sniff_delimiter(&text))
        .flexible(true)
        .has_headers(false) // every row is data; the frontend decides
        .from_reader(text.as_bytes());

    let mut rows = Vec::new();
    for record in reader.records() {
        let record = record.map_err(|e| format!("parseFailed: {e}"))?;
        rows.push(record.iter().map(|cell| cell.trim().to_string()).collect());
    }

    let sheet_name = path
        .file_stem()
        .map(|stem| stem.to_string_lossy().to_string())
        .unwrap_or_default();
    let (width, rows) = pad(rows);
    Ok(SpreadsheetGrid { sheet_name, headers: column_letters(width), rows })
}

fn cell_to_string(cell: &Data) -> String {
    match cell {
        Data::Empty => String::new(),
        Data::String(value) => value.trim().to_string(),
        other => other.to_string().trim().to_string(),
    }
}

fn read_workbook(path: &Path) -> Result<SpreadsheetGrid, String> {
    let mut workbook = open_workbook_auto(path).map_err(|e| format!("readFailed: {e}"))?;
    let sheet_name = workbook
        .sheet_names()
        .first()
        .cloned()
        .ok_or_else(|| "emptyWorkbook".to_string())?;
    let range = workbook
        .worksheet_range(&sheet_name)
        .map_err(|e| format!("parseFailed: {e}"))?;

    let rows: Vec<Vec<String>> = range
        .rows()
        .map(|row| row.iter().map(cell_to_string).collect())
        .collect();

    let (width, rows) = pad(rows);
    Ok(SpreadsheetGrid { sheet_name, headers: column_letters(width), rows })
}

/// Return the first sheet as a plain grid of strings. Makes no decision about
/// header rows or column meaning — see spec §9.
#[tauri::command]
pub fn read_spreadsheet(path: String) -> Result<SpreadsheetGrid, String> {
    let path = Path::new(&path);
    let extension = path
        .extension()
        .map(|ext| ext.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    match extension.as_str() {
        "csv" | "tsv" | "txt" => read_delimited(path),
        _ => read_workbook(path),
    }
}
```

- [ ] **Step 7: Register the command in BOTH handler lists**

In `src-tauri/src/main.rs`: add `mod spreadsheet;` beside the other `mod` declarations, add `use spreadsheet::read_spreadsheet;` to the import block, and add `read_spreadsheet,` to `generate_handler![…]`.

In `src-tauri/src/lib.rs`: add `read_spreadsheet,` to its `generate_handler![…]` list too. Skipping this compiles and passes `cargo test`, then fails at runtime on iOS and Android.

- [ ] **Step 8: Verify the registration guard passes**

Run: `pnpm vitest run tests/tauri-command-registration.test.js`
Expected: PASS — the command appears in both lists.

- [ ] **Step 9: Verify the whole crate still builds**

Run: `cd src-tauri && cargo test`
Expected: PASS, no warnings about unused imports.

- [ ] **Step 10: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/spreadsheet.rs src-tauri/src/main.rs src-tauri/src/lib.rs
git commit -m "feat(import): reads xlsx, ods and delimited files into a plain grid"
```

---

### Task 2: `lexicon_apply_import` — one transactional write

**Files:**
- Modify: `src-tauri/src/lexicon.rs` (new command near `lexicon_upsert_entry`, line ~482)
- Modify: `src-tauri/src/main.rs`, `src-tauri/src/lib.rs` (both handler lists)

**Interfaces:**
- Consumes: `upsert_entry_in(conn, dictionary_id, entry) -> rusqlite::Result<UpsertOutcome>` (`lexicon.rs:295`), `touch_manifest(dir, conn)` (`lexicon.rs:198`), `is_lexicon_pack_id(id)` (`lexicon.rs:83`), `pack_dir(app, pack_id)`, `open_db(dir)`.
- Produces: `lexicon_apply_import(app, packId: String, dictionaryId: i64, entries: Vec<LexiconEntryInput>) -> Result<ImportOutcome, LexiconError>` where `ImportOutcome` serializes camelCase as `{ inserted: usize, updated: usize }`.

- [ ] **Step 1: Write the failing test**

In the existing `#[cfg(test)]` module of `src-tauri/src/lexicon.rs`:

```rust
#[test]
fn apply_import_inserts_new_terms_and_updates_existing_ones() {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch(
        "CREATE TABLE entries (
            id INTEGER PRIMARY KEY, dictionaryId INTEGER, term TEXT,
            termPhoneticsStrict TEXT, termPhoneticsLoose TEXT, definition TEXT,
            definitionPhoneticsWordsStrict TEXT, definitionPhoneticsWordsLoose TEXT
        );",
    )
    .unwrap();

    let entry = |term: &str, definition: &str| LexiconEntryInput {
        term: term.into(),
        term_phonetics_strict: String::new(),
        term_phonetics_loose: String::new(),
        definition: definition.into(),
        definition_phonetics_words_strict: String::new(),
        definition_phonetics_words_loose: String::new(),
    };

    upsert_entry_in(&conn, 1, &entry("སངས་རྒྱས་", "buddha")).unwrap();

    let outcome = apply_import_in(
        &conn,
        1,
        &[entry("སངས་རྒྱས་", "awakened one"), entry("ཆོས་", "dharma")],
    )
    .unwrap();

    assert_eq!(outcome.inserted, 1);
    assert_eq!(outcome.updated, 1);

    let definition: String = conn
        .query_row(
            "SELECT definition FROM entries WHERE term = ?",
            params!["སངས་རྒྱས་"],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(definition, "awakened one");
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd src-tauri && cargo test apply_import`
Expected: FAIL — `cannot find function apply_import_in in this scope`.

- [ ] **Step 3: Implement the helper and the command**

In `src-tauri/src/lexicon.rs`, beside `upsert_entry_in`:

```rust
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportOutcome {
    pub inserted: usize,
    pub updated: usize,
}

/// Apply every row, counting inserts and updates. Split out from the command so
/// it can be tested against an in-memory database.
pub fn apply_import_in(
    conn: &Connection,
    dictionary_id: i64,
    entries: &[LexiconEntryInput],
) -> rusqlite::Result<ImportOutcome> {
    let mut outcome = ImportOutcome { inserted: 0, updated: 0 };
    for entry in entries {
        if upsert_entry_in(conn, dictionary_id, entry)?.created {
            outcome.inserted += 1;
        } else {
            outcome.updated += 1;
        }
    }
    Ok(outcome)
}

/// Write a whole import in one transaction: a failure mid-way rolls the lexicon
/// back entirely rather than leaving it half-imported (spec §13).
#[tauri::command]
pub fn lexicon_apply_import(
    app: AppHandle,
    pack_id: String,
    dictionary_id: i64,
    entries: Vec<LexiconEntryInput>,
) -> Result<ImportOutcome, LexiconError> {
    if !is_lexicon_pack_id(&pack_id) {
        return Err(LexiconError::new("notEditable", "This dictionary is read-only."));
    }
    let dir = pack_dir(&app, &pack_id)?;
    let mut conn = open_db(&dir)?;

    let transaction = conn.transaction().map_err(LexiconError::from)?;
    let outcome = apply_import_in(&transaction, dictionary_id, &entries)
        .map_err(LexiconError::from)?;
    transaction.commit().map_err(LexiconError::from)?;

    touch_manifest(&dir, &conn)?;
    Ok(outcome)
}
```

Match `LexiconError::new` and the `From<rusqlite::Error>` impl to whatever the file already defines at line 35 — do not introduce a second error shape.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd src-tauri && cargo test apply_import`
Expected: PASS.

- [ ] **Step 5: Register in BOTH handler lists**

Add `lexicon_apply_import,` to `generate_handler![…]` in **both** `src-tauri/src/main.rs` and `src-tauri/src/lib.rs`, and to the `use lexicon::{…}` block in `main.rs`.

- [ ] **Step 6: Verify both guards**

Run: `pnpm vitest run tests/tauri-command-registration.test.js && cd src-tauri && cargo test`
Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/lexicon.rs src-tauri/src/main.rs src-tauri/src/lib.rs
git commit -m "feat(import): applies a whole spreadsheet import in one transaction"
```

---

### Task 3: Header and column detection

**Files:**
- Create: `src/services/lexicon-import.js`
- Test: `tests/lexicon-import.test.js`

**Interfaces:**
- Consumes: `TibetanRegExps` from `tibetan-regexps` (already a dependency).
- Produces: `detectLayout({ headers, rows }) -> { hasHeaderRow, labels, termColumn, definitionColumn, dataRows }` where `labels` is the array shown in the dropdowns, `termColumn`/`definitionColumn` are integer indexes or `null`, and `dataRows` excludes the header row when one was detected.

- [ ] **Step 1: Write the failing tests**

Create `tests/lexicon-import.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { detectLayout } from '../src/services/lexicon-import.js';

const GRID = {
  headers: ['A', 'B', 'C'],
  rows: [
    ['Terme', 'Traduction', 'Notes'],
    ['སངས་རྒྱས་', 'buddha', 'n.'],
    ['ཆོས་', 'dharma', ''],
  ],
};

describe('detectLayout', () => {
  it('treats a first row with no Tibetan as a header', () => {
    const layout = detectLayout(GRID);
    expect(layout.hasHeaderRow).toBe(true);
    expect(layout.labels).toEqual(['Terme', 'Traduction', 'Notes']);
    expect(layout.dataRows).toHaveLength(2);
  });

  it('keeps the column letters when there is no header row', () => {
    const layout = detectLayout({ ...GRID, rows: GRID.rows.slice(1) });
    expect(layout.hasHeaderRow).toBe(false);
    expect(layout.labels).toEqual(['A', 'B', 'C']);
    expect(layout.dataRows).toHaveLength(2);
  });

  it('picks the most Tibetan column as the term', () => {
    expect(detectLayout(GRID).termColumn).toBe(0);
  });

  it('picks the first remaining non-empty column as the definition', () => {
    expect(detectLayout(GRID).definitionColumn).toBe(1);
  });

  it('picks the term column even when it is not the first', () => {
    const layout = detectLayout({
      headers: ['A', 'B'],
      rows: [
        ['buddha', 'སངས་རྒྱས་'],
        ['dharma', 'ཆོས་'],
      ],
    });
    expect(layout.termColumn).toBe(1);
    expect(layout.definitionColumn).toBe(0);
  });

  it('reports no term column when the sheet holds no Tibetan at all', () => {
    const layout = detectLayout({
      headers: ['A', 'B'],
      rows: [['one', 'two']],
    });
    expect(layout.termColumn).toBe(null);
  });

  it('does not call a first row a header when every row is Tibetan-free', () => {
    // Nothing later contains Tibetan, so there is no evidence row 0 is special.
    const layout = detectLayout({ headers: ['A'], rows: [['one'], ['two']] });
    expect(layout.hasHeaderRow).toBe(false);
  });

  it('survives an empty sheet', () => {
    const layout = detectLayout({ headers: [], rows: [] });
    expect(layout.termColumn).toBe(null);
    expect(layout.dataRows).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run tests/lexicon-import.test.js`
Expected: FAIL — `Failed to resolve import ../src/services/lexicon-import.js`.

- [ ] **Step 3: Implement `detectLayout`**

Create `src/services/lexicon-import.js`:

```javascript
/**
 * Spreadsheet import — the decisions Rust deliberately refuses to make.
 *
 * read_spreadsheet returns every row plus column letters; which row is a
 * header and which columns mean what is decided here, where it can be tested
 * without a filesystem (spec §9).
 */
import TibetanRegExps from 'tibetan-regexps';

const TIBETAN = new RegExp(`[${TibetanRegExps.expressions.allTibetanCharacters}]`, 'u');

const hasTibetan = (cell) => TIBETAN.test(cell || '');

/** How much of this column is Tibetan? Empty cells do not count either way. */
function tibetanRatio(rows, column) {
  const filled = rows.map((row) => row[column] || '').filter((cell) => cell.trim());
  if (!filled.length) return 0;
  return filled.filter(hasTibetan).length / filled.length;
}

/**
 * @param {{headers: string[], rows: string[][]}} grid As returned by read_spreadsheet.
 * @returns {{hasHeaderRow: boolean, labels: string[], termColumn: number|null,
 *   definitionColumn: number|null, dataRows: string[][]}}
 */
export function detectLayout({ headers = [], rows = [] } = {}) {
  // Row 0 is a header when it holds no Tibetan AND something later does —
  // without that second half, a Tibetan-free sheet would lose its first row.
  const firstRow = rows[0] || [];
  const hasHeaderRow =
    rows.length > 1 &&
    !firstRow.some(hasTibetan) &&
    rows.slice(1).some((row) => row.some(hasTibetan));

  const dataRows = hasHeaderRow ? rows.slice(1) : rows;
  const labels = hasHeaderRow
    ? headers.map((letter, index) => firstRow[index]?.trim() || letter)
    : [...headers];

  let termColumn = null;
  let best = 0;
  headers.forEach((_, column) => {
    const ratio = tibetanRatio(dataRows, column);
    if (ratio > best) {
      best = ratio;
      termColumn = column;
    }
  });

  const definitionColumn = headers.findIndex(
    (_, column) =>
      column !== termColumn && dataRows.some((row) => (row[column] || '').trim())
  );

  return {
    hasHeaderRow,
    labels,
    termColumn,
    definitionColumn: definitionColumn === -1 ? null : definitionColumn,
    dataRows,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run tests/lexicon-import.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/lexicon-import.js tests/lexicon-import.test.js
git commit -m "feat(import): detects the header row and the term and definition columns"
```

---

### Task 4: The diff

**Files:**
- Modify: `src/services/lexicon-import.js`
- Test: `tests/lexicon-import.test.js`

**Interfaces:**
- Consumes: `tibetanLookupKey` from `src/utils.js`, `detectLayout` from Task 3.
- Produces: `diffRows(dataRows, { termColumn, definitionColumn }, existingEntries) -> { created, modified, unchangedCount, ignored }` where `existingEntries` is `[{ id, term, definition }]`, `created` is `[{ term, definition, row }]`, `modified` is `[{ term, definition, previousDefinition, row }]`, and `ignored` is `[{ row, reason }]` with `reason` one of `'noTerm' | 'duplicate'`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/lexicon-import.test.js`:

```javascript
import { diffRows } from '../src/services/lexicon-import.js';

const COLUMNS = { termColumn: 0, definitionColumn: 1 };
const EXISTING = [
  { id: 1, term: 'སངས་རྒྱས་', definition: 'buddha' },
  { id: 2, term: 'ཆོས་', definition: 'dharma' },
];

describe('diffRows', () => {
  it('classifies an absent term as created', () => {
    const diff = diffRows([['བླ་མ་', 'lama']], COLUMNS, EXISTING);
    expect(diff.created).toEqual([{ term: 'བླ་མ་', definition: 'lama', row: 1 }]);
  });

  it('classifies a changed definition as modified and carries the old one', () => {
    const diff = diffRows([['སངས་རྒྱས་', 'awakened one']], COLUMNS, EXISTING);
    expect(diff.modified).toEqual([
      {
        term: 'སངས་རྒྱས་',
        definition: 'awakened one',
        previousDefinition: 'buddha',
        row: 1,
      },
    ]);
  });

  it('counts an identical definition as unchanged and never lists it', () => {
    const diff = diffRows([['སངས་རྒྱས་', 'buddha']], COLUMNS, EXISTING);
    expect(diff.unchangedCount).toBe(1);
    expect(diff.created).toEqual([]);
    expect(diff.modified).toEqual([]);
  });

  it('matches a term written with a shad against one stored with a tsheg', () => {
    // tibetanLookupKey is the single normalization shared by storage, lookup
    // and this diff (spec §6) — without it this row would duplicate the entry.
    const diff = diffRows([['སངས་རྒྱས།', 'buddha']], COLUMNS, EXISTING);
    expect(diff.unchangedCount).toBe(1);
    expect(diff.created).toEqual([]);
  });

  it('ignores a row whose term cell is empty', () => {
    const diff = diffRows([['', 'orphan']], COLUMNS, EXISTING);
    expect(diff.ignored).toEqual([{ row: 1, reason: 'noTerm' }]);
  });

  it('ignores a row whose term holds no Tibetan at all', () => {
    const diff = diffRows([['notes', 'orphan']], COLUMNS, EXISTING);
    expect(diff.ignored).toEqual([{ row: 1, reason: 'noTerm' }]);
  });

  it('lets the last of two identical terms win and reports the earlier one', () => {
    const diff = diffRows(
      [
        ['བླ་མ་', 'first'],
        ['བླ་མ་', 'second'],
      ],
      COLUMNS,
      EXISTING
    );
    expect(diff.created).toEqual([{ term: 'བླ་མ་', definition: 'second', row: 2 }]);
    expect(diff.ignored).toEqual([{ row: 1, reason: 'duplicate' }]);
  });

  it('numbers rows from 1 so they match what the user sees in the sheet', () => {
    const diff = diffRows([['', 'a'], ['', 'b']], COLUMNS, EXISTING);
    expect(diff.ignored.map((entry) => entry.row)).toEqual([1, 2]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run tests/lexicon-import.test.js -t diffRows`
Expected: FAIL — `diffRows is not a function`.

- [ ] **Step 3: Implement `diffRows`**

Append to `src/services/lexicon-import.js`:

```javascript
import { tibetanLookupKey } from '../utils';

/**
 * Classify every data row against what the dictionary already holds.
 *
 * Keyed on tibetanLookupKey, the same normalization the write and lookup paths
 * use, so "same term written with a shad" and "with a tsheg" collapse to one
 * entry instead of silently duplicating (spec §6).
 *
 * @param {string[][]} dataRows Rows with the header already removed.
 * @param {{termColumn: number, definitionColumn: number}} columns
 * @param {Array<{id: number, term: string, definition: string}>} existingEntries
 */
export function diffRows(dataRows, { termColumn, definitionColumn }, existingEntries = []) {
  const existing = new Map(
    existingEntries.map((entry) => [tibetanLookupKey(entry.term), entry])
  );

  // Last occurrence wins, so walk backwards and skip keys already taken.
  const seen = new Set();
  const ignored = [];
  const retained = [];

  for (let index = dataRows.length - 1; index >= 0; index--) {
    const row = index + 1; // 1-based: what the user sees in the sheet
    const rawTerm = (dataRows[index][termColumn] || '').trim();
    const key = rawTerm ? tibetanLookupKey(rawTerm) : '';

    if (!key || !key.replace(/[་།༑༔\s]/g, '')) {
      ignored.push({ row, reason: 'noTerm' });
      continue;
    }
    if (seen.has(key)) {
      ignored.push({ row, reason: 'duplicate' });
      continue;
    }
    seen.add(key);
    retained.push({
      row,
      key,
      term: key,
      definition: (dataRows[index][definitionColumn] || '').trim(),
    });
  }

  retained.reverse();
  ignored.sort((a, b) => a.row - b.row);

  const created = [];
  const modified = [];
  let unchangedCount = 0;

  for (const { row, key, term, definition } of retained) {
    const match = existing.get(key);
    if (!match) {
      created.push({ term, definition, row });
    } else if (match.definition === definition) {
      unchangedCount++;
    } else {
      modified.push({ term, definition, previousDefinition: match.definition, row });
    }
  }

  return { created, modified, unchangedCount, ignored };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run tests/lexicon-import.test.js`
Expected: PASS (16 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/lexicon-import.js tests/lexicon-import.test.js
git commit -m "feat(import): diffs a sheet against the dictionary it is going into"
```

---

### Task 5: Service bindings

**Files:**
- Modify: `src/services/lexicon.js`
- Test: `tests/lexicon-import.test.js`

**Interfaces:**
- Consumes: `prepareEntry(rawTerm, rawDefinition)` (`src/services/lexicon.js:61`) — it already computes all six phonetic columns.
- Produces: `Lexicon.readSpreadsheet(path)`, `Lexicon.applyImport(packId, dictionaryId, rows)`, and the pure `entriesForImport(rows)` used by both.

- [ ] **Step 1: Write the failing test**

Append to `tests/lexicon-import.test.js`:

```javascript
import { entriesForImport } from '../src/services/lexicon.js';

describe('entriesForImport', () => {
  it('gives every row the six phonetic columns Rust expects', () => {
    const [entry] = entriesForImport([{ term: 'སངས་རྒྱས་', definition: 'buddha' }]);
    expect(Object.keys(entry).sort()).toEqual([
      'definition',
      'definitionPhoneticsWordsLoose',
      'definitionPhoneticsWordsStrict',
      'term',
      'termPhoneticsLoose',
      'termPhoneticsStrict',
    ]);
    expect(entry.termPhoneticsStrict).toBeTruthy();
  });

  it('drops rows that prepareEntry rejects as unusable', () => {
    expect(entriesForImport([{ term: '   ', definition: 'orphan' }])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/lexicon-import.test.js -t entriesForImport`
Expected: FAIL — `entriesForImport is not a function`.

- [ ] **Step 3: Implement**

In `src/services/lexicon.js`, beside `prepareEntry`:

```javascript
/**
 * Turn confirmed diff rows into the payload lexicon_apply_import expects.
 * Phonetics are computed here because JS owns them — Rust never derives them.
 */
export function entriesForImport(rows) {
  return rows.map((row) => prepareEntry(row.term, row.definition)).filter(Boolean);
}
```

And on the `Lexicon` object, beside `export`:

```javascript
  readSpreadsheet(path) {
    return invoke('read_spreadsheet', { path });
  },

  applyImport(packId, dictionaryId, rows) {
    return invoke('lexicon_apply_import', {
      packId,
      dictionaryId,
      entries: entriesForImport(rows),
    });
  },
```

Check `prepareEntry`'s current return for an unusable term — if it throws rather than returning null, make `entriesForImport` filter on the same condition `saveEntry` already relies on rather than inventing a second rule.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run tests/lexicon-import.test.js`
Expected: PASS (18 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/lexicon.js tests/lexicon-import.test.js
git commit -m "feat(import): binds the spreadsheet commands to the lexicon service"
```

---

### Task 6: `ImportPreviewDialog`

**Files:**
- Create: `src/components/ImportPreviewDialog.vue`
- Test: `tests/import-preview-dialog.test.js`

**Interfaces:**
- Consumes: `detectLayout`, `diffRows` (Tasks 3–4); `Lexicon.entries`, `Lexicon.applyImport` (Task 5).
- Props: `modelValue: Boolean`, `grid: Object` (from `read_spreadsheet`), `packId: String`, `dictionaryId: Number`, `dictionaryName: String`.
- Emits: `update:modelValue`, `imported` with `{ inserted, updated }`.

**Behaviour (spec §9.5):** two steps in one dialog — mapping, then recap. Opens on the mapping step when no Tibetan column was detected, with a message rather than an error. Recap headline reads `12 new · 3 modified · 45 unchanged · 2 rows ignored`. Modified entries listed old → new with checkboxes **checked by default**. Unchanged never rendered. Ignored columns named explicitly. Ignored rows in a collapsed block with their numbers.

- [ ] **Step 1: Write the failing tests**

Create `tests/import-preview-dialog.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import ImportPreviewDialog from '../src/components/ImportPreviewDialog.vue';
import Lexicon from '../src/services/lexicon';

const GRID = {
  sheetName: 'Sheet1',
  headers: ['A', 'B', 'C'],
  rows: [
    ['Terme', 'Traduction', 'Notes'],
    ['སངས་རྒྱས་', 'awakened one', 'n.'],
    ['བླ་མ་', 'lama', ''],
    ['', 'orphan', ''],
  ],
};

let vuetify;
beforeEach(() => {
  vuetify = createVuetify({ components, directives });
  Lexicon.entries = vi.fn().mockResolvedValue({
    total: 1,
    entries: [{ id: 1, term: 'སངས་རྒྱས་', definition: 'buddha' }],
  });
  Lexicon.applyImport = vi.fn().mockResolvedValue({ inserted: 1, updated: 1 });
});

const mountDialog = () =>
  mount(ImportPreviewDialog, {
    props: {
      modelValue: true,
      grid: GRID,
      packId: 'custom-notes',
      dictionaryId: 1,
      dictionaryName: 'My notes',
    },
    global: { plugins: [vuetify] },
  });

describe('ImportPreviewDialog', () => {
  it('recaps what the import will do', async () => {
    const wrapper = mountDialog();
    await flushPromises();
    const text = wrapper.text();
    expect(text).toContain('1 new');
    expect(text).toContain('1 modified');
    expect(text).toContain('1 row ignored');
  });

  it('lists a modified entry old to new', async () => {
    const wrapper = mountDialog();
    await flushPromises();
    expect(wrapper.text()).toContain('buddha');
    expect(wrapper.text()).toContain('awakened one');
  });

  it('never renders unchanged entries', async () => {
    Lexicon.entries = vi.fn().mockResolvedValue({
      total: 1,
      entries: [{ id: 1, term: 'བླ་མ་', definition: 'lama' }],
    });
    const wrapper = mountDialog();
    await flushPromises();
    expect(wrapper.text()).toContain('1 unchanged');
    expect(wrapper.findAll('[data-test="modified-entry"]')).toHaveLength(0);
  });

  it('names the columns it is going to ignore', async () => {
    const wrapper = mountDialog();
    await flushPromises();
    expect(wrapper.text()).toContain('Notes');
  });

  it('sends both new and modified entries when nothing is unchecked', async () => {
    const wrapper = mountDialog();
    await flushPromises();
    await wrapper.find('[data-test="confirm-import"]').trigger('click');
    await flushPromises();
    const [, , rows] = Lexicon.applyImport.mock.calls[0];
    expect(rows).toHaveLength(2);
  });

  it('excludes a conflict the user unchecked', async () => {
    const wrapper = mountDialog();
    await flushPromises();
    await wrapper.find('[data-test="modified-checkbox"] input').setValue(false);
    await wrapper.find('[data-test="confirm-import"]').trigger('click');
    await flushPromises();
    const [, , rows] = Lexicon.applyImport.mock.calls[0];
    expect(rows).toHaveLength(1);
    expect(rows[0].term).toContain('བླ་མ་');
  });

  it('emits what was written', async () => {
    const wrapper = mountDialog();
    await flushPromises();
    await wrapper.find('[data-test="confirm-import"]').trigger('click');
    await flushPromises();
    expect(wrapper.emitted('imported')[0][0]).toEqual({ inserted: 1, updated: 1 });
  });

  it('opens on the mapping step when it finds no Tibetan column', async () => {
    const wrapper = mount(ImportPreviewDialog, {
      props: {
        modelValue: true,
        grid: { sheetName: 'S', headers: ['A'], rows: [['one'], ['two']] },
        packId: 'custom-notes',
        dictionaryId: 1,
        dictionaryName: 'My notes',
      },
      global: { plugins: [vuetify] },
    });
    await flushPromises();
    expect(wrapper.find('[data-test="mapping-step"]').exists()).toBe(true);
    expect(wrapper.text()).toMatch(/couldn't tell which column/i);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run tests/import-preview-dialog.test.js`
Expected: FAIL — cannot resolve `ImportPreviewDialog.vue`.

- [ ] **Step 3: Implement the dialog**

Build `src/components/ImportPreviewDialog.vue` as Options API with a `<style lang="stylus" scoped>` block, matching `QuickAddDialog.vue`'s structure. Requirements:

- `v-dialog max-width="720"`, `v-card` with `v-card-item` title `Import into {{ dictionaryName }}` and subtitle `{{ grid.sheetName }}`.
- `data`: `step` (`'mapping' | 'recap'`), `hasHeaderRow`, `labels`, `termColumn`, `definitionColumn`, `existing`, `unchecked` (a `Set` of row numbers), `importing`.
- On open: call `detectLayout(grid)`, load `Lexicon.entries(packId, dictionaryId, { limit: 100000 })` for the diff, then set `step` to `'recap'` when `termColumn !== null`, otherwise `'mapping'` with the message "We couldn't tell which column holds the Tibetan. Pick it below."
- Mapping step (`data-test="mapping-step"`): two `v-select`s bound to `termColumn`/`definitionColumn` with `:items="labels"`, plus a `v-checkbox` bound to `hasHeaderRow`. Changing any of them recomputes the diff. A "Continue" button moves to the recap and is disabled while `termColumn === null`.
- Recap step: headline built from the diff with correct pluralisation (`1 row ignored` / `2 rows ignored`); each modified entry in a row with `data-test="modified-entry"` showing `previousDefinition` struck through then `definition`, and a `v-checkbox` with `data-test="modified-checkbox"` bound into `unchecked`; a line naming every column that is neither term nor definition ("Column C 'Notes' will be ignored"); a `v-expansion-panels` block listing ignored rows by number and reason.
- Actions: `Back` (recap → mapping), `Cancel`, and a `v-btn color="primary" variant="flat" data-test="confirm-import" :loading="importing"` reading `Import`.
- Confirm: `Lexicon.applyImport(packId, dictionaryId, [...created, ...modified.filter(m => !unchecked.has(m.row))])`, then `$emit('imported', outcome)`, close, and dispatch `dictionaries-updated` and `all-terms-updated` (spec §9.6).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run tests/import-preview-dialog.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ImportPreviewDialog.vue tests/import-preview-dialog.test.js
git commit -m "feat(import): previews the diff before writing a spreadsheet in"
```

---

### Task 7: Import into the dictionary being viewed

**Files:**
- Modify: `src/components/LexiconPage.vue` (toolbar at line ~55, beside Add and Export)

**Interfaces:**
- Consumes: `Lexicon.readSpreadsheet` (Task 5), `ImportPreviewDialog` (Task 6).

- [ ] **Step 1: Add the toolbar action**

Beside the existing Export button:

```html
<v-btn variant="text" class="ml-1" @click="importSpreadsheet">
  <v-icon start>mdi-file-import-outline</v-icon>
  Import
</v-btn>
```

- [ ] **Step 2: Add the handler**

```javascript
    async importSpreadsheet() {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const path = await open({
        multiple: false,
        filters: [
          { name: 'Spreadsheets', extensions: ['xlsx', 'xls', 'ods', 'csv', 'tsv'] },
        ],
      });
      if (!path) return;
      try {
        this.importGrid = await Lexicon.readSpreadsheet(path);
        this.importOpen = true;
      } catch (e) {
        console.error('[LexiconPage] read failed:', e);
        this.snackbar.open(messageForError(e, 'Could not read this file.'));
      }
    },
```

Mirror how `exportLexicon` already reaches the dialog plugin and the snackbar in this file rather than introducing a second style.

- [ ] **Step 3: Mount the dialog**

```html
<ImportPreviewDialog
  v-model="importOpen"
  :grid="importGrid"
  :pack-id="packId"
  :dictionary-id="dictionaryId"
  :dictionary-name="dictionaryName"
  @imported="onImported"
/>
```

with `onImported({ inserted, updated })` refreshing the table and opening a snackbar reading `{{ inserted }} added, {{ updated }} updated`.

- [ ] **Step 4: Verify nothing regressed**

Run: `pnpm vitest run tests/lexicon-page.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/LexiconPage.vue
git commit -m "feat(import): adds a spreadsheet import to the dictionary toolbar"
```

---

### Task 8: New dictionary from a spreadsheet

This task is **not in the spec** — §9 assumes an existing dictionary. It was added at the user's request so a first import does not require creating an empty dictionary first.

**Files:**
- Modify: `src/components/CustomPackSection.vue` (beside the create flow at line ~249)

**Interfaces:**
- Consumes: `Lexicon.create` (existing), `Lexicon.readSpreadsheet`, `ImportPreviewDialog`.

- [ ] **Step 1: Add the action beside "create a dictionary"**

A second button, `Create from a spreadsheet`, opening the same file picker as Task 7.

- [ ] **Step 2: Default the name from the file**

After `read_spreadsheet` returns, pre-fill the new dictionary's name with the file's base name (`grid.sheetName`), editable in a field above the preview.

- [ ] **Step 3: Create only on confirmation**

**Order matters.** Call `Lexicon.create(name)` inside the confirm handler, *after* the user commits, then `applyImport` into the pack it returns. Creating up front would leave an orphan empty dictionary behind whenever the user cancels the preview.

Pass `:pack-id="null"` to `ImportPreviewDialog` for this flow and have it skip the `Lexicon.entries` lookup when `packId` is null — every row is new, so the diff is `created` only, `modified` is empty and no conflict arbitration is offered. Add an `create-requested` emit the section listens to, so the dialog never itself decides to create a dictionary.

- [ ] **Step 4: Write the test**

In `tests/custom-pack-section.test.js`, assert that cancelling the preview calls neither `Lexicon.create` nor `Lexicon.applyImport`, and that confirming calls `create` before `applyImport`.

- [ ] **Step 5: Run the tests**

Run: `pnpm vitest run tests/custom-pack-section.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/CustomPackSection.vue tests/custom-pack-section.test.js
git commit -m "feat(import): creates a dictionary straight from a spreadsheet"
```

---

### Task 9: Drag and drop

**Files:**
- Modify: `src/components/LexiconPage.vue`

- [ ] **Step 1: Listen for Tauri's file-drop event**

```javascript
    async listenForDroppedSpreadsheets() {
      const { getCurrentWebview } = await import('@tauri-apps/api/webview');
      this.unlistenDrop = await getCurrentWebview().onDragDropEvent((event) => {
        if (event.payload.type !== 'drop') return;
        const path = event.payload.paths.find((candidate) =>
          /\.(xlsx|xls|ods|csv|tsv)$/i.test(candidate)
        );
        if (path) this.openImportFor(path);
      });
    },
```

Extract the body of Task 7's `importSpreadsheet` after the picker into `openImportFor(path)` so both entry points share it.

- [ ] **Step 2: Release the listener**

Call `this.unlistenDrop?.()` in `unmounted()`. The page is inside `<keep-alive>`, so register in `activated()` and release in `deactivated()` rather than `mounted`/`unmounted` — otherwise a second listener stacks on every visit.

- [ ] **Step 3: Verify by hand in the Tauri app**

Run `pnpm tauri:dev`, drop an `.xlsx` onto the lexicon page, confirm the preview opens. Navigate away and back three times, drop again, and confirm the preview opens exactly once — that is the check that the listener is not stacking.

- [ ] **Step 4: Commit**

```bash
git add src/components/LexiconPage.vue
git commit -m "feat(import): accepts a spreadsheet dropped onto the dictionary"
```

---

## Verification before merge

- [ ] `cd src-tauri && cargo test` — passes
- [ ] `pnpm vitest run` — passes, no new warnings
- [ ] `pnpm build` — passes
- [ ] `pnpm check:tauri-versions` — passes
- [ ] `pnpm tauri:dev`: import a sheet with a new word, a modified word and an unchanged word; confirm the recap counts match (spec §15 step 3)
- [ ] Import a `.csv` saved from Excel for Windows (semicolons, CP1252 accents) and confirm the accents survive
- [ ] Import the same sheet twice; the second run must report 0 new, 0 modified, everything unchanged — the proof that the diff key matches the write key
- [ ] Look up an imported term with the global hotkey; if it is not found, the normalization rule in §6 has been broken somewhere
