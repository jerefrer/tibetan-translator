#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::menu::{Menu, Submenu, MenuItem};

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle();
            
            let app_menu = Menu::new(app_handle).unwrap();

            let quit_menu = MenuItem::with_id(
                app_handle,
                "quit",
                "Quit",
                true,
                Some("")
            ).unwrap();

            let app_submenu = Submenu::new(
                app_handle,
                "App",
                true
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
                "Source code on Github",
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

            let feature_menu = MenuItem::with_id(
                app_handle,
                "feature",
                "Request a feature",
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

            let support_menu = MenuItem::with_id(
                app_handle,
                "support",
                "Support me",
                true,
                None::<&str>
            ).unwrap();

            let help_submenu = Submenu::new(
                app_handle,
                "Help",
                true
            ).unwrap();

            // Build the menu structure
            let app_submenu = app_submenu;
            app_submenu.append(&quit_menu).unwrap();

            let help_submenu = help_submenu;
            help_submenu.append(&website_menu).unwrap();
            help_submenu.append(&github_menu).unwrap();
            help_submenu.append(&bug_menu).unwrap();
            help_submenu.append(&feature_menu).unwrap();
            help_submenu.append(&contact_menu).unwrap();
            help_submenu.append(&support_menu).unwrap();

            let menu = app_menu;
            menu.append(&app_submenu).unwrap();
            menu.append(&help_submenu).unwrap();

            app.set_menu(menu).unwrap();
            Ok(())
        })
        .on_menu_event(|app_handle, event| {
          match event.id().0.as_str() {
              "quit" => {
                  app_handle.exit(0);
              },
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