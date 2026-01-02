use base64::{engine::general_purpose::STANDARD, Engine};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

/// Get the scans directory path within app data
fn get_scans_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let scans_dir = app_data_dir.join("scans");
    Ok(scans_dir)
}

/// Get the path for a specific scan's directory
fn get_scan_dir(app: &AppHandle, scan_id: &str) -> Result<PathBuf, String> {
    let scans_dir = get_scans_dir(app)?;
    Ok(scans_dir.join(scan_id))
}

/// Check if a dictionary's scans are downloaded locally
#[tauri::command]
pub fn check_scan_downloaded(app: AppHandle, scan_id: String) -> Result<bool, String> {
    let scan_dir = get_scan_dir(&app, &scan_id)?;

    if !scan_dir.exists() {
        return Ok(false);
    }

    // Check if directory has any PNG files
    let has_files = fs::read_dir(&scan_dir)
        .map_err(|e| format!("Failed to read scan dir: {}", e))?
        .filter_map(|e| e.ok())
        .any(|e| e.path().extension().map_or(false, |ext| ext == "png"));

    Ok(has_files)
}

/// Get the local scan image as base64-encoded data URL (returns None if not downloaded)
#[tauri::command]
pub fn get_scan_image_data(
    app: AppHandle,
    scan_id: String,
    page_num: u32,
) -> Result<Option<String>, String> {
    let scan_dir = get_scan_dir(&app, &scan_id)?;
    let image_path = scan_dir.join(format!("{}.png", page_num));

    if image_path.exists() {
        let bytes = fs::read(&image_path)
            .map_err(|e| format!("Failed to read image: {}", e))?;
        let base64_data = STANDARD.encode(&bytes);
        Ok(Some(format!("data:image/png;base64,{}", base64_data)))
    } else {
        Ok(None)
    }
}

/// Progress event payload for scan downloads
#[derive(Clone, serde::Serialize)]
struct ScanDownloadProgress {
    scan_id: String,
    current: u32,
    total: u32,
    percent: f32,
}

/// Download all scan images for a dictionary
#[tauri::command]
pub async fn download_scan_images(
    app: AppHandle,
    scan_id: String,
    base_url: String,
    min_page: u32,
    max_page: u32,
) -> Result<(), String> {
    let scan_dir = get_scan_dir(&app, &scan_id)?;

    // Create directory if it doesn't exist
    fs::create_dir_all(&scan_dir).map_err(|e| format!("Failed to create scan dir: {}", e))?;

    let client = reqwest::Client::new();
    let total_pages = max_page - min_page + 1;
    let mut downloaded = 0u32;

    for page_num in min_page..=max_page {
        let image_path = scan_dir.join(format!("{}.png", page_num));

        // Skip if already downloaded but still count as progress
        if image_path.exists() {
            downloaded += 1;
            let _ = app.emit(
                "scan-download-progress",
                ScanDownloadProgress {
                    scan_id: scan_id.clone(),
                    current: downloaded,
                    total: total_pages,
                    percent: (downloaded as f32 / total_pages as f32) * 100.0,
                },
            );
            continue;
        }

        let url = format!("{}/{}/{}.png", base_url, scan_id, page_num);

        // Download the image
        let response = client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Failed to download page {}: {}", page_num, e))?;

        if !response.status().is_success() {
            // Skip missing pages rather than failing completely
            eprintln!(
                "Warning: Page {} not found (status: {})",
                page_num,
                response.status()
            );
            downloaded += 1;
            continue;
        }

        let bytes = response
            .bytes()
            .await
            .map_err(|e| format!("Failed to read page {} bytes: {}", page_num, e))?;

        fs::write(&image_path, bytes)
            .map_err(|e| format!("Failed to save page {}: {}", page_num, e))?;

        downloaded += 1;

        // Emit progress event
        let _ = app.emit(
            "scan-download-progress",
            ScanDownloadProgress {
                scan_id: scan_id.clone(),
                current: downloaded,
                total: total_pages,
                percent: (downloaded as f32 / total_pages as f32) * 100.0,
            },
        );
    }

    Ok(())
}

/// Delete downloaded scan images for a dictionary
#[tauri::command]
pub fn delete_scan(app: AppHandle, scan_id: String) -> Result<(), String> {
    let scan_dir = get_scan_dir(&app, &scan_id)?;

    if scan_dir.exists() {
        fs::remove_dir_all(&scan_dir).map_err(|e| format!("Failed to delete scan: {}", e))?;
    }

    Ok(())
}
