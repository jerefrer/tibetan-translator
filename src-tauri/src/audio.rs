use base64::{engine::general_purpose::STANDARD, Engine};
use futures_util::StreamExt;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager, Window};

/// How many recordings download at once; they are small (about 20 KB each)
/// and number in the thousands, so one at a time would take many minutes.
const PARALLEL_DOWNLOADS: usize = 8;

/// Dictionary ids and file names come from the frontend and end up in paths,
/// so only plain names are accepted: no separators, no `..`, nothing hidden.
fn is_plain_name(name: &str) -> bool {
    !name.is_empty()
        && !name.starts_with('.')
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
        && !name.contains("..")
}

fn is_recording_name(name: &str) -> bool {
    is_plain_name(name) && name.ends_with(".mp3")
}

/// Directory holding a dictionary's downloaded recordings, within app data
fn get_audio_dir(app: &AppHandle, audio_id: &str) -> Result<PathBuf, String> {
    if !is_plain_name(audio_id) {
        return Err(format!("Invalid audio id: {}", audio_id));
    }
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    Ok(app_data_dir.join("audio").join(audio_id))
}

fn count_recordings(dir: &PathBuf) -> usize {
    fs::read_dir(dir)
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .filter(|e| e.path().extension().map_or(false, |ext| ext == "mp3"))
                .count()
        })
        .unwrap_or(0)
}

/// Whether every recording of a dictionary is on the device. A download that
/// was interrupted leaves fewer files than expected and reads as not done.
#[tauri::command]
pub fn check_audio_downloaded(
    app: AppHandle,
    audio_id: String,
    expected_count: usize,
) -> Result<bool, String> {
    let audio_dir = get_audio_dir(&app, &audio_id)?;
    Ok(expected_count > 0 && count_recordings(&audio_dir) >= expected_count)
}

/// A downloaded recording as a data URL, or None when it is not on the device
#[tauri::command]
pub fn get_audio_data(
    app: AppHandle,
    audio_id: String,
    file_name: String,
) -> Result<Option<String>, String> {
    if !is_recording_name(&file_name) {
        return Err(format!("Invalid recording name: {}", file_name));
    }
    let path = get_audio_dir(&app, &audio_id)?.join(&file_name);
    if !path.exists() {
        return Ok(None);
    }
    let bytes = fs::read(&path).map_err(|e| format!("Failed to read recording: {}", e))?;
    Ok(Some(format!("data:audio/mpeg;base64,{}", STANDARD.encode(&bytes))))
}

/// Progress event payload for audio downloads
#[derive(Clone, serde::Serialize)]
struct AudioDownloadProgress {
    audio_id: String,
    current: u32,
    total: u32,
    percent: f32,
}

async fn download_recording(
    client: &reqwest::Client,
    url: String,
    path: PathBuf,
) -> Result<(), String> {
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to download {}: {}", url, e))?;

    if !response.status().is_success() {
        // Skip a missing recording rather than failing the whole download
        eprintln!("Warning: {} not found (status: {})", url, response.status());
        return Ok(());
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read {}: {}", url, e))?;

    // Written under a temporary name first, so an interrupted download never
    // leaves a truncated .mp3 that would count as downloaded
    let partial = path.with_extension("mp3.part");
    fs::write(&partial, bytes).map_err(|e| format!("Failed to save recording: {}", e))?;
    fs::rename(&partial, &path).map_err(|e| format!("Failed to save recording: {}", e))?;
    Ok(())
}

/// Download every recording of a dictionary, skipping those already there
#[tauri::command]
pub async fn download_audio(
    app: AppHandle,
    window: Window,
    audio_id: String,
    base_url: String,
    file_names: Vec<String>,
) -> Result<(), String> {
    if let Some(bad) = file_names.iter().find(|name| !is_recording_name(name)) {
        return Err(format!("Invalid recording name: {}", bad));
    }

    let audio_dir = get_audio_dir(&app, &audio_id)?;
    fs::create_dir_all(&audio_dir).map_err(|e| format!("Failed to create audio dir: {}", e))?;

    let client = reqwest::Client::new();
    let total = file_names.len() as u32;
    if total == 0 {
        return Err(format!("No recordings listed for {}", audio_id));
    }
    let mut downloaded = 0u32;

    let emit_progress = |downloaded: u32| {
        let percent = (downloaded as f32 / total as f32) * 100.0;
        let _ = window.emit(
            "audio-download-progress",
            AudioDownloadProgress {
                audio_id: audio_id.clone(),
                current: downloaded,
                total,
                percent,
            },
        );
    };

    emit_progress(0);

    let jobs: Vec<(String, PathBuf)> = file_names
        .into_iter()
        .map(|name| {
            let url = format!("{}/{}/{}", base_url, audio_id, name);
            (url, audio_dir.join(name))
        })
        .collect();

    let mut downloads = futures_util::stream::iter(jobs.into_iter().map(|(url, path)| {
        // reqwest::Client is a handle around an Arc, so this does not copy the pool
        let client = client.clone();
        async move {
            if path.exists() {
                return Ok(());
            }
            download_recording(&client, url, path).await
        }
    }))
    .buffer_unordered(PARALLEL_DOWNLOADS);

    while let Some(result) = downloads.next().await {
        result?;
        downloaded += 1;
        emit_progress(downloaded);
    }

    Ok(())
}

/// Delete a dictionary's downloaded recordings
#[tauri::command]
pub fn delete_audio(app: AppHandle, audio_id: String) -> Result<(), String> {
    let audio_dir = get_audio_dir(&app, &audio_id)?;
    if audio_dir.exists() {
        fs::remove_dir_all(&audio_dir).map_err(|e| format!("Failed to delete audio: {}", e))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn should_accept_plain_dictionary_ids_and_recording_names() {
        assert!(is_plain_name("hotl1"));
        assert!(is_recording_name("1-100a.mp3"));
        assert!(is_recording_name("12_3b.mp3"));
    }

    #[test]
    fn should_reject_names_that_could_escape_the_audio_directory() {
        for name in ["", "../x.mp3", "a/b.mp3", "a\\b.mp3", "..", ".hidden.mp3", "/abs.mp3"] {
            assert!(!is_recording_name(name), "{name} should be rejected");
        }
        assert!(!is_plain_name("../hotl1"));
    }

    #[test]
    fn should_reject_recordings_that_are_not_mp3() {
        assert!(!is_recording_name("1-100a.wav"));
        assert!(!is_recording_name("1-100a.mp3.part"));
    }
}
