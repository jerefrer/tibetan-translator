mod database;
mod packs;
mod scans;

use database::{
    execute_query, get_all_terms, get_dictionaries, get_entries_for_term, init_database,
    search_entries,
};
use packs::{
    download_pack, fetch_pack_manifest, get_installed_packs, get_pack_path, read_pack_database,
    remove_pack, supports_modular_packs, update_pack,
};
use scans::{check_scan_downloaded, delete_scan, download_scan_images, get_scan_image_data};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            // Database commands
            init_database,
            get_all_terms,
            get_dictionaries,
            get_entries_for_term,
            search_entries,
            execute_query,
            // Scan commands
            check_scan_downloaded,
            get_scan_image_data,
            download_scan_images,
            delete_scan,
            // Pack commands
            fetch_pack_manifest,
            get_installed_packs,
            download_pack,
            update_pack,
            remove_pack,
            get_pack_path,
            read_pack_database,
            supports_modular_packs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
