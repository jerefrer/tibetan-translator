use base64::{engine::general_purpose::STANDARD, Engine};
use futures_util::StreamExt;
use std::fs::{self, File};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager, Window};
use zip::ZipArchive;

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

/// Progress event payload for audio downloads, in bytes of the archive
#[derive(Clone, serde::Serialize)]
struct AudioDownloadProgress {
    audio_id: String,
    downloaded: u64,
    total: u64,
    percent: f32,
}

/// Unpack a dictionary's archive into its audio directory. Only flat `.mp3`
/// names are written, so no entry can land outside that directory.
fn extract_recordings(archive_path: &Path, audio_dir: &Path) -> Result<usize, String> {
    let file = File::open(archive_path).map_err(|e| format!("Failed to open archive: {}", e))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("Invalid archive: {}", e))?;
    fs::create_dir_all(audio_dir).map_err(|e| format!("Failed to create audio dir: {}", e))?;

    let mut extracted = 0;
    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|e| format!("Failed to read archive entry: {}", e))?;
        let name = entry.name().to_string();
        if !entry.is_file() || !is_recording_name(&name) {
            continue;
        }
        let mut out = File::create(audio_dir.join(&name))
            .map_err(|e| format!("Failed to save {}: {}", name, e))?;
        io::copy(&mut entry, &mut out).map_err(|e| format!("Failed to save {}: {}", name, e))?;
        extracted += 1;
    }
    Ok(extracted)
}

/// Download a dictionary's recordings as one archive and unpack it. One
/// request instead of thousands: per-file downloads took minutes on a phone.
#[tauri::command]
pub async fn download_audio(
    app: AppHandle,
    window: Window,
    audio_id: String,
    url: String,
) -> Result<(), String> {
    let audio_dir = get_audio_dir(&app, &audio_id)?;
    let parent = audio_dir.parent().ok_or("Invalid audio dir")?.to_path_buf();
    fs::create_dir_all(&parent).map_err(|e| format!("Failed to create audio dir: {}", e))?;
    let archive_path = parent.join(format!("{}.zip.part", audio_id));

    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to download {}: {}", url, e))?;
    if !response.status().is_success() {
        return Err(format!("Failed to download {}: HTTP {}", url, response.status()));
    }

    let total = response.content_length().unwrap_or(0);
    let emit_progress = |downloaded: u64| {
        let percent = if total > 0 { (downloaded as f32 / total as f32) * 100.0 } else { 0.0 };
        let _ = window.emit(
            "audio-download-progress",
            AudioDownloadProgress { audio_id: audio_id.clone(), downloaded, total, percent },
        );
    };
    emit_progress(0);

    let mut file =
        File::create(&archive_path).map_err(|e| format!("Failed to create archive: {}", e))?;
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download error: {}", e))?;
        file.write_all(&chunk).map_err(|e| format!("Write error: {}", e))?;
        // Emit about every 256 KB to avoid flooding the webview
        if downloaded / 262_144 != (downloaded + chunk.len() as u64) / 262_144 {
            emit_progress(downloaded + chunk.len() as u64);
        }
        downloaded += chunk.len() as u64;
    }
    drop(file);

    let result = extract_recordings(&archive_path, &audio_dir);
    let _ = fs::remove_file(&archive_path);
    result?;

    emit_progress(total.max(downloaded));
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

    fn write_archive(path: &Path, entries: &[(&str, &[u8])]) {
        use zip::write::SimpleFileOptions;
        let mut zip = zip::ZipWriter::new(File::create(path).unwrap());
        for (name, bytes) in entries {
            zip.start_file(*name, SimpleFileOptions::default()).unwrap();
            zip.write_all(bytes).unwrap();
        }
        zip.finish().unwrap();
    }

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("audio-test-{}-{}", name, std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn should_extract_every_recording_of_an_archive() {
        let dir = temp_dir("extract");
        let archive = dir.join("hotl1.zip");
        write_archive(&archive, &[("1-100a.mp3", b"a"), ("1-100b.mp3", b"bb")]);
        let audio_dir = dir.join("hotl1");

        let count = extract_recordings(&archive, &audio_dir).unwrap();

        assert_eq!(count, 2);
        assert_eq!(fs::read(audio_dir.join("1-100b.mp3")).unwrap(), b"bb");
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn should_skip_entries_that_are_not_plain_recordings() {
        let dir = temp_dir("skip");
        let archive = dir.join("evil.zip");
        write_archive(&archive, &[("../escaped.mp3", b"x"), ("notes.txt", b"x"), ("ok.mp3", b"x")]);
        let audio_dir = dir.join("evil");

        let count = extract_recordings(&archive, &audio_dir).unwrap();

        assert_eq!(count, 1);
        assert!(!dir.join("escaped.mp3").exists());
        assert!(!audio_dir.join("notes.txt").exists());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn should_reject_recordings_that_are_not_mp3() {
        assert!(!is_recording_name("1-100a.wav"));
        assert!(!is_recording_name("1-100a.mp3.part"));
    }
}
