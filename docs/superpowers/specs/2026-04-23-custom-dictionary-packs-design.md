# Custom Dictionary Packs — Design Spec

**Date:** 2026-04-23
**Author:** Jérémy Frère (with Claude)
**Status:** Approved, pending implementation plan

---

## 1. Problem

The app currently supports three hardcoded dictionary packs (`core`, `tibetan-monolingual`, `sanskrit-academic`), either bundled with the app or downloaded via a manifest from a server. There is no way for users to install dictionaries from sources outside this official set — for example, personal Anki decks converted to dictionary format, or dictionaries shared peer-to-peer.

Jérémy has four personal Anki decks covering INALCO French-Tibetan vocabulary (~194 entries total) and wants to:

1. Convert them to a single dictionary file that fits the app's existing format and retains all information (including inline pronunciation notes and etymology).
2. Install that file on his machine, with the ability to share it with other users of the app.

## 2. Goals

- **Single-use value**: Jérémy's INALCO decks are fully usable inside the app.
- **Generic mechanism**: any user with Anki decks (or another source) can produce and install a custom pack using the same pipeline.
- **Zero runtime surprise**: once installed, a custom pack is indistinguishable from an official pack in search results and dictionary ordering.
- **Sharing-friendly**: a single `.tibdict` file carries everything needed to install on another machine.
- **Maximum reuse**: reuse the existing pack SQLite schema, PackManager lifecycle, FTS search, and per-dictionary settings.

## 3. Non-goals

- OS-level file association (double-click `.tibdict` opens app) — may be added later.
- Drag-and-drop on iOS/Android — not currently supported by Tauri mobile.
- Editing custom dictionaries from within the app.
- Generating `.tibdict` files from within the app (remains a build-time script).
- Web version support — the web build is a demo for desktop/mobile clients; custom packs are Tauri-only.
- Cryptographic signing of `.tibdict` files.
- Automatic schema migration across incompatible `schemaVersion` bumps.

## 4. Deliverables

### 4.1 Build-time conversion script

`build/convert-anki-to-tibdict.js` — Node CLI that converts N Anki `.apkg` files (plus a config JSON) into one `.tibdict` output file.

### 4.2 App-side import and management

- Drag-and-drop of `.tibdict` files onto the desktop window.
- "Importer un dictionnaire…" button in `ConfigurePage`, visible on all Tauri platforms (desktop + mobile).
- "Dictionnaires personnalisés" section in the pack management UI.
- Seamless integration with existing dictionary ordering and search.

## 5. Architecture overview

```
OFFLINE (developer or advanced user)
  APKG files ─┐
              ├─► build/convert-anki-to-tibdict.js ─► mon-dico.tibdict
  config.json ┘                                          │
                                                         │ shared via email, USB, etc.
                                                         ▼
APP (runtime, Tauri only)
  Drag-drop  OR  "Importer…" button
                      │
                      ▼
              CustomPackImporter
                • validate manifest
                • check schemaVersion
                • detect id conflict → confirm modal
                • invoke install_custom_pack Tauri command
                      │
                      ▼
              PackManager.reloadCustomPack(id)
                • register in localStorage
                • SqlDatabase.reloadPack() (existing code)
                • dispatch 'dictionaries-updated', 'all-terms-updated'
                      │
                      ▼
              Search, results display, ordering:
              unchanged — custom pack behaves like any other pack.
```

### Guiding principles

1. **Maximum reuse.** An installed `.tibdict` uses the exact SQLite schema, triggers, and FTS tables as official packs. 99% of the runtime code treats it identically.
2. **Visible isolation where it matters.** Management (install, delete) is clearly separated in the UI; search and ordering are fully mixed.
3. **Single source of truth for metadata.** The `manifest.json` inside the `.tibdict` is authoritative. It is copied verbatim into the install folder so that metadata is available without re-opening the archive.

## 6. File format: `.tibdict`

ZIP archive with the `.tibdict` extension, containing:

```
mon-dico.tibdict  (ZIP, level 9)
├── manifest.json
└── data.sqlite
```

### `manifest.json`

```json
{
  "format": "tibdict",
  "formatVersion": 1,
  "schemaVersion": 3,
  "id": "inalco-fr-tib",
  "name": "INALCO Français-Tibétain",
  "description": "Vocabulaire L1 et L2 du cursus INALCO, tiré de decks Anki personnels.",
  "author": "Jérémy Frère",
  "version": "1.0.0",
  "createdAt": "2026-04-23T12:00:00Z",
  "icon": "mdi-school-outline",
  "dictionaries": [
    { "name": "INALCO Français-Tibétain", "entriesCount": 194 }
  ]
}
```

| Field | Purpose | Required |
|---|---|---|
| `format` | Always `"tibdict"`, sanity check | ✅ |
| `formatVersion` | Version of the `.tibdict` envelope format (distinct from `schemaVersion`). Allows the envelope to evolve independently of the SQLite schema | ✅ |
| `schemaVersion` | Must match app's `SUPPORTED_SCHEMA_VERSION`, else import refused | ✅ |
| `id` | No `custom-` prefix (app prefixes internally); `[a-z0-9][a-z0-9-]*[a-z0-9]` | ✅ |
| `name` | Displayed in management UI | ✅ |
| `description` | Displayed in management UI | ✅ |
| `author`, `version`, `createdAt` | Traceability; author shown nowhere in UI but retained in file | optional |
| `icon` | Material Design icon name or special name like `tibetan-ka`; defaults to `mdi-book-plus-outline` | optional |
| `dictionaries` | Array of `{ name, entriesCount }` describing the dictionaries inside the pack | ✅ |

### `data.sqlite`

Exact same schema as official packs:
- Table `dictionaries (id, name, position, enabled)`
- Table `entries (id, term, termPhoneticsStrict, termPhoneticsLoose, definition, definitionPhoneticsWordsStrict, definitionPhoneticsWordsLoose, dictionaryId)`
- Virtual table `entries_fts` using FTS5 with `unicode61` tokenizer
- Triggers `entries_after_insert`, `entries_after_delete`, `entries_after_update`
- Index `idx_entries_term` on `entries(term)`

No new schema or schema variant. Zero maintenance burden.

### Import-time validation (in order, first failure rejects)

1. ZIP opens successfully.
2. Entries `manifest.json` and `data.sqlite` both present.
3. `manifest.format === "tibdict"`.
4. `manifest.formatVersion` ≤ app's `MAX_SUPPORTED_FORMAT_VERSION`.
5. `manifest.schemaVersion === SUPPORTED_SCHEMA_VERSION`.
6. `manifest.id` matches regex `^[a-z0-9][a-z0-9-]*[a-z0-9]$`.
7. `data.sqlite` opens, has tables `dictionaries` and `entries` with expected columns.
8. If a custom pack with the same `id` is already installed, trigger the conflict-confirmation modal.

Validation happens in a temp directory. On success, the folder is moved atomically to the final location. On failure, the temp directory is deleted.

## 7. Conversion pipeline: APKG → `.tibdict`

**Script:** `build/convert-anki-to-tibdict.js`

**Invocation:**
```bash
node build/convert-anki-to-tibdict.js \
  --config build/inalco.tibdict-config.json \
  --output ./inalco-fr-tib.tibdict
```

**Config file `inalco.tibdict-config.json`:**
```json
{
  "id": "inalco-fr-tib",
  "name": "INALCO Français-Tibétain",
  "description": "Vocabulaire L1 et L2 du cursus INALCO.",
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

The `reversed` flag indicates that a deck stores `[tibetan, french]` instead of the normal `[french, tibetan]`.

### Pipeline

1. Parse config JSON.
2. For each source APKG:
   a. Unzip into a temp folder.
   b. Decompress `collection.anki21b` (zstd) into a SQLite file.
   c. `SELECT flds FROM notes WHERE flds IS NOT NULL`.
   d. Split each note on `^_` (ASCII 0x1F) → `[field0, field1]`.
   e. Apply direction:
      - `reversed: true` → `tib = field0, fr = field1`
      - `reversed: false` → `fr = field0, tib = field1`
   f. Normalize each field:
      - `<br>` and `<br/>` → `\n`
      - `&nbsp;` → space
      - `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;` → their characters
      - `trim()`
      - Skip entry if Tibetan field is empty.
   g. Collect `{ term, definition }`.
3. Deduplicate on exact `(term, definition)` pairs only — no intelligent merging.
4. Build `data.sqlite`:
   - Reuse the table-creation code from `build-packs.js` (single source of truth — extract into a shared helper if needed).
   - Insert one row into `dictionaries` with `id=1, name=<from config>, position=1, enabled=1`.
   - For each entry:
     - Normalize `term`: append `་` (tsheg) if the final character isn't `་ ། ༑ ༔` (matches `build-packs.js` logic).
     - Compute `[termPhoneticsStrict, termPhoneticsLoose] = strictAndLoosePhoneticsFor(term)` using existing `src/utils.js`.
     - Compute the same for `definition` (even though French phonetics aren't linguistically meaningful, we do this for schema consistency; it produces a harmless string).
     - `INSERT INTO entries (...)` — triggers populate FTS automatically.
5. Generate `manifest.json` with actual `entriesCount`.
6. Package `manifest.json` + `data.sqlite` into a ZIP (level 9) → output `.tibdict`.
7. Print a summary: total entries, file size, output path.

### Error strategy

If an APKG is corrupted or in an unexpected format, log a precise warning (filename, note id) and continue with the others. The script exits non-zero only if total collected entries is zero.

### New dev dependencies

- `adm-zip` (or `yauzl`) — ZIP read/write for APKG and `.tibdict`.
- `@mongodb-js/zstd` (or a similar zstd binding) — decompress `collection.anki21b`.

Both dev-only, not bundled in the app.

## 8. App-side installation and management

### 8.1 On-disk layout

```
<app-data-dir>/
  packs/
    core.sqlite                  (existing)
    tibetan-monolingual.sqlite   (existing)
    sanskrit-academic.sqlite     (existing)
    custom/
      custom-inalco-fr-tib/
        data.sqlite
        manifest.json            (verbatim copy from the .tibdict)
      custom-<other-id>/
        ...
```

IDs are prefixed with `custom-` internally to guarantee no clash with future official pack IDs.

### 8.2 New Tauri commands (Rust)

Implemented in `src-tauri/src/custom_packs.rs` (new file) or appended to `src-tauri/src/packs.rs`.

| Command | Input | Output |
|---|---|---|
| `install_custom_pack` | absolute path to `.tibdict` file | `{ id, manifest }` of installed pack |
| `list_custom_packs` | — | `[{ id, manifest }]` |
| `remove_custom_pack` | `id` (e.g., `custom-inalco-fr-tib`) | `()` |

Rust installation flow:
1. Extract `.tibdict` into a temp dir.
2. Validate per §6 rules.
3. If conflict, return a structured error — frontend decides whether to retry with `force: true` after user confirmation.
4. On success, move temp dir atomically to `packs/custom/<prefixed-id>/`.
5. Return parsed manifest to frontend.

Querying a custom pack reuses the existing `query_pack` infrastructure; the only change is that the pack lookup by ID can resolve to either `packs/<id>.sqlite` or `packs/custom/<id>/data.sqlite`.

### 8.3 Frontend integration

- On app start, `PackManager.init()` calls both `list_packs` and `list_custom_packs`.
- `PACK_DEFINITIONS` stays static for the three official packs; custom packs are added dynamically to the in-memory pack list at runtime.
- `SqlDatabase` already supports loading N packs in parallel via `tauri-packs-native` mode — no changes to queries or search.
- `allTerms` refresh via the existing `all-terms-updated` event after install/remove.

### 8.4 Drag-and-drop flow (desktop only)

1. `App.vue` subscribes to `getCurrentWebview().onDragDropEvent()` (Tauri v2).
2. On `drop`:
   a. Filter for files with extension `.tibdict`.
   b. If 0 matches, ignore silently.
   c. If ≥1 matches, process them **sequentially** (see §8.6 for multi-file behaviour).
3. For each file, invoke `CustomPackImporter.install(filePath)`.
4. If a conflict arises, open the confirmation modal; user choice determines whether to call the Tauri command with `force: true`.

### 8.5 "Importer" button flow (all Tauri platforms)

In `ConfigurePage.vue`, "Dictionnaires personnalisés" section:
- `<v-btn prepend-icon="mdi-file-upload">Importer un dictionnaire…</v-btn>`
- Opens native file picker via Tauri `dialog.open()` (filter `*.tibdict`).
- Same validation, confirmation, and installation flow as drag-drop.
- iOS/Android: `dialog.open()` opens the platform document picker; same flow.

### 8.6 Multi-file drag-drop

- Filter dropped files to keep only those ending in `.tibdict`.
- Process them sequentially with `for (const file of tibdictFiles) await install(file)`.
- If the user cancels a conflict modal, skip that file and continue with the rest (do not abort the queue).
- At the end, if ≥ 2 files were in the queue, show a summary snackbar:
  `"3 dictionnaires installés"` or `"2 installés, 1 annulé"`.
- If no `.tibdict` files in the drop: silent.

### 8.7 Web build

The section "Dictionnaires personnalisés" and the "Importer" button are hidden entirely in web mode. No custom pack support.

## 9. UI changes

### 9.1 "Dictionnaires personnalisés" section in `ConfigurePage`

Placement: immediately after the three official packs.

Layout per installed custom pack:

**Single-dictionary pack:**
```
✓ INALCO Français-Tibétain                  v1.0.0
                                          [Supprimer]
```

**Multi-dictionary pack:**
```
✓ Mon Pack de Bouddhisme          v2.1.0 · 3 dicos
                                          [Supprimer]
```

Rules:
- No author, no entries count, no file size, no export button.
- Version shown to the right of the name only if `manifest.version` is present.
- `"N dicos"` shown only if the pack contains more than one dictionary.
- Empty state: `"Aucun dictionnaire personnalisé. Glissez un fichier .tibdict sur la fenêtre ou cliquez sur Importer…"`.

### 9.2 Conflict confirmation modal

```
┌────────────────────────────────────────┐
│  Remplacer le dictionnaire ?            │
│                                         │
│  "INALCO Français-Tibétain" existe      │
│  déjà (v1.0.0).                         │
│                                         │
│  Le nouveau fichier est v1.1.0.         │
│                                         │
│       [Annuler]   [Remplacer]           │
└────────────────────────────────────────┘
```

- Versions shown only if present in both old and new manifests.
- If neither has a version, subtitle falls back to `"Ce dictionnaire est déjà installé."`.

### 9.3 Dictionary ordering

No code change. The drag-and-drop ordering list renders all dictionaries (official + custom) identically, already driven by `allDictionaries`. **No visual distinction** between official and custom — per user request.

### 9.4 Search results

No code change. Dictionary name appears in each entry header from the `dictionaries` table — works identically for custom packs.

### 9.5 Snackbar messages

Short and user-friendly, no technical jargon:
- ✅ `"INALCO Français-Tibétain installé"`
- ✅ `"INALCO Français-Tibétain supprimé"`
- ❌ `"Fichier incompatible avec cette version de l'app. Essayez de vous procurer une version à jour du fichier."`
- ❌ `"Fichier invalide ou corrompu."`
- ❌ `"Ce fichier n'est pas un dictionnaire valide."`

## 10. Schema versioning and portability

- `formatVersion` (envelope) and `schemaVersion` (SQLite) are independent.
- `.tibdict` files are frozen at the current `SUPPORTED_SCHEMA_VERSION` at build time.
- If the app later bumps `SUPPORTED_SCHEMA_VERSION`, older `.tibdict` files become incompatible and trigger the incompatibility snackbar. User must obtain an up-to-date file.
- Automatic migration is out of scope; may be added later if needed.

## 11. Edge cases

| Case | Behaviour |
|---|---|
| Two `.tibdict` files with the same `id` | Replacement flow with confirmation modal |
| `.tibdict` with 0 entries | Refused at validation; snackbar `"Fichier invalide ou corrompu."` |
| Manifest claims 194 entries, SQLite has 100 | Trust the SQLite. `entriesCount` in manifest is informational only |
| Custom dictionary name collides with an official one (e.g., `Hopkins2015`) | Accepted — different `dictionaryId`s in different packs, no technical collision |
| Pack deletion while a query is in flight | Handled by existing `PackManager.unloadPack()` lifecycle |
| App starts and a `packs/custom/<id>/` is broken (missing SQLite, unreadable manifest) | Log warning, skip that pack, other packs load normally |
| Drag-drop of non-`.tibdict` files only | Silently ignored |
| Drag-drop mixing `.tibdict` and other files | Process `.tibdict` files, ignore others |
| Multiple `.tibdict` files dropped at once | Sequential processing, recap snackbar at end (see §8.6) |
| User cancels a conflict modal mid-queue | Skip that file, continue with remaining files |

### Implicit technical decisions

- `packs/custom/` directory created on first install, not at app start.
- `manifest.json` copied verbatim on install (not reconstituted from the SQLite).
- Removal = delete the entire `packs/custom/<id>/` folder.
- No cryptographic signature on `.tibdict` files.

## 12. Tests

### 12.1 Unit tests (vitest)

`tests/custom-pack-importer.test.js`:
- Accepts a valid `.tibdict`.
- Rejects: corrupted ZIP, missing `manifest.json`, missing `data.sqlite`, `format !== "tibdict"`, incompatible `schemaVersion`, invalid `id`, invalid SQLite schema.
- Detects an ID conflict.

`tests/convert-anki-to-tibdict.test.js`:
- Parses a minimal synthetic `collection.anki21b`.
- Handles both `reversed: true` and `reversed: false`.
- Cleans `<br>`, `&nbsp;`, HTML entities.
- Deduplicates exact duplicates.
- Appends missing final tsheg.
- Skips empty notes.

### 12.2 Manual integration checklist

1. Run script on all 4 INALCO APKGs → verify `.tibdict` is created.
2. Launch Tauri desktop app → drag file onto window → verify installation.
3. Search for `ང་` and `je ; moi` → verify results.
4. Move custom pack to a middle position in the dictionary ordering list.
5. Delete it; verify the folder on disk is removed.
6. Re-import; verify it works.
7. Re-import the same file; verify the conflict modal appears.
8. Drop three `.tibdict` files at once; verify sequential install and recap snackbar.

No automated E2E — Tauri drag-drop is painful to automate and the manual checklist is sufficient for this scope.

## 13. Open questions

None. All design decisions are resolved.

## 14. Decisions summary

| # | Decision |
|---|---|
| 1 | Single merged dictionary `INALCO Français-Tibétain` for all 4 APKGs |
| 2 | `term` = Tibetan Unicode, `definition` = French; all content preserved; minimal cosmetic cleanup (`<br>`, `&nbsp;`, HTML entities, trim) |
| 3 | Drag-and-drop (desktop) + "Importer…" button (all Tauri platforms); no file-association |
| 4 | Format `.tibdict` = ZIP of `manifest.json` + `data.sqlite` |
| 5 | On-disk: `packs/custom/<prefixed-id>/`; `custom-` prefix is internal only |
| 6 | Frozen schema (v3), replace-on-conflict with confirmation modal |
| 7 | Web: no custom pack support; UI hidden entirely |
| 8 | UI per pack shows name + version (and dico count if >1); no author, size, entries, or export |
| 9 | User-facing error messages are short, no technical jargon |
| 10 | Multi-file drag-drop supported (sequential, recap snackbar) |
