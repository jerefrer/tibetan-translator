# Define screen: redesign report

- **Branch:** `claude/redesign-define-g9hdo6`, from `redesign` at `9b6e398`. You asked for `redesign-define`; this session was set up to develop and push on `claude/redesign-define-g9hdo6`, so the work is there and I did not create `redesign-define`. Rename it when you merge if you prefer. Nothing was pushed to `main` or `redesign`.
- **Status:** done, ready for review. No PR opened.

## Commits

| Commit | Subject |
| --- | --- |
| `50d0eb7` | docs(define): lists every behaviour of the old Define screen before its rebuild |
| `118f754` | feat(define): redraws definitions in the new style, the dictionary chip opening an About dialog |
| `0148909` | feat(define): redraws the scan viewer on a dark page with the dictionary name in its title |
| `5b7963b` | feat(define): redraws the Dictionaries menu, and lets Up/Down and Space pick a dictionary from the keyboard |
| `4567dd3` | feat(define): redraws the search-instead hint as a card and the packs notice in amber |
| `bd7a92b` | feat(define): rebuilds the Define screen in the new design, with a phone layout |
| `5180685` | feat(define): redraws Add my definition in the new style and focuses the definition when it opens |
| `e7b52d4` | feat(define): redraws the Define help in the new style and documents Space in the Dictionaries menu |
| `2e320cb` | fix(define): drops the trailing space from the word offered to Search |
| (this file) | docs(define): reports on the Define rebuild |

Every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Test results

`pnpm test` before each push: **1,018 passed, 1 failed** (57 files; 111 more tests than the baseline). The failure is `tests/apkg-reader.test.js`, which needs the local `INALCO_L1_voca.apkg` that is not in this checkout; it failed the same way on the untouched baseline (907 passed, 1 failed). `pnpm build` succeeds.

New or rewritten test files:

- `tests/define-page.test.js` (new, 32 tests): mounts the page the way `App.vue` does (real router, `<keep-alive>` around `<router-view>`) and covers the route, the guards, `activated()`, `all-terms-updated`, the field, Up/Down, clear, the terms list and its infinite scroll, "No results.", the Dictionaries menu in the header, entries order and filtering, scanned rows, loading, Copy all, Add my definition, the absence of a headword audio button, and the phone flow.
- `tests/define-entries.test.js` (new, 19): entry rows (the `definition` class App.vue listens on, decorator audio players kept, copy, about, scanned rows, the popup without a snackbar), the batch-on-scroll in `Entries.vue`, the About dialog.
- `tests/scan-viewer.test.js` (new, 11): title, "approximate", loading, error and Retry, previous/next and their limits, zoom limits and reset, keyboard, swipe, close.
- `tests/dictionaries-menu.test.js` (new, 23): button count and highlight, click, switch, Ctrl/Cmd+click, long press, fuzzy filter, all/none/restore, every keyboard shortcut, keep-alive (de)registration, and `DictionariesMenuMixin`.
- `tests/typed-wylie.test.js` (new, 11): the "typed ye shes" echo.
- `tests/define-help.test.js` (new, 6): the help button and its tabs on desktop app, web and phone.
- `tests/define-page-hints.test.js` (rewritten off Vuetify, 3 tests added): search-instead hint and packs notice on the page.
- `tests/quick-add-dialog.test.js` (rewritten off Vuetify: `.v-input` became `.ui-field`; 6 tests added). No test was skipped or deleted.

## Behaviours of the old screen

This list was written (commit `50d0eb7`) before any code changed, by reading `DefinePage.vue` and every component it uses. Its outcome is in the checklist below.

### Route and page lifecycle

- D1. Route `/define/:term?`: the selected term is the route parameter.
- D2. Opening `/define` with no term goes to the last selected term (`selectedTerm` in storage).
- D3. Each route change stores the selected term and scrolls the window to the top.
- D4. `<keep-alive>`: the page keeps its state when you leave it; `activated()` focuses the field each time the page is shown.
- D5. The field has `autofocus`.
- D6. Listens to `all-terms-updated` (pack installed or removed) and recomputes the term list; removes the listener on unmount.
- D7. Cmd/Ctrl+D opens Define (App-level shortcut, `config/navigation.js`).

### Search field (`TibetanTextField`)

- F1. Wylie is converted to Tibetan when a space, a tsheg or Enter is typed, on Ctrl+V and on drop.
- F2. A second trailing tsheg is refused; spaces an Android keyboard adds after Tibetan punctuation are removed; double spaces collapse.
- F3. Text pasted in a pre-Unicode Tibetan font is repaired; a pasted block of several lines is not inserted (Define does not listen to `paste:multiple`).
- F4. Placeholder "Type a Tibetan term"; `enterkeyhint="search"`; spellcheck, autocomplete, autocorrect off.
- F5. Clear button: empties the field, forgets the stored term, clears the definitions, goes to `/define`.
- F6. Up/Down in the field select the previous/next term of the whole filtered list (not only the rendered part), via the route; the rendered count grows so the selected term is in the list.
- F7. On a phone, focusing the field goes back to the terms list.

### Terms drawer

- T1. Lists every term starting with what was typed, sorted, from `SqlDatabase.allTerms`.
- T2. Typing selects the first term after a 500 ms debounce (route push), or clears the definitions when nothing matches. When the route already holds that term, the definitions are loaded anyway.
- T3. Typing resets the rendered count to 100 and clears definitions that belong to a term no longer in the list.
- T4. Selecting a term keeps the typed prefix in the field when the term contains it; otherwise the field takes the term.
- T5. "Showing N of M terms" when there is at least one term.
- T6. Infinite scroll: 100 terms per batch, a sentinel with a spinner while more remain (observer rooted on the list, 100 px margin).
- T7. Dictionaries menu in the drawer header (dictionaries that have entries for the selected term). Closing it focuses the field.
- T8. Clicking a term selects it; the selected term is highlighted.
- T9. `updated()` tried to scroll the selected term into view, but its selector (`td.active`) matches nothing since the list became `div`s: it is dead code today.
- T10. "No results." when something is typed and no term matches.
- T11. Search-instead hint when the typed text carries Latin diacritics (Sanskrit, transliterated English): it keeps the text as typed (the field turns it into Tibetan), disappears when the field is emptied, and its button opens `/search/<text as typed>`. Plain Wylie never shows it.
- T12. Uninstalled-packs notice when something is typed, fewer than 3 terms match, the platform has optional packs, the pack manager is ready and some packs are missing: "N packs were not searched", the list of packs with their dictionary count, and a button to `/dictionaries?status=available`.

### Definitions pane

- P1. Copy all: copies the term and every non-scanned definition of the enabled dictionaries (`CopyService.entriesToText`); "Copied" or "Copy failed" in the snackbar. Hidden while loading or when there is nothing to copy.
- P2. Add my definition (book-plus icon with a tooltip): only on platforms with modular packs and when a term is selected; opens `QuickAddDialog` with the term; after a save the lookup runs again so the new definition shows. The dialog is mounted at page level so it survives the loading state.
- P3. Loading state: spinner and "Loading definitions..." while the entries load; the old entries are cleared at once when the term changes.
- P4. Entries of the enabled dictionaries only, sorted by the dictionary order from Settings.
- P5. 25 entries rendered first, 10 more each time the last one comes into view.
- P6. The dictionaries menu choice is per lookup: each new lookup resets every dictionary to its Settings state. Coming back to the page reloads the Settings state (`activated()` in the mixin).

### Entry (`EntriesEntry.vue`, shared with Split and both lookup popups)

- E1. Dictionary chip with the short label (Tibetan wrapped in spans); a click shows the dictionary's "about" (title in bold, links made clickable) in the snackbar.
- E2. Per-entry copy button (not on scanned entries): copies the entry; the icon turns into a green check for 1.2 s; snackbar "Copied" or "Copy failed".
- E3. The definition is decorated (`Decorator.decorate`) and rendered as HTML in an element with class `definition`. App-level listeners rely on that class: abbreviations open their expansion in the snackbar, links to `/define/...` navigate in the app. Audio players embedded by the decorator play through `AudioPlayerService`. There is no headword audio button.
- E4. Scanned dictionaries: "Page N" with "(approximate)" when the stored page carries a `?`, and a View Scan button opening the scan viewer at that page.

### Scan viewer (`ScanViewer.vue`, shared with Search)

- S1. Full-screen; opens at the entry's page (or the first page); title "Page N" with the dictionary's display offset applied.
- S2. Previous/Next, disabled at the first and last page; Left/Right arrows; swipe left/right on touch when not zoomed.
- S3. Zoom out/in by ×1.5 between 100 % and 400 %, percentage shown (hidden on a phone); keys `+`/`=`, `-`, `0`; pinch to zoom; zoom resets on page change.
- S4. Escape and the close button close it.
- S5. Spinner while loading, error message with Retry, 30 s timeout; remote URLs get a cache buster; Tauri serves downloaded scans as data URLs.
- S6. Safe-area insets (notch, home bar); a fixed 24 px top offset on Android.

### Dictionaries menu (`ResultsAndPaginationAndDictionaries.vue` + `DictionariesMenuMixin`, shared with Search and Split)

- M1. Button showing enabled/total, highlighted when the choice differs from Settings; hidden when there are no results.
- M2. Filter field, focused when the menu opens; fuzzy match on the short label with the matched letters underlined; "No matching dictionary".
- M3. Enable all / Enable none (of the listed dictionaries), Restore preferences.
- M4. A click or the switch toggles a dictionary; Ctrl/Cmd+click, or a long press (500 ms) on touch, keeps only that one and closes the menu after 500 ms.
- M5. Keyboard: Ctrl/Cmd+B opens it (only with results); Escape closes; Enter keeps only the listed dictionaries and closes; Ctrl or Shift + Enter/A/N/R do "only listed" / all / none / restore. Up/Down and Space were meant to move and toggle a highlighted row, but relied on a Vuetify 2 class (`v-list-item--highlighted`) that Vuetify 3 never sets.
- M6. Emits `close:dictionariesMenu` when it closes; the keyboard handler is registered on mount and activation and removed on deactivation and unmount.
- M7. Props `page`, `loading`, `numberOfEntriesPerPage`, `hidePagination` and event `change:page` drive a paginator; every current caller passes `hidePagination`.

### Add my definition (`QuickAddDialog.vue`, shared with Search)

- Q1. Title "Add my definition", or "Create a dictionary" when the user has none; "Saving to X" when there is a single target.
- Q2. Target picker when there are several dictionaries; the last target is remembered (`lastLexiconTarget`).
- Q3. Tibetan term field prefilled with the term; definition field focused.
- Q4. Debounced (250 ms) exact-match lookup of the term in the target: prefills the existing definition and warns that saving replaces it; Save cancels the debounce and re-checks first.
- Q5. "A definition is required." under the definition, "A Tibetan term is required." under the term; save errors through `messageForError`.
- Q6. Snackbar "Added to your dictionary" / "Your definition was updated" / "<name> created"; emits `saved`; resets its state on each opening.

### Help (`DefinePageHelpDialogWithButton.vue`)

- H1. A help button in the navigation rail (only on Define) opening a dialog with tabs: Dictionaries filter (how the menu works, its shortcuts), Quick Lookup (desktop app only, with a demo video and the hotkeys), Navigation (not on a phone: Up/Down, Cmd/Ctrl+D/S/T/G).

### Everywhere

- X1. Light and dark theme.
- X2. Text size setting (root font size).
- X3. Phone (≤ 600 px): terms list first, definitions after a tap.

## Checklist: kept, changed, dropped

Legend: ✅ kept as it was · 🔄 kept, with a difference explained · ➕ added · ❌ dropped (none).

### Route and lifecycle
- ✅ D1 Route `/define/:term?`.
- ✅ D2 `/define` goes back to the stored term.
- ✅ D3 Stores the term on each route change; scrolls the window to the top (`window.scrollTo` instead of jQuery).
- ✅ D4 Keep-alive; `activated()` focuses the field (tested with a real `<keep-alive>`).
- ✅ D5 `autofocus`.
- ✅ D6 `all-terms-updated` listener added and removed.
- ✅ D7 Cmd/Ctrl+D (App level, untouched).

### Search field (now `UiTibetanField`)
- ✅ F1 Wylie conversion on space, tsheg, Enter, Ctrl+V and drop.
- ✅ F2 Double tsheg refused, Android spaces removed, double spaces collapsed.
- ✅ F3 Legacy-font paste repaired; a multi-line paste is still not inserted.
- ✅ F4 Placeholder "Type a Tibetan term", `enterkeyhint="search"`, spellcheck/autocorrect off. Added `aria-label="Term to define"`.
- ✅ F5 Clear button: empties the field, forgets the stored term, clears definitions, goes to `/define`.
- 🔄 F6 Up/Down: same selection through the whole list. Difference: they no longer move the caret to the start/end of the field (`preventDefault`).
- ✅ F7 On a phone, focusing the field shows the terms.
- ➕ "typed ye shes": the field echoes the Wylie you typed, as on the board (desktop only, as on the boards). It is forgotten as soon as it can no longer be told from the field (a paste, an edit in the middle, a term picked from the list). Logic in `src/services/typed-wylie.js`.

### Terms
- ✅ T1 Prefix list, sorted.
- ✅ T2 First term selected after 500 ms; definitions loaded even when the route already holds that term.
- ✅ T3 Rendered count reset to 100; stale definitions cleared.
- ✅ T4 The typed prefix stays in the field when a longer term is picked.
- ✅ T5 "Showing N of M terms".
- ✅ T6 Infinite scroll, 100 per batch, spinner on the sentinel.
- 🔄 T7 Dictionaries menu in the terms header; closing it focuses the field. Redrawn (see M1–M7).
- ✅ T8 Click selects; selected term highlighted (accent background, as on the board).
- 🔄 T9 The dead `td.active` scroll is replaced by one that works: the selected term is scrolled into view (nearest edge) when it changes, so Up/Down past the visible part of the list now follow.
- ✅ T10 "No results." (now a card, as on the Empty board).
- 🔄 T11 Search-instead hint: same trigger (Latin diacritics only; plain Wylie never shows it), same button target. Differences: (a) wording "Looking for a Sanskrit or English word? / Define reads what you type as Tibetan." from the Empty board; (b) it now sits under the list/"No results." as on the board, it was above the list; (c) a word the field could only half convert (`kākiṇī` → `ཀཱཀིṇī་`) is now offered as typed, the old code offered the half-converted text; (d) the trailing space that triggered the conversion is no longer carried into Search.
- 🔄 T12 Packs notice: same trigger, heading and list of packs, same target. Differences: amber dashed style from the board, button reads "See packs" (was "Browse and install").

### Definitions
- ✅ P1 Copy all (scanned entries excluded, snackbar messages unchanged).
- ✅ P2 Add my definition: same conditions, tooltip, re-lookup after save, dialog mounted at page level.
- ✅ P3 Loading state with "Loading definitions...".
- ✅ P4 Enabled dictionaries only, Settings order.
- ✅ P5 25 first, then 10 more as the last entry comes into view. Small difference: the old row also asked for more when the last entry *left* the view; now only when it enters.
- ✅ P6 Menu choice reset on each lookup; Settings state reloaded on `activated()`.

### Entry
- 🔄 E1 Chip with the short label. Difference: a click opens an **About dialog** (title, description lines with links, language direction and subject tags, Close) instead of the snackbar, as you asked and as drawn on the Dialogs board. A dictionary without details (your own) shows "No description for this dictionary."
- ✅ E2 Per-entry copy with the check for 1.2 s and the snackbar. It no longer throws in the quick lookup popup, which provides no snackbar (it copies silently there).
- ✅ E3 Decorated definition in an element with class `definition`; abbreviations, `/define/` links and decorator audio players work. No headword audio button (tested). 🔄 Tibetan links inside definitions are drawn in the accent colour instead of browser blue.
- ✅ E4 "Page N (approximate)" and View scan.

### Scan viewer
- 🔄 S1 Opens at the page; title is now "Jäschke · Page 479" (dictionary name added, from the board) with "approximate" beside it while on the page the entry pointed to.
- 🔄 S2 Previous/Next beside the page on a desktop (board), under it on a phone; same limits, arrows, swipe.
- ✅ S3 Zoom ×1.5 between 100 % and 400 %, keys, pinch, reset on page change; percentage hidden on a phone.
- ✅ S4 Escape (now handled by the dialog) and the close button.
- ✅ S5 Spinner, error with Retry, 30 s timeout, cache buster, local scans in Tauri.
- ✅ S6 Safe-area insets; 24 px Android offset.
- 🔄 Colour: a fixed dark surface (`#1b1512`, the board's) in both themes instead of the red toolbar and footer.

### Dictionaries menu (shared with Search and Split)
- 🔄 M1 Button reads "Dictionaries · 16", or "Dictionaries · 12/16" when some are off; turns accent when the choice differs from Settings; hidden without results.
- ✅ M2 Filter focused on open, fuzzy match underlined, "No matching dictionary".
- ✅ M3 Enable all / none, Restore preferences.
- ✅ M4 Click and switch toggle; Ctrl/Cmd+click and long press keep only one and close after 500 ms.
- 🔄 M5 Every shortcut kept (Ctrl/Cmd+B, Escape, Enter, Ctrl/Shift + Enter/A/N/R). Up/Down/Space/Enter on a highlighted row, documented in the help but broken since Vuetify 3, now work; Space is added to the help.
- ✅ M6 `close:dictionariesMenu`; handler registered on mount/activation, removed on deactivation/unmount.
- ✅ M7 Props and `change:page` kept; the paginator is now `UiPagination` (no caller uses it).

### Add my definition (shared with Search)
- ✅ Q1–Q6 Same titles, "Saving to X", picker and remembered target, prefilled term, debounced exact-match check and its warning, validation messages under the right field, snackbar messages, `saved`.
- 🔄 The definition field gets the focus when the dialog opens (the old `autofocus` did that through Vuetify).
- ➕ Enter in "Dictionary name" creates the dictionary.

### Help
- 🔄 H1 Same tabs and content, redrawn with `UiDialog` and `UiTabs`, keys drawn as keycaps. The button is yellow in the rail and floats above the phone bar (styles in `DefinePageHelpDialogWithButton.vue`). The dictionaries part is a new Vuetify-free `DictionariesMenuHelp.vue`; `DictionariesMenuHelpTab.vue` is untouched because the Search and Split help still mount it inside Vuetify tabs.

### Everywhere
- ✅ X1 Light and dark (all colours from the tokens; checked on screen).
- ✅ X2 Text size: sizes are in rem; checked at 125 %.
- ✅ X3 Phone: terms first, then the definitions with a "‹ Terms" link, the term in large Tibetan, Copy all and Add my definition at the top, one card per entry (phone boards).

## Decisions for you to check

1. **About dialog instead of the snackbar** for the dictionary chip. It shows the language direction and subject tags as chips, like the Dialogs board; it does not show the pack name (the catalog's About does).
2. **"typed ye shes"** is new. It only shows while the field holds exactly what was converted from your typing.
3. **Search-instead hint wording and position** (T11) and **"See packs"** (T12). The board's "12 more entries are in packs you have not installed" was not used: the app cannot count entries in packs it does not have (the README calls that number illustrative), so the heading stays "N packs were not searched" with the list of packs.
4. **The Dictionaries button count** shows enabled/total only when some are off. The board shows a single number.
5. **The Dictionaries menu opens aligned to the button's right edge.** On Define that makes it extend left over the rail; align-start would cover the definitions instead. Kept "end" because it suits Search and Split, where the button sits at the right.
6. **Scan viewer stays dark in the light theme**, as on the board.
7. **No fade at the bottom of the two cards.** The boards draw one to suggest more content; on a real scrolling list it would hide the last row, so I left it out.
8. **Pre-existing, not changed:** the entry row shows the stored page while the viewer shows it with the dictionary's display offset (Jäschke: the row says "Page 505", the viewer "Page 479"). Both boards show the same number; I did not change either side because I do not know which one users rely on.
9. **Pre-existing, not changed:** for 500 ms after the page opens, a click on another term can be undone by the delayed "select the first term" of the initial load. Same as before.

## What I checked, and what I could not

- **Web dev server, real data:** no dictionary database was in the checkout, so I extracted `public/packs/core.7z` (read only) into `public/TibetanTranslator.sqlite`, which `.gitignore` already excludes; nothing under `public/packs/` changed. That is the core pack only (35 dictionaries).
- **Looked at in the browser (Chromium, screenshots):** desktop 1440×900 light and dark; Empty state with the search-instead hint; the Dictionaries menu open; the About dialog; the scan viewer with a real Chandra Das page; phone 390×844 terms list, entries (light and dark), scan viewer, empty state; the help dialog (desktop light, desktop dark Navigation tab, phone); the "Create a dictionary" state of Add my definition; Define at 125 % text size; Search and Split still running with the new menu and entry rows.
- **Not checked on screen:** the uninstalled-packs notice and the Add my definition button (both only exist in the Tauri app, where packs are optional; covered by tests); the Add my definition form with existing dictionaries (needs the Tauri lexicon commands; covered by tests); the Quick Lookup help tab and its video (Tauri only); the quick lookup popup window (`popup.html`), which also renders `Entries.vue`; Search's own scan viewer (no scanned row came up in my searches); the Tauri desktop app, iOS and Android; real touch gestures (swipe, pinch, long press are covered by tests only); audio playback inside a definition (the decorator markup is kept and tested, not played).

## Changes outside the files I own

- **New files:** `src/components/DictionaryAboutDialog.vue`, `src/components/DictionariesMenuHelp.vue`, `src/services/typed-wylie.js` and the new test files listed above.
- **Shared components whose look changed for other screens** (props and events unchanged): `Entries.vue`/`EntriesEntry.vue` are also used by Split, `SelectedTibetanEntriesPopup.vue` and the quick lookup popup; `ResultsAndPaginationAndDictionaries.vue`, `ScanViewer.vue`, `QuickAddDialog.vue` and `UninstalledPacksNotice.vue` by Search. Search and Split run unchanged (screenshots), but their rows now sit in the new style inside the old pages until those are rebuilt.
- **Nothing edited** in `SearchPage.vue`, `SegmentPage.vue`, `TibetanTextField.vue`, `DictionariesMenuHelpTab.vue`, `src/ui/`, `AppNav.vue`, `App.vue` or the tokens.
- **For the shell owner:** `AppNav.vue` still styles `.help-button .v-icon`; the Define button no longer has a `v-icon`, so it carries its own colours. Those `AppNav` rules can go once Search and Split help are rebuilt.
- **For whoever owns `src/services/storage.js`:** `Storage.set` writes `localStorage[key]` as a property, which the test setup's `localStorage.clear()` does not reset, so values leak between tests. The new tests delete what they use; worth fixing in the setup or in `Storage`.
