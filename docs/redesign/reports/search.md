# Search screen: redesign report

## Behaviours of the old screen

Written before any code changed, by reading `SearchPage.vue`, `SearchBuilder.vue`, `SearchBuilderRow.vue`, `SearchPageHelpDialogWithButton.vue` and what they use (`DictionariesMenuMixin`, `InfiniteScrollMixin`, `ResultsAndPaginationAndDictionaries.vue`, `UninstalledPacksNotice.vue`, `QuickAddDialog.vue`, `ScanViewer.vue`, `App.vue`, `config/navigation.js`). The outcome of each one is in the checklist further down.

### Route and page lifecycle

- R1. Route `/search/:query?`: the query is the route parameter.
- R2. Entering `/search` with no query goes to the stored query (`searchQuery` in storage). On entry the stored query is put in the path as is; on a route update within Search it is URI-encoded.
- R3. A route change while on `/search` sets the field, stores the query and runs the search (as a navigation: the query is not added to the recent searches and the route is not pushed again). Route changes while another page is shown are ignored, so leaving Search does not clear it.
- R4. On mount, a query from the route runs the search.
- R5. `<keep-alive>`: the page keeps its query, results and scroll when you leave; `activated()` focuses the field each time the page is shown.
- R6. Cmd/Ctrl+S opens Search (App level, `config/navigation.js`).

### Query field

- F1. Placeholder "Type your query"; `autofocus`; spellcheck, autocomplete, autocapitalize, autocorrect off; Tibetan font.
- F2. No Wylie conversion while typing (the field takes English, Sanskrit and phonetics). Wylie is converted to Tibetan only inside parentheses, when the query runs: `(dga' ba)` searches དགའ་བ་.
- F3. Enter runs the search; so does the search button, which is disabled while the field is empty or blank.
- F4. A spinner beside the search button while a search runs.
- F5. Clear button: empties the field, forgets the stored query, goes to `/search/`, drops the results (the recent searches come back) and the highlighted terms.
- F6. Text pasted in a pre-Unicode Tibetan font is repaired at the caret (the rest of the field is kept, the caret goes after the pasted text); any other paste is left to the browser. If the repair declines, the raw text is inserted.
- F7. Running a search with a blank field clears, as F5.

### Running a search

- S1. The query is split on `&`; each part must match (AND). `(…)` parts are Wylie; `[…]` sounds precisely like; `{…}` sounds more or less like; anything else "contains".
- S2. Hybrid SQL: FTS (term or definition) for non-Tibetan parts and phonetics (spaceless input expanded into syllable variants), `LIKE` on term or definition for Tibetan parts; BM25 ranking with term columns weighted; at most 5,000 rows.
- S3. A search started from the field, the button, the builder or a recent search adds the query to the recent searches (moved to the front if present, at most 100) and pushes `/search/<encoded query>`.
- S4. The terms to highlight are frozen when the search runs, so typing in the field does not re-render or re-decorate the results.
- S5. Each new search resets the Dictionaries menu to the Settings choice and recounts entries per dictionary; coming back to the page reloads the Settings choice (`activated()` in the mixin).
- S6. Results are sorted: terms starting with the first search term first, then the dictionary order from Settings, then BM25 rank, then shorter terms.
- S7. While a search runs, the result list, the recent searches and "No entries" are hidden; the results header stays.

### Recent searches

- H1. Shown when no search has been run (or after Clear), not loading, and the list is not empty.
- H2. Header "Recent Searches" with a history icon; one button per query, Tibetan wrapped in spans with a tsheg added when missing.
- H3. A click runs that query (and moves it to the front).
- H4. "Clear History" empties the list (stored as `previousQueries`) and focuses the field.

### Query builder (`SearchBuilder.vue`, `SearchBuilderRow.vue`)

- B1. Shown or hidden with "Hide" / "Show Query Builder"; visible by default. It reads `searchBuilderVisible` from storage but nothing ever writes it, so it always opens visible, although the help says "Your preference is remembered".
- B2. Two-way sync with the field: typing a query rebuilds the rows (split on `&`, `[…]`, `{…}`, `(…)`); editing a row rewrites the query (`[term]`, `{term}`, `(term)`, parts joined by ` & `, empty rows left out). Editing does not run the search.
- B3. Each row: a mode (contains, contains (Wylie), sounds precisely like, sounds more or less like) and a term; placeholders "བོད་ཡིག་ or text", "sangs rgyas", "sangye".
- B4. "Add condition" adds an empty "contains" row.
- B5. A remove button on each row while there are two rows or more; removing the only row would clear it.
- B6. Enter in a row runs the search.
- B7. Row inputs do no Wylie conversion; spellcheck and autocomplete off.
- B8. Phone: mode above term, the remove button in the corner.

### Results

- L1. "Showing X of Y results" (X rendered, Y in the enabled dictionaries) when there are results.
- L2. Add my definition (book-plus icon, tooltip) in the results header on platforms with modular packs, when there is a query; opens `QuickAddDialog` prefilled with the query only when it is a single plain Tibetan term (empty for `&` queries, `[…]`/`{…}` syntax, or non-Tibetan text). After a save the search runs again. The dialog is mounted at page level so it survives the header disappearing.
- L3. Dictionaries menu in the results header (dictionaries that have results); closing it focuses the field. Ctrl/Cmd+B opens it.
- L4. Each row: the term with the hits highlighted, the dictionary chip (short label, Tibetan wrapped), the definition decorated (`Decorator.decorate`) and highlighted, in an element with class `definition` (App.vue listens on it for abbreviations and `/define/` links).
- L5. Highlighting: Latin hits on a yellow background, case-insensitive, `'` and `’` interchangeable; Tibetan hits underlined in yellow; phonetic parts highlight the Tibetan syllables that sound like them. HTML tags are left alone.
- L6. A click on the dictionary chip shows the dictionary's "about" in the snackbar.
- L7. Scanned dictionaries: no definition, "Page N" with "(approximate)" when the stored page carries `?`, and a "View Scan" button opening the scan viewer at that page (one viewer at page level).
- L8. Infinite scroll: 50 rows at first, 50 more as the sentinel comes within 200 px of the viewport; a spinner while more remain, then "All N results loaded".
- L9. "No entries" when a search returned nothing (or nothing in the enabled dictionaries).
- L10. Uninstalled-packs notice under the results once a search has run, when fewer than 3 results, the platform has optional packs and some are missing (`UninstalledPacksNotice`).

### Help (`SearchPageHelpDialogWithButton.vue`)

- Q1. A help button in the navigation, only while Search is shown, opening "How to use the search page" with tabs: Query Builder (the four modes and their syntax, Add condition, the sync note, the Hide note), Syntax Examples (with links to the Phonetic search and Wylie support tabs), Phonetic search, Wylie support, Dictionaries filter, Navigation (not on a phone: Cmd/Ctrl+D/S/T/G). Close button.

### Everywhere

- X1. Light and dark theme.
- X2. Text size setting.
- X3. Phone (≤ 600 px): smaller field text, each result stacked (term, chip, definition), builder rows stacked.

### Dead code noticed

- `isDark`/`useTheme`, `changePage`/`paginationLoading`/`resultsPage` (no paginator is shown), `.mobile-controls` and `.v-table` styles: not used by anything visible.
