use base64::{engine::general_purpose::STANDARD, Engine};
use crate::downloads::{self, CANCELLED};
use futures_util::{stream, StreamExt};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager, Window};

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

/// Written once every page has been handled, so an interrupted download is
/// never mistaken for a finished one
const COMPLETE_MARKER: &str = ".complete";

/// Number of pages downloaded at once
const CONCURRENT_PAGES: usize = 8;

/// Whether a scan directory holds the whole dictionary: either the marker is
/// there, or (installs made before the marker existed) at least as many PNGs
/// as expected. `.png.part` files are unfinished writes and do not count.
fn scan_is_complete(dir: &Path, expected: u32) -> bool {
    if dir.join(COMPLETE_MARKER).exists() {
        return true;
    }
    if expected == 0 {
        return false;
    }
    let count = fs::read_dir(dir)
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .filter(|e| e.path().extension().map_or(false, |ext| ext == "png"))
                .count()
        })
        .unwrap_or(0);
    count >= expected as usize
}

/// Check if a dictionary's scans are fully downloaded locally
#[tauri::command]
pub fn check_scan_downloaded(
    app: AppHandle,
    scan_id: String,
    expected_count: u32,
) -> Result<bool, String> {
    let scan_dir = get_scan_dir(&app, &scan_id)?;
    Ok(scan_dir.exists() && scan_is_complete(&scan_dir, expected_count))
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
    window: Window,
    scan_id: String,
    base_url: String,
    min_page: u32,
    max_page: u32,
) -> Result<(), String> {
    let scan_dir = get_scan_dir(&app, &scan_id)?;

    // Create directory if it doesn't exist
    fs::create_dir_all(&scan_dir).map_err(|e| format!("Failed to create scan dir: {}", e))?;

    if max_page < min_page {
        return Err(format!("Invalid page range: {}-{}", min_page, max_page));
    }

    let cancel_key = format!("scan:{}", scan_id);
    let _download = downloads::guard(&cancel_key);

    // One client for every page, so connections are kept alive and reused
    let client = reqwest::Client::new();
    let total_pages = max_page - min_page + 1;
    let mut done = 0u32;

    let emit_progress = |done: u32| {
        let _ = window.emit(
            "scan-download-progress",
            ScanDownloadProgress {
                scan_id: scan_id.clone(),
                current: done,
                total: total_pages,
                percent: (done as f32 / total_pages as f32) * 100.0,
            },
        );
    };

    // Emit an initial 0% so the listener sees activity before the first
    // page lands — useful for very small downloads that finish before the
    // UI has a chance to render the first progress tick.
    emit_progress(0);

    let mut pages = stream::iter(min_page..=max_page)
        .map(|page_num| {
            let client = &client;
            let scan_dir = &scan_dir;
            let scan_id = &scan_id;
            let base_url = &base_url;
            let cancel_key = &cancel_key;
            async move {
                if downloads::is_cancelled(cancel_key) {
                    return Err(CANCELLED.to_string());
                }
                download_page(client, scan_dir, base_url, scan_id, page_num).await
            }
        })
        .buffer_unordered(CONCURRENT_PAGES);

    let mut failure: Option<String> = None;
    while let Some(result) = pages.next().await {
        match result {
            // Completions are counted, not page numbers, so progress is monotonic
            Ok(()) => {
                done += 1;
                emit_progress(done);
            }
            Err(e) => {
                failure = Some(e);
                break;
            }
        }
        if downloads::is_cancelled(&cancel_key) {
            failure = Some(CANCELLED.to_string());
            break;
        }
    }
    // Drops the pages still in flight
    drop(pages);

    if let Some(error) = failure {
        if error == CANCELLED {
            // A cancelled download leaves nothing behind
            let _ = fs::remove_dir_all(&scan_dir);
            return Err(CANCELLED.to_string());
        }
        // Pages already written stay, so a retry resumes where this stopped
        return Err(error);
    }

    fs::write(scan_dir.join(COMPLETE_MARKER), b"")
        .map_err(|e| format!("Failed to mark scan as complete: {}", e))?;

    Ok(())
}

/// Fetch one page unless it is already on disk. A missing page (non-success
/// status) is skipped with a warning rather than failing the whole download.
async fn download_page(
    client: &reqwest::Client,
    scan_dir: &Path,
    base_url: &str,
    scan_id: &str,
    page_num: u32,
) -> Result<(), String> {
    let image_path = scan_dir.join(format!("{}.png", page_num));
    if image_path.exists() {
        return Ok(());
    }

    let url = format!("{}/{}/{}.png", base_url, scan_id, page_num);
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to download page {}: {}", page_num, e))?;

    if !response.status().is_success() {
        eprintln!(
            "Warning: Page {} not found (status: {})",
            page_num,
            response.status()
        );
        return Ok(());
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read page {} bytes: {}", page_num, e))?;

    // Write then rename, so an interrupted write never leaves a truncated PNG
    // that would later read as present
    let part_path = scan_dir.join(format!("{}.png.part", page_num));
    fs::write(&part_path, bytes).map_err(|e| format!("Failed to save page {}: {}", page_num, e))?;
    fs::rename(&part_path, &image_path)
        .map_err(|e| format!("Failed to save page {}: {}", page_num, e))?;
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

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("scans-test-{}-{}", name, std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn touch(dir: &Path, name: &str) {
        fs::write(dir.join(name), b"x").unwrap();
    }

    #[test]
    fn should_be_complete_when_the_marker_exists() {
        let dir = temp_dir("marker");
        touch(&dir, COMPLETE_MARKER);
        assert!(scan_is_complete(&dir, 700));
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn should_be_complete_when_enough_pngs_exist_without_marker() {
        let dir = temp_dir("enough");
        for n in 1..=3 {
            touch(&dir, &format!("{}.png", n));
        }
        assert!(scan_is_complete(&dir, 3));
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn should_not_be_complete_when_only_a_few_pngs_exist_without_marker() {
        let dir = temp_dir("few");
        touch(&dir, "1.png");
        touch(&dir, "2.png");
        assert!(!scan_is_complete(&dir, 3));
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn should_not_count_part_files() {
        let dir = temp_dir("part");
        touch(&dir, "1.png");
        touch(&dir, "2.png.part");
        touch(&dir, "3.png.part");
        assert!(!scan_is_complete(&dir, 3));
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn should_not_be_complete_when_the_directory_is_empty() {
        let dir = temp_dir("empty");
        assert!(!scan_is_complete(&dir, 0));
        assert!(!scan_is_complete(&dir, 5));
        fs::remove_dir_all(&dir).unwrap();
    }
}
