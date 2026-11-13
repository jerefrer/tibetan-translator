//! Process-wide cancellation registry for downloads.
//!
//! Keys are `pack:<packId>`, `scan:<scanId>` and `audio:<audioId>`. The
//! frontend calls `cancel_download`; the download loops poll `is_cancelled`.

use once_cell::sync::Lazy;
use std::collections::HashSet;
use std::sync::Mutex;

/// The exact error a cancelled download returns (the frontend compares it)
pub const CANCELLED: &str = "cancelled";

static CANCELLED_KEYS: Lazy<Mutex<HashSet<String>>> = Lazy::new(|| Mutex::new(HashSet::new()));

/// A poisoned lock only means another thread panicked mid-insert; the set is
/// still usable, and refusing to cancel would be worse.
fn keys() -> std::sync::MutexGuard<'static, HashSet<String>> {
    CANCELLED_KEYS.lock().unwrap_or_else(|e| e.into_inner())
}

/// Begin a download: forget any cancel left over from a previous one
pub fn start(key: &str) {
    keys().remove(key);
}

pub fn is_cancelled(key: &str) -> bool {
    keys().contains(key)
}

/// End a download, whatever the outcome
pub fn finish(key: &str) {
    keys().remove(key);
}

/// Calls `start` now and `finish` on drop, so early returns cannot leak a key
pub struct DownloadGuard(String);

pub fn guard(key: &str) -> DownloadGuard {
    start(key);
    DownloadGuard(key.to_string())
}

impl Drop for DownloadGuard {
    fn drop(&mut self) {
        finish(&self.0);
    }
}

#[tauri::command]
pub fn cancel_download(key: String) {
    keys().insert(key);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn should_clear_a_stale_cancel_when_a_download_starts() {
        cancel_download("test:stale".to_string());
        start("test:stale");
        assert!(!is_cancelled("test:stale"));
    }

    #[test]
    fn should_report_cancelled_after_cancel_download() {
        start("test:cancel");
        assert!(!is_cancelled("test:cancel"));
        cancel_download("test:cancel".to_string());
        assert!(is_cancelled("test:cancel"));
        assert!(!is_cancelled("test:other"));
        finish("test:cancel");
    }

    #[test]
    fn should_forget_the_key_when_finished() {
        cancel_download("test:finish".to_string());
        finish("test:finish");
        assert!(!is_cancelled("test:finish"));
    }

    #[test]
    fn should_forget_the_key_when_the_guard_drops() {
        {
            let _guard = guard("test:guard");
            cancel_download("test:guard".to_string());
            assert!(is_cancelled("test:guard"));
        }
        assert!(!is_cancelled("test:guard"));
    }

    #[test]
    fn should_clear_a_stale_cancel_when_a_guard_is_created() {
        cancel_download("test:guard-stale".to_string());
        let _guard = guard("test:guard-stale");
        assert!(!is_cancelled("test:guard-stale"));
    }
}
