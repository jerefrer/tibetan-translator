use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Emitter, Manager, Window};

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

/// Read pack database file as bytes (for WASM)
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
        return fs::read(&resource_path).map_err(|e| format!("Failed to read core pack: {}", e));
    }

    Err(format!("Pack {} not found", pack_id))
}

/// Check if platform supports modular packs (always true for Tauri)
#[tauri::command]
pub fn supports_modular_packs() -> bool {
    true
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

/// Extract 7z archive
fn extract_7z(archive_path: &PathBuf, output_dir: &PathBuf) -> Result<(), String> {
    // Try using system 7z command
    let output_dir_str = output_dir.to_string_lossy();

    // Try 7z first (Linux, Windows with 7-Zip installed)
    let result = Command::new("7z")
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

    // Try 7zz (macOS with Homebrew)
    let result = Command::new("7zz")
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

    // Try p7zip on macOS
    let result = Command::new("/opt/homebrew/bin/7z")
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

    // Try /usr/local/bin/7z (Intel Mac Homebrew)
    let result = Command::new("/usr/local/bin/7z")
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

    Err("7z extraction failed: 7z command not found. Please install p7zip.".to_string())
}
