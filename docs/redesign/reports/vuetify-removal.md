# Phase 4: Vuetify removal

**Branch:** `claude/remove-vuetify-p4840x`, started from `redesign` at `a66066c`. Nothing pushed to `main` or `redesign`. No version bump, no tag, nothing in `public/packs/` or `src-tauri/` touched, `build:packs` / `build:database` not run.

## Result in one paragraph

Vuetify, `vite-plugin-vuetify` and `@mdi/font` are gone from `package.json`, the lockfile, the Vite config, the tests and the code. The main JS chunk halves (1,065 → 525 kB), the main CSS drops from 901 to 73 kB, and 3.6 MB of icon fonts leave the build. Every screen I could reach renders **pixel for pixel as before** in light and dark at 1280 and 390 px. The exceptions are deliberate and listed under "Visible changes". The screens had been built on top of Vuetify's CSS reset, and without it every page shifted (8 px body margin, wrong box sizing, button and input defaults). That reset is carried over as `src/css/reset.css`.

## Commits

| Commit | Subject |
| --- | --- |
| `ddef3c3` | fix(tests-page): makes the /tests developer page render again, without Vuetify |
| `a7a969f` | fix(theme): applies the stored dark theme at launch through theme.js |
| `146dfbe` | feat(app): shows the update toast above the first-launch screen and hides the app behind it from screen readers |
| `9110b70` | refactor: makes the app lighter by deleting the replaced TibetanTextField and DictionariesMenuHelpTab |
| `5732972` | feat(app): makes the app lighter by removing Vuetify |
| `885dd63` | fix(tests-page): makes the character diff of a failing example readable |
| `dd553b1` | refactor(icons): names the built-in pack icons with Lucide names |
| `58d91b9` | fix(theme): sharpens the dictionary chips in dark by deleting the Vuetify-era CSS |
| `d8f2db4` | docs(claude): describes the in-house UI instead of Vuetify |
| (this one) | docs(redesign): reports on the Vuetify removal and ticks Phase 4 |

## Tests, build, versions

- `pnpm test` before any change: **1,278 passed, 1 failed** (1,279). After the last code commit: **1,299 passed, 1 failed** (1,300). The failure in both runs is `tests/apkg-reader.test.js`, which needs the local `INALCO_L1_voca.apkg`. That file is not in this checkout.
- No test was skipped or deleted. Tests that installed Vuetify (`mixins`, `navigation-state`, `dictionary-catalog-component`, `search-page-decoration`, `legacy-paste-wiring`) now mount without it. `settings-page` used to mock `useTheme` and now checks `data-theme` on `<html>`. `legacy-paste-wiring` keeps all seven checks and now runs against `UiTibetanField`. The selection-popup test no longer looks for `.v-input`.
- New tests:
  - `tests/app.test.js` (12): the start-up overlay, the theme and text size at start-up, the toast (HTML content, Close, the update message, abbreviations), the first-launch screen with an inert shell, refreshing the terms when it is done, the toast's z-index above it, and no Vuetify markup.
  - `tests/tests-page.test.js` (7).
  - One more case each in `settings-page` and `theme`.
- `pnpm build`: passes (only the existing "chunks larger than 500 kB" warning).
- `pnpm check:tauri-versions`: all pairs aligned.

## Bundle sizes (`pnpm build`, the same build serves the desktop app and the web)

| | Before the redesign (owner's baseline) | `redesign` branch, before this phase | After this phase |
| --- | --- | --- | --- |
| Vuetify JS | 377 kB / 116 kB gz (own chunk) | inside `main` | **0** |
| Main JS chunk | 438 kB / 142 kB gz | 1,065 kB / 325 kB gz | **525 kB / 159 kB gz** |
| Vuetify / main CSS | 415 kB (Vuetify CSS) | 901 kB / 129 kB gz (`main.css`) | **73 kB / 12 kB gz** |
| Material Design Icons fonts | ~1.2 MB .ttf + .eot, .woff 574 kB, .woff2 394 kB | .ttf 1,308 kB, .eot 1,308 kB, .woff 588 kB, .woff2 403 kB (3.6 MB) | **0** |
| All JS | | 2,134 kB / 676 kB gz | **1,594 kB / 510 kB gz** |
| All CSS | | 951 kB / 140 kB gz | **120 kB / 22 kB gz** |
| All font files | | 4.8 MB | **1.2 MB** (DDC Uchen 862 kB, the UI fonts) |

The quick lookup window's chunks barely move. `quick-lookup.js` grows from 474 to 493 kB and `GlobalLookupWindow.js` shrinks from 37 to 18 kB, because Rollup regrouped shared code; together they stay at about 511 kB. The popup never loaded Vuetify.

On `redesign`, Vuetify had no chunk of its own. It sat inside `main`, which is why `main` measured 1,065 kB there against 438 kB before the redesign. The 525 kB now is the old 438 kB, plus the redesigned screens, `src/ui` and Reka UI, minus Vuetify.

## What was removed

- **Dependencies:** `vuetify`, `vite-plugin-vuetify`, `@mdi/font`. Also `jsdiff`: only the /tests page imported it, and it is a deep-equal helper, not the diff library the page expected (see below). `pnpm-lock.yaml` was regenerated with `pnpm remove`.
- **Config:** `src/plugins/vuetify.js` and the `plugins/` folder, `app.use(vuetify)` in `main.js`, the `vuetify({ autoImport: true })` plugin in `vite.config.mjs`, and the `deps.inline: ['vuetify']` setting in `vitest.config.mjs`. There was no `vuetify` manual chunk to remove.
- **Code:**
  - `TibetanTextField.vue`, replaced by `UiTibetanField`.
  - `DictionariesMenuHelpTab.vue`, replaced by `DictionariesMenuHelp`.
  - `ThemeMixin.js`: no component used it, so it was deleted instead of rewritten on `theme.js`.
  - The `import '@mdi/font/...'` line.
  - `App.vue`'s `useTheme` setup, watcher and `isDark`.
  - The `darkTheme` storage key, which only the Vuetify plugin read. It is no longer written.
- **CSS:**
  - `help-dialog.css` as a whole. None of its selectors matched anything: `.help-dialog`, `.v-toolbar`, `.v-tab`, `.v-card-text`, `.v-table`, `.v-alert`, `.keyboard-square`…
  - In `layout.css`: the `.v-overlay`, `.v-snackbar` (link colours), `.v-input`, `.v-card .v-progress-linear`, `.v-tooltip`, `.v-autocomplete`, `.v-tabs-items` and `.v-application` rules.
  - Also in `layout.css`, these unused helpers: `.flex-centered`, `.nowrap`, `.list-*`, `.text-center input`, `fieldset legend`.
  - In `tibetan.css`: the `.v-input.tibetan…` rules, `.tibetan .v-btn` and `.v-autocomplete`.
  - In `AppNav.vue`: two `.help-button .v-icon` rules.
  - About 20 of these rules were dark overrides (`.theme--dark …` and `.v-theme--dark …`). The few dark rules still needed now key on `[data-theme='dark']`: the audio player, the language labels the decorator writes into definitions, and the scrollbar colours. So `theme.js` no longer sets the legacy `theme--light|dark` class, which nothing reads any more.

## What replaced what

- **`App.vue`:**
  - `v-app` became a plain `<div class="app">`.
  - `v-overlay` + `v-img` + `v-progress-circular` became `.app-loading`: the same logo (100 px, `brightness(0.25)`, 32 px below), with `UiSpinner` sized and thinned to the old ring (192 px across, 10 px stroke, accent colour in light, ink in dark, a 12% track).
  - `v-snackbar` became `UiToast`, still driven by the injected `snackbar` (`open(html)`, `close()`).
- **First-launch screen:** the toast viewport is now `z-index: 10000`, above the first-launch screen's 9999, so "Update to vX ready!" shows during onboarding. The app shell gets `inert` while that screen is shown, so Tab and screen readers no longer reach the app behind it.
- **Theme:**
  - `App.vue` calls `initDocumentTheme()` at start-up.
  - The Appearance card calls `applyDocumentTheme(resolveTheme(...))` on a change.
  - `themePreference` (light, dark, system) and Text size work as before.
  - This also removes the path behind the Search report's "dark theme at load" note. On `redesign` it did switch in my runs, but it went through Vuetify's deprecated `theme.global.name`.
- **Base styles:** `src/css/reset.css` is Vuetify's reset (ress.css plus its `html` defaults) without the Internet Explorer and Edge Legacy fixes. `main.js` loads it first. The quick lookup window never had it and still does not load it.
- **`/tests` page:**
  - It was broken on `redesign` before this phase: blank, with `_(...).pluck(...).flatten is not a function`, and its diff view could never have worked.
  - It is now a plain table with the same total, groups, fold on click, re-run on click, and a small character diff (`diffChars` in `TestsPageGroupResultDiff.vue`).
  - It shows 10/11: `PhoneticSearch.splitSyllables("jomolari")` gives `jo mo lari`, not `jo mo la ri`. That failure is pre-existing and not touched.
- **Icons:**
  - The two `mdi-*` names left in the app's own code (`pack-definitions.js`, unused at runtime) are now `book-open` and `graduation-cap`.
  - **`MDI_ALIASES` in `src/ui/icons.js` is kept.** Custom pack manifests name their icon in MDI form: the Rust side gives every new glossary `mdi-notebook-edit-outline` (`src-tauri/src/lexicon.rs`), and `.tibdict` files already on users' disks do the same. `CustomPackSection.packIcon()` resolves them through the map.

## Visual check

**Method:**
- Screenshots of the web dev server (Chromium, Playwright), compared pixel by pixel.
- The "before" set is the `redesign` branch with Vuetify. The "after" set is this branch.
- Light and dark, 1280×820 and 390×844.
- Data: the real core pack, extracted from `public/packs/core.7z` into the scratchpad and symlinked as `public/TibetanTranslator.sqlite` (git-ignored). The symlink was removed before the build. Nothing was added to git.

**Identical (0 differing pixels):**
- Define (empty, and with a term), the Dictionaries menu (desktop and phone), the Define, Search and Split help dialogs.
- Search with results, Split (empty and split).
- Settings (full page), Dictionaries, My glossary.
- The first-launch screen, which I forced in the browser by setting `showOnboarding` on the root instance.
- The selection popup in light.
- The About dialog differs only by anti-aliasing noise (no pixel off by more than 24/255).

**Visible changes, all intended:**
1. **Toast:** it is now `UiToast`, the board's style: a dark ink card, underlined Close, and links in the text colour instead of Vuetify's grey bar, uppercase CLOSE and cyan links. The position (bottom, centred, over the phone's bottom bar) is the same.
2. **Toast during onboarding:** it is now visible above the first-launch screen. Before, it was hidden under it.
3. **Loading overlay:**
   - In light it matches: background `#FAF3E0`, logo, ring size and position, ring and track colours within 2/255.
   - In dark, the background is `--bg` darkened like Vuetify's 32% black scrim, giving `#14100E`. Before it was `#0C0C0C`, because Vuetify painted `#121212` under it.
   - The ring animates differently: a fixed quarter arc that turns, where Vuetify's arc grew and shrank.
4. **Dark dictionary chips** (Define, Search, Split, selection popup, quick lookup window): the grey `text-shadow` that blurred them is gone, as the quick-lookup report proposed.
5. **`/tests`:** it renders now; it was blank before.

**Not checked on screen:**
- The Tauri app on any platform, iOS and Android.
- The real first-launch flow: it is forced in the browser and needs modular packs.
- The quick lookup window itself. Its only CSS changes are the chip shadow and the removed `.v-` rules, and `tests/quick-lookup-window.test.js` passes.
- Add my definition, the scan viewer, the custom-pack conflict modal (Tauri only).
- Audio playback in definitions (its dark styles moved to `[data-theme='dark']`).
- Text size other than 100% on the loading overlay. The ring is pinned in px like the logo, so it does not grow with Text size.
- `color-mix()` on old Linux WebKitGTK: if it is unsupported, the dark loading background falls back to plain `--bg`.

## Leftovers kept on purpose

- **`MDI_ALIASES`** (above).
- **`UiIcon` reads its name from the default slot.** No caller uses this any more, but `tests/ui/plain-components.test.js` covers it and it costs nothing.
- **"Replaces `<v-…>`" comments** at the top of each `src/ui` component, and in `ui.css` and `intersect.js`. They record what each component maps from, which helps when reading old commits or reports.
- **"no Vuetify" assertions** in tests (`app`, `tests-page`, `onboarding-screen`, `quick-lookup-window`, `selection-popup`, `split-page`, `settings-page`). They are guards against regressions.
- **`font-family: "Roboto", sans-serif` on `<html>`** in `reset.css`. Roboto was never bundled, so this has always meant the system sans-serif. Every redesigned component sets `--font-ui` itself. It is kept so that nothing moves. See decision 1.
- **README credits** ("the people behind Vue.js, Vuetify, …"): your thanks, not code.
- **Older plans, specs and reports** under `docs/` mention Vuetify as history; not edited.

## Found but not mine to remove (not Vuetify)

- `src/components/DropZone.vue` is referenced nowhere. It pulls in the `filedrop` dependency.
- The `sass` devDependency: no `.scss` or `.sass` file and no `lang="sass"` block is left in `src/`. It may be removable.
- `vue.config.js` is a Vue CLI / webpack config that the Vite build ignores.
- `src/background.js`, from the Electron era, was not checked.

## Decisions for the owner

1. **Base font.** Text that sets no font falls back to `Roboto, sans-serif` (in practice the system sans), as under Vuetify. Phase 5 could switch `reset.css` to `var(--font-ui)`. That would be a visible change wherever a component forgot to set its font (for example the `/tests` page, which I set explicitly).
2. **The toast's look** is now the board's, not Vuetify's (Visible changes 1). Links in a toast are underlined in the toast's text colour, no longer cyan.
3. **Dark loading background** `#14100E` vs `#0C0C0C`, and the different spinner motion (Visible changes 3).
4. **`mdi-school-outline`** (the INALCO pack config in `build/inalco.tibdict-config.json`) has no alias, so that pack shows the `book-plus` fallback icon. This predates this phase. Adding `'mdi-school-outline': 'graduation-cap'` would change what users see, so I left it.
5. **System theme changes.** With the theme set to "system", a change of the OS theme is picked up only once Settings has been opened, because the Appearance card holds the listener (`App.vue` never had one). This predates this phase; Phase 5 could move the listener to `App.vue`.
6. **`/tests` shows one failing example** (`jomolari`). It may be a wrong expectation or a real bug in `splitSyllables`.
