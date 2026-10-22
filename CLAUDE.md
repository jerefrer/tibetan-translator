# CLAUDE.md

## For Claude

Don't run this command yourself, ask me to do it:

```
pnpm build:packs
```

## Tauri package version alignment

Every `@tauri-apps/*` npm package MUST match its Rust crate counterpart on the same major/minor. `tauri build` (run by the GitHub release action) enforces this; `tauri dev`, `cargo check`, and `pnpm build` do NOT, so a mismatch is invisible locally until release time.

Gotcha: bumping one crate can transitively pull others up — e.g. `tauri-plugin-dialog 2.7` requires `tauri ^2.10`, which then forces `@tauri-apps/api` to 2.10. Audit **both** sides together when touching any `@tauri-apps/*` package.

Run `pnpm check:tauri-versions` to verify alignment in ~300ms without a full build. It reads `src-tauri/Cargo.lock` and `node_modules/@tauri-apps/*/package.json` and reports every pair. It is chained into `release:patch/minor/major` automatically, so a misaligned pair blocks the release before the bump/commit/tag/push.

When adding a new Tauri plugin, add its pair to the `PAIRS` array in `scripts/check-tauri-versions.js`.

## Release process

`pnpm release:patch|minor|major` runs the whole chain:

```
check:tauri-versions
  → bump-version <type> --print     resolve the next version, write nothing
  → generate-changelog --next       write notes, OPEN $EDITOR, may abort
  → bump-version <type>             now write package.json/tauri.conf.json/Cargo.toml
  → git add -A, commit, tag v<version>, push
```

**It is interactive.** `generate-changelog --next` collects the commits since the last published release, has `claude -p --model sonnet` write user-facing notes into `CHANGELOG.md`, then opens `$VISUAL → $EDITOR → git core.editor → vi` and waits. Save and quit to continue. **Leaving the version's section empty aborts the release** — nothing is bumped, committed or tagged, and `CHANGELOG.md` is restored. That is the intended way to back out.

Changelog entries never repeat the verb in their `###` heading ("Copy buttons on every definition", not "Added copy buttons"), and carry no trailing full stop. The rule lives in the prompt inside `scripts/generate-changelog.js`.

This text is user-visible in three places: the GitHub release body, the `notes` field of `latest.json`, and the **What's new** dialog the app shows before restarting to install an update. Sloppy notes ship to users.

Pure logic lives in `scripts/lib/changelog-core.js`, covered by `tests/changelog.test.js`. Two one-off scripts exist and should not be needed again: `generate-changelog.js --backfill` rebuilds the whole file from every published release, and `sync-release-notes.js` (dry run by default, `--apply` to write) pushes each section to its GitHub release body.

### CI gotchas

**`bundle.targets` lists every format explicitly, and leaves out `rpm`.** It used to be `"all"`, which made `ubuntu-22.04` run for 2h36 — 2h20 of it spent compressing the 184 MB `core.sqlite` resource into a `.rpm` that four releases of download counts say nobody installs. The AppImage already covers Fedora and openSUSE, and is what `latest.json` serves Linux under `linux-x86_64`. The list is global, not per-platform, so adding a format means adding it for every OS: the valid values are `deb`, `rpm`, `appimage`, `msi`, `nsis`, `app`, `dmg`, and dropping one silently removes that installer from the release — which is how Intel Macs went missing in v1.9.2. `app` is what produces the macOS `.app.tar.gz` the updater needs; it is not optional.

**A failed matrix job cannot be re-run while the rest of the run is still going.** Both the button and `gh run rerun --failed` answer `403 — The workflow run containing this job is already running`. The whole run has to finish first.

**Each matrix job merges its own entries into the release's `latest.json`.** A job that dies after uploading its binaries but before writing that entry leaves a release carrying every asset while the updater silently stops offering it to that platform — this happened to Intel Macs on v1.9.2. The `verify-updater-manifest` job now fails the run and names the missing platforms. The fix is to re-run the failed matrix job once the run completes; re-running merges, it does not overwrite.

Releases from v1.9.2 onward sit on a single `v*` tag. Earlier ones sit on a parallel `app-v*` tag that `tauri-action` used to mint, which is why compare links in `CHANGELOG.md` use both forms.

## Project Overview

Tibetan Translator is a multi-platform dictionary app that provides access to 60+ Tibetan dictionaries through a unified interface. It runs as a **Tauri 2** desktop/mobile app and can also run in a web browser.

## Tech Stack

- **Frontend**: Vue 3 (Options API) + Vue Router 4. The UI is in-house components in `src/ui` (built on Reka UI primitives) with Lucide icons and the design tokens in `src/css/tokens.css`; there is no UI framework
- **Build**: Vite 5, pnpm
- **Backend**: Tauri 2 (Rust), native SQLite via rusqlite
- **Styling**: plain CSS on the design tokens (`src/ui`, `src/css`, most components) and Stylus in some older component blocks; Lucide icons
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
pnpm release:patch    # Full release: changelog (interactive) + bump + tag + push
pnpm check:tauri-versions  # Verify @tauri-apps/* npm vs Rust crate alignment
```

## Project Structure

```
src/
  components/          # Screens and app components (Options API with mixins); App.vue is the root
    settings/          # Settings cards
    mixins/            # MobileResponsiveMixin, InfiniteScrollMixin
  ui/                  # Component library (UiButton, UiDialog, UiTibetanField...), icons.js, showcase at /ui-showcase (dev only)
  services/            # Core services (database, packs, search, theme, etc.)
  config/              # Platform detection, pack definitions, navigation
  css/                 # Global styles: tokens, reset (main window only), fonts, layout, tibetan, scrollbars
  router.js            # Route definitions
  main.js              # Main app entry point
  popup.js             # GlobalLookupWindow entry point (desktop popup)
  utils.js             # Tibetan text utilities
src-tauri/
  src/main.rs          # Tauri setup, commands, macOS panel config
  src/packs.rs         # Pack installation, queries, chunked download
  src/database.rs      # Legacy single-database queries
  src/scans.rs         # Scan image management
build/                 # Database and pack build scripts
tests/                 # Vitest tests: services, every screen mounted with @vue/test-utils, src/ui in tests/ui
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

| Mode                 | Platform                     | How it works                                     |
| -------------------- | ---------------------------- | ------------------------------------------------ |
| `tauri-packs-native` | All Tauri (desktop + mobile) | Native SQLite per pack via Rust commands         |
| `tauri-packs`        | Fallback desktop             | sql.js WebWorkers per pack (`multi-database.js`) |
| `tauri-native`       | Legacy fallback              | Single native SQLite database                    |
| `web`                | Browser                      | Full bundled DB via sql.js WebAssembly           |

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
- `mixins/MobileResponsiveMixin`, `mixins/InfiniteScrollMixin` - phone layout and infinite scroll

Screens are built from the `src/ui` components (`import { UiButton, UiDialog } from '../ui'`), never from raw Reka UI. They are styled only with the tokens (`var(--accent)`, `var(--space-4)`, `var(--text-sm)`...), so light and dark both work; the theme is `data-theme="light|dark"` on `<html>`, set by `src/services/theme.js`. Icons are `<ui-icon name="...">` with Lucide names; `src/ui/icons.js` registers each one used (and keeps `mdi-*` aliases only for custom-pack manifests). The app-level toast is the injected `snackbar` (`this.snackbar.open(html)`), rendered by `UiToast` in App.vue.

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

| File                                  | Purpose                                                  |
| ------------------------------------- | -------------------------------------------------------- |
| `src/services/sql-database.js`        | Unified database interface (all platform modes)          |
| `src/services/multi-database.js`      | Worker pool for multi-pack SQL queries                   |
| `src/services/pack-manager.js`        | Pack download/install/remove lifecycle                   |
| `src/services/global-lookup.js`       | Desktop hotkey + clipboard integration                   |
| `src/services/phonetic-search.js`     | Phonetic search implementation                           |
| `src/services/decorator.js`           | Entry highlighting and link decoration                   |
| `src/config/platform.js`              | Platform detection (Tauri/web/mobile)                    |
| `src/config/pack-definitions.js`      | Pack metadata and dictionary lists                       |
| `src/components/TibetanTextField.vue` | Shared Tibetan input with Wylie conversion               |
| `src/utils.js`                        | Tibetan utilities (phonetics, tokenizer, trailing tshek) |

## Conventions

- **Vue Options API** throughout, no `<script setup>` or Composition API in components
- **Styles**: `src/ui` and new code use plain CSS (`<style>`, sometimes `scoped`) on the tokens; some older components still use `lang="stylus"`. Both are fine, do not convert for the sake of it. `src/css/reset.css` is the base reset of the main window (formerly Vuetify's); the quick lookup window does not load it
- **jQuery** is used in older code (App.vue event delegation, scroll management)
- **Underscore.js** for debounce, utility functions
- Keyboard shortcuts: `Cmd/Ctrl+D` (Define), `Cmd/Ctrl+S` (Search), `Cmd/Ctrl+T` (Split), `Cmd/Ctrl+G` (Settings)
- Mobile breakpoint: `600px` (`window.innerWidth <= 600`)
- Theme: light/dark with system preference detection, stored as `themePreference` in localStorage and applied by `src/services/theme.js`; Text size is `fontSize` (a percentage of the root font size), so sizes in rem follow it

## Git style

- Use conjugated action verbs. For instance "Adds a new feature", "Fixes a bug with something".
