# Editable Personal Lexicons — Design Spec

**Date:** 2026-08-10
**Author:** Jérémy Frère (with Claude)
**Status:** Approved, pending implementation plan
**Builds on:** [`2026-04-23-custom-dictionary-packs-design.md`](2026-04-23-custom-dictionary-packs-design.md)

---

## 1. Problem

Custom dictionary packs (`.tibdict`) can be **installed** from the app today, but they can only be **produced** by a developer: `pnpm build:tibdict` reads Anki `.apkg` files plus a hand-written JSON config, and requires cloning the repo, installing dependencies, and using a terminal.

A non-technical user — a translator building a personal glossary — therefore cannot create her own dictionary, cannot add words to it over time, and cannot share it without going through a developer for every single update.

The 2026-04-23 spec explicitly listed "generating `.tibdict` files from within the app" and "editing custom dictionaries from within the app" as non-goals. This spec reverses both.

## 2. What already exists (and is reused untouched)

Verified in the codebase before writing this spec:

| Capability | Where | Status |
|---|---|---|
| Phonetics generation | `src/utils.js:21` `strictAndLoosePhoneticsFor` | **Already shipped in the app.** `tibetan-to-phonetics` is a runtime `dependency`, and the build scripts import *from* `src/utils.js` — not the reverse |
| FTS5 write support | `rusqlite` with `features = ["bundled"]` | Available. `src-tauri/src/packs.rs:747` already runs FTS5 `MATCH` queries in production, proving the module is compiled in |
| Pack SQLite schema | `build/lib/pack-schema.js` | Canonical DDL, covered by `tests/pack-schema.test.js` |
| Custom pack discovery | `src-tauri/src/custom_packs.rs` `get_custom_pack_paths` | Scans `packs/custom/custom-*/data.sqlite`; anything written there is searchable immediately |
| Install / conflict / remove | `src/services/tibdict-installer.js`, `custom-pack-importer.js` | Drag-drop + file picker + conflict modal, all working |
| Tibetan input with Wylie | `src/components/TibetanTextField.vue` | Reused as-is in the entry editor |
| Connection model | `Connection::open` per query, no pool | Writes need no cache invalidation |

**Nothing about the storage format changes.** A lexicon is a custom pack; a custom pack is a `.tibdict` on disk.

## 3. Goals

- A non-technical user can create a dictionary, add and correct entries, and keep using it over months — without a developer and without a terminal.
- She can load an existing spreadsheet into it, and re-import an updated spreadsheet later to **add and update** words, not just to create.
- She can export it as a single `.tibdict` file and send it to whoever she wants.
- Entries she creates behave exactly like official dictionary entries in search, Define, the global lookup popup, and dictionary ordering.

## 4. Non-goals

- Web support. Editing is Tauri-only, matching custom packs.
- Any server, catalogue, account, or auto-update from a URL. Sharing is "send the file".
- Merging two lexicons into one.
- Undo/history beyond the import preview.
- Schema change. An entry remains `term` + `definition`; no extra columns.
- Editing official packs. They stay read-only.

## 5. Core decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | **Every custom pack is editable** | No new storage concept. Simple mental model: official = read-only, yours = yours. A `.tibdict` received from a friend can be tweaked locally |
| 2 | Editing targets a **dictionary**, not a pack | A converted `.tibdict` may hold several dictionaries; without this, "add a word to this pack" is undefined |
| 3 | **The term is the merge key** | Required by the "update existing words" requirement |
| 4 | Import **overwrites by default**, conflicts are unchecked-able | Predictable ("my spreadsheet is the source of truth") while still recoverable |
| 5 | **Identical rows are never listed**, only counted | Avoids drowning the user in a wall of unchanged entries |
| 6 | Phonetics computed in **JS**, spreadsheets parsed in **Rust** | Single source of truth for phonetics; no stale JS xlsx parser in the bundle |
| 7 | New lexicons are created by **copying a committed empty template** | Avoids duplicating the DDL in Rust and letting it drift from `pack-schema.js` |
| 8 | Terms are stored via a single shared `tibetanLookupKey` helper | See §6 — storage and lookup must be byte-identical, so the rule lives in exactly one place |

## 6. Term normalization — the one correctness trap

Lookups are **exact matches**: `src-tauri/src/packs.rs` runs `WHERE entries.term = ?`.

Two callers query with arbitrary text rather than a term picked from a list — `src/components/GlobalLookupPopup.vue` and `src/components/SelectedTibetanEntriesPopup.vue`. Both derive their query the same way:

```js
text.replace(TibetanRegExps.anythingNonTibetan, '')   // DELETE every non-Tibetan character
    .replace(TibetanRegExps.beginningPunctuation, '') // drop leading punctuation
// …then, at the query call:
withTrailingTshek(that)                               // end with exactly one tsheg
```

Therefore a lexicon entry stored any other way is **invisible to the global hotkey lookup**. Two ways to get this wrong, both found during implementation:

1. Storing a term that ends in a shad (`།`). `withTrailingTshek` (`src/utils.js`) replaces trailing punctuation with a tsheg, so the shad form is never queried for.
2. Using `cleanTerm` (`src/utils.js`) to tidy the input. It *substitutes* `-`, `"` and newlines with a space, whereas the lookup path *deletes* them — so `ཤེས་རིག-དཔེ་མཛོད` would be stored as `ཤེས་རིག དཔེ་མཛོད་` but searched for as `ཤེས་རིགདཔེ་མཛོད་`. `cleanTerm` exists for the build scripts, which run it on raw pre-conversion **Wylie**, where a hyphen is a syllable separator that legitimately becomes a space. It is the wrong tool for post-conversion Tibetan Unicode.

The rule is therefore expressed **once**, as `tibetanLookupKey` in `src/utils.js`, and used by every site that either stores or searches for a term — the lexicon write paths and both popups. Duplicating the rule is what let it drift in the first place; a single exported helper is what keeps storage and lookup byte-identical.

Note this also differs from `build/lib/build-tibdict-sqlite.js`'s local `ensureTrailingTsheg`, which preserves a trailing shad. That function stays as-is for the Anki pipeline.

The same normalization defines the import diff key, so "same term written with a shad" and "same term written with a tsheg" collapse to one entry rather than silently duplicating.

## 7. Architecture

```
UI (Vue 3 Options API + Vuetify)
  LexiconPage.vue          route /lexicon — list, search, edit, delete, import, export
  LexiconEntryDialog.vue   add / edit one entry (uses TibetanTextField)
  QuickAddDialog.vue       "Add my definition" from Define / Search
  ImportPreviewDialog.vue  column mapping + recap + conflict arbitration
      │
services/lexicon.js        orchestration: normalize, compute phonetics, call Rust, emit events
services/lexicon-import.js pure functions: column detection + diff  (unit-tested, no Tauri)
      ▼
src-tauri/src/lexicon.rs   new file, sibling of custom_packs.rs — all write commands
      ▼
packs/custom/custom-<id>/data.sqlite   unchanged schema; FTS triggers keep the index in sync
```

### Why the split lands where it does

**Phonetics stay in JS.** `strictAndLoosePhoneticsFor` has no Rust equivalent and is the same function used by search and by the build scripts. Reimplementing Tibetan phonetics in Rust would create a second source of truth that silently diverges. The JS layer computes the six phonetic columns and hands Rust ready-to-insert rows; Rust never interprets Tibetan.

**Spreadsheet parsing goes to Rust.** The maintained npm `xlsx` package is stale with known advisories, and decoding a binary Excel file inside the webview would add weight to a bundle that (in web mode) has no use for it. `calamine` reads xlsx/xls/ods; `csv` + `encoding_rs` handles the CP1252-with-semicolons files Excel for Windows produces. Rust returns a plain grid of strings and makes no decisions about it.

**The diff stays in JS**, as pure functions in `lexicon-import.js`, because it depends on the same normalization rules as the rest of the app (§6) and must be unit-testable without a Tauri runtime.

### Isolation

`lexicon-import.js` takes `(grid, mapping, existingEntries)` and returns a plan object. It touches no Tauri API, no DOM, no database — which is what makes the diff rules (§9) cheap to test exhaustively.

`lexicon.js` is the only module that knows Tauri commands exist. The dialogs call it and never `invoke` directly, matching the existing `custom-pack-importer.js` / `tibdict-installer.js` layering.

## 8. Rust commands (`src-tauri/src/lexicon.rs`)

All take a `packId` that must start with `custom-`; anything else is rejected. This is the guard that keeps official packs read-only.

| Command | Input | Output |
|---|---|---|
| `create_lexicon` | `id`, `name`, `description` | `InstalledCustomPack` |
| `rename_lexicon` | `packId`, `name`, `description` | updated manifest |
| `lexicon_entries` | `packId`, `dictionaryId`, `search?`, `limit`, `offset` | `{ total, entries: [{ id, term, definition }] }` |
| `lexicon_upsert_entry` | `packId`, `dictionaryId`, `entry` | `{ id, created: bool }` |
| `lexicon_delete_entry` | `packId`, `entryId` | `()` |
| `lexicon_apply_import` | `packId`, `dictionaryId`, `entries: [entry]` | `{ inserted, updated }` |
| `lexicon_export` | `packId`, `destPath` | `{ version }` |
| `read_spreadsheet` | `path` | `{ sheetName, headers, rows }` |

`entry` is `{ term, termPhoneticsStrict, termPhoneticsLoose, definition, definitionPhoneticsWordsStrict, definitionPhoneticsWordsLoose }` — all six phonetic columns pre-computed by JS.

**Upsert semantics.** Both `lexicon_upsert_entry` and `lexicon_apply_import` resolve by exact `term` within the target `dictionaryId`: found → `UPDATE`, absent → `INSERT`. Rust does not trust ids resolved earlier by the JS diff, which makes both commands idempotent and immune to the lexicon changing between preview and confirmation.

`lexicon_apply_import` wraps every row in **one transaction**. A failure mid-way rolls back entirely — the lexicon is never left half-imported.

After any write, the manifest's `entriesCount` and `modifiedAt` are refreshed.

### Manifest additions

One new optional field, `modifiedAt`, added to `TibdictManifest` as `#[serde(default)] Option<String>`. Existing `.tibdict` files keep parsing unchanged.

A lexicon created in-app gets `version: "1.0.0"`, `icon: "mdi-notebook-edit-outline"`, `author: null`, `description: ""` when left blank, and a single dictionary named after the lexicon.

The `id` is a slug derived from the name (lowercased, ASCII-folded, non-alphanumerics → `-`, deduplicated with a numeric suffix if taken). It matches the existing `^[a-z0-9][a-z0-9-]*[a-z0-9]$` rule and is **never shown or asked**. A name that slugs to nothing (e.g. only Tibetan characters) falls back to `lexicon`; a slug shorter than the two characters the regex requires is padded to `<slug>-lexicon`.

The slug is generated **in JS** and passed to `create_lexicon` as `id` without the `custom-` prefix, which Rust adds. Keeping it in JS makes the rules unit-testable without a Tauri runtime, and the deduplication list is already in memory as `PackManager.customPacks`.

### The empty template

`build/lib/pack-schema.js` is the canonical DDL. Rather than restating it in Rust, a small script emits an empty database from that same function:

```
pnpm build:empty-pack  →  src-tauri/resources/empty-pack.sqlite
```

The ~20 KB file is **committed**, so no build step is added to the release pipeline, and `create_lexicon` merely copies it and inserts one `dictionaries` row. A test asserts the committed template's schema matches `createPackTables` output, so drift is caught in CI rather than at runtime.

`empty-pack.sqlite` is registered in `tauri.conf.json` resources.

## 9. Import — flow and diff rules

1. She picks a `.xlsx`/`.xls`/`.csv` file (picker or drag-drop onto the window).
2. `read_spreadsheet` returns the first sheet as `{ headers, rows }`. Rust does **not** decide whether a header row exists: it returns every row in `rows` and puts spreadsheet column letters (`A`, `B`, `C`…) in `headers`.
3. **Header detection and column auto-detection** (`lexicon-import.js`):
   - Row 0 is treated as a header when it contains no Tibetan characters *and* at least one later row does. Its cells then replace the column letters as display labels, and it is excluded from the data.
   - The column with the highest ratio of Tibetan characters becomes the term column; the first remaining column with non-empty content becomes the definition.
   - Two dropdowns let her override both, and a "first row is a header" checkbox lets her override the detection.
4. **Diff**, keyed on the normalized term (§6), against the target dictionary's existing entries:

| Case | Classification |
|---|---|
| Term absent from the lexicon | **new** |
| Term present, definition differs | **modified** |
| Term present, definition identical | **unchanged** (counted only, never listed) |
| Empty Tibetan cell, or term normalizes to empty | **ignored** (row number recorded) |
| Same term appears twice in the sheet | Last occurrence wins; earlier ones counted as ignored with an explicit reason |

5. **Preview dialog**:
   - headline recap: `12 new · 3 modified · 45 unchanged · 2 rows ignored`
   - the modified entries listed old → new, checkbox each, **checked by default**
   - unchanged entries never rendered
   - ignored columns named explicitly ("Column C 'notes' will be ignored")
   - ignored rows in a collapsed block with their row numbers
   - if no Tibetan column is detected, the dialog opens **on the mapping step** with a message rather than failing
6. Confirm → JS computes phonetics for the retained rows only → `lexicon_apply_import` → `dictionaries-updated` + `all-terms-updated`.

Unchecked conflicts are simply excluded from the payload; new entries are never unchecked-able (there is nothing to arbitrate).

## 10. Quick add

A button beside the consulted term in `DefinePage` and `SearchPage` opens `QuickAddDialog`:

- term pre-filled with the looked-up term, editable through `TibetanTextField` (Wylie conversion comes free)
- multiline definition
- target dictionary dropdown, defaulting to the last used (persisted in localStorage via `src/services/storage.js`); if no lexicon exists yet, the dialog offers to create one inline
- if the term already exists in the target, its definition is loaded and Save updates it — consistent with the "term is the merge key" decision (§5, row 3)

The button is hidden when `supportsModularPacks()` is false (web).

## 11. Export and sharing

Per-lexicon export button → native save dialog → Rust zips `manifest.json` + `data.sqlite` into a `.tibdict`.

**The patch version is auto-incremented on every export** (`1.0.0` → `1.0.1`). Without this, the recipient's existing conflict modal would always compare `v1.0.0` against `v1.0.0` and tell them nothing. The bumped version is written back to the installed manifest so the next export continues the sequence.

Sharing itself needs no new code: she sends the file, the recipient drops it on the window, and the existing install flow takes over.

**One warning to add.** Re-installing an updated `.tibdict` replaces the whole pack, discarding any local edits the recipient made to their copy. The conflict modal (`CustomPackConflictModal.vue`) gains a line shown only when the installed pack's `modifiedAt` is later than its `createdAt`: *"You have modified this dictionary. Replacing it will discard your changes."*

## 12. Error handling

| Situation | Behaviour |
|---|---|
| Unreadable or corrupt spreadsheet | Snackbar, no state change |
| No Tibetan column detected | Preview opens on the mapping step with an explanatory message |
| Empty rows / empty Tibetan cell | Counted as ignored, listed by row number |
| Write fails mid-import | Single transaction, rollback, nothing applied |
| Lexicon deleted while its editor is open | Page refreshes on `dictionaries-updated` and returns to the list |
| `packId` not prefixed `custom-` | Command rejected — the guard protecting official packs |
| Duplicate lexicon name | Allowed; the slug is deduplicated with a numeric suffix |

## 13. Tests

**Unit (vitest, no Tauri):**
- `tests/lexicon-import-diff.test.js` — new/modified/unchanged/ignored classification, term normalization collapsing shad and tsheg, duplicate rows in the sheet, unchecked conflicts excluded from the payload
- `tests/lexicon-column-detection.test.js` — Tibetan column detection with and without a header row, override behaviour, files with a single column
- `tests/lexicon-slug.test.js` — slug generation, deduplication, Tibetan-only name fallback
- `tests/empty-pack-template.test.js` — the committed template's schema matches `createPackTables`

**Rust:**
- `lexicon_apply_import` rolls back completely on failure
- `create_lexicon` produces a database that `get_custom_pack_paths` discovers
- `lexicon_export` round-trip: create → add entries → export → reinstall → entries present
- Commands reject a `packId` without the `custom-` prefix

**Manual checklist:**
1. Create a lexicon, add three words, verify they appear in Define and in Search
2. Copy a Tibetan term to the clipboard, trigger the global hotkey, verify the lexicon entry appears (validates §6)
3. Import a spreadsheet with a new word, a modified word, and an unchanged word; verify the recap counts
4. Uncheck one conflict, confirm, verify it was left untouched
5. Export, remove the lexicon, re-install from the exported file, verify entries survive
6. Reorder the lexicon among the official dictionaries

## 14. Phasing

Two phases, each independently shippable. Only one is active at a time.

| Phase | Contents | Outcome |
|---|---|---|
| **1** | Empty template + `create_lexicon` · CRUD commands · `LexiconPage` · `LexiconEntryDialog` · `QuickAddDialog` · export · conflict-modal warning | The user is fully autonomous and can already share |
| **2** | `read_spreadsheet` (calamine/csv) · column detection · diff · `ImportPreviewDialog` · drag-drop of spreadsheets | Bulk loading and spreadsheet round-trips |

Phase 1 unblocks the actual need. Phase 2 is the more expensive half and benefits from real usage feedback on phase 1's data model before being built.
