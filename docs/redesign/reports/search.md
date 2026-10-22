# Search screen: redesign report

- **Branch:** `claude/redesign-search-w2a0o4`, from `redesign` at `0aed9b4`. Nothing was pushed to `main` or `redesign`. No PR opened.
- **Status:** done, ready for review.

## Commits

| Commit | Subject |
| --- | --- |
| `c49e9bc` | docs(search): lists every behaviour of the old Search screen before its rebuild |
| `b47402c` | feat(search): redraws the query builder as a card, and puts the caret in a condition when it is added |
| `0ed4738` | feat(search): rebuilds the Search screen in the new design, with a phone layout |
| `2c6dd5a` | fix(search): finds Tibetan queries every time, where every other search said "No entries" |
| `0adb0a0` | fix(search): runs each search once instead of twice |
| `e4d89b6` | fix(search): shows Tibetan larger in the query field and puts Query builder under the field on a phone |
| `df53d7c` | test(search): covers every behaviour of the Search screen on the page itself |
| `8894786` | feat(search): redraws the Search help in the new style |
| (this file) | docs(search): reports on the Search rebuild |

Every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Test results

`pnpm test` before the push: **1,090 passed, 1 failed** (59 files). The failure is `tests/apkg-reader.test.js`, which needs the local `INALCO_L1_voca.apkg` that is not in this checkout. The baseline of this checkout (`redesign` with the Define work) was 1,018 passed and the same 1 failed; your brief's 908 predates the Define tests. `pnpm build` succeeds. No test was skipped or deleted.

- `tests/search-page.test.js` (new, 51 tests): mounts the page the way `App.vue` does (real router, `<keep-alive>` around `<router-view>`), one block per group below: route, guards, keep-alive and focus, the field, Wylie in parentheses, Enter and the button, the spinner, clear, legacy paste (real repair tables), the SQL built for Tibetan, English and phonetic parts, recent searches (order, limit of 100, click, Clear history), the builder (default, remembered, two-way sync, Enter, add/remove), results (count, sort, Settings choice per query, highlighting, `definition` class, About dialog, scanned rows and the viewer, infinite scroll and "All N results loaded", "No entries", packs notice), Add my definition (term, re-search, absent on web), phone layout.
- `tests/search-builder.test.js` (rewritten off Vuetify, 15 tests added, 50 in all): the parsing and generation tests are unchanged; new ones drive the markup (mode labels and options, typing, Enter, placeholders, no Wylie conversion, add with focus, remove buttons, Hide, phone).
- `tests/search-help.test.js` (new, 7): button only on Search, tabs, the links between tabs, phonetics, Dictionaries filter, Navigation (not on a phone), Close.
- `tests/search-page-decoration.test.js`: unchanged tests; its router mock now returns a promise, as the real `push` does.

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

## Checklist: kept, changed, dropped

Legend: ✅ kept as it was · 🔄 kept, with a difference explained · ➕ added · ❌ dropped (none).

### Route and lifecycle
- ✅ R1 Route `/search/:query?`.
- ✅ R2 Both guards unchanged.
- 🔄 R3 Same handling of route changes. Difference: a search started on the page (field, button, builder, recent search) pushes its route and **no longer runs a second time** when the route watcher sees that push (`0adb0a0`). Navigation from elsewhere (Back, links, other pages) still runs the query.
- ✅ R4 Mount runs the query from the route.
- ✅ R5 Keep-alive keeps query and results; `activated()` focuses the field (tested with a real `<keep-alive>`).
- ✅ R6 Cmd/Ctrl+S (App level, untouched).

### Query field (now `UiTextField`)
- 🔄 F1 Same placeholder, `autofocus`, spelling help off; added `aria-label="Search query"` and `enterkeyhint="search"`. Font: Source Serif 4 as on the boards, with DDC Uchen for Tibetan, set larger (26 px, 24 px on a phone) as soon as the query contains Tibetan.
- ✅ F2 No conversion while typing; Wylie in parentheses is converted when the query runs. See decision 1 about `UiTibetanField`.
- ✅ F3 Enter and the search button (now the accent square inside the field, as on the board), disabled while blank.
- 🔄 F4 Spinner while the query runs: now `UiTextField`'s own spinner, inside the field before the clear button.
- ✅ F5 Clear button: same effects.
- ✅ F6 Legacy-font paste repaired at the caret; other pastes left to the browser.
- ✅ F7 A blank query clears.

### Running a search
- ✅ S1 `&`, `(…)`, `[…]`, `{…}` unchanged.
- 🔄 S2 Same SQL. Bug fixed (`2c6dd5a`): the Tibetan test used `tibetanGroups`, a regexp with the `g` flag, whose `test()` answers false every other call. A Tibetan query could then be sent as neither Tibetan nor English and come back "No entries"; opening `/search/<Tibetan>` directly always failed (the first render had already called the test once). This was in the old screen too.
- ✅ S3 Recent searches: front, no duplicates, at most 100; route pushed.
- ✅ S4 Highlights frozen at search time (existing decoration tests still pass).
- ✅ S5 Each query resets the Dictionaries menu to Settings; `activated()` reloads Settings.
- ✅ S6 Same sort.
- ✅ S7 Lists hidden while loading; the results header stays.

### Recent searches (board "B · Search, empty")
- ✅ H1 Same conditions.
- 🔄 H2 A card: history icon, "RECENT SEARCHES" label, the queries as bordered buttons (Tibetan in DDC Uchen, Latin in Source Serif), Tibetan still wrapped with a tsheg added.
- ✅ H3 A click runs the query.
- 🔄 H4 "Clear history" is now a text link at the right of the card header (board); same effect, focuses the field.
- ➕ A "What you can search" card under it (board): Tibetan or Wylie, English words, How it sounds. Shown before any search, with or without recent searches. Wording: see decision 3.

### Query builder (board "B · Search, query builder open")
- 🔄 B1 Shown by default as before, **now remembered** when hidden or shown (`searchBuilderVisible`), as the help always promised. The toggle reads "Query builder" (was "Show Query Builder") and sits beside the field, under it on a phone.
- ✅ B2 Two-way sync unchanged; editing a row does not run the query.
- 🔄 B3 Same four modes and placeholders; the mode is a `UiSelect` sharing one box with the term.
- ✅ B4 Add condition. ➕ The caret goes into the new condition.
- ✅ B5 Remove buttons from two rows on (circle-minus, "Remove this condition").
- ✅ B6 Enter in a row runs the query.
- ✅ B7 No Wylie conversion in rows.
- ✅ B8 Phone: mode above the term (board).
- ➕ The note "An entry must match every condition." ("Match every condition" on a phone).

### Results
- 🔄 L1 "Showing **X** of **Y** results", numbers in bold (board).
- 🔄 L2 Add my definition: same conditions, term and re-search. A text button "Add my definition" beside Dictionaries on a desktop (board), the book-plus icon with a tooltip on a phone.
- ✅ L3 Dictionaries menu (the one rebuilt with Define); closing it focuses the field; Ctrl/Cmd+B.
- ✅ L4 Term, chip, decorated definition in an element with class `definition`.
- 🔄 L5 Same highlighting rules. Colours: Latin hits on the brand yellow (`--logo-bg`) with dark ink in both themes, Tibetan hits underlined in that yellow.
- 🔄 L6 The chip opens the **About dialog** (`DictionaryAboutDialog`, as on Define) instead of the snackbar.
- 🔄 L7 "Page N (approximate)" and "View scan" as on Define; the viewer now receives `approximate`, so its title says "approximate" like on Define (it did not on Search).
- 🔄 L8 50 then 50 more, spinner, "All N results loaded". Difference: the observer is rooted on the element that scrolls (the results card on a desktop, the page on a phone), so the 200 px look-ahead now applies (it was rooted on the viewport, where the card's clipping made it fire only when the sentinel showed), and it re-arms after each batch, so a short batch that leaves the sentinel in view keeps loading.
- ✅ L9 "No entries" (now a card).
- ✅ L10 Uninstalled-packs notice: same component, same trigger (Define's redraw).

### Help
- 🔄 Q1 Same tabs and text, on `UiDialog`/`UiTabs`, with `UiAlert` for the callouts; tables restyled; the "(See Phonetic search)" links are buttons. The Dictionaries filter tab uses the Vuetify-free `DictionariesMenuHelp`.

### Everywhere
- ✅ X1 Light and dark: every colour from the tokens (checked on screen, see below).
- ✅ X2 Text size: sizes in rem; checked at 125 %.
- 🔄 X3 Phone (board "B · Search on a phone"): the whole page scrolls; each result is a card, the dictionary chip at the left and the term at the right, the definition under them.
- Dead code removed: `useTheme`/`isDark`, `changePage`/`paginationLoading`/`resultsPage`, `toggleBuilder`/`hideBuilder`, the unused `snackbar` injection, all Vuetify overrides.

## Decisions for you to check

1. **No `UiTibetanField` on Search.** Your brief says it replaces `TibetanTextField` here, but the old Search screen never used `TibetanTextField`: its field is a plain `v-text-field` on purpose, because a query is often English, Sanskrit or phonetics (`seven limbs`, `[chomdende]`), and `UiTibetanField` turns any Wylie-looking text into Tibetan on each space (`seven limbs` would become Tibetan). Search's Wylie support is the `(…)` syntax and the "contains (Wylie)" mode, both kept. The field is a `UiTextField` and does only the legacy-font repair, as before. The builder rows stay plain inputs for the same reason.
2. **The query builder opens by default**, as before; the main Search board draws it closed. Now that the choice is remembered, people who hide it once keep it hidden. Say if you prefer it closed by default.
3. **"What you can search" wording.** The board says "Tibetan or Wylie: find entries where a headword or a definition contains it". Bare Wylie is searched as English, so I added "Put Wylie in parentheses: (ye shes)." The other two blurbs are the board's.
4. **The field shows the real query syntax.** The builder board shows "ye shes wakefulness" in the field; the real field shows `(ye shes) & wakefulness`, since field and builder stay in sync.
5. **Packs notice.** The Search board shows "Searching 35 of 65 dictionaries. Two optional packs are not installed…" under a full result list. I kept Define's component (shown only with fewer than 3 results, heading "N packs were not searched", "See packs"), since the app cannot count what missing packs would add. Showing it on every search would need a change in `UninstalledPacksNotice.vue` (Define's).
6. **Highlight colours** are not drawn on the boards; I kept the old yellow (see L5).
7. **No bottom fade** on the results card (same reason as on Define: it would hide the last row).
8. **Phone result card**: chip left, term right, as on the board; a long term wraps, right-aligned.
9. **Long dictionary names** are cut with an ellipsis in the 150 px chip column (the board has them on one line); on a phone the chip shows in full.
10. **Each search runs once** (R3). Worth a try in the desktop app: a search from the field, then Back and Forward.

## What I checked, and what I could not

- **Web dev server, real data:** no dictionary database was in the checkout, so I extracted `public/packs/core.7z` (read only) to `public/TibetanTranslator.sqlite`, which `.gitignore` excludes; nothing under `public/packs/` changed. Core pack only (35 dictionaries). I did not run `pnpm build:packs` or `pnpm build:database`.
- **Looked at in Chromium (screenshots):** desktop 1440×900 in light and dark: empty state with recent searches and the tips card, query builder open with two conditions, English, Tibetan, Wylie `(snying rje)` and phonetic `[chomdende]` results, the Dictionaries menu, the About dialog, a scanned Jäschke row and the scan viewer it opens, the infinite scroll to "All 147 results loaded", the help (three tabs, light and dark); 1280×800 at 125 % text size; phone 390×844 in light and dark: builder, results, Dictionaries menu, empty state, scanned row, the builder toggle under the field, the help.
- **Dark theme at load:** in headless Chromium a stored or system dark preference did not switch the page to dark at load (`data-theme` stayed `light`; the console shows Vuetify's deprecation warning for `theme.global.name.value` in `App.vue`'s `initializeTheme`). I set `data-theme="dark"` by hand to check the screen. This is App-level code I did not touch; worth checking in the app.
- **Not checked on screen:** Add my definition and the uninstalled-packs notice (Tauri only: they need modular packs; covered by tests); Add my definition with real lexicons; the Tauri desktop app, iOS and Android; real touch input; legacy-font paste in a real browser (tested with the real repair tables in happy-dom); Cmd/Ctrl+S and Cmd/Ctrl+B in the browser (App-level and Define's menu, unchanged).

## Changes outside the files I own

- **Nothing edited** in the Define components (`Entries`, `EntriesEntry`, `ScanViewer`, `ResultsAndPaginationAndDictionaries`, `QuickAddDialog`, `UninstalledPacksNotice`, `DictionaryAboutDialog`, `DictionariesMenuHelp`), `SegmentPage.vue`, `TibetanTextField.vue`, `App.vue`, `AppNav.vue`, `src/ui/` or the tokens.
- **Reused, not copied:** the Search help button and panels carry Define's classes (`define-help-button`, `define-help-content`) so both helps look the same. Whoever owns the Define help may want to rename them to shared names (`page-help-…`) once Split's help is rebuilt too.
- **For the shell owner:** `AppNav.vue`'s `.help-button .v-icon` rules now only serve Split's help. `DictionariesMenuHelpTab.vue` is now used by Split's help only.
- **For whoever owns `App.vue`:** the dark-at-load observation above.
- **The `tibetanGroups` pitfall** (a `g` regexp used with `test()`): I found no other `tibetanGroups.test(` in `src/`, so nothing else is affected today.
