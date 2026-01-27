# CLAUDE.md

## Project Overview

Tibetan Translator is a multi-platform dictionary app that provides access to 60+ Tibetan dictionaries through a unified interface. It runs as a **Tauri 2** desktop/mobile app and can also run in a web browser.

## Tech Stack

- **Frontend**: Vue 3 (Options API) + Vuetify 3 + Vue Router 4
- **Build**: Vite 5, pnpm
- **Backend**: Tauri 2 (Rust), native SQLite via rusqlite
- **Styling**: Stylus + SASS, Material Design Icons
- **Testing**: Vitest
- **Platforms**: macOS, Windows, Linux, iOS, Android, Web

## Commands

```bash
pnpm dev              # Vite dev server (port 8080)
pnpm build            # Production build to /dist
pnpm tauri:dev        # Tauri desktop dev with hot reload
pnpm tauri:build      # Native desktop build
pnpm ios:dev          # iOS simulator dev
pnpm android:dev      # Android dev
pnpm test             # Run tests (vitest)
pnpm test:watch       # Watch mode
pnpm build:database   # Build full SQLite DB from dictionary sources
pnpm build:packs      # Build modular pack .sqlite files
```

## Project Structure

```
src/
  components/          # Vue components (Options API with mixins)
  services/            # Core services (database, packs, search, etc.)
  config/              # Platform detection, pack definitions
  plugins/             # Vuetify setup
  css/                 # Global styles (layout, tibetan fonts, scrollbars)
  router.js            # Route definitions
  main.js              # Main app entry point
  popup.js             # GlobalLookupWindow entry point (desktop popup)
  utils.js             # Tibetan text utilities
  App.vue              # Root component
src-tauri/
  src/main.rs          # Tauri setup, commands, macOS panel config
  src/packs.rs         # Pack installation, queries, chunked download
  src/database.rs      # Legacy single-database queries
  src/scans.rs         # Scan image management
build/                 # Database and pack build scripts
tests/                 # Vitest tests (phonetic search, search queries)
vendor/                # Third-party dictionary source files
```

## Architecture

### Routing & Page Lifecycle

Routes are defined in `src/router.js`:
- `/define/:term?` - DefinePage (term lookup)
- `/search/:query?` - SearchPage (full-text search)
- `/segment` - SegmentPage (sentence splitting)
- `/settings` - ConfigurePage (settings, dictionary management)

App.vue uses `<keep-alive>` for all route components. This means pages are **not destroyed** when navigating away. Use the `activated()` lifecycle hook (not `mounted()`) for actions that should run each time a page becomes visible.

### Database Layer

`SqlDatabase` (`src/services/sql-database.js`) abstracts four database modes:

| Mode | Platform | How it works |
|------|----------|-------------|
| `tauri-packs-native` | All Tauri (desktop + mobile) | Native SQLite per pack via Rust commands |
| `tauri-packs` | Fallback desktop | sql.js WebWorkers per pack (`multi-database.js`) |
| `tauri-native` | Legacy fallback | Single native SQLite database |
| `web` | Browser | Full bundled DB via sql.js WebAssembly |

Key property: `SqlDatabase.allTerms` is a **plain JS array** (not Vue-reactive). It's loaded once at init and refreshed via `setAllTermsVariable()` when packs change. An `all-terms-updated` CustomEvent is dispatched after refresh so Vue components can react.

### Dictionary Pack System

Three packs defined in `src/config/pack-definitions.js`:
- **core** (required, bundled) - 34 dictionaries
- **tibetan-monolingual** (optional, downloadable) - 20 dictionaries
- **sanskrit-academic** (optional, downloadable) - 9 dictionaries

Pack lifecycle is managed by `PackManager` (`src/services/pack-manager.js`). After download/removal, `SqlDatabase.reloadPack()` / `unloadPack()` refreshes the database state and dispatches events.

### Custom Events

- `dictionaries-updated` - Fired when the dictionary list in localStorage changes (after pack load/unload)
- `all-terms-updated` - Fired after `SqlDatabase.allTerms` is refreshed

### Component Patterns

All components use **Options API** with **mixins** for shared logic:
- `DictionariesDetailsMixin` - Dictionary metadata and abbreviation lookups
- `DictionariesMenuMixin` - Dictionary filtering/toggle UI
- `DictionariesFuzzySearchMixin` - Fuzzy search across dictionaries

### State Management

No Vuex/Pinia. State is managed through:
- **LocalStorage** (via `src/services/storage.js`) - Persistent settings, dictionary order, theme
- **Vue `reactive()`** - Global snackbar state, PackManager state
- **Component data/computed** - Local state with mixins for sharing
- **Custom DOM events** - Cross-component sync for database updates

### GlobalLookupWindow

A **separate Tauri window** (`popup.html` / `src/popup.js`) that provides clipboard-based term lookup via a global hotkey. It runs independently of the main app with its own Vue instance, database access, and theme initialization. On macOS it uses an NSPanel for proper focus behavior.

### Tibetan Text Handling

- `TibetanTextField` component handles Wylie-to-Unicode conversion on keyup/paste
- Tibetan punctuation: tsheg `་` (U+0F0B), shad `།` (U+0F0D), rin chen spungs shad `༑` (U+0F11), gter tsheg `༔` (U+0F14)
- Input normalization: trailing punctuation is replaced with a single tsheg for dictionary lookups
- Libraries: `tibetan-normalizer`, `tibetan-regexps`, `tibetan-to-phonetics`, `tibetan-word-tokenizer`

## Key Files

| File | Purpose |
|------|---------|
| `src/services/sql-database.js` | Unified database interface (all platform modes) |
| `src/services/multi-database.js` | Worker pool for multi-pack SQL queries |
| `src/services/pack-manager.js` | Pack download/install/remove lifecycle |
| `src/services/global-lookup.js` | Desktop hotkey + clipboard integration |
| `src/services/phonetic-search.js` | Phonetic search implementation |
| `src/services/decorator.js` | Entry highlighting and link decoration |
| `src/config/platform.js` | Platform detection (Tauri/web/mobile) |
| `src/config/pack-definitions.js` | Pack metadata and dictionary lists |
| `src/components/TibetanTextField.vue` | Shared Tibetan input with Wylie conversion |
| `src/utils.js` | Tibetan utilities (phonetics, tokenizer, trailing tshek) |

## Conventions

- **Vue Options API** throughout, no `<script setup>` or Composition API in components
- **Stylus** for component `<style>` blocks (some use `lang="stylus" scoped`, some unscoped)
- **jQuery** is used in older code (App.vue event delegation, scroll management)
- **Underscore.js** for debounce, utility functions
- Keyboard shortcuts: `Cmd/Ctrl+D` (Define), `Cmd/Ctrl+S` (Search), `Cmd/Ctrl+T` (Split), `Cmd/Ctrl+G` (Settings)
- Mobile breakpoint: `600px` (`window.innerWidth <= 600`)
- Theme: light/dark with system preference detection, stored as `themePreference` in localStorage
