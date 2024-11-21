#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::menu::{Menu, Submenu, MenuItem};

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle();
            
            let app_menu = Menu::new(app_handle).unwrap();

            // Add version number as non-clickable menu item
            let version_menu = MenuItem::with_id(
                app_handle,
                "version",
                format!("Version {}", env!("CARGO_PKG_VERSION")),
                false,  // Set to false to make it non-clickable
                None::<&str>
            ).unwrap();

            // Add separator
            let separator = MenuItem::new(
                app_handle,
                "-------------",  // empty text for separator
                false,  // disabled
                None::<&str>
            ).unwrap();

            let website_menu = MenuItem::with_id(
                app_handle,
                "website",
                "Website",
                true,
                None::<&str>
            ).unwrap();

            let github_menu = MenuItem::with_id(
                app_handle,
                "github",
                "Source code",
                true,
                None::<&str>
            ).unwrap();

            let support_menu = MenuItem::with_id(
                app_handle,
                "support",
                "Support me",
                true,
                None::<&str>
            ).unwrap();

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
                "Contact me",
                true,
                None::<&str>
            ).unwrap();

            let app_submenu = Submenu::new(
                app_handle,
                "App",
                true
            ).unwrap();

            let help_submenu = Submenu::new(
                app_handle,
                "Help",
                true
            ).unwrap();

            // Build the menu structure
            app_submenu.append(&version_menu).unwrap();
            app_submenu.append(&separator).unwrap();  // Add separator after version
            app_submenu.append(&website_menu).unwrap();
            app_submenu.append(&github_menu).unwrap();
            app_submenu.append(&support_menu).unwrap();

            help_submenu.append(&feature_menu).unwrap();
            help_submenu.append(&bug_menu).unwrap();
            help_submenu.append(&contact_menu).unwrap();

            let menu = app_menu;
            menu.append(&app_submenu).unwrap();
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