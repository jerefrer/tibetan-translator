use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Cursor, Read};
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
    /// Populated on "conflict" so the frontend can show the real pack name
    /// in its confirmation modal without re-reading the .tibdict itself.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub incoming_manifest: Option<TibdictManifest>,
    /// Populated on "conflict" so the frontend can show the already-installed version.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub existing_manifest: Option<TibdictManifest>,
}

impl InstallError {
    fn new(code: &str, message: &str) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            incoming_manifest: None,
            existing_manifest: None,
        }
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
    let bytes = id.as_bytes();
    let valid_char = |b: u8| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-';
    if !bytes.iter().all(|b| valid_char(*b)) { return false; }
    // first and last must be alphanumeric
    let first = bytes[0];
    let last = bytes[bytes.len() - 1];
    (first.is_ascii_lowercase() || first.is_ascii_digit())
        && (last.is_ascii_lowercase() || last.is_ascii_digit())
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
    let src = PathBuf::from(&file_path);
    if !src.exists() {
        return Err(InstallError::new("path", &format!("File not found: {file_path}")));
    }
    let bytes = fs::read(&src)
        .map_err(|e| InstallError::new("corrupt", &format!("read file: {e}")))?;
    install_from_bytes(app, bytes, force).await
}

/// Same as install_custom_pack but takes raw ZIP bytes. Used by the frontend
/// HTML5 drag-drop path where we only have the file's content (not an OS path).
#[tauri::command]
pub async fn install_custom_pack_from_bytes(
    app: AppHandle,
    data: Vec<u8>,
    force: Option<bool>,
) -> Result<InstalledCustomPack, InstallError> {
    install_from_bytes(app, data, force).await
}

async fn install_from_bytes(
    app: AppHandle,
    bytes: Vec<u8>,
    force: Option<bool>,
) -> Result<InstalledCustomPack, InstallError> {
    let force = force.unwrap_or(false);

    // 1. Open ZIP from the in-memory bytes
    let cursor = Cursor::new(&bytes);
    let mut archive = ZipArchive::new(cursor)
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
            // Read the existing manifest so the frontend can show the installed version.
            let existing = fs::read_to_string(final_dir.join("manifest.json"))
                .ok()
                .and_then(|s| serde_json::from_str::<TibdictManifest>(&s).ok());
            let _ = fs::remove_dir_all(&temp_dir);
            let mut err = InstallError::new("conflict", "pack already installed");
            err.incoming_manifest = Some(manifest.clone());
            err.existing_manifest = existing;
            return Err(err);
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
