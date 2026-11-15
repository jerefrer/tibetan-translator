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

## Mobile store builds

Built locally, not in CI (see `DECISIONS.md`). `pnpm android:release` makes the `.aab`, `pnpm ios:release` the App Store `.ipa`; both run `check:tauri-versions` first.

- **Version:** both read `version` from `tauri.conf.json`, the one `release:*` bumps. Android derives `versionCode` from it; each store refuses a second upload of the same number.
- **Android signing:** `src-tauri/gen/android/keystore.properties` (`keyAlias`, `password`, `storeFile`) points at the upload keystore, kept outside the repo; both are git-ignored. Without the file, release builds come out unsigned. Losing the upload key is recoverable through Play App Signing support, but slow.
- **Android NDK:** `NDK_HOME` must point at NDK r28 or later, which aligns native libraries to the 16 KB pages Google Play requires.
- **iOS signing:** team `3J4HCZ8V25` (personal, not the BDRC team also in Xcode), set in `tauri.ios.conf.json` and `gen/apple/project.yml`.
- **iOS privacy:** `src-tauri/Info.ios.plist` is merged into the app's Info.plist (export compliance: no non-exempt encryption). `gen/apple/TibetanTranslator_iOS/PrivacyInfo.xcprivacy` declares the required-reason APIs; if App Store Connect answers an upload with ITMS-91053, add the category it names there. After editing `gen/apple/project.yml`, run `xcodegen generate` in `gen/apple` outside the sandbox (its atomic write of `Info.plist` is refused inside it and deletes the file), **with `Externals/` moved aside and an empty one in its place**: xcodegen adds every `libapp.a` it finds there to the app's resources, and the debug and release copies then collide ("Multiple commands produce libapp.a"). Regenerating also resets `Info.plist`'s version and drops the merged `Info.ios.plist` keys; the next `tauri ios build` writes them back.
- **Xcode 27:** needs Tauri 2.12.3+ and its plugins' October 2026 releases (non-public `@_cdecl` entry points no longer link in release), and `ios:release` puts `/usr/bin` first in `PATH` because the export step's `rsync` otherwise reaches Homebrew's rsync 3.x, which openrsync cannot talk to ("exportArchive Copy failed").
- **Windows:** `tauri.ios.conf.json` and `tauri.android.conf.json` replace `app.windows` with the main window only; the quick-lookup popup is desktop-only.

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
    lookup/            # Define (LookupPage): LookupField (Tibetan), results (headwords, and the definitions Search lists), hints, home, the layout both pages share
    search/            # Search: SearchPage, SearchField (the query builder behind its button)
    reader/            # Reader: editor, words with their expressions, word panel / sheet
    entry/             # TermEntry: one term's page (In short, dictionary tabs, definitions), shared by Define, Search and Reader
    dictionaries/      # DictionariesPage: packs, the dictionaries in lookup order (switches, reordering, undo), the selected one's detail
    settings/          # SettingsPage (General, Quick lookup, Offline content, About; Help on a phone) built from SettingsGroup / SettingsRow
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

Routes are defined in `src/router.js`. Define, Search, Reader and Settings on a phone (the Folio navigation, `src/config/navigation.js`); the desktop sidebar lists Define, Search and Reader, then My glossary and Dictionaries, and ends with a Settings link. On a phone the glossary and dictionaries are rows of Settings:

- `/define/:term?` - LookupPage, shown as "Define": a Tibetan term, typed in Tibetan or Wylie, and its entry. A hint sends Latin that is no term to Search
- `/search` - SearchPage: `?q=<query>` searches the definitions, `&term=<term>` is the entry open beside the results; `&dict=<name>` keeps that search to one dictionary (Dictionaries' "Search its definitions") until its ×. A result's entry opens in Search itself, beside the results; a query that is a Tibetan term offers to open it in Define. Nothing is carried over between the two pages otherwise (they were one page with a བོད / EN switch for a while, and the conversions it made confused more than they helped). The term Define selected and the query Search ran last are kept under `lookupState`
- `/reader` - ReaderPage (paste or type a text, read it word by word)
- `/settings` - SettingsPage: settings only (General, Quick lookup, Offline content, About); on a phone also the My glossary and Dictionaries rows, and Help
- `/dictionaries` - DictionariesPage: everything about dictionaries (packs, which are on, their order, what each holds). It writes Storage's `dictionaries`, the order and switches lookups read; `?find=` and `?status=` set its search and filter, `?dictionary=` selects one. On a phone opening a dictionary pushes that `?dictionary=`, so Android's Back (the web view's history, see wry's `WryActivity`) closes it
- `/glossary/:packId?/:dictionaryId?` - LexiconPage (My glossary): the title is the glossary picker, its menu creates, adds and removes glossaries (GlossaryActions); spreadsheets come in through SpreadsheetDropDialog (HTML5 drop, Tauri's own drag and drop being off)
- `/saved` - SavedPage: every saved term (the sidebar shows the eight newest), to search, list newest first or in Tibetan order, copy or clear

**Back and Forward** walk the router's history, as a browser does (`src/services/navigation-history.js`): the arrows at the top of the sidebar, Cmd/Ctrl+[ and ], the mouse's side buttons in the app, Android's Back, and a phone entry's back link when it was reached from another entry. So only places go in the history: a term or result opened by a click, a link, a hint or Enter is `push`ed, while what typing selects (Define's first match, a Search query after the pause) and Up/Down `replace` it. Search keeps the entry it shows in its route (`&term=`) so that Back from a link followed in it returns to it.

**Help** is one dialog for the whole app (`src/components/help/HelpDialog.vue`, topics in `HelpTopic.vue`, state in `src/services/help.js`), opened on the topic of the screen: the sidebar's Help, F1 or Cmd/Ctrl+/ on desktop, the "?" beside Define's, Search's and Reader's titles on a phone, and the Help row at the end of Settings on a phone. A feature that changes needs its topic changed.

The former routes redirect, keeping query and hash: `/lookup/<term>` to `/define/<term>` (Define was called Lookup for a while), `/search/<query>` to `/search?q=<query>`, Lookup's former English mode (`/lookup?mode=en&q=...&dict=...`, or the same on `/define`) to `/search?q=...&dict=...`, `/segment` to `/reader`, `/lexicon/...` to `/glossary/...`, and the former Library routes (`/library`, `/library/settings`, `/library/glossary/...`, `/library/dictionaries`) to `/settings`, `/glossary/...` and `/dictionaries`. The former Settings links `/settings?view=preferences`, `/settings#dictionary-order` and `/settings?find=...` land on `/dictionaries`. Links inside definitions are `/define/<term>` (decorator.js and App.vue rely on it), so they open Define on that term directly.

App.vue uses `<keep-alive>` for all route components, keyed on the first path segment (every page has its own). This means pages are **not destroyed** when navigating away. Use the `activated()` lifecycle hook (not `mounted()`) for actions that should run each time a page becomes visible, and guard route watchers on the page's own path (`this.$route.path.startsWith('/define')`): a page kept alive still sees the other pages' routes.

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
- `DictionariesMenuMixin` - The dictionaries of the current results, as enabled and ordered on the Dictionaries page (TermEntry)
- `mixins/PaneWidthMixin` - the width of a pane whose divider was dragged (Define, Search, Reader)
- `mixins/ResultsFreshnessMixin` - Define's and Search's results searched again when dictionaries or packs changed while the page was away
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

- **Tibetan order** (by root letter, as dictionaries file them, not by code point): `src/services/tibetan-order.js` (Saved) and its Rust twin `src-tauri/src/tibetan_order.rs`, registered as SQLite's `TIBETAN` collation for the glossary (`ORDER BY term COLLATE TIBETAN`, so pages stay in order). `tests/fixtures/tibetan-order.json` holds both to one order: change them together
- `src/ui/UiTibetanField.vue` handles Wylie-to-Unicode conversion on space, tsheg, Enter, paste and drop, repairs legacy-font pastes and refuses a second tsheg; Define's field (`LookupField`) uses it (Search's field converts nothing), and `src/services/typed-wylie.js` keeps the "typed sangs rgyas" echo. The Reader's editor applies the same conversion to a multi-line text, where spaces are word breaks
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
| `src/ui/UiTibetanField.vue`           | Shared Tibetan input with Wylie conversion               |
| `src/utils.js`                        | Tibetan utilities (phonetics, tokenizer, trailing tshek) |

## Conventions

- **Vue Options API** throughout, no `<script setup>` or Composition API in components
- **Styles**: `src/ui` and new code use plain CSS (`<style>`, sometimes `scoped`) on the tokens; some older components still use `lang="stylus"`. Both are fine, do not convert for the sake of it. `src/css/reset.css` is the base reset of the main window (formerly Vuetify's); the quick lookup window does not load it
- **jQuery** is used in older code (App.vue event delegation, scroll management)
- **Underscore.js** for debounce, utility functions
- Keyboard shortcuts: `Cmd/Ctrl+D` (Define), `Cmd/Ctrl+S` (Search), `Cmd/Ctrl+K` (focus the field of Define, or of Search when it is open), `Cmd/Ctrl+E` (Reader), `Cmd/Ctrl+1`, `2`, `3` (Define, Search, Reader, read from `event.code` so AZERTY works), `Cmd/Ctrl+G` (Settings), `Cmd/Ctrl+[` and `]` (Back, Forward)
- Mobile breakpoint: `600px` (`window.innerWidth <= 600`)
- Theme: light/dark with system preference detection, stored as `themePreference` in localStorage and applied by `src/services/theme.js`; Text size is `fontSize` (a percentage of the root font size), so sizes in rem follow it

## Git style

- Use conjugated action verbs. For instance "Adds a new feature", "Fixes a bug with something".
