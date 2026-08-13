mod custom_packs;
mod database;
mod lexicon;
mod packs;
mod scans;
mod spreadsheet;

use custom_packs::{install_custom_pack, install_custom_pack_from_bytes, list_custom_packs, remove_custom_pack};
use lexicon::{
    lexicon_apply_import, lexicon_export_xlsx,
    create_lexicon, lexicon_delete_entry, lexicon_entries, lexicon_export,
    lexicon_find_entry, lexicon_upsert_entry, rename_lexicon,
};
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
use spreadsheet::read_spreadsheet;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
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
            lexicon_apply_import,
            lexicon_export_xlsx,
            read_spreadsheet,
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
            // Custom pack commands
            install_custom_pack,
            install_custom_pack_from_bytes,
            list_custom_packs,
            remove_custom_pack,
            // Lexicon (editable custom pack) commands
            create_lexicon,
            rename_lexicon,
            lexicon_entries,
            lexicon_find_entry,
            lexicon_upsert_entry,
            lexicon_delete_entry,
            lexicon_export,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
