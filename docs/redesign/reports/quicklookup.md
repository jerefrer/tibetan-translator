# Quick lookup window: redesign report

(Work in progress: the checklist outcome is filled in at the end.)

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
- P2. Only when the selection is mostly Tibetan (at most 15 non-Tibetan characters), not inside an input (it checks `.v-input`, which no rebuilt screen has any more), not on Split (`.segment-page`), and not the whole text of an element `.term` (no rebuilt screen has one any more). Non-Tibetan characters and leading punctuation are stripped; the lookup adds a trailing tsheg.
- P3. Placed beside the selection: right of where it started on the left half of the window, left of it on the right half; below it on the upper half, above it on the lower half.
- P4. Spinner while loading, then the entries (`Entries.vue`, every dictionary, the order from the database), or "No entries.".
- P5. Any new selection change or a scroll hides it. It overwrites `document.onmousemove`, `onselectstart`, `onselectionchange` and `window.onscroll`.
- P6. Vuetify card (grey in light, default in dark) with fade transitions.
