# Quick lookup window: redesign report

- **Branch:** `claude/redesign-quicklookup-8qp4fm`, from `redesign` at `24a6a58`. Nothing was pushed to `main` or `redesign`.
- **Status:** done, ready for review. No PR opened.

## Commits

| Commit | Subject |
| --- | --- |
| `ae82110` | docs(quicklookup): lists every behaviour of the old quick lookup window before its rebuild |
| `ca2a396` | feat(quicklookup): rebuilds the quick lookup window in the new design, with the term in large Tibetan and only the enabled dictionaries |
| `e19a41d` | feat(quicklookup): redraws the selection popup in the new style, with only the enabled dictionaries |
| (this file) | docs(quicklookup): reports on the quick lookup rebuild |

Every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Test results

`pnpm test` before the push: **1,237 passed, 1 failed** (66 files; 82 more tests than the baseline of 1,155 passed / 1 failed on this branch). The failure is `tests/apkg-reader.test.js`, which needs the local `INALCO_L1_voca.apkg` that is not in this checkout; it failed the same way before any change. `pnpm build` succeeds (`popup.html` builds; the popup chunk no longer pulls Vuetify or the Material Design Icons font).

No existing test covered the popup or the selection popup, so none was rewritten; none was skipped or deleted. New test files:

- `tests/quick-lookup-window.test.js` (44 tests): mounts `GlobalLookupWindow.vue` with the Tauri API mocked (commands, clipboard, events, window) and the real `Entries.vue`, decorator, Wylie converter and `src/ui`. One test or more per behaviour ID below: start-up and the spinner, outside Tauri, the panel command on mount, every clipboard case (empty, legacy font, Tibetan, Wylie, other text), the title, Tab and the mode buttons, the mode memory, Wylie typed in the field, the 150 ms search, the terms list and its batches, Up/Down and clicks, a slow answer for an earlier term, enabled dictionaries and their order, the database fallback, every empty and no-result state, the hotkey shown in the empty state, the search-instead button, sorting, highlighting, the result batches, the packs notice, copy with its toast, the About dialog and Escape over it, `/define/` links and abbreviations, Escape, the close button and its fallback, dragging, `panel-shown`, the focus fallback, and the clean-up.
- `tests/quick-lookup.test.js` (20): the pure logic in `src/services/quick-lookup.js`.
- `tests/popup-appearance.test.js` (6): theme and Text size applied, and re-applied on a Settings change or a system theme change.
- `tests/selection-popup.test.js` (12): the selection popup (P1–P6 below).

## Behaviours of the old screen

This list was written before any code changed, by reading `GlobalLookupWindow.vue`, `SelectedTibetanEntriesPopup.vue`, `src/popup.js`, `popup.html`, and what they use: `Entries.vue`/`EntriesEntry.vue` (already rebuilt for Define), `DictionariesDetailsMixin`, `TibetanTextField`, `src/services/theme.js`, `src/services/global-lookup.js` (the hotkey side, in the main window), the popup window in `src-tauri/tauri.conf.json` and the panel commands in `src-tauri/src/main.rs`.

### Window, hotkey and clipboard (`global-lookup.js`, `main.rs`, `tauri.conf.json`)

- W1. The hotkey (default Cmd/Ctrl+Shift+C, set in Settings) is registered by the main window. On press it reads the clipboard; if the clipboard holds text, it places the popup in the upper third of the current monitor, centred, and shows it with `show_lookup_panel`. The hotkey does not copy the selection itself: the user copies first.
- W2. The popup is a pre-declared window `global-lookup-popup` (`popup.html`): 650×500, minimum 450×300, resizable, no decorations, always on top, not in the taskbar, shadow, hidden at start, on every workspace. (The fallback window created by `global-lookup.js` if it is missing is 650×500, not resizable.)
- W3. macOS: on mount the popup calls `configure_window_for_fullscreen`, which turns it into an NSPanel: floating level, non-activating (it does not steal focus from the app you copied from), resizable, shown over full-screen apps and on all spaces, and **hidden as soon as it loses key status** (a click outside closes it). Other platforms: the command is a no-op.
- W4. `show_lookup_panel` makes the panel key (keyboard goes to it) and emits `panel-shown`. On `panel-shown` the popup re-reads the clipboard at once, then refreshes the term list (`pack_get_all_terms`) in the background so a pack installed meanwhile is seen.
- W5. The popup also re-reads the clipboard each time its window gains focus (fallback for `panel-shown`).
- W6. Close: `hide_lookup_panel` (NSPanel `orderOut`, so the previous app keeps the focus); if that fails, the window is hidden. The window is never destroyed, so its state survives between lookups.
- W7. A 14 px drag bar at the top moves the window (`startDragging`, since `data-tauri-drag-region` was unreliable).
- W8. Desktop only: `popup.js` redirects to `/` on a phone.

### Start-up (`popup.js`, `created`)

- S1. Theme: `popup.js` applies the stored preference with `initDocumentTheme()` (the same `theme.js` as the main window: `data-theme` and `theme--*` on `<html>`); the component also sets Vuetify's theme from it. `popup.html` paints the background before the script runs (white or `#1e1e1e`). The theme is read once per page load: a change in Settings shows in the popup only after a restart.
- S2. Text size: **not applied**. The popup ignores the "Text size" setting (the main window sets the root font size from `fontSize`; the popup never does).
- S3. A spinner while the term list loads (after a 100 ms wait). Outside Tauri (a browser), it logs "Tauri not available" and shows the empty state.
- S4. The term list comes from `pack_get_all_terms` (every installed pack), then the clipboard is read.

### Reading the clipboard

- C1. Empty or blank clipboard: nothing changes.
- C2. Text in a pre-Unicode Tibetan font is repaired from the text alone (`mayNeedLegacyRepair` / `convertLegacyPaste`).
- C3. Text with Tibetan characters: Define mode, the field gets the lookup key (`tibetanLookupKey`: non-Tibetan stripped, trailing punctuation turned into one tsheg).
- C4. Text without Tibetan: converted from Wylie; if the result is Tibetan and some term starts with it, Define mode with the converted text. Otherwise (English, Sanskrit, a sentence) Search mode with the raw text.
- C5. The last Define value of the session is remembered (`lastDefineTerm`), and forgotten when the clipboard lands in Search.

### Modes and field

- M1. Two tabs, Define and Search (icons, 32 px). Tab toggles the mode from anywhere in the window.
- M2. Define → Search keeps the text. Search → Define keeps Tibetan text; Latin text is replaced by the last Define value (re-converting `kind` would give `ཀིནད་`).
- M3. Define field: `TibetanTextField` (Wylie converted on space, tsheg, Enter, Ctrl+V and drop; legacy paste repaired), placeholder "Type or paste Tibetan", autofocus.
- M4. Search field: plain text field with a magnifier, placeholder "Search across definitions", autofocus.
- M5. A close button (×) beside the field.

### Define mode

- D1. Left panel (40 %, 150–250 px): "N terms", every term starting with the field's text, sorted; 50 at first, "Load more..." for 50 more.
- D2. Typing resets the list and selects the first term at once (no debounce); a selected term no longer in the list is cleared.
- D3. Click a term or Up/Down (anywhere in the window) to select; the selected term is highlighted and scrolled into view.
- D4. Selecting a term loads its entries with `pack_get_entries_for_term` (every installed pack); if that fails, `SqlDatabase.getEntriesFor`. Entries are sorted by the dictionary order from Settings. **Disabled dictionaries are not filtered out**: the popup shows entries from every dictionary, including the ones turned off in Settings.
- D5. Right panel: spinner while loading; the entries (`Entries.vue`, the shared rows); "No definitions for "X"" when the term has none; "Select a term" when nothing is selected.
- D6. Left panel states: "No terms found" when nothing matches; "Copy text to look up" when the field is empty.

### Search mode

- R1. Full-text search over terms and definitions (`pack_search_entries`, type `definition`), debounced 150 ms; spinner while the first results load.
- R2. Sort: terms starting with the query first, then shorter terms, then dictionary position.
- R3. "N results", then rows: the term (Tibetan) and the dictionary chip plus the decorated definition; the query is highlighted in both (yellow mark; underline in Tibetan), apostrophes `'` and `’` match each other, HTML tags are left alone.
- R4. 20 rows at first, "Load more..." for 20 more.
- R5. "No results" when nothing matches; "Type to search" when empty.

### Entries (shared `EntriesEntry.vue`, as rebuilt for Define)

- E1. Dictionary chip (short label); a click opens the About dialog.
- E2. Copy button per entry; the icon turns into a check for 1.2 s. The popup provides no snackbar, so no "Copied" message.
- E3. Decorated definition with class `definition`. Abbreviations: the main window opens their expansion on click; **the popup has no handler** (nothing happens). Links to `/define/…` inside a definition: **the popup has no handler**, so the browser follows the link and the popup window navigates away from `popup.html`.
- E4. Audio players embedded by the decorator: the popup carries its own copy of the audio player code (play/pause, seek by click/drag/touch).
- E5. Scanned dictionaries: "Page N (approximate)" and View scan (scan viewer).
- E6. 10 entries first, 10 more as the last comes into view (`Entries.vue`).

### Not in the old popup

- N1. **No notice for packs not installed.** The board's footer has one ("12 more entries in packs you have not installed").
- N2. No headword display, no pronunciation, no "Open in Define".

### Keyboard footer

- K1. "Esc close · Tab toggle mode · ↑↓ navigate terms".
- K2. Escape closes the popup (from anywhere in the window).

### Selection popup in the main window (`SelectedTibetanEntriesPopup.vue`, mounted by `App.vue`)

- P1. Selecting text in the main window opens, after 1 s without change, a floating card (min(90vw, 640 px) × 45vh) with the entries of the selected Tibetan.
- P2. Only when the selection is mostly Tibetan (at most 15 runs of non-Tibetan text: the check counts runs, not characters), not inside an input (it checks `.v-input`, which no rebuilt screen has any more), not on Split (`.segment-page`), and not the whole text of an element `.term` (no rebuilt screen has one any more). Non-Tibetan characters and leading punctuation are stripped; the lookup adds a trailing tsheg.
- P3. Placed beside the selection: right of where it started on the left half of the window, left of it on the right half; below it on the upper half, above it on the lower half.
- P4. Spinner while loading, then the entries (`Entries.vue`, every dictionary, the order from the database), or "No entries.".
- P5. Any new selection change or a scroll hides it. It overwrites `document.onmousemove`, `onselectstart`, `onselectionchange` and `window.onscroll`.
- P6. Vuetify card (grey in light, default in dark) with fade transitions.

## Checklist: kept, changed, dropped

Legend: ✅ kept as it was · 🔄 kept, with a difference explained · ➕ added · ❌ dropped or not added (with the reason).

### Window, hotkey and clipboard
- ✅ W1 Hotkey, clipboard read and placement: untouched (`global-lookup.js` is the main window's).
- ✅ W2 Window 650×500, minimum 450×300, no decorations, always on top: untouched (see decision 7).
- ✅ W3 `configure_window_for_fullscreen` on mount (NSPanel on macOS). Tested that it is called; the panel itself is Rust, untouched.
- 🔄 W4 `panel-shown` still re-reads the clipboard at once and refreshes the term list in the background. It now also re-reads the Settings the main window may have changed (dictionaries on/off and order, theme, Text size, hotkey), refreshes the installed packs and puts the focus in the field.
- 🔄 W5 Regaining the focus re-reads the clipboard **only if it changed** since the last read. Before, every return to the window replaced what you had typed with the clipboard again.
- ✅ W6 Close with `hide_lookup_panel`, window hide as fallback; the window is never destroyed.
- 🔄 W7 The whole bar drags the window (the board has no separate drag strip), except its buttons.
- ✅ W8 Redirect to `/` on a phone.

### Start-up
- 🔄 S1 Same `theme.js` as the main window (`data-theme` and `theme--*`), through `src/services/popup-appearance.js`. Differences: Vuetify's theme is gone; `popup.html` resolves the theme before the app loads, so a dark window no longer flashes light; the theme is re-applied at each showing, on a system theme change, and on a `storage` event from the main window.
- 🔄 S2 **Text size is now applied** (it was ignored). Every size in the window is in rem; checked at 125 %.
- ✅ S3 Spinner while the terms load; outside Tauri the window shows its empty state.
- ✅ S4 Terms from `pack_get_all_terms`, then the clipboard. The list is frozen (Vue no longer proxies hundreds of thousands of strings) and handed to the decorator, see E3.

### Reading the clipboard
- ✅ C1 Empty clipboard: nothing changes.
- ✅ C2 Legacy-font repair from the text.
- ✅ C3 Tibetan: Define with the lookup key.
- ✅ C4 Wylie starting a known term: Define, converted; anything else: Search. ➕ The Wylie is shown beside the headword ("ye shes · yé shé").
- ✅ C5 Session memory of the last Define value. Logic moved to `src/services/quick-lookup.js` (`classifyClipboardText`, `switchMode`).

### Modes and field
- 🔄 M1 Define/Search is a two-button switch in the bar instead of tabs under it. Tab still toggles.
- ✅ M2 Tibetan kept across modes; Latin text in Search brings back the last Define value.
- 🔄 M3 Define field is `UiTibetanField` (same conversions and legacy-paste repair), placeholder unchanged. The focus goes to it on start, on each mode switch and each showing.
- 🔄 M4 Search field is `UiTextField`, same placeholder; Tibetan typed in it gets the Tibetan font and size.
- 🔄 M5 The × button is replaced by the board's "Close with Esc" keycap, which is itself the close button (label hidden below 520 px).
- ➕ Bar title "From your clipboard" (board) while the field holds the clipboard's text, "Quick lookup" once you type.

### Define
- 🔄 D1 Terms column (9.5 rem; 7.5 rem below 520 px), "N TERMS" above it; 50 terms, 50 more when the end scrolls into view or on "More" (was a "Load more..." button only).
- ✅ D2 Typing selects the first term at once; a term no longer in the list is cleared.
- ✅ D3 Click or Up/Down (anywhere, Define only); the selected term is highlighted (accent, as on Define) and scrolled into view. ➕ A slow answer for an earlier term can no longer replace the entries of the one now selected.
- 🔄 D4 Same command and fallback, same Settings order. **Difference: dictionaries turned off in Settings are now left out**, as in the main window (they were shown).
- 🔄 D5 ➕ Headword block from the board: the term in 2.75 rem rubric Tibetan, its reading, "N ENTRIES". Spinner while loading. "No definitions for “X”." plus, when it is the case, "N entries are in dictionaries turned off in Settings." The old "Select a term" state is gone: the first term is always selected as soon as there is one, so it could only flash.
- 🔄 D6 Empty field: "Copy Tibetan text anywhere, then press ⌘⇧C" (the hotkey from Settings) and "Or type it above, in Tibetan or Wylie." No match: "No term starts with “X”." ➕ with a "Search the definitions instead" button.

### Search
- ✅ R1 `pack_search_entries` (type `definition`), 150 ms debounce, spinner. ➕ Only the last request may land.
- ✅ R2 Same sort.
- 🔄 R3 "N RESULTS"; each row is the term in rubric Tibetan above the **shared entry row** (chip opening the About dialog, ➕ copy button, decorated definition). Matches are marked with the amber tokens (`<mark>`) instead of a yellow `<em>`; underline in Tibetan kept; apostrophes still interchangeable. Disabled dictionaries are left out, as in D4.
- 🔄 R4 20 rows, 20 more on scroll or on "Show more results".
- 🔄 R5 "No results for “X”." / "Type to search across every definition."

### Entries
- ✅ E1 The chip opens the About dialog. Escape then closes the dialog only, not the window.
- 🔄 E2 Copy now says "Copied" in a toast (the window provides its own snackbar).
- 🔄 E3 Tibetan in definitions is now linked as in the main window (the decorator had no term list in this window, so there were no links). A click looks the term up **in this window** instead of navigating the webview away from `popup.html`. Abbreviations show their expansion in the toast (nothing happened before).
- 🔄 E4 Audio players use the shared `AudioPlayerService` instead of the window's own copy of that code (same play/pause and seeking).
- ✅ E5 Scanned dictionaries: page and View scan (shared row, not seen on screen here).
- 🔄 E6 25 entries first (as on Define), then 10 more on scroll.
- 🔄 Layout: the board's two-column row (chip in a 124 px column, definition beside it, copy at the end) at the default 650 px width; below 640 px the chip goes above the definition, since the terms column takes the room the board gives the definitions.

### Not in the old window
- ➕ N1 Packs notice in the footer: "2 packs were not searched: Tibetan Monolingual, Sanskrit & Academic. Install from Dictionaries in the main window." Same rule as Define and Search (fewer than 3 terms or results, some optional pack missing). Text only, no button: see "Changes needed outside my files".
- ❌ Pronunciation button (board): not added. There is no headword audio in the app, and the fidelity checklist says there is no headword audio button.
- ❌ Frequent renderings chips ("wisdom 5", board): not added. The plan's open question says to leave "Most often rendered as" out.
- ❌ "Collect" (board): not added. The plan says no "Collect".
- ❌ "Open in Lookup" (board): not added, because this window cannot route the main window without a change in `App.vue`. See below.

### Keyboard
- 🔄 K1 Footer keycaps "Tab Define or Search" and "↑ ↓ Terms" (Define only); Esc sits in the bar, as on the board. The footer shows the packs notice instead when there is one.
- ✅ K2 Escape closes from anywhere, except over a dialog.

### Selection popup in the main window
- ✅ P1 Same trigger and delay (1 s), same size.
- 🔄 P2 Same rules. Its "inside a field" check now also knows the rebuilt fields (`.ui-field`, any input or text area) and its "whole term" check the rebuilt lists (`.term-item`, `.result-term`, `.headword`); both had become dead checks.
- ✅ P3 Same placement (now from `window.innerWidth/innerHeight` instead of jQuery).
- 🔄 P4 Spinner, entries or "No entries.". Disabled dictionaries left out, Settings order, as everywhere else.
- ✅ P5 Hidden on a selection change or a scroll. ➕ Handlers released on unmount; a slow lookup no longer overwrites a newer one.
- 🔄 P6 Card drawn with the tokens (surface, line, 14 px radius, pop shadow) and the `ui-fade` transition, no Vuetify.

## Decisions the owner should check

1. **The board is a single-term card; the window keeps a terms column and a field.** Without them, clicking a longer term, Up/Down through the terms and typing a correction (all existing flows) would be lost. They are kept light so the headword stays the focus.
2. **Define/Search switch in the bar.** The board does not draw one; the old window had tabs.
3. **Reading line.** The Wylie is shown only when the clipboard held Wylie (the app has no Unicode-to-Wylie converter). Phonetics use the `english-loose` setting, one word per syllable ("yé shé", "sang gyé"); the board writes "yeshé".
4. **"17 ENTRIES"** instead of the board's "TIBETAN · 17 ENTRIES": "Tibetan" said nothing the window does not already say.
5. **Disabled dictionaries are now hidden** in the window and in the selection popup. Before, both showed every dictionary. The main window already hid them.
6. **Coming back to the window keeps what you typed** unless the clipboard changed (W5). `panel-shown` (the hotkey) always reads the clipboard.
7. **Window size unchanged (650×500).** The board is drawn at 560×480. Adopting it means changing `src-tauri/tauri.conf.json` and `POPUP_WIDTH/HEIGHT` in `global-lookup.js`, which are not mine; the layout works at both sizes (checked).
8. **Tab still switches the mode**, so Tab cannot move the focus between controls in this window (unchanged behaviour). Worth a thought for keyboard users.
9. **The packs notice has no button** (see below) and its wording differs from Define's.
10. **New "Search the definitions instead" button** when no term matches.

## What I checked, and what I could not

- **Browser, real data:** `popup.html` through the Vite dev server in Chromium, with the Tauri IPC mocked by a Playwright init script answering from the core pack (`public/packs/core.7z` extracted read-only to the scratchpad, never into `public/packs/`). Checked on screen: Define from Tibetan and from Wylie, Up/Down, Tab, Search from English and from Tibetan with highlights, no-term state with the packs notice, empty state, copy toast, About dialog with Escape, a Tibetan link in a definition, `panel-shown` with a new clipboard; light and dark; 650×500, the board's 560×480, the 450 px minimum, 390 px wide, and Text size 125 %.
- **Selection popup:** in the main window's web build on Define (core pack symlinked as `public/TibetanTranslator.sqlite`, which `.gitignore` excludes; nothing added to git), light and dark, with a programmatic selection.
- **Not checked:** the Tauri window itself (it cannot run here): the NSPanel's focus behaviour (not taking the focus from the source app, hiding on a click outside), the real global hotkey and clipboard, dragging, resizing, Windows and Linux. Rust is untouched, so these should behave as before, but nobody has seen the new window in the app yet. Also not seen: a scanned entry's View scan inside the window, audio playback, the `storage` event between the two webviews (if the engine does not share it, the theme still updates at the next showing through `panel-shown`).

## Changes needed in files I do not own

- **"Open in Define" and "See packs" (`App.vue`).** The window can bring the main window forward but cannot route it. With a listener in `App.vue`, for example
  `listen('quick-lookup:open', ({ payload }) => this.$router.push(payload.path))`,
  the window could `emitTo('main', 'quick-lookup:open', { path: '/define/<term>' })`, show and focus the main window, and hide itself; the capabilities already allow `emit`, `show` and `set-focus`. On macOS, showing the main window from a non-activating panel may also need the app activated from Rust; to try on a Mac. Then the board's "Open in Lookup" (as "Open in Define") and a "See packs" button can be added.
- **Window size** (`src-tauri/tauri.conf.json`, `global-lookup.js`): only if you want the board's 560×480 (decision 7). The fallback window that `global-lookup.js` creates is not resizable while the declared one is; pre-existing.
- **`src/css/layout.css`** gives `.theme--dark .dictionary-label` a grey text shadow (legacy). It now blurs the dictionary chips in dark on Define and in this window; it can go with the Vuetify clean-up.
- **No Rust change was needed.**
