mod database;
mod packs;
mod scans;

use database::{
    execute_query, get_all_terms, get_dictionaries, get_entries_for_term, init_database,
    search_entries,
};
use packs::{
    download_pack, ensure_pack_available, fetch_pack_manifest, get_installed_packs,
    get_pack_database_size, get_pack_path, pack_execute_query, pack_get_all_terms,
    pack_get_dictionaries, pack_get_entries_for_term, pack_search_entries, read_pack_database,
    read_pack_database_chunk, remove_pack, supports_modular_packs, update_pack,
};
use scans::{check_scan_downloaded, delete_scan, download_scan_images, get_scan_image_data};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init());

    // Add desktop-only plugins
    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_global_shortcut::Builder::new().build())
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init());
    }

    // Add macOS permissions plugin (only on macOS)
    #[cfg(target_os = "macos")]
    {
        builder = builder.plugin(tauri_plugin_macos_permissions::init());
    }

    builder
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
            read_pack_database_chunk,
            get_pack_database_size,
            ensure_pack_available,
            supports_modular_packs,
            // Native SQLite pack queries (for mobile performance)
            pack_get_all_terms,
            pack_get_entries_for_term,
            pack_search_entries,
            pack_get_dictionaries,
            pack_execute_query,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
