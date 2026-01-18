use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;
#[cfg(desktop)]
use std::process::Command;
use tauri::{AppHandle, Emitter, Manager, Window};
#[cfg(mobile)]
use tauri_plugin_fs::FsExt;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PackManifest {
    pub schema_version: u32,
    pub generated: String,
    pub packs: HashMap<String, PackInfo>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PackInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub required: bool,
    pub dictionary_count: u32,
    pub files: PackFiles,
    pub checksum: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PackFiles {
    pub sqlite: FileInfo,
    pub compressed: FileInfo,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileInfo {
    pub filename: String,
    pub size: u64,
    #[serde(rename = "sizeMB")]
    pub size_mb: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub pack_id: String,
    pub downloaded: u64,
    pub total: u64,
    pub percentage: f32,
    pub status: String,
}

/// Get the packs directory in app data
fn get_packs_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let packs_dir = app_data.join("packs");
    fs::create_dir_all(&packs_dir).map_err(|e| format!("Failed to create packs dir: {}", e))?;
    Ok(packs_dir)
}

/// Get the GitHub releases base URL for dictionary packs
fn get_releases_base_url() -> String {
    "https://github.com/jerefrer/tibetan-translator/releases/download/dictionary-packs".to_string()
}

/// Fetch the pack manifest from GitHub releases
#[tauri::command]
pub async fn fetch_pack_manifest() -> Result<PackManifest, String> {
    let url = format!("{}/pack-manifest.json", get_releases_base_url());

    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to fetch manifest: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Failed to fetch manifest: HTTP {}",
            response.status()
        ));
    }

    let manifest: PackManifest = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse manifest: {}", e))?;

    Ok(manifest)
}

/// Get list of installed packs
#[tauri::command]
pub async fn get_installed_packs(app: AppHandle) -> Result<Vec<String>, String> {
    let packs_dir = get_packs_dir(&app)?;

    // Core pack is always installed (bundled with app)
    let mut installed = vec!["core".to_string()];

    // Check for additional downloaded packs
    if let Ok(entries) = fs::read_dir(&packs_dir) {
        for entry in entries.flatten() {
            if let Some(name) = entry.file_name().to_str() {
                if name.ends_with(".sqlite") {
                    let pack_id = name.replace(".sqlite", "");
                    if pack_id != "core" && !installed.contains(&pack_id) {
                        installed.push(pack_id);
                    }
                }
            }
        }
    }

    Ok(installed)
}

/// Download a pack with progress events
#[tauri::command]
pub async fn download_pack(
    app: AppHandle,
    window: Window,
    pack_id: String,
) -> Result<(), String> {
    let packs_dir = get_packs_dir(&app)?;
    let compressed_path = packs_dir.join(format!("{}.7z", pack_id));
    let sqlite_path = packs_dir.join(format!("{}.sqlite", pack_id));

    // Download URL
    let url = format!("{}/{}.7z", get_releases_base_url(), pack_id);

    // Emit starting status
    let _ = window.emit(
        "pack-download-progress",
        DownloadProgress {
            pack_id: pack_id.clone(),
            downloaded: 0,
            total: 0,
            percentage: 0.0,
            status: "starting".to_string(),
        },
    );

    // Start download
    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Download failed: HTTP {}", response.status()));
    }

    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;

    // Create file
    let mut file =
        File::create(&compressed_path).map_err(|e| format!("Failed to create file: {}", e))?;

    // Stream download with progress
    let mut stream = response.bytes_stream();
    use futures_util::StreamExt;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download error: {}", e))?;
        file.write_all(&chunk)
            .map_err(|e| format!("Write error: {}", e))?;

        downloaded += chunk.len() as u64;

        // Emit progress every ~100KB to avoid flooding
        if downloaded % 102400 < chunk.len() as u64 || downloaded == total_size {
            let _ = window.emit(
                "pack-download-progress",
                DownloadProgress {
                    pack_id: pack_id.clone(),
                    downloaded,
                    total: total_size,
                    percentage: if total_size > 0 {
                        (downloaded as f32 / total_size as f32) * 100.0
                    } else {
                        0.0
                    },
                    status: "downloading".to_string(),
                },
            );
        }
    }

    // Emit extracting status
    let _ = window.emit(
        "pack-download-progress",
        DownloadProgress {
            pack_id: pack_id.clone(),
            downloaded: total_size,
            total: total_size,
            percentage: 100.0,
            status: "extracting".to_string(),
        },
    );

    // Extract 7z file
    extract_7z(&compressed_path, &packs_dir)?;

    // Clean up compressed file
    fs::remove_file(&compressed_path).ok();

    // Verify extraction
    if !sqlite_path.exists() {
        return Err("Extraction failed: sqlite file not found".to_string());
    }

    // Emit complete status
    let _ = window.emit(
        "pack-download-progress",
        DownloadProgress {
            pack_id: pack_id.clone(),
            downloaded: total_size,
            total: total_size,
            percentage: 100.0,
            status: "complete".to_string(),
        },
    );

    Ok(())
}

/// Remove an installed pack
#[tauri::command]
pub async fn remove_pack(app: AppHandle, pack_id: String) -> Result<(), String> {
    let packs_dir = get_packs_dir(&app)?;
    let sqlite_path = packs_dir.join(format!("{}.sqlite", pack_id));

    if sqlite_path.exists() {
        fs::remove_file(&sqlite_path).map_err(|e| format!("Failed to remove pack: {}", e))?;
    }

    Ok(())
}

/// Get path to a pack's database file
#[tauri::command]
pub async fn get_pack_path(
    app: AppHandle,
    pack_id: String,
) -> Result<String, String> {
    let packs_dir = get_packs_dir(&app)?;
    let sqlite_path = packs_dir.join(format!("{}.sqlite", pack_id));

    if sqlite_path.exists() {
        Ok(sqlite_path.to_string_lossy().to_string())
    } else {
        Err(format!("Pack {} not installed", pack_id))
    }
}

/// Ensure a pack is available in app data and return its path
/// For core pack: copies from bundled resources if not in app data
/// For other packs: returns path if exists
#[tauri::command]
pub async fn ensure_pack_available(
    app: AppHandle,
    pack_id: String,
) -> Result<String, String> {
    let packs_dir = get_packs_dir(&app)?;
    let sqlite_path = packs_dir.join(format!("{}.sqlite", pack_id));

    // If already in app data, return path
    if sqlite_path.exists() {
        return Ok(sqlite_path.to_string_lossy().to_string());
    }

    // For core pack, copy from bundled resources
    if pack_id == "core" {
        let resource_path = app
            .path()
            .resolve("core.sqlite", tauri::path::BaseDirectory::Resource)
            .map_err(|e| format!("Failed to resolve resource path: {}", e))?;

        #[cfg(desktop)]
        {
            fs::copy(&resource_path, &sqlite_path)
                .map_err(|e| format!("Failed to copy core pack: {}", e))?;
        }

        #[cfg(mobile)]
        {
            // On mobile, use fs plugin to read bundled asset
            let contents = app
                .fs()
                .read(&resource_path)
                .map_err(|e| format!("Failed to read bundled core pack: {}", e))?;

            let mut file = File::create(&sqlite_path)
                .map_err(|e| format!("Failed to create core pack file: {}", e))?;
            file.write_all(&contents)
                .map_err(|e| format!("Failed to write core pack: {}", e))?;
        }

        return Ok(sqlite_path.to_string_lossy().to_string());
    }

    Err(format!("Pack {} not found", pack_id))
}

/// Read pack database file as bytes (for WASM)
/// Note: On mobile, this is typically not called since mobile uses native SQLite
#[tauri::command]
pub async fn read_pack_database(
    app: AppHandle,
    pack_id: String,
) -> Result<Vec<u8>, String> {
    let packs_dir = get_packs_dir(&app)?;
    let sqlite_path = packs_dir.join(format!("{}.sqlite", pack_id));

    // Check app data directory first (for updated packs, including updated core)
    if sqlite_path.exists() {
        return fs::read(&sqlite_path).map_err(|e| format!("Failed to read pack: {}", e));
    }

    // For core pack, fall back to bundled resource
    if pack_id == "core" {
        let resource_path = app
            .path()
            .resolve("core.sqlite", tauri::path::BaseDirectory::Resource)
            .map_err(|e| format!("Failed to resolve resource path: {}", e))?;

        // On desktop, use standard fs::read directly
        #[cfg(desktop)]
        {
            return fs::read(&resource_path)
                .map_err(|e| format!("Failed to read core pack: {}", e));
        }

        // On mobile (iOS/Android), copy bundled asset to app data first, then read
        // We copy to app data so subsequent reads use filesystem (not asset resolver)
        #[cfg(mobile)]
        {
            // Read from bundled assets using fs plugin
            let contents = app
                .fs()
                .read(&resource_path)
                .map_err(|e| format!("Failed to read bundled core pack: {}", e))?;

            // Write to app data directory for future reads
            let mut file = File::create(&sqlite_path)
                .map_err(|e| format!("Failed to create core pack file: {}", e))?;
            file.write_all(&contents)
                .map_err(|e| format!("Failed to write core pack: {}", e))?;

            // Ensure file is fully written before reading
            drop(file);

            // Read from the newly created file in app data
            // This uses standard fs::read which works for files we created
            return fs::read(&sqlite_path)
                .map_err(|e| format!("Failed to read copied core pack: {}", e));
        }
    }

    Err(format!("Pack {} not found", pack_id))
}

/// Check if platform supports modular packs (always true for Tauri)
#[tauri::command]
pub fn supports_modular_packs() -> bool {
    true
}

/// Get pack database file size (for chunked loading)
#[tauri::command]
pub async fn get_pack_database_size(
    app: AppHandle,
    pack_id: String,
) -> Result<u64, String> {
    let packs_dir = get_packs_dir(&app)?;
    let sqlite_path = packs_dir.join(format!("{}.sqlite", pack_id));

    // Check app data directory first
    if sqlite_path.exists() {
        let metadata = fs::metadata(&sqlite_path)
            .map_err(|e| format!("Failed to get file size: {}", e))?;
        return Ok(metadata.len());
    }

    // For core pack, ensure it's copied to app data first, then get size
    if pack_id == "core" {
        // Call ensure_pack_available to copy if needed
        ensure_pack_available(app.clone(), pack_id.clone()).await?;

        // Now file should exist in app data
        if sqlite_path.exists() {
            let metadata = fs::metadata(&sqlite_path)
                .map_err(|e| format!("Failed to get file size: {}", e))?;
            return Ok(metadata.len());
        }
    }

    Err(format!("Pack {} not found", pack_id))
}

/// Read a chunk of pack database file (for WASM on memory-constrained devices)
/// offset and length are in bytes
#[tauri::command]
pub async fn read_pack_database_chunk(
    app: AppHandle,
    pack_id: String,
    offset: u64,
    length: u64,
) -> Result<Vec<u8>, String> {
    use std::io::{Read, Seek, SeekFrom};

    let packs_dir = get_packs_dir(&app)?;
    let sqlite_path = packs_dir.join(format!("{}.sqlite", pack_id));

    // Ensure file exists (for core pack, this copies from bundle)
    if !sqlite_path.exists() && pack_id == "core" {
        ensure_pack_available(app.clone(), pack_id.clone()).await?;
    }

    if !sqlite_path.exists() {
        return Err(format!("Pack {} not found", pack_id));
    }

    let mut file = File::open(&sqlite_path)
        .map_err(|e| format!("Failed to open pack: {}", e))?;

    file.seek(SeekFrom::Start(offset))
        .map_err(|e| format!("Failed to seek: {}", e))?;

    let mut buffer = vec![0u8; length as usize];
    let bytes_read = file.read(&mut buffer)
        .map_err(|e| format!("Failed to read chunk: {}", e))?;

    buffer.truncate(bytes_read);
    Ok(buffer)
}

// ============================================
// Native SQLite Pack Queries (for mobile performance)
// ============================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PackEntry {
    pub id: i64,
    pub term: String,
    #[serde(rename = "termPhoneticsStrict")]
    pub term_phonetics_strict: String,
    #[serde(rename = "termPhoneticsLoose")]
    pub term_phonetics_loose: String,
    pub definition: String,
    #[serde(rename = "definitionPhoneticsWordsStrict")]
    pub definition_phonetics_words_strict: String,
    #[serde(rename = "definitionPhoneticsWordsLoose")]
    pub definition_phonetics_words_loose: String,
    #[serde(rename = "dictionaryId")]
    pub dictionary_id: String,  // Compound ID: "pack_id:dictionary_id" (e.g., "core:1")
    pub dictionary: Option<String>,
    #[serde(rename = "dictionaryPosition")]
    pub dictionary_position: Option<i64>,
    #[serde(rename = "_sourcePackId")]
    pub source_pack_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PackDictionary {
    pub id: String,  // Compound ID: "pack_id:dictionary_id" (e.g., "core:1")
    pub name: String,
    pub position: i64,
    #[serde(rename = "_sourcePackId")]
    pub source_pack_id: Option<String>,
}

/// Get paths to all installed pack databases
fn get_all_pack_db_paths(app: &AppHandle) -> Result<Vec<(String, PathBuf)>, String> {
    let packs_dir = get_packs_dir(app)?;
    let mut pack_paths = Vec::new();

    // Check for core pack in app data first
    let core_path = packs_dir.join("core.sqlite");
    if core_path.exists() {
        pack_paths.push(("core".to_string(), core_path));
    } else {
        // Try bundled resource for core
        if let Ok(resource_path) = app
            .path()
            .resolve("core.sqlite", tauri::path::BaseDirectory::Resource)
        {
            // On desktop, we can use the resource path directly
            #[cfg(desktop)]
            if resource_path.exists() {
                pack_paths.push(("core".to_string(), resource_path));
            }
            // On mobile, we need to copy to app data first (done by ensure_pack_available)
        }
    }

    // Check for additional downloaded packs
    if let Ok(entries) = fs::read_dir(&packs_dir) {
        for entry in entries.flatten() {
            if let Some(name) = entry.file_name().to_str() {
                if name.ends_with(".sqlite") {
                    let pack_id = name.replace(".sqlite", "");
                    // Skip core if already added
                    if pack_id != "core" {
                        pack_paths.push((pack_id, entry.path()));
                    }
                }
            }
        }
    }

    Ok(pack_paths)
}

/// Get all unique terms from all installed packs (for Define page autocomplete)
#[tauri::command]
pub async fn pack_get_all_terms(app: AppHandle) -> Result<Vec<String>, String> {
    println!("[pack_get_all_terms] Starting...");

    // First ensure core pack is available in app data
    let core_path = ensure_pack_available(app.clone(), "core".to_string()).await?;
    println!("[pack_get_all_terms] Core pack ensured at: {}", core_path);

    let pack_paths = get_all_pack_db_paths(&app)?;
    println!("[pack_get_all_terms] Found {} pack paths", pack_paths.len());
    for (pack_id, path) in &pack_paths {
        println!("[pack_get_all_terms]   - {}: {:?}", pack_id, path);
    }

    let mut all_terms = std::collections::HashSet::new();

    for (pack_id, db_path) in pack_paths {
        println!("[pack_get_all_terms] Opening pack: {} at {:?}", pack_id, db_path);
        match Connection::open(&db_path) {
            Ok(conn) => {
                let mut stmt = conn
                    .prepare("SELECT DISTINCT term FROM entries")
                    .map_err(|e| format!("Failed to prepare statement for pack {}: {}", pack_id, e))?;

                let terms: Vec<String> = stmt
                    .query_map([], |row| row.get(0))
                    .map_err(|e| format!("Failed to query terms from pack {}: {}", pack_id, e))?
                    .filter_map(|r| r.ok())
                    .collect();

                println!("[pack_get_all_terms] Pack {} returned {} terms", pack_id, terms.len());
                all_terms.extend(terms);
            }
            Err(e) => {
                eprintln!("[pack_get_all_terms] Warning: Failed to open pack {} at {:?}: {}", pack_id, db_path, e);
                // Continue with other packs
            }
        }
    }

    let mut terms_vec: Vec<String> = all_terms.into_iter().collect();
    terms_vec.sort();
    println!("[pack_get_all_terms] Total unique terms: {}", terms_vec.len());
    Ok(terms_vec)
}

/// Get entries for a specific term from all installed packs
#[tauri::command]
pub async fn pack_get_entries_for_term(app: AppHandle, term: String) -> Result<Vec<PackEntry>, String> {
    // First ensure core pack is available in app data
    ensure_pack_available(app.clone(), "core".to_string()).await?;

    let pack_paths = get_all_pack_db_paths(&app)?;
    let mut all_entries = Vec::new();

    for (pack_id, db_path) in pack_paths {
        match Connection::open(&db_path) {
            Ok(conn) => {
                let mut stmt = conn
                    .prepare(
                        "SELECT entries.id, entries.term, entries.termPhoneticsStrict, entries.termPhoneticsLoose,
                                entries.definition, entries.definitionPhoneticsWordsStrict,
                                entries.definitionPhoneticsWordsLoose, entries.dictionaryId,
                                dictionaries.name AS dictionary, dictionaries.position AS dictionaryPosition
                         FROM entries
                         INNER JOIN dictionaries ON dictionaries.id = entries.dictionaryId
                         WHERE entries.term = ?
                         ORDER BY dictionaries.position",
                    )
                    .map_err(|e| format!("Failed to prepare statement for pack {}: {}", pack_id, e))?;

                let entries: Vec<PackEntry> = stmt
                    .query_map(params![term], |row| {
                        let raw_dict_id: i64 = row.get(7)?;
                        Ok(PackEntry {
                            id: row.get(0)?,
                            term: row.get(1)?,
                            term_phonetics_strict: row.get(2)?,
                            term_phonetics_loose: row.get(3)?,
                            definition: row.get(4)?,
                            definition_phonetics_words_strict: row.get(5)?,
                            definition_phonetics_words_loose: row.get(6)?,
                            dictionary_id: format!("{}:{}", pack_id, raw_dict_id),  // Compound ID
                            dictionary: row.get(8)?,
                            dictionary_position: row.get(9)?,
                            source_pack_id: Some(pack_id.clone()),
                        })
                    })
                    .map_err(|e| format!("Failed to query entries from pack {}: {}", pack_id, e))?
                    .filter_map(|r| r.ok())
                    .collect();

                all_entries.extend(entries);
            }
            Err(e) => {
                eprintln!("Warning: Failed to open pack {} at {:?}: {}", pack_id, db_path, e);
            }
        }
    }

    // Sort by dictionary position across all packs
    all_entries.sort_by(|a, b| {
        a.dictionary_position
            .unwrap_or(i64::MAX)
            .cmp(&b.dictionary_position.unwrap_or(i64::MAX))
    });

    Ok(all_entries)
}

/// Search entries across all installed packs using FTS
#[tauri::command]
pub async fn pack_search_entries(
    app: AppHandle,
    query: String,
    search_type: String,
) -> Result<Vec<PackEntry>, String> {
    // First ensure core pack is available in app data
    ensure_pack_available(app.clone(), "core".to_string()).await?;

    let pack_paths = get_all_pack_db_paths(&app)?;
    let mut all_entries = Vec::new();

    // Escape special FTS5 characters
    let escaped_query = query.replace('"', "\"\"");

    // Build the FTS5 MATCH clause based on search type
    let fts_query = match search_type.as_str() {
        "phonetics_strict" => format!(
            "(termPhoneticsStrict : \"{0}\" OR definitionPhoneticsWordsStrict : \"{0}\")",
            escaped_query
        ),
        "phonetics_loose" => format!(
            "(termPhoneticsLoose : \"{0}\" OR definitionPhoneticsWordsLoose : \"{0}\")",
            escaped_query
        ),
        _ => format!(
            "(term : \"{0}\" OR definition : \"{0}\")",
            escaped_query
        ),
    };

    let sql = format!(
        "SELECT entries.id, entries.term, entries.termPhoneticsStrict, entries.termPhoneticsLoose,
                entries.definition, entries.definitionPhoneticsWordsStrict,
                entries.definitionPhoneticsWordsLoose, entries.dictionaryId,
                dictionaries.name AS dictionary, dictionaries.position AS dictionaryPosition
         FROM entries
         INNER JOIN dictionaries ON dictionaries.id = entries.dictionaryId
         INNER JOIN entries_fts ON entries.id = entries_fts.rowid
         WHERE entries_fts MATCH '{}'
         LIMIT 2000",
        fts_query
    );

    for (pack_id, db_path) in pack_paths {
        match Connection::open(&db_path) {
            Ok(conn) => {
                let mut stmt = match conn.prepare(&sql) {
                    Ok(s) => s,
                    Err(e) => {
                        eprintln!("Warning: Failed to prepare FTS query for pack {}: {}", pack_id, e);
                        continue;
                    }
                };

                let entries: Vec<PackEntry> = match stmt.query_map([], |row| {
                    let raw_dict_id: i64 = row.get(7)?;
                    Ok(PackEntry {
                        id: row.get(0)?,
                        term: row.get(1)?,
                        term_phonetics_strict: row.get(2)?,
                        term_phonetics_loose: row.get(3)?,
                        definition: row.get(4)?,
                        definition_phonetics_words_strict: row.get(5)?,
                        definition_phonetics_words_loose: row.get(6)?,
                        dictionary_id: format!("{}:{}", pack_id, raw_dict_id),  // Compound ID
                        dictionary: row.get(8)?,
                        dictionary_position: row.get(9)?,
                        source_pack_id: Some(pack_id.clone()),
                    })
                }) {
                    Ok(rows) => rows.filter_map(|r| r.ok()).collect(),
                    Err(_) => Vec::new(),
                };

                all_entries.extend(entries);

                // Stop if we have enough results
                if all_entries.len() >= 5000 {
                    break;
                }
            }
            Err(e) => {
                eprintln!("Warning: Failed to open pack {} at {:?}: {}", pack_id, db_path, e);
            }
        }
    }

    // Truncate to limit
    all_entries.truncate(5000);

    Ok(all_entries)
}

/// Execute arbitrary SQL query across all installed packs
/// Results are merged from all packs with source pack ID added
#[tauri::command]
pub async fn pack_execute_query(
    app: AppHandle,
    sql: String,
    params_json: String,
) -> Result<Vec<serde_json::Value>, String> {
    // First ensure core pack is available in app data
    ensure_pack_available(app.clone(), "core".to_string()).await?;

    let pack_paths = get_all_pack_db_paths(&app)?;
    let mut all_results = Vec::new();

    // Parse params
    let params: Vec<String> = serde_json::from_str(&params_json).unwrap_or_default();

    for (pack_id, db_path) in pack_paths {
        match Connection::open(&db_path) {
            Ok(conn) => {
                let mut stmt = match conn.prepare(&sql) {
                    Ok(s) => s,
                    Err(e) => {
                        eprintln!("Warning: Failed to prepare query for pack {}: {}", pack_id, e);
                        continue;
                    }
                };

                let column_count = stmt.column_count();
                let column_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();

                let rusqlite_params: Vec<&dyn rusqlite::ToSql> = params
                    .iter()
                    .map(|s| s as &dyn rusqlite::ToSql)
                    .collect();

                let rows: Vec<serde_json::Value> = match stmt.query_map(rusqlite_params.as_slice(), |row| {
                    let mut obj = serde_json::Map::new();
                    for i in 0..column_count {
                        let value: rusqlite::Result<rusqlite::types::Value> = row.get(i);
                        if let Ok(v) = value {
                            let col_name = &column_names[i];
                            let json_value = match v {
                                rusqlite::types::Value::Null => serde_json::Value::Null,
                                rusqlite::types::Value::Integer(int_val) => {
                                    // Convert dictionaryId to compound ID
                                    if col_name == "dictionaryId" {
                                        serde_json::Value::String(format!("{}:{}", pack_id, int_val))
                                    } else {
                                        serde_json::json!(int_val)
                                    }
                                },
                                rusqlite::types::Value::Real(f) => serde_json::json!(f),
                                rusqlite::types::Value::Text(s) => serde_json::Value::String(s),
                                rusqlite::types::Value::Blob(b) => serde_json::json!(b),
                            };
                            obj.insert(col_name.clone(), json_value);
                        }
                    }
                    // Add source pack ID
                    obj.insert("_sourcePackId".to_string(), serde_json::Value::String(pack_id.clone()));
                    Ok(serde_json::Value::Object(obj))
                }) {
                    Ok(iter) => iter.filter_map(|r| r.ok()).collect(),
                    Err(e) => {
                        eprintln!("Warning: Query failed for pack {}: {}", pack_id, e);
                        continue;
                    }
                };

                all_results.extend(rows);
            }
            Err(e) => {
                eprintln!("Warning: Failed to open pack {} at {:?}: {}", pack_id, db_path, e);
            }
        }
    }

    Ok(all_results)
}

/// Get dictionaries from all installed packs
#[tauri::command]
pub async fn pack_get_dictionaries(app: AppHandle) -> Result<Vec<PackDictionary>, String> {
    // First ensure core pack is available in app data
    ensure_pack_available(app.clone(), "core".to_string()).await?;

    let pack_paths = get_all_pack_db_paths(&app)?;
    let mut all_dictionaries = Vec::new();

    for (pack_id, db_path) in pack_paths {
        match Connection::open(&db_path) {
            Ok(conn) => {
                let mut stmt = conn
                    .prepare("SELECT id, name, position FROM dictionaries ORDER BY position")
                    .map_err(|e| format!("Failed to prepare statement for pack {}: {}", pack_id, e))?;

                let dictionaries: Vec<PackDictionary> = stmt
                    .query_map([], |row| {
                        let raw_id: i64 = row.get(0)?;
                        Ok(PackDictionary {
                            id: format!("{}:{}", pack_id, raw_id),  // Compound ID
                            name: row.get(1)?,
                            position: row.get(2)?,
                            source_pack_id: Some(pack_id.clone()),
                        })
                    })
                    .map_err(|e| format!("Failed to query dictionaries from pack {}: {}", pack_id, e))?
                    .filter_map(|r| r.ok())
                    .collect();

                all_dictionaries.extend(dictionaries);
            }
            Err(e) => {
                eprintln!("Warning: Failed to open pack {} at {:?}: {}", pack_id, db_path, e);
            }
        }
    }

    // Sort by position across all packs
    all_dictionaries.sort_by(|a, b| a.position.cmp(&b.position));

    Ok(all_dictionaries)
}

/// Update a pack (download new version, replacing existing)
/// For core pack, downloads to app data dir (overrides bundled version)
#[tauri::command]
pub async fn update_pack(
    app: AppHandle,
    window: Window,
    pack_id: String,
) -> Result<(), String> {
    let packs_dir = get_packs_dir(&app)?;
    let compressed_path = packs_dir.join(format!("{}.7z", pack_id));
    let sqlite_path = packs_dir.join(format!("{}.sqlite", pack_id));

    // Download URL
    let url = format!("{}/{}.7z", get_releases_base_url(), pack_id);

    // Emit starting status
    let _ = window.emit(
        "pack-update-progress",
        DownloadProgress {
            pack_id: pack_id.clone(),
            downloaded: 0,
            total: 0,
            percentage: 0.0,
            status: "starting".to_string(),
        },
    );

    // Start download
    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Download failed: HTTP {}", response.status()));
    }

    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;

    // Create file
    let mut file =
        File::create(&compressed_path).map_err(|e| format!("Failed to create file: {}", e))?;

    // Stream download with progress
    let mut stream = response.bytes_stream();
    use futures_util::StreamExt;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download error: {}", e))?;
        file.write_all(&chunk)
            .map_err(|e| format!("Write error: {}", e))?;

        downloaded += chunk.len() as u64;

        // Emit progress every ~100KB to avoid flooding
        if downloaded % 102400 < chunk.len() as u64 || downloaded == total_size {
            let _ = window.emit(
                "pack-update-progress",
                DownloadProgress {
                    pack_id: pack_id.clone(),
                    downloaded,
                    total: total_size,
                    percentage: if total_size > 0 {
                        (downloaded as f32 / total_size as f32) * 100.0
                    } else {
                        0.0
                    },
                    status: "downloading".to_string(),
                },
            );
        }
    }

    // Emit extracting status
    let _ = window.emit(
        "pack-update-progress",
        DownloadProgress {
            pack_id: pack_id.clone(),
            downloaded: total_size,
            total: total_size,
            percentage: 100.0,
            status: "extracting".to_string(),
        },
    );

    // Remove old database if it exists
    if sqlite_path.exists() {
        fs::remove_file(&sqlite_path).ok();
    }

    // Extract 7z file
    extract_7z(&compressed_path, &packs_dir)?;

    // Clean up compressed file
    fs::remove_file(&compressed_path).ok();

    // Verify extraction
    if !sqlite_path.exists() {
        return Err("Extraction failed: sqlite file not found".to_string());
    }

    // Emit complete status
    let _ = window.emit(
        "pack-update-progress",
        DownloadProgress {
            pack_id: pack_id.clone(),
            downloaded: total_size,
            total: total_size,
            percentage: 100.0,
            status: "complete".to_string(),
        },
    );

    Ok(())
}

/// Extract 7z archive using pure Rust implementation
/// Works on all platforms including mobile (iOS/Android)
fn extract_7z(archive_path: &PathBuf, output_dir: &PathBuf) -> Result<(), String> {
    // On desktop, try system commands first for better compatibility
    #[cfg(desktop)]
    {
        let output_dir_str = output_dir.to_string_lossy();

        // Try various 7z command locations
        let commands = [
            "7z",
            "7zz",
            "/opt/homebrew/bin/7z",
            "/usr/local/bin/7z",
        ];

        for cmd in commands {
            let result = Command::new(cmd)
                .args([
                    "x",
                    "-y",
                    &format!("-o{}", output_dir_str),
                    &archive_path.to_string_lossy(),
                ])
                .output();

            if let Ok(output) = result {
                if output.status.success() {
                    return Ok(());
                }
            }
        }

        // Fall through to pure Rust implementation if no system command works
    }

    // Use pure Rust 7z extraction (works on all platforms including mobile)
    sevenz_rust2::decompress_file(archive_path, output_dir)
        .map_err(|e| format!("7z extraction failed: {}", e))
}
