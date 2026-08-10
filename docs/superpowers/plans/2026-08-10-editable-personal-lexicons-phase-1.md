# Editable Personal Lexicons — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a non-technical user create a personal dictionary inside the app, add/edit/delete entries in it, and export it as a shareable `.tibdict` file — with no terminal and no developer.

**Architecture:** A lexicon *is* a custom pack. Nothing about the storage format changes: new lexicons are created by copying a committed empty SQLite template (same schema as `build/lib/pack-schema.js`), written to `packs/custom/custom-<id>/data.sqlite`, and picked up by the existing `get_custom_pack_paths` discovery. Phonetics are computed in JS (`src/utils.js`, already shipped) and handed to Rust as ready rows; Rust only writes.

**Tech Stack:** Rust + rusqlite (bundled, FTS5) + `zip` crate · Vue 3 Options API + Vuetify 3 · vitest · sql.js (build script only)

**Spec:** [`docs/superpowers/specs/2026-08-10-editable-personal-lexicons-design.md`](../specs/2026-08-10-editable-personal-lexicons-design.md)

## Global Constraints

- **Term normalization is non-negotiable.** Every write path stores `withTrailingTshek(cleanTerm(input))` from `src/utils.js`. Lookups are exact matches (`WHERE entries.term = ?`), and `GlobalLookupPopup.vue:83` queries with `withTrailingTshek(...)`. Any other normalization makes lexicon entries invisible to the global hotkey.
- **Never duplicate the SQLite DDL.** `build/lib/pack-schema.js` is the only place tables are defined. Rust copies a template; it never runs `CREATE TABLE`.
- **All lexicon commands reject a `packId` that does not start with `custom-`.** This is what keeps official packs read-only.
- **Editing is Tauri-only.** Every new UI element is gated on `supportsModularPacks()` from `src/config/platform.js`.
- **Vue Options API only.** No `<script setup>`, no Composition API in components. Match the surrounding code.
- **Phonetics are computed in JS, never in Rust.** Rust receives all six phonetic columns pre-filled.
- **Git style:** conjugated action verbs — "Adds…", "Fixes…".
- SQLite writes that touch more than one row run inside a single transaction.

---

## File structure

**New files**

| Path | Responsibility |
|---|---|
| `build/make-empty-pack.js` | Emits the empty template from `createPackTables`. Run manually, output committed |
| `src-tauri/resources/empty-pack.sqlite` | Committed empty pack database (~20 KB) |
| `src-tauri/src/lexicon.rs` | All lexicon write/read commands + pure helpers + `#[cfg(test)]` tests |
| `src/services/lexicon.js` | Slug, term normalization, phonetics, Tauri command wrappers |
| `src/components/LexiconPage.vue` | Route `/lexicon` — lexicon list, entry table, search, export, rename, delete |
| `src/components/LexiconEntryDialog.vue` | Add/edit a single entry |
| `src/components/QuickAddDialog.vue` | "Add my definition" from Define/Search |
| `tests/lexicon-slug.test.js` | Slug generation |
| `tests/lexicon-entry.test.js` | Term normalization + entry preparation |
| `tests/empty-pack-template.test.js` | Template schema matches `createPackTables` |

**Modified files**

| Path | Change |
|---|---|
| `src-tauri/src/custom_packs.rs` | Expose `custom_packs_dir` + `CUSTOM_ID_PREFIX` as `pub(crate)`; add `modified_at` to the manifest |
| `src-tauri/src/main.rs` | `mod lexicon;` + register the seven new commands |
| `src-tauri/tauri.conf.json` | Register `empty-pack.sqlite` as a resource |
| `src/services/pack-manager.js` | Add `refreshAfterLexiconChange()` |
| `src/router.js` | Add the `/lexicon` route |
| `src/components/CustomPackSection.vue` | "Manage entries" button per pack + "New dictionary" button |
| `src/components/CustomPackConflictModal.vue` | Local-modification warning |
| `src/components/DefinePage.vue` | Quick-add button |
| `src/components/SearchPage.vue` | Quick-add button |

---

### Task 1: Empty pack template

**Files:**
- Create: `build/make-empty-pack.js`
- Create: `src-tauri/resources/empty-pack.sqlite` (generated, committed)
- Test: `tests/empty-pack-template.test.js`
- Modify: `src-tauri/tauri.conf.json:56-59`
- Modify: `package.json` (scripts)

**Interfaces:**
- Consumes: `createPackTables(database)` from `build/lib/pack-schema.js`
- Produces: `src-tauri/resources/empty-pack.sqlite` — a database with `dictionaries`, `entries`, `entries_fts`, the three triggers and `idx_entries_term`, and **zero rows**

- [ ] **Step 1: Write the failing test**

Create `tests/empty-pack-template.test.js`:

```js
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import initSqlJs from '../public/sql-wasm.js';
import { createPackTables } from '../build/lib/pack-schema.js';

// Vitest runs tests as ESM — __dirname is not defined, so derive it.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.resolve(__dirname, '../src-tauri/resources/empty-pack.sqlite');

function schemaOf(db) {
  const [result] = db.exec(
    "SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name"
  );
  return result.values.map((row) => row.join('\n'));
}

describe('empty-pack.sqlite template', () => {
  it('exists', () => {
    expect(fs.existsSync(TEMPLATE)).toBe(true);
  });

  it('has exactly the schema createPackTables produces', async () => {
    const SQL = await initSqlJs();

    const expected = new SQL.Database();
    createPackTables(expected);
    const expectedSchema = schemaOf(expected);
    expected.close();

    const actual = new SQL.Database(new Uint8Array(fs.readFileSync(TEMPLATE)));
    const actualSchema = schemaOf(actual);
    actual.close();

    expect(actualSchema).toEqual(expectedSchema);
  });

  it('contains no rows', async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database(new Uint8Array(fs.readFileSync(TEMPLATE)));
    const [dicts] = db.exec('SELECT COUNT(*) FROM dictionaries');
    const [entries] = db.exec('SELECT COUNT(*) FROM entries');
    db.close();
    expect(dicts.values[0][0]).toBe(0);
    expect(entries.values[0][0]).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- tests/empty-pack-template.test.js`
Expected: FAIL — the template file does not exist yet.

- [ ] **Step 3: Write the generator script**

Create `build/make-empty-pack.js`:

```js
#!/usr/bin/env node
/**
 * Emits src-tauri/resources/empty-pack.sqlite — an empty pack database used as
 * the template when the app creates a new personal lexicon.
 *
 * The output is COMMITTED to the repo so the release pipeline needs no extra
 * build step. Re-run this script whenever build/lib/pack-schema.js changes:
 *
 *   node build/make-empty-pack.js
 */

import fs from 'fs';
import path from 'path';
import initSqlJs from '../public/sql-wasm.js';
import { createPackTables } from './lib/pack-schema.js';

const OUTPUT = path.resolve(__dirname, '../src-tauri/resources/empty-pack.sqlite');

async function main() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  createPackTables(db);
  const data = Buffer.from(db.export());
  db.close();

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, data);
  console.log(`Wrote ${OUTPUT} (${(data.length / 1024).toFixed(1)} kB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 4: Add the script to package.json**

In `package.json`, next to `"build:tibdict"`, add:

```json
"build:empty-pack": "babel-node ./build/make-empty-pack.js",
```

- [ ] **Step 5: Generate the template**

Run: `pnpm build:empty-pack`
Expected: prints `Wrote .../empty-pack.sqlite (~20 kB)`

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm test -- tests/empty-pack-template.test.js`
Expected: PASS, 3 tests.

- [ ] **Step 7: Register the resource**

In `src-tauri/tauri.conf.json`, extend the `resources` map (currently lines 56–59) to:

```json
    "resources": {
      "../public/packs/core.sqlite": "core.sqlite",
      "../public/packs/pack-manifest.json": "pack-manifest.json",
      "resources/empty-pack.sqlite": "empty-pack.sqlite"
    },
```

- [ ] **Step 8: Commit**

```bash
git add build/make-empty-pack.js src-tauri/resources/empty-pack.sqlite \
        tests/empty-pack-template.test.js src-tauri/tauri.conf.json package.json
git commit -m "feat(lexicon): adds an empty pack template for new lexicons"
```

---

### Task 2: Expose custom pack internals and add `modifiedAt`

**Files:**
- Modify: `src-tauri/src/custom_packs.rs`

**Interfaces:**
- Produces: `pub(crate) fn custom_packs_dir(app: &AppHandle) -> Result<PathBuf, InstallError>`, `pub(crate) const CUSTOM_ID_PREFIX: &str`, and `TibdictManifest.modified_at: Option<String>` (serialized as `modifiedAt`)

- [ ] **Step 1: Add the `modifiedAt` field**

In `src-tauri/src/custom_packs.rs`, inside `struct TibdictManifest`, add after the `created_at` field:

```rust
    #[serde(default)]
    pub modified_at: Option<String>,
```

The struct already carries `#[serde(rename_all = "camelCase")]`, so this serializes as `modifiedAt`. `#[serde(default)]` keeps every existing `.tibdict` parsing unchanged.

- [ ] **Step 2: Widen the two visibilities**

Change:

```rust
const CUSTOM_ID_PREFIX: &str = "custom-";
```

to:

```rust
pub(crate) const CUSTOM_ID_PREFIX: &str = "custom-";
```

and:

```rust
fn custom_packs_dir(app: &AppHandle) -> Result<PathBuf, InstallError> {
```

to:

```rust
pub(crate) fn custom_packs_dir(app: &AppHandle) -> Result<PathBuf, InstallError> {
```

- [ ] **Step 3: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: finishes with no errors (warnings about unused `pub(crate)` items are acceptable at this stage).

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/custom_packs.rs
git commit -m "refactor(custom-packs): exposes pack dir helpers and adds modifiedAt"
```

---

### Task 3: Rust lexicon module — creation

**Files:**
- Create: `src-tauri/src/lexicon.rs`
- Modify: `src-tauri/src/main.rs:3-6` (module declaration), `src-tauri/src/main.rs:295-334` (handler list)

**Interfaces:**
- Consumes: `custom_packs::{custom_packs_dir, CUSTOM_ID_PREFIX, TibdictManifest, TibdictManifestDictionary, InstalledCustomPack}`
- Produces:
  - `pub struct LexiconError { code: String, message: String }` (serialized camelCase)
  - `pub fn is_lexicon_pack_id(id: &str) -> bool`
  - `pub fn bump_patch_version(version: Option<&str>) -> String`
  - Command `create_lexicon(app, id: String, name: String, description: String) -> Result<InstalledCustomPack, LexiconError>`

Note: the slug is generated in JS (Task 6) and passed in as `id` **without** the `custom-` prefix; Rust adds the prefix.

- [ ] **Step 1: Write the module with its unit tests**

Create `src-tauri/src/lexicon.rs`:

```rust
//! Personal lexicons — write access to custom dictionary packs.
//!
//! A lexicon IS a custom pack: same on-disk layout, same SQLite schema, same
//! discovery path. This module only adds the ability to write to one.
//!
//! Two invariants hold everywhere in this file:
//!   1. Every command refuses a pack id that is not prefixed `custom-`.
//!      That guard is what keeps the official packs read-only.
//!   2. Phonetic columns are computed by the frontend (src/utils.js) and
//!      arrive pre-filled. Rust never interprets Tibetan.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

use crate::custom_packs::{
    custom_packs_dir, InstalledCustomPack, TibdictManifest, TibdictManifestDictionary,
    CUSTOM_ID_PREFIX,
};

const FORMAT_VERSION: u32 = 1;
const SCHEMA_VERSION: u32 = 3;
const DEFAULT_ICON: &str = "mdi-notebook-edit-outline";

/// Error codes returned to the frontend:
///   - "notCustom" : pack id is not a custom pack — refused
///   - "notFound"  : pack, dictionary or entry does not exist
///   - "conflict"  : a pack with this id already exists
///   - "corrupt"   : SQLite or manifest unreadable
///   - "path"      : filesystem error
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LexiconError {
    pub code: String,
    pub message: String,
}

impl LexiconError {
    fn new(code: &str, message: impl Into<String>) -> Self {
        Self { code: code.to_string(), message: message.into() }
    }
}

/// An entry ready to be written. All six phonetic columns come from the frontend.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LexiconEntryInput {
    pub term: String,
    pub term_phonetics_strict: String,
    pub term_phonetics_loose: String,
    pub definition: String,
    pub definition_phonetics_words_strict: String,
    pub definition_phonetics_words_loose: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LexiconEntry {
    pub id: i64,
    pub term: String,
    pub definition: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LexiconEntriesPage {
    pub total: i64,
    pub entries: Vec<LexiconEntry>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertOutcome {
    pub id: i64,
    pub created: bool,
}

// ---------------------------------------------------------------- pure helpers

/// A pack may only be written to when it is a custom pack.
pub fn is_lexicon_pack_id(id: &str) -> bool {
    if !id.starts_with(CUSTOM_ID_PREFIX) {
        return false;
    }
    let rest = &id[CUSTOM_ID_PREFIX.len()..];
    if rest.len() < 2 {
        return false;
    }
    let bytes = rest.as_bytes();
    let edge_ok = |b: u8| b.is_ascii_lowercase() || b.is_ascii_digit();
    edge_ok(bytes[0])
        && edge_ok(bytes[bytes.len() - 1])
        && rest.bytes().all(|b| edge_ok(b) || b == b'-')
}

/// Increment the patch component so a re-exported lexicon shows a newer version
/// in the recipient's conflict modal. Missing or non-semver input restarts at 1.0.1.
pub fn bump_patch_version(version: Option<&str>) -> String {
    let raw = version.unwrap_or("1.0.0");
    let parts: Vec<&str> = raw.split('.').collect();
    if parts.len() == 3 {
        if let (Ok(major), Ok(minor), Ok(patch)) = (
            parts[0].parse::<u32>(),
            parts[1].parse::<u32>(),
            parts[2].parse::<u32>(),
        ) {
            return format!("{}.{}.{}", major, minor, patch + 1);
        }
    }
    "1.0.1".to_string()
}

fn now_iso8601() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    iso8601_from_unix_secs(secs)
}

/// Split out from `now_iso8601` so the calendar arithmetic is testable against
/// known instants — a clock-reading function can only ever be asserted on shape.
fn iso8601_from_unix_secs(secs: u64) -> String {
    // Days since the Unix epoch, converted with the civil-from-days algorithm.
    let days = (secs / 86_400) as i64;
    let rem = secs % 86_400;
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        y, m, d, rem / 3_600, (rem % 3_600) / 60, rem % 60
    )
}

// ------------------------------------------------------------ path + manifest

fn pack_dir(app: &AppHandle, pack_id: &str) -> Result<PathBuf, LexiconError> {
    if !is_lexicon_pack_id(pack_id) {
        return Err(LexiconError::new(
            "notCustom",
            format!("{pack_id} is not an editable dictionary"),
        ));
    }
    let dir = custom_packs_dir(app)
        .map_err(|e| LexiconError::new("path", e.message))?
        .join(pack_id);
    if !dir.exists() {
        return Err(LexiconError::new("notFound", format!("{pack_id} is not installed")));
    }
    Ok(dir)
}

fn open_db(dir: &Path) -> Result<Connection, LexiconError> {
    Connection::open(dir.join("data.sqlite"))
        .map_err(|e| LexiconError::new("corrupt", format!("open database: {e}")))
}

fn read_manifest(dir: &Path) -> Result<TibdictManifest, LexiconError> {
    let raw = fs::read_to_string(dir.join("manifest.json"))
        .map_err(|e| LexiconError::new("corrupt", format!("read manifest: {e}")))?;
    serde_json::from_str(&raw)
        .map_err(|e| LexiconError::new("corrupt", format!("parse manifest: {e}")))
}

fn write_manifest(dir: &Path, manifest: &TibdictManifest) -> Result<(), LexiconError> {
    let raw = serde_json::to_string_pretty(manifest)
        .map_err(|e| LexiconError::new("corrupt", format!("serialize manifest: {e}")))?;
    fs::write(dir.join("manifest.json"), raw)
        .map_err(|e| LexiconError::new("path", format!("write manifest: {e}")))
}

/// Refresh `modifiedAt` and the per-dictionary entry counts after a write.
fn touch_manifest(dir: &Path, conn: &Connection) -> Result<(), LexiconError> {
    let mut manifest = read_manifest(dir)?;
    manifest.modified_at = Some(now_iso8601());
    for (index, dictionary) in manifest.dictionaries.iter_mut().enumerate() {
        let dictionary_id = (index + 1) as i64;
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM entries WHERE dictionaryId = ?",
                params![dictionary_id],
                |row| row.get(0),
            )
            .unwrap_or(0);
        dictionary.entries_count = Some(count as u32);
    }
    write_manifest(dir, &manifest)
}

// -------------------------------------------------------------------- command

/// Create an empty lexicon by copying the bundled template.
/// `id` is the slug WITHOUT the `custom-` prefix (generated by the frontend).
#[tauri::command]
pub async fn create_lexicon(
    app: AppHandle,
    id: String,
    name: String,
    description: String,
) -> Result<InstalledCustomPack, LexiconError> {
    let pack_id = format!("{CUSTOM_ID_PREFIX}{id}");
    if !is_lexicon_pack_id(&pack_id) {
        return Err(LexiconError::new("notCustom", format!("invalid id: {id}")));
    }

    let dir = custom_packs_dir(&app)
        .map_err(|e| LexiconError::new("path", e.message))?
        .join(&pack_id);
    if dir.exists() {
        return Err(LexiconError::new("conflict", format!("{pack_id} already exists")));
    }

    let template = app
        .path()
        .resolve("empty-pack.sqlite", tauri::path::BaseDirectory::Resource)
        .map_err(|e| LexiconError::new("path", format!("resolve template: {e}")))?;

    fs::create_dir_all(&dir).map_err(|e| LexiconError::new("path", format!("mkdir: {e}")))?;

    let cleanup = |e: LexiconError| {
        let _ = fs::remove_dir_all(&dir);
        e
    };

    fs::copy(&template, dir.join("data.sqlite"))
        .map_err(|e| cleanup(LexiconError::new("path", format!("copy template: {e}"))))?;

    let conn = open_db(&dir).map_err(cleanup)?;
    conn.execute(
        "INSERT INTO dictionaries (id, name, position, enabled) VALUES (1, ?, 1, 1)",
        params![&name],
    )
    .map_err(|e| cleanup(LexiconError::new("corrupt", format!("insert dictionary: {e}"))))?;

    let now = now_iso8601();
    let manifest = TibdictManifest {
        format: "tibdict".to_string(),
        format_version: FORMAT_VERSION,
        schema_version: SCHEMA_VERSION,
        id: id.clone(),
        name: name.clone(),
        description,
        author: None,
        version: Some("1.0.0".to_string()),
        created_at: Some(now.clone()),
        modified_at: Some(now),
        icon: Some(DEFAULT_ICON.to_string()),
        dictionaries: vec![TibdictManifestDictionary {
            name,
            entries_count: Some(0),
        }],
    };
    write_manifest(&dir, &manifest).map_err(cleanup)?;

    Ok(InstalledCustomPack { id: pack_id, manifest })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_a_well_formed_custom_pack_id() {
        assert!(is_lexicon_pack_id("custom-my-lexicon"));
        assert!(is_lexicon_pack_id("custom-abc123"));
    }

    #[test]
    fn rejects_ids_without_the_custom_prefix() {
        assert!(!is_lexicon_pack_id("core"));
        assert!(!is_lexicon_pack_id("tibetan-monolingual"));
        assert!(!is_lexicon_pack_id("my-lexicon"));
    }

    #[test]
    fn rejects_malformed_slugs() {
        assert!(!is_lexicon_pack_id("custom-"));
        assert!(!is_lexicon_pack_id("custom-a"));
        assert!(!is_lexicon_pack_id("custom--leading"));
        assert!(!is_lexicon_pack_id("custom-trailing-"));
        assert!(!is_lexicon_pack_id("custom-Upper"));
        assert!(!is_lexicon_pack_id("custom-with space"));
        assert!(!is_lexicon_pack_id("custom-../escape"));
    }

    #[test]
    fn bumps_the_patch_component() {
        assert_eq!(bump_patch_version(Some("1.0.0")), "1.0.1");
        assert_eq!(bump_patch_version(Some("2.5.9")), "2.5.10");
    }

    #[test]
    fn restarts_at_one_zero_one_for_missing_or_invalid_versions() {
        assert_eq!(bump_patch_version(None), "1.0.1");
        assert_eq!(bump_patch_version(Some("not-a-version")), "1.0.1");
        assert_eq!(bump_patch_version(Some("1.0")), "1.0.1");
    }

    #[test]
    fn converts_known_instants_to_iso8601() {
        assert_eq!(iso8601_from_unix_secs(0), "1970-01-01T00:00:00Z");
        assert_eq!(iso8601_from_unix_secs(86_399), "1970-01-01T23:59:59Z");
        assert_eq!(iso8601_from_unix_secs(86_400), "1970-01-02T00:00:00Z");
        assert_eq!(iso8601_from_unix_secs(1_000_000_000), "2001-09-09T01:46:40Z");
    }

    #[test]
    fn handles_the_leap_day_the_century_rule_would_skip() {
        // 2000 is a leap year despite being a century — the case a naive
        // day-count conversion gets wrong.
        assert_eq!(iso8601_from_unix_secs(951_782_400), "2000-02-29T00:00:00Z");
    }

    #[test]
    fn stamps_the_current_time_in_the_expected_shape() {
        let stamp = now_iso8601();
        assert_eq!(stamp.len(), 20);
        assert!(stamp.ends_with('Z'));
        assert!(stamp.starts_with("20"), "expected a 21st-century year, got {stamp}");
    }
}
```

- [ ] **Step 2: Register the module and the command**

In `src-tauri/src/main.rs`, add after `mod database;` (keeping alphabetical order):

```rust
mod lexicon;
```

Then add to the `invoke_handler` list, after the `// Custom pack commands` block:

```rust
            // Lexicon (editable custom pack) commands
            create_lexicon,
```

And add the corresponding `use` next to the existing `use custom_packs::...` import:

```rust
use lexicon::create_lexicon;
```

Match whatever import style the file already uses for `custom_packs` commands.

- [ ] **Step 3: Run the Rust tests to verify they pass**

Run: `cd src-tauri && cargo test lexicon`
Expected: PASS — 6 tests in `lexicon::tests`.

- [ ] **Step 4: Verify the whole crate compiles**

Run: `cd src-tauri && cargo check`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/lexicon.rs src-tauri/src/main.rs
git commit -m "feat(lexicon): adds create_lexicon and the lexicon Rust module"
```

---

### Task 4: Rust read + write commands for entries

**Files:**
- Modify: `src-tauri/src/lexicon.rs`
- Modify: `src-tauri/src/main.rs` (handler list)

**Interfaces:**
- Consumes: `pack_dir`, `open_db`, `touch_manifest`, `LexiconEntryInput`, `LexiconEntry`, `LexiconEntriesPage`, `UpsertOutcome` from Task 3
- Produces:
  - `lexicon_entries(app, packId, dictionaryId: i64, search: Option<String>, limit: i64, offset: i64) -> Result<LexiconEntriesPage, LexiconError>`
  - `lexicon_upsert_entry(app, packId, dictionaryId: i64, entry: LexiconEntryInput) -> Result<UpsertOutcome, LexiconError>`
  - `lexicon_delete_entry(app, packId, entryId: i64) -> Result<(), LexiconError>`
  - `pub fn upsert_entry_in(conn, dictionary_id, entry) -> rusqlite::Result<UpsertOutcome>`

- [ ] **Step 1: Write the failing tests**

Append to the `#[cfg(test)] mod tests` block in `src-tauri/src/lexicon.rs`:

```rust
    use std::path::PathBuf;

    /// Copy the committed template into a temp file and open it, so tests
    /// exercise the real schema (triggers and FTS included) without an AppHandle.
    fn temp_db(label: &str) -> (Connection, PathBuf) {
        let template = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join("empty-pack.sqlite");
        let path = std::env::temp_dir().join(format!("lexicon-test-{label}-{}.sqlite", std::process::id()));
        let _ = fs::remove_file(&path);
        fs::copy(&template, &path).expect("copy template");
        let conn = Connection::open(&path).expect("open temp db");
        conn.execute(
            "INSERT INTO dictionaries (id, name, position, enabled) VALUES (1, 'Test', 1, 1)",
            [],
        )
        .expect("insert dictionary");
        (conn, path)
    }

    fn input(term: &str, definition: &str) -> LexiconEntryInput {
        LexiconEntryInput {
            term: term.to_string(),
            term_phonetics_strict: "ts".to_string(),
            term_phonetics_loose: "tl".to_string(),
            definition: definition.to_string(),
            definition_phonetics_words_strict: "ds".to_string(),
            definition_phonetics_words_loose: "dl".to_string(),
        }
    }

    #[test]
    fn inserts_an_entry_that_is_absent() {
        let (conn, path) = temp_db("insert");
        let outcome = upsert_entry_in(&conn, 1, &input("ཞི་བདེ་", "peace")).unwrap();
        assert!(outcome.created);

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM entries", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
        let _ = fs::remove_file(path);
    }

    #[test]
    fn updates_an_existing_term_instead_of_duplicating_it() {
        let (conn, path) = temp_db("update");
        let first = upsert_entry_in(&conn, 1, &input("ཞི་བདེ་", "peace")).unwrap();
        let second = upsert_entry_in(&conn, 1, &input("ཞི་བདེ་", "peace, tranquillity")).unwrap();

        assert!(first.created);
        assert!(!second.created);
        assert_eq!(first.id, second.id);

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM entries", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);

        let definition: String = conn
            .query_row("SELECT definition FROM entries WHERE id = ?", params![first.id], |r| r.get(0))
            .unwrap();
        assert_eq!(definition, "peace, tranquillity");
        let _ = fs::remove_file(path);
    }

    #[test]
    fn keeps_the_fts_index_in_sync_on_update() {
        let (conn, path) = temp_db("fts");
        upsert_entry_in(&conn, 1, &input("ཞི་བདེ་", "peace")).unwrap();
        upsert_entry_in(&conn, 1, &input("ཞི་བདེ་", "tranquillity")).unwrap();

        let stale: i64 = conn
            .query_row("SELECT COUNT(*) FROM entries_fts WHERE entries_fts MATCH 'peace'", [], |r| r.get(0))
            .unwrap();
        let fresh: i64 = conn
            .query_row("SELECT COUNT(*) FROM entries_fts WHERE entries_fts MATCH 'tranquillity'", [], |r| r.get(0))
            .unwrap();

        assert_eq!(stale, 0, "the old definition must be gone from the FTS index");
        assert_eq!(fresh, 1);
        let _ = fs::remove_file(path);
    }

    #[test]
    fn treats_the_same_term_in_different_dictionaries_as_distinct() {
        let (conn, path) = temp_db("multi-dict");
        conn.execute(
            "INSERT INTO dictionaries (id, name, position, enabled) VALUES (2, 'Other', 2, 1)",
            [],
        )
        .unwrap();

        let a = upsert_entry_in(&conn, 1, &input("ཞི་བདེ་", "peace")).unwrap();
        let b = upsert_entry_in(&conn, 2, &input("ཞི་བདེ་", "paix")).unwrap();

        assert!(a.created);
        assert!(b.created);
        assert_ne!(a.id, b.id);
        let _ = fs::remove_file(path);
    }
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd src-tauri && cargo test lexicon`
Expected: FAIL to compile — `upsert_entry_in` is not defined.

- [ ] **Step 3: Implement the commands**

Add to `src-tauri/src/lexicon.rs`, before the `#[cfg(test)]` block:

```rust
/// Insert or update by exact term within one dictionary.
///
/// Resolution happens here rather than trusting an id resolved earlier by the
/// frontend, which makes the operation idempotent and safe when the lexicon
/// changed between a preview and its confirmation.
pub fn upsert_entry_in(
    conn: &Connection,
    dictionary_id: i64,
    entry: &LexiconEntryInput,
) -> rusqlite::Result<UpsertOutcome> {
    let existing: Option<i64> = conn
        .query_row(
            "SELECT id FROM entries WHERE dictionaryId = ? AND term = ?",
            params![dictionary_id, &entry.term],
            |row| row.get(0),
        )
        .ok();

    if let Some(id) = existing {
        conn.execute(
            "UPDATE entries SET
                term = ?, termPhoneticsStrict = ?, termPhoneticsLoose = ?,
                definition = ?, definitionPhoneticsWordsStrict = ?, definitionPhoneticsWordsLoose = ?
             WHERE id = ?",
            params![
                &entry.term,
                &entry.term_phonetics_strict,
                &entry.term_phonetics_loose,
                &entry.definition,
                &entry.definition_phonetics_words_strict,
                &entry.definition_phonetics_words_loose,
                id
            ],
        )?;
        return Ok(UpsertOutcome { id, created: false });
    }

    conn.execute(
        "INSERT INTO entries (
            term, termPhoneticsStrict, termPhoneticsLoose,
            definition, definitionPhoneticsWordsStrict, definitionPhoneticsWordsLoose,
            dictionaryId
         ) VALUES (?, ?, ?, ?, ?, ?, ?)",
        params![
            &entry.term,
            &entry.term_phonetics_strict,
            &entry.term_phonetics_loose,
            &entry.definition,
            &entry.definition_phonetics_words_strict,
            &entry.definition_phonetics_words_loose,
            dictionary_id
        ],
    )?;

    Ok(UpsertOutcome { id: conn.last_insert_rowid(), created: true })
}

/// Wrap a user's search string into a LIKE pattern.
///
/// The backslash must be escaped FIRST: it is the ESCAPE character, so escaping
/// it after the wildcards would double-escape the backslashes just inserted.
/// Leaving it unescaped is worse than cosmetic — `'ab' LIKE 'a\b' ESCAPE '\'`
/// is true in SQLite (the backslash is silently consumed), and a needle ending
/// in a backslash swallows the trailing `%` and breaks the search entirely.
pub fn like_pattern(needle: &str) -> String {
    format!(
        "%{}%",
        needle.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_")
    )
}

/// One page of entries, optionally filtered. `search` matches the term or the
/// definition with a LIKE on both, which is what the management table needs —
/// FTS is for the app's real search, not for this admin listing.
#[tauri::command]
pub async fn lexicon_entries(
    app: AppHandle,
    pack_id: String,
    dictionary_id: i64,
    search: Option<String>,
    limit: i64,
    offset: i64,
) -> Result<LexiconEntriesPage, LexiconError> {
    let dir = pack_dir(&app, &pack_id)?;
    let conn = open_db(&dir)?;

    let needle = search.unwrap_or_default();
    let pattern = like_pattern(&needle);
    let filtered = !needle.trim().is_empty();

    let total: i64 = if filtered {
        conn.query_row(
            "SELECT COUNT(*) FROM entries
             WHERE dictionaryId = ? AND (term LIKE ? ESCAPE '\\' OR definition LIKE ? ESCAPE '\\')",
            params![dictionary_id, &pattern, &pattern],
            |row| row.get(0),
        )
    } else {
        conn.query_row(
            "SELECT COUNT(*) FROM entries WHERE dictionaryId = ?",
            params![dictionary_id],
            |row| row.get(0),
        )
    }
    .map_err(|e| LexiconError::new("corrupt", format!("count entries: {e}")))?;

    let mut entries = Vec::new();
    if filtered {
        let mut stmt = conn
            .prepare(
                "SELECT id, term, definition FROM entries
                 WHERE dictionaryId = ? AND (term LIKE ? ESCAPE '\\' OR definition LIKE ? ESCAPE '\\')
                 ORDER BY term LIMIT ? OFFSET ?",
            )
            .map_err(|e| LexiconError::new("corrupt", format!("prepare: {e}")))?;
        let rows = stmt
            .query_map(params![dictionary_id, &pattern, &pattern, limit, offset], |row| {
                Ok(LexiconEntry { id: row.get(0)?, term: row.get(1)?, definition: row.get(2)? })
            })
            .map_err(|e| LexiconError::new("corrupt", format!("query: {e}")))?;
        for row in rows.flatten() {
            entries.push(row);
        }
    } else {
        let mut stmt = conn
            .prepare(
                "SELECT id, term, definition FROM entries
                 WHERE dictionaryId = ? ORDER BY term LIMIT ? OFFSET ?",
            )
            .map_err(|e| LexiconError::new("corrupt", format!("prepare: {e}")))?;
        let rows = stmt
            .query_map(params![dictionary_id, limit, offset], |row| {
                Ok(LexiconEntry { id: row.get(0)?, term: row.get(1)?, definition: row.get(2)? })
            })
            .map_err(|e| LexiconError::new("corrupt", format!("query: {e}")))?;
        for row in rows.flatten() {
            entries.push(row);
        }
    }

    Ok(LexiconEntriesPage { total, entries })
}

#[tauri::command]
pub async fn lexicon_upsert_entry(
    app: AppHandle,
    pack_id: String,
    dictionary_id: i64,
    entry: LexiconEntryInput,
) -> Result<UpsertOutcome, LexiconError> {
    if entry.term.trim().is_empty() {
        return Err(LexiconError::new("notFound", "a term is required"));
    }
    let dir = pack_dir(&app, &pack_id)?;
    let conn = open_db(&dir)?;
    let outcome = upsert_entry_in(&conn, dictionary_id, &entry)
        .map_err(|e| LexiconError::new("corrupt", format!("write entry: {e}")))?;
    touch_manifest(&dir, &conn)?;
    Ok(outcome)
}

#[tauri::command]
pub async fn lexicon_delete_entry(
    app: AppHandle,
    pack_id: String,
    entry_id: i64,
) -> Result<(), LexiconError> {
    let dir = pack_dir(&app, &pack_id)?;
    let conn = open_db(&dir)?;
    let affected = conn
        .execute("DELETE FROM entries WHERE id = ?", params![entry_id])
        .map_err(|e| LexiconError::new("corrupt", format!("delete entry: {e}")))?;
    if affected == 0 {
        return Err(LexiconError::new("notFound", format!("entry {entry_id} not found")));
    }
    touch_manifest(&dir, &conn)?;
    Ok(())
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd src-tauri && cargo test lexicon`
Expected: PASS — 10 tests.

- [ ] **Step 5: Register the three commands**

In `src-tauri/src/main.rs`, extend the lexicon block:

```rust
            // Lexicon (editable custom pack) commands
            create_lexicon,
            lexicon_entries,
            lexicon_upsert_entry,
            lexicon_delete_entry,
```

and the import to `use lexicon::{create_lexicon, lexicon_delete_entry, lexicon_entries, lexicon_upsert_entry};`

- [ ] **Step 6: Verify the crate compiles**

Run: `cd src-tauri && cargo check`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/lexicon.rs src-tauri/src/main.rs
git commit -m "feat(lexicon): adds entry read, upsert and delete commands"
```

---

### Task 5: Rust rename and export

**Files:**
- Modify: `src-tauri/src/lexicon.rs`
- Modify: `src-tauri/src/main.rs` (handler list)

**Interfaces:**
- Consumes: `pack_dir`, `read_manifest`, `write_manifest`, `bump_patch_version` from Tasks 3–4
- Produces:
  - `rename_lexicon(app, packId, name: String, description: String) -> Result<TibdictManifest, LexiconError>`
  - `lexicon_export(app, packId, destPath: String) -> Result<ExportOutcome, LexiconError>` where `ExportOutcome { version: String }`

- [ ] **Step 1: Implement both commands**

Add to `src-tauri/src/lexicon.rs`, before the `#[cfg(test)]` block:

```rust
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportOutcome {
    pub version: String,
}

/// Rename the lexicon. The pack id never changes — renaming must not orphan the
/// folder on disk or break dictionary ordering stored against the old id.
#[tauri::command]
pub async fn rename_lexicon(
    app: AppHandle,
    pack_id: String,
    name: String,
    description: String,
) -> Result<TibdictManifest, LexiconError> {
    if name.trim().is_empty() {
        return Err(LexiconError::new("notFound", "a name is required"));
    }
    let dir = pack_dir(&app, &pack_id)?;
    let conn = open_db(&dir)?;

    // A lexicon created in-app holds a single dictionary whose name mirrors the
    // pack name; keep the two in step so search results show the new name.
    let dictionary_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM dictionaries", [], |row| row.get(0))
        .unwrap_or(0);
    if dictionary_count == 1 {
        conn.execute("UPDATE dictionaries SET name = ? WHERE id = 1", params![&name])
            .map_err(|e| LexiconError::new("corrupt", format!("rename dictionary: {e}")))?;
    }

    let mut manifest = read_manifest(&dir)?;
    manifest.name = name.clone();
    manifest.description = description;
    manifest.modified_at = Some(now_iso8601());
    if dictionary_count == 1 {
        if let Some(first) = manifest.dictionaries.first_mut() {
            first.name = name;
        }
    }
    write_manifest(&dir, &manifest)?;
    Ok(manifest)
}

/// Zip manifest.json + data.sqlite into a .tibdict at `dest_path`.
///
/// The patch version is bumped and persisted first: without it, every export
/// would carry the same version and the recipient's conflict modal would
/// compare v1.0.0 against v1.0.0 and tell them nothing.
/// Write a .tibdict archive: a ZIP holding exactly `manifest.json` + `data.sqlite`.
///
/// Split out from `lexicon_export` so the archive layout — which is what the
/// install path on the recipient's machine validates — is testable without an
/// AppHandle. `custom_packs.rs` rejects an archive missing either member, so a
/// silent change here would only surface on someone else's computer.
pub fn write_tibdict_archive(
    dest_path: &Path,
    manifest_bytes: &[u8],
    sqlite_bytes: &[u8],
) -> Result<(), LexiconError> {
    use std::io::Write;
    use zip::write::SimpleFileOptions;

    let file = fs::File::create(dest_path)
        .map_err(|e| LexiconError::new("path", format!("create {}: {e}", dest_path.display())))?;
    let mut zip = zip::ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    for (name, bytes) in [
        ("manifest.json", manifest_bytes),
        ("data.sqlite", sqlite_bytes),
    ] {
        zip.start_file(name, options)
            .map_err(|e| LexiconError::new("path", format!("start {name} in archive: {e}")))?;
        zip.write_all(bytes)
            .map_err(|e| LexiconError::new("path", format!("write {name} to archive: {e}")))?;
    }

    zip.finish()
        .map_err(|e| LexiconError::new("path", format!("finalize archive: {e}")))?;
    Ok(())
}

#[tauri::command]
pub async fn lexicon_export(
    app: AppHandle,
    pack_id: String,
    dest_path: String,
) -> Result<ExportOutcome, LexiconError> {
    let dir = pack_dir(&app, &pack_id)?;

    let mut manifest = read_manifest(&dir)?;
    let version = bump_patch_version(manifest.version.as_deref());
    manifest.version = Some(version.clone());
    write_manifest(&dir, &manifest)?;

    let manifest_bytes = serde_json::to_vec_pretty(&manifest)
        .map_err(|e| LexiconError::new("corrupt", format!("serialize manifest: {e}")))?;
    let sqlite_bytes = fs::read(dir.join("data.sqlite"))
        .map_err(|e| LexiconError::new("corrupt", format!("read database: {e}")))?;

    write_tibdict_archive(Path::new(&dest_path), &manifest_bytes, &sqlite_bytes)?;

    Ok(ExportOutcome { version })
}
```

- [ ] **Step 2: Add the archive tests**

Append inside the existing `#[cfg(test)] mod tests` block:

```rust
    #[test]
    fn writes_an_archive_holding_exactly_the_two_expected_members() {
        let dest = std::env::temp_dir().join(format!("lexicon-export-{}.tibdict", std::process::id()));
        let _ = fs::remove_file(&dest);

        write_tibdict_archive(&dest, b"{\"format\":\"tibdict\"}", b"SQLite format 3\0")
            .expect("write archive");

        let file = fs::File::open(&dest).expect("open archive");
        let mut zip = zip::ZipArchive::new(file).expect("read archive");

        let mut names: Vec<String> = (0..zip.len())
            .map(|i| zip.by_index(i).expect("entry").name().to_string())
            .collect();
        names.sort();
        assert_eq!(names, vec!["data.sqlite".to_string(), "manifest.json".to_string()]);

        let _ = fs::remove_file(&dest);
    }

    #[test]
    fn round_trips_member_contents_through_the_archive() {
        use std::io::Read;

        let dest = std::env::temp_dir().join(format!("lexicon-roundtrip-{}.tibdict", std::process::id()));
        let _ = fs::remove_file(&dest);

        let manifest = br#"{"format":"tibdict","id":"demo"}"#;
        let sqlite = b"SQLite format 3\0some bytes";
        write_tibdict_archive(&dest, manifest, sqlite).expect("write archive");

        let file = fs::File::open(&dest).expect("open archive");
        let mut zip = zip::ZipArchive::new(file).expect("read archive");

        let mut got_manifest = Vec::new();
        zip.by_name("manifest.json")
            .expect("manifest member")
            .read_to_end(&mut got_manifest)
            .expect("read manifest");
        let mut got_sqlite = Vec::new();
        zip.by_name("data.sqlite")
            .expect("sqlite member")
            .read_to_end(&mut got_sqlite)
            .expect("read sqlite");

        assert_eq!(got_manifest, manifest.to_vec());
        assert_eq!(got_sqlite, sqlite.to_vec(), "binary content must survive intact");

        let _ = fs::remove_file(&dest);
    }
```

- [ ] **Step 3: Verify the crate compiles and the tests pass**

Run: `cd src-tauri && cargo test lexicon`
Expected: all tests pass, including the two new archive tests.

If the `zip` crate rejects `SimpleFileOptions`, check the version in `src-tauri/Cargo.toml` — on `zip 2.x` it is `zip::write::SimpleFileOptions`; adjust the import to whatever that version exposes and keep the rest identical. If `ZipArchive` reading is unavailable with the crate's current feature set, add what it needs to `Cargo.toml` and record that in your report.

- [ ] **Step 4: Confirm the archive writer is enabled**

Run: `cd src-tauri && cargo tree -p zip -e features | head -20`
Expected: the `deflate` feature is present. The existing `Cargo.toml` declares `zip = { version = "2", default-features = false, features = ["deflate"] }`, which supports writing.

- [ ] **Step 5: Register both commands**

In `src-tauri/src/main.rs`, extend the lexicon block to:

```rust
            // Lexicon (editable custom pack) commands
            create_lexicon,
            rename_lexicon,
            lexicon_entries,
            lexicon_upsert_entry,
            lexicon_delete_entry,
            lexicon_export,
```

and update the import accordingly.

- [ ] **Step 6: Run the full Rust test suite**

Run: `cd src-tauri && cargo test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/lexicon.rs src-tauri/src/main.rs
git commit -m "feat(lexicon): adds rename and .tibdict export"
```

---

### Task 6: JS lexicon service

**Files:**
- Create: `src/services/lexicon.js`
- Test: `tests/lexicon-slug.test.js`, `tests/lexicon-entry.test.js`
- Modify: `src/services/pack-manager.js` (add `refreshAfterLexiconChange`)

**Interfaces:**
- Consumes: `withTrailingTshek`, `cleanTerm`, `strictAndLoosePhoneticsFor` from `src/utils.js`; the Rust commands from Tasks 3–5
- Produces:
  - `slugForName(name, existingIds) -> string`
  - `normalizeTerm(raw) -> string` (`''` when there is nothing usable)
  - `prepareEntry(rawTerm, rawDefinition) -> { term, definition, termPhoneticsStrict, termPhoneticsLoose, definitionPhoneticsWordsStrict, definitionPhoneticsWordsLoose } | null`
  - `Lexicon.create(name, description)`, `.rename(packId, name, description)`, `.entries(packId, dictionaryId, { search, limit, offset })`, `.saveEntry(packId, dictionaryId, rawTerm, rawDefinition)`, `.deleteEntry(packId, entryId)`, `.export(packId, destPath)`, `.editableDictionaries()`

- [ ] **Step 1: Write the failing slug tests**

Create `tests/lexicon-slug.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { slugForName } from '../src/services/lexicon.js';

describe('slugForName', () => {
  it('lowercases and hyphenates a plain name', () => {
    expect(slugForName('My Lexicon', [])).toBe('my-lexicon');
  });

  it('strips accents so French names produce valid ids', () => {
    expect(slugForName('Médecine tibétaine', [])).toBe('medecine-tibetaine');
  });

  it('collapses punctuation runs into single hyphens', () => {
    expect(slugForName('Dzogchen -- notes!!', [])).toBe('dzogchen-notes');
  });

  it('falls back to "lexicon" when the name has no ASCII letters', () => {
    expect(slugForName('ཆོས་སྐད་', [])).toBe('lexicon');
  });

  it('pads one-character slugs so they satisfy the id regex', () => {
    // The pack id regex requires at least two characters.
    expect(slugForName('A', [])).toBe('a-lexicon');
  });

  it('deduplicates against ids already installed', () => {
    expect(slugForName('My Lexicon', ['custom-my-lexicon'])).toBe('my-lexicon-2');
    expect(slugForName('My Lexicon', ['custom-my-lexicon', 'custom-my-lexicon-2']))
      .toBe('my-lexicon-3');
  });

  it('always produces an id matching the pack id regex', () => {
    const regex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
    for (const name of ['My Lexicon', 'Médecine', 'A', '  ', '2024', '---']) {
      expect(slugForName(name, [])).toMatch(regex);
    }
  });
});
```

- [ ] **Step 2: Write the failing entry tests**

Create `tests/lexicon-entry.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { normalizeTerm, prepareEntry } from '../src/services/lexicon.js';

describe('normalizeTerm', () => {
  it('appends a tsheg when the term has no trailing punctuation', () => {
    expect(normalizeTerm('ཞི་བདེ')).toBe('ཞི་བདེ་');
  });

  it('replaces a trailing shad with a tsheg so the global lookup finds it', () => {
    // GlobalLookupPopup queries with withTrailingTshek(); storing a shad would
    // make the entry invisible to the hotkey.
    expect(normalizeTerm('ཞི་བདེ།')).toBe('ཞི་བདེ་');
  });

  it('leaves an already-normalized term untouched', () => {
    expect(normalizeTerm('ཞི་བདེ་')).toBe('ཞི་བདེ་');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeTerm('  ཞི་བདེ་  ')).toBe('ཞི་བདེ་');
  });

  it('returns an empty string for input with no usable content', () => {
    expect(normalizeTerm('')).toBe('');
    expect(normalizeTerm('   ')).toBe('');
    expect(normalizeTerm('།')).toBe('');
  });
});

describe('prepareEntry', () => {
  it('returns null when the term is unusable', () => {
    expect(prepareEntry('', 'peace')).toBeNull();
    expect(prepareEntry('   ', 'peace')).toBeNull();
  });

  it('returns null when the definition is empty', () => {
    expect(prepareEntry('ཞི་བདེ་', '   ')).toBeNull();
  });

  it('normalizes the term and fills all six columns', () => {
    const entry = prepareEntry('ཞི་བདེ།', '  peace  ');
    expect(entry.term).toBe('ཞི་བདེ་');
    expect(entry.definition).toBe('peace');
    expect(typeof entry.termPhoneticsStrict).toBe('string');
    expect(typeof entry.termPhoneticsLoose).toBe('string');
    expect(typeof entry.definitionPhoneticsWordsStrict).toBe('string');
    expect(typeof entry.definitionPhoneticsWordsLoose).toBe('string');
  });

  it('produces the same phonetics the pack build pipeline would', async () => {
    const { strictAndLoosePhoneticsFor } = await import('../src/utils.js');
    const entry = prepareEntry('ཞི་བདེ་', 'peace');
    const [strict, loose] = strictAndLoosePhoneticsFor('ཞི་བདེ་');
    expect(entry.termPhoneticsStrict).toBe(strict);
    expect(entry.termPhoneticsLoose).toBe(loose);
  });
});
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `pnpm test -- tests/lexicon-slug.test.js tests/lexicon-entry.test.js`
Expected: FAIL — `src/services/lexicon.js` does not exist.

- [ ] **Step 4: Implement the service**

Create `src/services/lexicon.js`:

```js
/**
 * Lexicon — editing custom dictionary packs from inside the app.
 *
 * Layering mirrors custom-pack-importer.js: this is the only module that knows
 * the Tauri lexicon commands exist. Components call it and never invoke directly.
 *
 * Two responsibilities live here rather than in Rust:
 *   - term normalization, because lookups are exact matches and
 *     GlobalLookupPopup queries with withTrailingTshek()
 *   - phonetics, because strictAndLoosePhoneticsFor() has no Rust equivalent
 *     and is the same function search and the build scripts use
 */

import { invoke } from '@tauri-apps/api/core';
import { withTrailingTshek, cleanTerm, strictAndLoosePhoneticsFor } from '../utils';
import PackManager from './pack-manager';

const CUSTOM_PREFIX = 'custom-';

/** Derive a valid, unused pack id from a human name. Never shown to the user. */
export function slugForName(name, existingIds = []) {
  const base = String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining accents left by NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  // The pack id regex is ^[a-z0-9][a-z0-9-]*[a-z0-9]$ — at least two characters.
  let root = base || 'lexicon';
  if (root.length < 2) root = `${root}-lexicon`;

  const taken = new Set(
    existingIds.map((id) => String(id).replace(new RegExp(`^${CUSTOM_PREFIX}`), ''))
  );
  if (!taken.has(root)) return root;

  let suffix = 2;
  while (taken.has(`${root}-${suffix}`)) suffix += 1;
  return `${root}-${suffix}`;
}

/**
 * Normalize a term for storage. Returns '' when nothing usable remains.
 *
 * Must match what GlobalLookupPopup.vue and SelectedTibetanEntriesPopup.vue
 * query with, or lexicon entries become invisible to the global hotkey.
 */
export function normalizeTerm(raw) {
  const cleaned = cleanTerm(String(raw ?? ''));
  if (!cleaned) return '';
  const normalized = withTrailingTshek(cleaned);
  return normalized === '་' ? '' : normalized;
}

/** Build a write-ready entry, or null when term or definition is unusable. */
export function prepareEntry(rawTerm, rawDefinition) {
  const term = normalizeTerm(rawTerm);
  const definition = String(rawDefinition ?? '').trim();
  if (!term || !definition) return null;

  const [termPhoneticsStrict, termPhoneticsLoose] = strictAndLoosePhoneticsFor(term);
  const [definitionPhoneticsWordsStrict, definitionPhoneticsWordsLoose] =
    strictAndLoosePhoneticsFor(definition);

  return {
    term,
    definition,
    termPhoneticsStrict,
    termPhoneticsLoose,
    definitionPhoneticsWordsStrict,
    definitionPhoneticsWordsLoose,
  };
}

export const Lexicon = {
  /** Every dictionary the user is allowed to write to, flattened across packs. */
  editableDictionaries() {
    return PackManager.customPacks.flatMap((pack) =>
      (pack.manifest.dictionaries || []).map((dictionary, index) => ({
        packId: pack.id,
        dictionaryId: index + 1,
        packName: pack.manifest.name,
        name: dictionary.name,
        entriesCount: dictionary.entriesCount ?? 0,
      }))
    );
  },

  async create(name, description = '') {
    const existingIds = PackManager.customPacks.map((pack) => pack.id);
    const id = slugForName(name, existingIds);
    const pack = await invoke('create_lexicon', { id, name: String(name).trim(), description });
    await PackManager.refreshAfterLexiconChange();
    return pack;
  },

  async rename(packId, name, description = '') {
    const manifest = await invoke('rename_lexicon', { packId, name, description });
    await PackManager.refreshAfterLexiconChange();
    return manifest;
  },

  entries(packId, dictionaryId, { search = '', limit = 50, offset = 0 } = {}) {
    return invoke('lexicon_entries', { packId, dictionaryId, search, limit, offset });
  },

  /** Returns { id, created } or null when the input was unusable. */
  async saveEntry(packId, dictionaryId, rawTerm, rawDefinition) {
    const entry = prepareEntry(rawTerm, rawDefinition);
    if (!entry) return null;
    const outcome = await invoke('lexicon_upsert_entry', { packId, dictionaryId, entry });
    await PackManager.refreshAfterLexiconChange();
    return outcome;
  },

  async deleteEntry(packId, entryId) {
    await invoke('lexicon_delete_entry', { packId, entryId });
    await PackManager.refreshAfterLexiconChange();
  },

  export(packId, destPath) {
    return invoke('lexicon_export', { packId, destPath });
  },
};

export default Lexicon;
```

- [ ] **Step 5: Add the refresh hook to PackManager**

In `src/services/pack-manager.js`, add a method right after `refreshCustomPacks()` (around line 620):

```js
  /**
   * Refresh everything after a lexicon write (create, edit, delete, import).
   * Re-reads the custom pack list so manifests (name, entriesCount) are current,
   * then rebuilds the dictionary registry and allTerms so the new entries are
   * searchable and the Define autocomplete picks them up.
   */
  async refreshAfterLexiconChange() {
    if (!supportsModularPacks()) return;
    await this.refreshCustomPacks();
    await refreshDictionariesAndTerms();
  },
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm test -- tests/lexicon-slug.test.js tests/lexicon-entry.test.js`
Expected: PASS — 12 tests.

The tests import `src/services/lexicon.js`, which imports `@tauri-apps/api/core`. If vitest fails to resolve that module, add a mock to `tests/setup.js` alongside the existing global mocks:

```js
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => Promise.resolve(null)),
  convertFileSrc: vi.fn((path) => path),
}))
```

- [ ] **Step 7: Commit**

```bash
git add src/services/lexicon.js src/services/pack-manager.js \
        tests/lexicon-slug.test.js tests/lexicon-entry.test.js tests/setup.js
git commit -m "feat(lexicon): adds the lexicon service with slug and entry preparation"
```

---

### Task 7: Entry editor dialog

**Files:**
- Create: `src/components/LexiconEntryDialog.vue`

**Interfaces:**
- Consumes: `Lexicon.saveEntry` from Task 6; `TibetanTextField` from `src/components/TibetanTextField.vue`
- Produces: a component with props `modelValue: Boolean`, `packId: String`, `dictionaryId: Number`, `entry: Object|null` (`{ id, term, definition }` when editing, `null` when adding), `initialTerm: String`; emits `update:modelValue` and `saved`

- [ ] **Step 1: Create the component**

Create `src/components/LexiconEntryDialog.vue`:

```vue
<template>
  <v-dialog :model-value="modelValue" max-width="560" @update:model-value="close">
    <v-card>
      <v-card-title>{{ isEditing ? 'Edit entry' : 'Add an entry' }}</v-card-title>

      <v-card-text>
        <TibetanTextField
          v-model="term"
          label="Tibetan term"
          :error-messages="termError ? [termError] : []"
          autofocus
        />
        <v-textarea
          v-model="definition"
          label="Definition"
          rows="4"
          auto-grow
          :error-messages="definitionError ? [definitionError] : []"
        />
        <p class="text-caption text-grey mt-2">
          A term already in this dictionary is updated rather than duplicated.
        </p>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close(false)">Cancel</v-btn>
        <v-btn color="primary" variant="tonal" :loading="saving" @click="save">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import TibetanTextField from './TibetanTextField.vue';
import Lexicon, { normalizeTerm } from '../services/lexicon';

export default {
  name: 'LexiconEntryDialog',
  components: { TibetanTextField },
  props: {
    modelValue: { type: Boolean, default: false },
    packId: { type: String, required: true },
    dictionaryId: { type: Number, required: true },
    entry: { type: Object, default: null },
    initialTerm: { type: String, default: '' },
  },
  emits: ['update:modelValue', 'saved'],
  data() {
    return {
      term: '',
      definition: '',
      termError: '',
      definitionError: '',
      saving: false,
    };
  },
  computed: {
    isEditing() {
      return !!(this.entry && this.entry.id);
    },
  },
  watch: {
    modelValue(open) {
      if (!open) return;
      this.term = this.entry?.term || this.initialTerm || '';
      this.definition = this.entry?.definition || '';
      this.termError = '';
      this.definitionError = '';
    },
  },
  methods: {
    close(value = false) {
      this.$emit('update:modelValue', value);
    },
    async save() {
      this.termError = normalizeTerm(this.term) ? '' : 'A Tibetan term is required.';
      this.definitionError = this.definition.trim() ? '' : 'A definition is required.';
      if (this.termError || this.definitionError) return;

      this.saving = true;
      try {
        const outcome = await Lexicon.saveEntry(
          this.packId,
          this.dictionaryId,
          this.term,
          this.definition
        );
        this.$emit('saved', outcome);
        this.close(false);
      } catch (e) {
        console.error('[LexiconEntryDialog] save failed:', e);
        this.termError = 'Could not save this entry.';
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>
```

- [ ] **Step 2: Verify the app still builds**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/LexiconEntryDialog.vue
git commit -m "feat(lexicon): adds the entry editor dialog"
```

---

### Task 8: Lexicon management page

**Files:**
- Create: `src/components/LexiconPage.vue`
- Modify: `src/router.js`
- Modify: `src/components/CustomPackSection.vue`

**Interfaces:**
- Consumes: `Lexicon` (Task 6), `LexiconEntryDialog` (Task 7), `PackManager.customPacks`
- Produces: route `/lexicon` and `/lexicon/:packId`

- [ ] **Step 1: Create the page**

Create `src/components/LexiconPage.vue`:

```vue
<template>
  <div class="lexicon-page pa-4">
    <div v-if="!isSupported" class="text-center text-grey py-8">
      Editing dictionaries is only available in the desktop and mobile apps.
    </div>

    <template v-else>
      <div class="d-flex align-center mb-4">
        <v-select
          v-model="selectedKey"
          :items="dictionaryOptions"
          item-title="label"
          item-value="key"
          label="Dictionary"
          density="comfortable"
          hide-details
          style="max-width: 340px"
        />
        <v-spacer />
        <v-btn
          v-if="selected"
          variant="tonal"
          color="primary"
          class="mr-2"
          @click="openAdd"
        >
          <v-icon start>mdi-plus</v-icon>
          Add an entry
        </v-btn>
        <v-btn v-if="selected" variant="text" @click="exportLexicon">
          <v-icon start>mdi-export</v-icon>
          Export
        </v-btn>
      </div>

      <div v-if="!dictionaryOptions.length" class="text-center text-grey py-8">
        No custom dictionary yet. Create one from Settings.
      </div>

      <template v-else-if="selected">
        <v-text-field
          v-model="search"
          label="Search in this dictionary"
          prepend-inner-icon="mdi-magnify"
          density="comfortable"
          clearable
          hide-details
          class="mb-3"
          @update:model-value="onSearchInput"
        />

        <div class="text-caption text-grey mb-2">{{ total }} entries</div>

        <v-list v-if="entries.length" density="comfortable">
          <v-list-item v-for="row in entries" :key="row.id" class="entry-row">
            <v-list-item-title class="tibetan">{{ row.term }}</v-list-item-title>
            <v-list-item-subtitle class="definition">{{ row.definition }}</v-list-item-subtitle>
            <template v-slot:append>
              <v-btn icon variant="text" size="small" @click="openEdit(row)">
                <v-icon>mdi-pencil</v-icon>
              </v-btn>
              <v-btn icon variant="text" size="small" color="error" @click="remove(row)">
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </template>
          </v-list-item>
        </v-list>

        <div v-else class="text-center text-grey py-8">
          {{ search ? 'No entry matches this search.' : 'This dictionary is empty.' }}
        </div>

        <v-pagination
          v-if="pageCount > 1"
          v-model="page"
          :length="pageCount"
          density="comfortable"
          class="mt-4"
          @update:model-value="load"
        />
      </template>

      <LexiconEntryDialog
        v-if="selected"
        v-model="dialogOpen"
        :pack-id="selected.packId"
        :dictionary-id="selected.dictionaryId"
        :entry="editing"
        @saved="onSaved"
      />
    </template>
  </div>
</template>

<script>
import { save } from '@tauri-apps/plugin-dialog';
import _ from 'underscore';
import Lexicon from '../services/lexicon';
import LexiconEntryDialog from './LexiconEntryDialog.vue';
import { supportsModularPacks } from '../config/platform';

const PAGE_SIZE = 50;

export default {
  name: 'LexiconPage',
  components: { LexiconEntryDialog },
  inject: ['snackbar'],
  data() {
    return {
      selectedKey: null,
      search: '',
      page: 1,
      total: 0,
      entries: [],
      dialogOpen: false,
      editing: null,
    };
  },
  computed: {
    isSupported() {
      return supportsModularPacks();
    },
    dictionaryOptions() {
      return Lexicon.editableDictionaries().map((dictionary) => ({
        ...dictionary,
        key: `${dictionary.packId}:${dictionary.dictionaryId}`,
        label: dictionary.name,
      }));
    },
    selected() {
      return this.dictionaryOptions.find((option) => option.key === this.selectedKey) || null;
    },
    pageCount() {
      return Math.max(1, Math.ceil(this.total / PAGE_SIZE));
    },
  },
  watch: {
    selectedKey() {
      this.page = 1;
      this.load();
    },
  },
  activated() {
    this.syncSelection();
    this.load();
  },
  mounted() {
    this.onSearchInput = _.debounce(() => {
      this.page = 1;
      this.load();
    }, 250);
    window.addEventListener('dictionaries-updated', this.syncSelection);
  },
  beforeUnmount() {
    window.removeEventListener('dictionaries-updated', this.syncSelection);
  },
  methods: {
    syncSelection() {
      const routePackId = this.$route.params.packId;
      const options = this.dictionaryOptions;
      if (!options.length) {
        this.selectedKey = null;
        return;
      }
      const stillThere = options.some((option) => option.key === this.selectedKey);
      if (stillThere) return;
      const fromRoute = routePackId && options.find((option) => option.packId === routePackId);
      this.selectedKey = (fromRoute || options[0]).key;
    },
    async load() {
      if (!this.selected) {
        this.entries = [];
        this.total = 0;
        return;
      }
      try {
        const page = await Lexicon.entries(this.selected.packId, this.selected.dictionaryId, {
          search: this.search || '',
          limit: PAGE_SIZE,
          offset: (this.page - 1) * PAGE_SIZE,
        });
        this.entries = page.entries;
        this.total = page.total;
      } catch (e) {
        console.error('[LexiconPage] load failed:', e);
        this.snackbar.open('Could not read this dictionary.');
      }
    },
    openAdd() {
      this.editing = null;
      this.dialogOpen = true;
    },
    openEdit(row) {
      this.editing = row;
      this.dialogOpen = true;
    },
    onSaved() {
      this.load();
    },
    async remove(row) {
      try {
        await Lexicon.deleteEntry(this.selected.packId, row.id);
        this.snackbar.open('Entry removed');
        this.load();
      } catch (e) {
        console.error('[LexiconPage] delete failed:', e);
        this.snackbar.open('Could not remove this entry.');
      }
    },
    async exportLexicon() {
      try {
        const destPath = await save({
          defaultPath: `${this.selected.packName}.tibdict`,
          filters: [{ name: 'Tibetan dictionary', extensions: ['tibdict'] }],
        });
        if (!destPath) return;
        const outcome = await Lexicon.export(this.selected.packId, destPath);
        this.snackbar.open(`Exported as v${outcome.version}`);
      } catch (e) {
        console.error('[LexiconPage] export failed:', e);
        this.snackbar.open('Could not export this dictionary.');
      }
    },
  },
};
</script>

<style lang="stylus" scoped>
.lexicon-page
  max-width 900px
  margin 0 auto

.entry-row
  border-bottom thin solid rgba(128, 128, 128, 0.2)

  .definition
    white-space pre-wrap
</style>
```

- [ ] **Step 2: Add the routes**

In `src/router.js`, add the import next to the others:

```js
import LexiconPage from './components/LexiconPage.vue'
```

and the routes after the `/settings` entry:

```js
  { path: '/lexicon', component: LexiconPage },
  { path: '/lexicon/:packId', component: LexiconPage },
```

- [ ] **Step 3: Add the entry points in Settings**

In `src/components/CustomPackSection.vue`, add a "Manage entries" button to each list item's `append` slot, before the delete button:

```vue
          <v-btn
            icon
            variant="text"
            size="small"
            @click="onManage(pack)"
          >
            <v-icon>mdi-playlist-edit</v-icon>
            <v-tooltip activator="parent" location="top">Manage entries</v-tooltip>
          </v-btn>
```

Add a "New dictionary" button next to each "Import a dictionary…" button (both the `v-card-actions` and the empty-state one):

```vue
      <v-btn variant="tonal" color="primary" size="small" class="ml-2" @click="onCreate">
        <v-icon start>mdi-plus</v-icon>
        New dictionary
      </v-btn>
```

Add to the component's `methods`:

```js
    onManage(pack) {
      this.$router.push(`/lexicon/${pack.id}`);
    },
    async onCreate() {
      const name = window.prompt('Name of the new dictionary');
      if (!name || !name.trim()) return;
      try {
        const pack = await Lexicon.create(name.trim());
        this.snackbar.open(`${pack.manifest.name} created`);
        this.$router.push(`/lexicon/${pack.id}`);
      } catch (e) {
        console.error('[CustomPackSection] create failed:', e);
        this.snackbar.open('Could not create this dictionary.');
      }
    },
```

and the import:

```js
import Lexicon from '../services/lexicon';
```

- [ ] **Step 4: Verify the build**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 5: Run the full JS test suite**

Run: `pnpm test`
Expected: PASS — no regressions in the existing suites.

- [ ] **Step 6: Commit**

```bash
git add src/components/LexiconPage.vue src/router.js src/components/CustomPackSection.vue
git commit -m "feat(lexicon): adds the lexicon management page"
```

---

### Task 9: Quick add from Define and Search

**Files:**
- Create: `src/components/QuickAddDialog.vue`
- Modify: `src/components/DefinePage.vue`
- Modify: `src/components/SearchPage.vue`

**Interfaces:**
- Consumes: `Lexicon` (Task 6), `TibetanTextField`, `Storage` from `src/services/storage.js`
- Produces: a component with props `modelValue: Boolean`, `term: String`; emits `update:modelValue` and `saved`. Remembers the last target in localStorage under `lastLexiconTarget`.

- [ ] **Step 1: Create the component**

Create `src/components/QuickAddDialog.vue`:

```vue
<template>
  <v-dialog :model-value="modelValue" max-width="560" @update:model-value="close">
    <v-card>
      <v-card-title>Add my definition</v-card-title>

      <v-card-text>
        <template v-if="targets.length">
          <v-select
            v-if="targets.length > 1"
            v-model="targetKey"
            :items="targets"
            item-title="name"
            item-value="key"
            label="Add to"
            density="comfortable"
            class="mb-2"
          />
          <TibetanTextField v-model="localTerm" label="Tibetan term" />
          <v-textarea
            v-model="definition"
            label="My definition"
            rows="4"
            auto-grow
            autofocus
            :error-messages="error ? [error] : []"
          />
          <p v-if="existingId" class="text-caption text-grey">
            This term is already in {{ selectedTarget.name }} — saving will update it.
          </p>
        </template>

        <template v-else>
          <p class="mb-3">
            You don't have a personal dictionary yet. Create one to start collecting
            your own definitions.
          </p>
          <v-text-field
            v-model="newLexiconName"
            label="Name of the new dictionary"
            density="comfortable"
            autofocus
          />
        </template>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close(false)">Cancel</v-btn>
        <v-btn
          v-if="targets.length"
          color="primary"
          variant="tonal"
          :loading="saving"
          @click="save"
        >
          Save
        </v-btn>
        <v-btn v-else color="primary" variant="tonal" :loading="saving" @click="createThenSave">
          Create
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import TibetanTextField from './TibetanTextField.vue';
import Lexicon, { normalizeTerm } from '../services/lexicon';
import Storage from '../services/storage';

export default {
  name: 'QuickAddDialog',
  components: { TibetanTextField },
  inject: ['snackbar'],
  props: {
    modelValue: { type: Boolean, default: false },
    term: { type: String, default: '' },
  },
  emits: ['update:modelValue', 'saved'],
  data() {
    return {
      localTerm: '',
      definition: '',
      targetKey: null,
      newLexiconName: '',
      existingId: null,
      error: '',
      saving: false,
    };
  },
  computed: {
    targets() {
      return Lexicon.editableDictionaries().map((dictionary) => ({
        ...dictionary,
        key: `${dictionary.packId}:${dictionary.dictionaryId}`,
      }));
    },
    selectedTarget() {
      return this.targets.find((target) => target.key === this.targetKey) || this.targets[0] || null;
    },
  },
  watch: {
    modelValue(open) {
      if (!open) return;
      this.localTerm = this.term || '';
      this.definition = '';
      this.error = '';
      this.newLexiconName = '';
      this.existingId = null;

      const remembered = Storage.get('lastLexiconTarget');
      const known = this.targets.some((target) => target.key === remembered);
      this.targetKey = known ? remembered : this.targets[0]?.key || null;
      this.loadExisting();
    },
    targetKey() {
      this.loadExisting();
    },
  },
  methods: {
    close(value = false) {
      this.$emit('update:modelValue', value);
    },
    /** Pre-fill the definition when this term is already in the target dictionary. */
    async loadExisting() {
      this.existingId = null;
      const target = this.selectedTarget;
      const term = normalizeTerm(this.localTerm);
      if (!target || !term) return;
      try {
        const page = await Lexicon.entries(target.packId, target.dictionaryId, {
          search: term,
          limit: 50,
          offset: 0,
        });
        const match = page.entries.find((entry) => entry.term === term);
        if (match) {
          this.existingId = match.id;
          if (!this.definition) this.definition = match.definition;
        }
      } catch (e) {
        console.error('[QuickAddDialog] lookup failed:', e);
      }
    },
    async save() {
      const target = this.selectedTarget;
      if (!target) return;
      if (!this.definition.trim()) {
        this.error = 'A definition is required.';
        return;
      }
      this.saving = true;
      try {
        const outcome = await Lexicon.saveEntry(
          target.packId,
          target.dictionaryId,
          this.localTerm,
          this.definition
        );
        if (!outcome) {
          this.error = 'A Tibetan term is required.';
          return;
        }
        Storage.set('lastLexiconTarget', target.key);
        this.snackbar.open(outcome.created ? 'Added to your dictionary' : 'Your definition was updated');
        this.$emit('saved', outcome);
        this.close(false);
      } catch (e) {
        console.error('[QuickAddDialog] save failed:', e);
        this.error = 'Could not save this entry.';
      } finally {
        this.saving = false;
      }
    },
    async createThenSave() {
      const name = this.newLexiconName.trim();
      if (!name) return;
      this.saving = true;
      try {
        const pack = await Lexicon.create(name);
        this.targetKey = `${pack.id}:1`;
        this.snackbar.open(`${pack.manifest.name} created`);
      } catch (e) {
        console.error('[QuickAddDialog] create failed:', e);
        this.snackbar.open('Could not create this dictionary.');
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>
```

- [ ] **Step 2: Wire it into DefinePage**

In `src/components/DefinePage.vue`, add to the template next to the consulted term's heading:

```vue
      <v-btn
        v-if="canAddToLexicon && selectedTerm"
        icon
        variant="text"
        size="small"
        @click="quickAddOpen = true"
      >
        <v-icon>mdi-book-plus</v-icon>
        <v-tooltip activator="parent" location="top">Add my definition</v-tooltip>
      </v-btn>

      <QuickAddDialog
        v-model="quickAddOpen"
        :term="selectedTerm || ''"
        @saved="onLexiconEntrySaved"
      />
```

Add to `components`: `QuickAddDialog`. Add to `data()`: `quickAddOpen: false`. Add to `computed`:

```js
    canAddToLexicon() {
      return supportsModularPacks();
    },
```

Add to `methods`:

```js
    onLexiconEntrySaved() {
      // Re-run the current lookup so the new definition shows immediately.
      if (this.selectedTerm) this.selectTerm(this.selectedTerm);
    },
```

Add the imports:

```js
import QuickAddDialog from './QuickAddDialog.vue';
import { supportsModularPacks } from '../config/platform';
```

If `selectTerm` is not the name of the existing method that loads entries for a term, use whatever method `DefinePage.vue:143` sits inside — the one that calls `SqlDatabase.getEntriesFor(this.selectedTerm)`.

- [ ] **Step 3: Wire it into SearchPage**

Apply the same three additions to `src/components/SearchPage.vue`: the button in the results header, the `QuickAddDialog` element bound to the searched Tibetan term, and the matching `components` / `data` / `computed` / imports. In SearchPage the dialog's `term` prop binds to the page's current query term rather than `selectedTerm`; pass `''` if the query is not a single Tibetan term — the dialog's own field stays editable.

- [ ] **Step 4: Verify the build**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/QuickAddDialog.vue src/components/DefinePage.vue src/components/SearchPage.vue
git commit -m "feat(lexicon): adds quick add from Define and Search"
```

---

### Task 10: Local-modification warning in the conflict modal

**Files:**
- Modify: `src/components/CustomPackConflictModal.vue`

**Interfaces:**
- Consumes: `existingManifest.modifiedAt` and `existingManifest.createdAt` (Task 2)

- [ ] **Step 1: Add the warning**

In `src/components/CustomPackConflictModal.vue`, add to the card text, after the existing version comparison line:

```vue
        <v-alert v-if="hasLocalEdits" type="warning" variant="tonal" density="compact" class="mt-3">
          You have modified this dictionary. Replacing it will discard your changes.
        </v-alert>
```

Add to `computed`:

```js
    hasLocalEdits() {
      const existing = this.existingManifest;
      if (!existing || !existing.modifiedAt || !existing.createdAt) return false;
      return new Date(existing.modifiedAt).getTime() > new Date(existing.createdAt).getTime();
    },
```

If the component receives its manifests under different prop or computed names, match the existing ones rather than introducing `existingManifest`.

- [ ] **Step 2: Verify the build**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/CustomPackConflictModal.vue
git commit -m "feat(lexicon): warns before replacing a locally edited dictionary"
```

---

### Task 11: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the JS test suite**

Run: `pnpm test`
Expected: PASS, including the four new suites.

- [ ] **Step 2: Run the Rust test suite**

Run: `cd src-tauri && cargo test`
Expected: PASS.

- [ ] **Step 3: Verify the production build**

Run: `pnpm build`
Expected: succeeds with no errors.

- [ ] **Step 4: Verify Tauri version alignment**

Run: `pnpm check:tauri-versions`
Expected: every pair aligned. No `@tauri-apps/*` package was touched by this plan, so this should pass unchanged.

- [ ] **Step 5: Record the manual checklist**

The following require a running desktop app (`pnpm tauri:dev`) and cannot be automated. Report them as **not executed** unless actually run:

1. Settings → Custom Dictionaries → New dictionary → name it → lands on `/lexicon`
2. Add three entries; verify they appear in Define and in Search
3. Copy a Tibetan term to the clipboard, trigger the global hotkey — the lexicon entry must appear (this validates the term normalization rule)
4. Edit an entry, verify the old definition no longer appears in search results
5. Export, remove the lexicon, re-install the exported file, verify the entries survived
6. Re-import the same file — the conflict modal appears with the local-modification warning
7. Drag the lexicon to a middle position in the dictionary ordering list

- [ ] **Step 6: Commit anything outstanding**

```bash
git status
```

Expected: clean tree. `.serena/project.yml` may show as modified from before this work — leave it alone.

---

## Self-review

**Spec coverage:**

| Spec section | Task |
|---|---|
| §5.7 empty template | 1 |
| §5.1 all custom packs editable | 3, 4 (the `custom-` guard) |
| §5.8 / §6 term normalization | 6 (`normalizeTerm` + tests) |
| §7 architecture split | 3–6 |
| §8 Rust commands (phase 1 subset) | 3, 4, 5 |
| §8 manifest `modifiedAt` | 2 |
| §8 slug rules | 6 |
| §10 quick add | 9 |
| §11 export + version bump | 5, 8 |
| §11 local-modification warning | 10 |
| §12 error handling | 3–5 (error codes), 8–9 (snackbars) |
| §13 tests | 1, 3, 4, 6, 11 |

§9 (import) and the `read_spreadsheet` / `lexicon_apply_import` commands are **phase 2** and deliberately absent.

**Type consistency:** `packId` / `dictionaryId` / `entryId` are used identically across Rust command signatures (snake_case, auto-converted from camelCase by Tauri) and the JS wrappers. `UpsertOutcome { id, created }` is produced in Task 4 and consumed in Tasks 7 and 9. `editableDictionaries()` returns `{ packId, dictionaryId, packName, name, entriesCount }` in Task 6 and is destructured with those exact names in Tasks 8 and 9.
