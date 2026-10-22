# Define screen: redesign report

Status: in progress. This section was written before any code changed, by reading
`DefinePage.vue` and every component it uses. Each item is ticked at the end.

## Behaviours of the old screen

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
