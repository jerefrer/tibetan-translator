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
