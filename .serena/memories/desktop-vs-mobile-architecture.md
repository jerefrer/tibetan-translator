# Tauri Desktop vs Mobile Architecture

## Critical: Separate Entry Points

The Tauri app has **two separate entry points** that must be kept in sync:

- **`src-tauri/src/main.rs`** - Desktop entry point (macOS, Windows, Linux)
- **`src-tauri/src/lib.rs`** - Mobile entry point (iOS, Android)

## Common Issue: Commands Not Found

If a Tauri command returns "Command X not found" on desktop but other commands work:
1. Check if the command is registered in **main.rs** `invoke_handler`
2. Commands added to lib.rs for mobile won't automatically be available on desktop
3. Both files must import and register the same commands

## Current Command Registration

Both files should have matching:
- `use packs::{ ... }` imports
- `invoke_handler(tauri::generate_handler![ ... ])` registrations

### Pack commands that must be in BOTH files:
```rust
// In use packs::{ ... }
download_pack, ensure_pack_available, fetch_pack_manifest, get_installed_packs,
get_pack_database_size, get_pack_path, pack_execute_query, pack_get_all_terms,
pack_get_dictionaries, pack_get_entries_for_term, pack_search_entries, read_pack_database,
read_pack_database_chunk, remove_pack, supports_modular_packs, update_pack,

// In invoke_handler
pack_get_all_terms,
pack_get_entries_for_term,
pack_search_entries,
pack_get_dictionaries,
pack_execute_query,
```

## Global Lookup Popup Window

### Configuration
- Popup window defined in `src-tauri/tauri.conf.json` with label `global-lookup-popup`
- Starts hidden (`visible: false`), shown via hotkey
- Uses `hide()` instead of `destroy()` to preserve IPC state

### Files involved:
- `src/services/global-lookup.js` - Hotkey registration and popup management
- `src/components/GlobalLookupWindow.vue` - Popup UI component
- `src/popup.js` - Popup entry point
- `popup.html` - Popup HTML template

### Key behaviors:
- Re-reads clipboard on focus (via `onFocusChanged` listener)
- Uses native SQLite queries via `pack_get_all_terms` and `pack_get_entries_for_term`
- Closes on Escape, navigates with arrow keys

## Platform Detection

- `isTauri()` - Check if running in Tauri
- `isMobile()` - Check if iOS/Android
- `supportsModularPacks()` - Check if modular pack system is available

## Build Notes

- Desktop uses `pnpm tauri:dev` or `pnpm tauri build`
- If LLVM errors occur, clean with `rm -rf src-tauri/target`
- Vite builds both `index.html` (main) and `popup.html` (popup) as separate entry points
