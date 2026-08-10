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

/// Build a SQL `LIKE ... ESCAPE '\'` pattern that matches `needle` as a literal
/// substring. The backslash (the escape character itself) must be escaped
/// first, before the wildcards `%` and `_` — escaping it after would
/// double-escape the backslashes just inserted to escape those wildcards.
/// Otherwise a literal backslash in `needle` is either silently consumed by
/// LIKE (matching more than intended) or, if trailing, consumes the `%` this
/// function appends (matching nothing at all).
fn like_pattern(needle: &str) -> String {
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

    /// Regression coverage for path-traversal shapes. The ASCII allowlist in
    /// `is_lexicon_pack_id` (lowercase, digits, hyphen only) blocks all of these
    /// by construction today — these tests exist so that if the guard is ever
    /// refactored toward a blocklist or a strip-based approach, a reintroduced
    /// `/`- or `\`-based bypass fails a test instead of shipping silently.
    #[test]
    fn rejects_path_traversal_shaped_ids() {
        assert!(!is_lexicon_pack_id("custom-a/b"));
        assert!(!is_lexicon_pack_id("custom-a\\b"));
        assert!(!is_lexicon_pack_id("custom-/etc/passwd"));
        assert!(!is_lexicon_pack_id("custom-%2e%2e%2fescape"));
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

    #[test]
    fn like_pattern_escapes_the_escape_character_before_wildcards() {
        // Backslash must be doubled first, or LIKE silently consumes it and
        // treats the next character as literal instead of matching a real
        // backslash — `a\b` would then match `ab`.
        assert_eq!(like_pattern("a\\b"), "%a\\\\b%");
        // Wildcards are still escaped, as before.
        assert_eq!(like_pattern("100%"), "%100\\%%");
        assert_eq!(like_pattern("a_b"), "%a\\_b%");
        // A needle ending in a backslash must not be able to consume the `%`
        // this function appends — that would turn a substring search into an
        // impossible exact-suffix match that returns nothing.
        assert_eq!(like_pattern("abc\\"), "%abc\\\\%");
    }

    #[test]
    fn like_search_matches_a_literal_backslash_without_over_or_under_matching() {
        let (conn, path) = temp_db("like-backslash");
        // Contains a literal backslash — this is the row a search for `a\b` must find.
        upsert_entry_in(&conn, 1, &input("term-a", "path is a\\b on disk")).unwrap();
        // Would incorrectly match under the old escaping if the backslash were
        // silently consumed instead of escaped.
        upsert_entry_in(&conn, 1, &input("term-b", "path is ab on disk")).unwrap();
        // Contains a percent sign, to confirm wildcard-escaping still holds
        // alongside the backslash fix.
        upsert_entry_in(&conn, 1, &input("term-c", "100% done")).unwrap();

        let pattern = like_pattern("a\\b");
        let mut stmt = conn
            .prepare("SELECT term FROM entries WHERE definition LIKE ? ESCAPE '\\' ORDER BY term")
            .unwrap();
        let matches: Vec<String> =
            stmt.query_map(params![&pattern], |row| row.get(0)).unwrap().flatten().collect();

        assert_eq!(
            matches,
            vec!["term-a".to_string()],
            "only the entry containing a literal backslash should match"
        );
        let _ = fs::remove_file(path);
    }

    #[test]
    fn like_search_handles_a_needle_ending_in_a_backslash() {
        let (conn, path) = temp_db("like-trailing-backslash");
        upsert_entry_in(&conn, 1, &input("term-a", "prefix abc\\ suffix")).unwrap();

        let pattern = like_pattern("abc\\");
        let matches: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM entries WHERE definition LIKE ? ESCAPE '\\'",
                params![&pattern],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(
            matches, 1,
            "a needle ending in a backslash must still work as a substring search"
        );
        let _ = fs::remove_file(path);
    }
}
