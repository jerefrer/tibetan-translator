mod database;
mod scans;

use database::{
    execute_query, get_all_terms, get_dictionaries, get_entries_for_term, init_database,
    search_entries,
};
use scans::{check_scan_downloaded, delete_scan, download_scan_images, get_scan_image_data};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            init_database,
            get_all_terms,
            get_dictionaries,
            get_entries_for_term,
            search_entries,
            execute_query,
            check_scan_downloaded,
            get_scan_image_data,
            download_scan_images,
            delete_scan,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
