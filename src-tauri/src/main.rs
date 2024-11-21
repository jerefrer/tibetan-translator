#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::menu::{Menu, Submenu, MenuItem, SubmenuBuilder, MenuItemBuilder, AboutMetadata};

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle();
            
            let app_menu = Menu::new(app_handle).unwrap();

            let feature_menu = MenuItem::with_id(
                app_handle,
                "feature",
                "Request a feature",
                true,
                None::<&str>
            ).unwrap();

            let bug_menu = MenuItem::with_id(
                app_handle,
                "bug",
                "Report a bug",
                true,
                None::<&str>
            ).unwrap();

            let contact_menu = MenuItem::with_id(
                app_handle,
                "contact",
                "Contact the author",
                true,
                None::<&str>
            ).unwrap();

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
            ).unwrap();

            help_submenu.append(&feature_menu).unwrap();
            help_submenu.append(&bug_menu).unwrap();
            help_submenu.append(&contact_menu).unwrap();

            let menu = app_menu;
            menu.append(&app_submenu).unwrap();
            menu.append(&edit_submenu).unwrap();
            menu.append(&help_submenu).unwrap();

            app.set_menu(menu).unwrap();
            
            Ok(())
        })
        .on_menu_event(|_app_handle, event| {  // Added underscore to mark as intentionally unused
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
        })
        .run(tauri::generate_context!())
        .expect("error while running application");
}