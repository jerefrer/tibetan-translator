#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

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

// Desktop-only: Menu functionality
#[cfg(desktop)]
use tauri::menu::{Menu, Submenu, MenuItem, SubmenuBuilder, MenuItemBuilder, AboutMetadata};

// macOS-only: NSPanel support for fullscreen overlay
#[cfg(target_os = "macos")]
use tauri::{Emitter, Manager};
#[cfg(target_os = "macos")]
use tauri_nspanel::{
    tauri_panel, CollectionBehavior, ManagerExt, PanelLevel, StyleMask, WebviewWindowExt,
};

// Define the panel type for the popup window (macOS only)
#[cfg(target_os = "macos")]
tauri_panel! {
    panel!(LookupPanel {
        config: {
            can_become_key_window: true,
            is_floating_panel: true
        }
    })

    panel_event!(LookupPanelEventHandler {
        window_did_resign_key(notification: &NSNotification) -> ()
    })
}

// macOS-only: Configure popup window as NSPanel for fullscreen overlay
#[cfg(target_os = "macos")]
#[tauri::command]
fn configure_window_for_fullscreen(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(popup_window) = app.get_webview_window("global-lookup-popup") {
        // Convert the window to an NSPanel
        let panel = popup_window
            .to_panel::<LookupPanel>()
            .map_err(|e| format!("Failed to convert window to panel: {:?}", e))?;

        // Set floating level so it appears above other windows
        panel.set_level(PanelLevel::Floating.value());

        // Set non-activating style so it doesn't steal focus from other apps
        // Also add resizable so users can resize the panel
        panel.set_style_mask(StyleMask::empty().nonactivating_panel().resizable().into());

        // Configure collection behavior for fullscreen overlay:
        // - full_screen_auxiliary: appear on same space as fullscreen windows
        // - can_join_all_spaces: appear on all desktop spaces
        panel.set_collection_behavior(
            CollectionBehavior::new()
                .full_screen_auxiliary()
                .can_join_all_spaces()
                .into(),
        );

        // Set up event handler to auto-hide panel when it loses key window status
        // This handles click-outside-to-close behavior
        let handler = LookupPanelEventHandler::new();
        let app_handle = app.clone();
        handler.window_did_resign_key(move |_notification| {
            println!("[GlobalLookupPopup] Panel resigned key window - hiding");
            // Hide the panel when it loses focus
            if let Ok(panel) = app_handle.get_webview_panel("global-lookup-popup") {
                panel.hide();
            }
        });
        panel.set_event_handler(Some(handler.as_ref()));

        Ok(())
    } else {
        Err("Popup window not found".to_string())
    }
}

// macOS-only: Show the panel and make it key window
#[cfg(target_os = "macos")]
#[tauri::command]
fn show_lookup_panel(app: tauri::AppHandle) -> Result<(), String> {
    // Use the panel's show method which properly handles key window
    if let Ok(panel) = app.get_webview_panel("global-lookup-popup") {
        panel.show();
        // Make sure it becomes the key window to receive keyboard input
        panel.make_key_window();
        // Emit event to notify the popup to refresh clipboard
        if let Some(window) = app.get_webview_window("global-lookup-popup") {
            let _ = window.emit("panel-shown", ());
        }
        Ok(())
    } else {
        // Fallback to regular window show if panel not found (first time before conversion)
        if let Some(window) = app.get_webview_window("global-lookup-popup") {
            window.show().map_err(|e| e.to_string())?;
            window.set_focus().map_err(|e| e.to_string())?;
            let _ = window.emit("panel-shown", ());
        }
        Ok(())
    }
}

// macOS-only: Hide the panel without affecting focus (uses orderOut)
#[cfg(target_os = "macos")]
#[tauri::command]
fn hide_lookup_panel(app: tauri::AppHandle) -> Result<(), String> {
    // Use the panel's hide method which calls orderOut: and doesn't affect focus
    if let Ok(panel) = app.get_webview_panel("global-lookup-popup") {
        panel.hide();
        Ok(())
    } else {
        // Fallback to regular window hide if panel not found
        if let Some(window) = app.get_webview_window("global-lookup-popup") {
            window.hide().map_err(|e| e.to_string())?;
        }
        Ok(())
    }
}

// Stub for non-macOS platforms
#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn show_lookup_panel(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::{Emitter, Manager};
    if let Some(window) = app.get_webview_window("global-lookup-popup") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        let _ = window.emit("panel-shown", ());
    }
    Ok(())
}

// Stub for non-macOS platforms
#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn hide_lookup_panel(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("global-lookup-popup") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

// Stub for non-macOS platforms
#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn configure_window_for_fullscreen(_app: tauri::AppHandle) -> Result<(), String> {
    Ok(())
}

#[cfg(desktop)]
fn setup_menu(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app.handle();

    let app_menu = Menu::new(app_handle)?;

    let feature_menu = MenuItem::with_id(
        app_handle,
        "feature",
        "Request a feature",
        true,
        None::<&str>
    )?;

    let bug_menu = MenuItem::with_id(
        app_handle,
        "bug",
        "Report a bug",
        true,
        None::<&str>
    )?;

    let contact_menu = MenuItem::with_id(
        app_handle,
        "contact",
        "Contact the author",
        true,
        None::<&str>
    )?;

    let website = MenuItemBuilder::new("Project website")
        .id("website")
        .build(app)?;

    let github = MenuItemBuilder::new("Source code on Github")
        .id("github")
        .build(app)?;

    let support = MenuItemBuilder::new("Support the author")
        .id("support")
        .build(app)?;

    let app_submenu = SubmenuBuilder::new(app, "App")
        .about(Some(AboutMetadata {
            ..Default::default()
        }))
        .separator()
        .item(&website)
        .item(&github)
        .item(&support)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .quit()
        .build()?;

    let edit_submenu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let help_submenu = Submenu::new(
        app_handle,
        "Help",
        true
    )?;

    help_submenu.append(&feature_menu)?;
    help_submenu.append(&bug_menu)?;
    help_submenu.append(&contact_menu)?;

    let menu = app_menu;
    menu.append(&app_submenu)?;
    menu.append(&edit_submenu)?;
    menu.append(&help_submenu)?;

    app.set_menu(menu)?;

    Ok(())
}

#[cfg(desktop)]
fn handle_menu_event(_app_handle: &tauri::AppHandle, event: tauri::menu::MenuEvent) {
    match event.id().0.as_str() {
        "website" => {
            let _ = open::that("https://jerefrer.github.io/tibetan-translator/");
        },
        "github" => {
            let _ = open::that("https://github.com/jerefrer/tibetan-translator/");
        },
        "bug" => {
            let _ = open::that("https://github.com/jerefrer/tibetan-translator/issues/new");
        },
        "feature" => {
            let _ = open::that("https://github.com/jerefrer/tibetan-translator/issues/new");
        },
        "contact" => {
            let _ = open::that("https://frerejeremy.me");
        },
        "support" => {
            let _ = open::that("https://frerejeremy.me");
        },
        _ => {}
    }
}

fn main() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());

    // Add NSPanel plugin for macOS fullscreen overlay support
    #[cfg(target_os = "macos")]
    {
        builder = builder.plugin(tauri_nspanel::init());
    }

    builder = builder.invoke_handler(tauri::generate_handler![
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
            // Native SQLite pack queries (for popup and mobile)
            pack_get_all_terms,
            pack_get_entries_for_term,
            pack_search_entries,
            pack_get_dictionaries,
            pack_execute_query,
            // macOS fullscreen support
            configure_window_for_fullscreen,
            show_lookup_panel,
            hide_lookup_panel,
        ]);

    // Add macOS permissions plugin (only on macOS)
    #[cfg(target_os = "macos")]
    {
        builder = builder.plugin(tauri_plugin_macos_permissions::init());
    }

    #[cfg(desktop)]
    {
        builder = builder
            .setup(|app| {
                setup_menu(app)?;
                Ok(())
            })
            .on_menu_event(handle_menu_event);
    }

    builder
        .build(tauri::generate_context!())
        .expect("error while building application")
        .run(|app_handle, event| {
            match event {
                #[cfg(target_os = "macos")]
                tauri::RunEvent::Reopen { has_visible_windows, .. } => {
                    // When clicking the dock icon, show the main window
                    if !has_visible_windows {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
                #[cfg(target_os = "macos")]
                tauri::RunEvent::WindowEvent {
                    label,
                    event: tauri::WindowEvent::CloseRequested { api, .. },
                    ..
                } => {
                    // On macOS, hide the main window instead of closing it
                    // This allows the app to stay running and reopen via dock icon
                    if label == "main" {
                        api.prevent_close();
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                }
                _ => {}
            }
        });
}
