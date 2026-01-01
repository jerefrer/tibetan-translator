#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod database;

use database::{
    execute_query, get_all_terms, get_dictionaries, get_entries_for_term, init_database,
    search_entries,
};

// Desktop-only: Menu functionality
#[cfg(desktop)]
use tauri::menu::{Menu, Submenu, MenuItem, SubmenuBuilder, MenuItemBuilder, AboutMetadata};

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
        .invoke_handler(tauri::generate_handler![
            init_database,
            get_all_terms,
            get_dictionaries,
            get_entries_for_term,
            search_entries,
            execute_query,
        ]);

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
        .run(tauri::generate_context!())
        .expect("error while running application");
}
