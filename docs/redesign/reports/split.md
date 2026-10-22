# Split screen: redesign report

- **Branch:** `claude/split-screen-redesign-noj960`, from `redesign` at `0aed9b4`. This session was set up to push there; nothing was pushed to `main` or `redesign`.
- **Status:** done, ready for review. No PR opened.

## Commits

| Commit | Subject |
| --- | --- |
| `7ecc90e` | docs(split): lists every behaviour of the old Split screen before its rebuild |
| `0ed9faa` | feat(split): redraws the pane dividers as a thin grip and lets the arrow keys move them |
| `d021047` | feat(split): rebuilds the Split screen in the new design, with merge brackets and a phone layout |
| `0ef7101` | feat(split): redraws the Split help in the new style and documents Space and Shift+Space |
| `c36e62c` | fix(split): gives the text area more height by default, and always room for a line of text |
| (this file) | docs(split): reports on the Split rebuild |

Every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Test results

`pnpm test` before the push: **1,081 passed, 1 failed** (60 files; 63 more tests than the baseline of 1,018 passed / 1 failed on this branch). The failure is `tests/apkg-reader.test.js`, which needs the local `INALCO_L1_voca.apkg` that is not in this checkout; it failed the same way before any change. `pnpm build` succeeds.

New test files (no test was skipped or deleted; no existing test was tied to the old Split markup):

- `tests/split-page.test.js` (48 tests): mounts the page the way `App.vue` does (real router, `<keep-alive>` around `<router-view>`) and covers every behaviour below by its ID: route, keep-alive state and focus, the Up/Down listener's lifetime, the text area (attributes, Space/Shift+Space, Wylie on keyup, Ctrl/Cmd+Enter, ordinary and legacy-font paste, splitting on spaces after 500 ms, selection kept across edits), Split words, Clear, the tokenizer (loaded once, error message, syllable fallback, retry), the terms (count, Dictionaries menu, order and duplicates, selection, lookup key, no-entry marker, merge buttons for 2 to 5 terms, bracket lanes, tooltip, merging, Up/Down), every empty state, the definitions (loading, messages, order, menu reset, no Copy all), both dividers (defaults, clamps, storage) and the phone flow. The tokenizer and the database are mocked; the Wylie converter, the legacy-font repair, `Entries.vue` and the Dictionaries menu are the real ones.
- `tests/resizable-divider.test.js` (8): mouse and touch drag, cursor and text selection while dragging, separator role, arrow keys, clean-up.
- `tests/split-help.test.js` (7): button only on Split, tabs on desktop and phone, the Navigation shortcuts, ⌘ on a Mac, Close.

## Behaviours of the old screen

This list was written (commit `7ecc90e`) before any code changed, by reading `SegmentPage.vue`, `ResizableDivider.vue`, `SplitPageHelpDialogWithButton.vue`, `MobileResponsiveMixin.js`, `DictionariesMenuMixin.js`, and the shared components the page mounts (`Entries.vue`, `ResultsAndPaginationAndDictionaries.vue`, rebuilt for Define), plus the places outside the page that depend on it (`App.vue`, `router.js`, `config/navigation.js`, `SelectedTibetanEntriesPopup.vue`).

### Route and page lifecycle

- L1. Route `/segment`, no parameter: the text and the terms are not in the URL.
- L2. `<keep-alive>`: the text, the terms, the selected term and the definitions survive leaving the page; nothing is stored, so they are lost when the app restarts.
- L3. `activated()` focuses the text area each time the page is shown.
- L4. Cmd/Ctrl+T opens Split (App-level shortcut, `config/navigation.js`).
- L5. The root element has the class `segment-page`; `SelectedTibetanEntriesPopup.vue` uses it so that selecting Tibetan text on this page does not open the selection popup.
- L6. Up/Down are listened to on `window`, registered in `mounted()` and removed only in `beforeUnmount()`. Because the page is kept alive, the listener stays active on every other page once Split has been opened: Up/Down there also move Split's hidden selection (and look its definitions up) and have their default prevented (no arrow-key scrolling in Settings, for example). A bug.

### Text area

- A1. A plain `<textarea>` (not `TibetanTextField`), DDC Uchen at 1.625rem, placeholder "Paste or type Tibetan text", spellcheck, autocomplete, autocapitalize and autocorrect off. Several lines are allowed.
- A2. Space without Shift inserts a tsheg at the caret (replacing the selection); Shift+Space inserts a real space. So typing Wylie syllables separated by spaces gives tshegs, and Shift+Space is how you mark a word boundary while typing.
- A3. Wylie is converted to Tibetan on keyup of Space or a tsheg, over the whole text, keeping spaces, line breaks and trailing punctuation; repeated tshegs collapse to one.
- A4. Ctrl/Cmd+Enter in the text area runs Split words.
- A5. Paste: text in a pre-Unicode Tibetan font (detected from the clipboard's HTML) is repaired and inserted at the caret, then Wylie is converted and Split words runs. Any other paste is inserted by the browser; 50 ms later Wylie is converted and Split words runs. A paste therefore always splits the text automatically. Several lines can be pasted.
- A6. Spaces decide where words are split: 500 ms after the text changes (other than through the page's own rewrites), the terms are rebuilt from the text split on any whitespace. Parts made only of shad, gter tsheg or rin chen spungs shad are skipped; a tsheg is added to a part that ends neither in a tsheg nor in a shad. If the list did not change, nothing happens.
- A7. After such an edit, the selected term stays selected where it moved (first occurrence of the same text); if it is gone, the index is clamped to the list and its definitions are reloaded. Only terms not seen before are checked for entries; the merge buttons are recomputed.
- A8. Text dropped into the area is not converted (no drop handler).

### Split words, Clear, tokenizer

- B1. "Split words" (scissors icon, primary) and "Clear" (x icon) are shown in a header above the text area only when the text is not blank. Split words shows a spinner while splitting.
- B2. Split words loads the tokenizer once (`tibetan-word-tokenizer` with `/botok-dictionary.json`, lazily), tokenizes the text, keeps the TEXT chunks as terms ending in a tsheg (or shad), and rewrites the text area as those terms joined by single spaces. Punctuation chunks and line breaks are not written back.
- B3. After Split words the selection stays at the same position (or goes to the first term); its definitions are reloaded; on a phone the page stays on the terms. Then every term is checked for entries, then the merges are computed.
- B4. If the tokenizer cannot load, the error message is shown under the text area with an alert icon (e.g. "Dictionary not found. Please ensure botok-dictionary.json is in the public folder."), and the text is split on tshegs, shads and spaces instead (one syllable per term). The tokenizer is tried again on the next Split words.
- B5. Split words on blank text empties the terms, the selection and the definitions.
- B6. Clear empties the text, the terms, the selection, the definitions and the merges, returns to the terms on a phone, and focuses the text area.

### Terms list

- T1. Header: "N terms", "Segmenting..." while splitting, or "No terms".
- T2. The Dictionaries menu sits in the header when the selected term has entries; closing it focuses the text area.
- T3. Terms in text order, duplicates kept, in Tibetan.
- T4. A click selects a term (highlighted in the accent colour) and loads its definitions (looked up with `tibetanLookupKey`). On a phone it also switches to the definitions.
- T5. Terms with no entry are drawn at 60 % opacity, in italics, with a help-circle icon. A term not checked yet is drawn normally. The check looks the term up as it stands (with its trailing tsheg), not with `tibetanLookupKey`.
- T6. **Merge buttons.** For each position and for 2 up to `MAX_MERGE_TERM_COUNT` (5) consecutive terms, the terms are joined (each with its trailing tsheg); when the joined term has entries a button is drawn over those rows at the right edge of the list, several buttons from the same position side by side. Tooltip "Merge N terms: <joined term>". Positions come from the rows' measured size.
- T7. Clicking a merge button replaces the terms by the joined term. If the selected term was one of them, the joined term becomes selected and its definitions load; otherwise the selection follows its term. The text area is rewritten as the terms joined by spaces. The joined term is checked for entries and the merges around it (4 positions either side) are recomputed.
- T8. Up/Down anywhere on the page select the previous/next term (no wrap); Down with nothing selected selects the first. On a phone, they also switch to the definitions. The list is not scrolled to follow the selection.
- T9. Empty states: "Paste text above to begin" when the text is blank; "Add spaces between words or click "Split words"" when there is text but no term (and not splitting).

### Definitions

- P1. While loading: spinner and "Loading definitions...".
- P2. "Select a term to see definitions" (book icon) when there are terms and none is selected.
- P3. "No definitions found for "<term>"" (book-off icon) when the selected term has no entry in the enabled dictionaries.
- P4. Entries of the enabled dictionaries only, in the Settings order, 25 first then 10 more as the last comes into view (`Entries.vue`), with a fade.
- P5. The Dictionaries menu choice is per lookup: each lookup resets it to the Settings state; coming back to the page reloads the Settings state (`activated()` in the mixin).
- P6. No Copy all and no Add my definition on this page (per-entry copy and the dictionary About come with `Entries.vue`).

### Resizable dividers (`ResizableDivider.vue`)

- R1. A horizontal divider between the text area and the lower panes (not on a phone). Dragging it sets the text area's height as a percentage of the page, between 15 % and 70 %, stored as `segment.topHeight` (default 33 %). Minimum heights: 100 px on top, 200 px below.
- R2. A vertical divider between the terms and the definitions (not on a phone, and only when there are terms). Dragging it sets the terms' width as a percentage, between 20 % and 60 %, stored as `segment.leftWidth` (default 35 %). Minimum widths: 200 px terms, 300 px definitions.
- R3. Mouse and touch drag; while dragging, the whole page shows the resize cursor and text selection is off; the handle turns blue on hover and while dragging. No keyboard control.

### Phone (≤ 600 px)

- M1. The text area (at most 40 % of the height) above the terms; the definitions are hidden until a term is tapped. Then the text area and the terms are hidden and a "Back to terms" button (arrow-left) sits above the definitions.
- M2. No dividers.

### Help (`SplitPageHelpDialogWithButton.vue`)

- H1. A help button in the navigation, only on Split, opening "How to use the split page" with tabs: Dictionaries filter (`DictionariesMenuHelpTab`), and, not on a phone, Navigation: Up / Down (select previous / next word), Ctrl/⌘+Enter (split the text into words), Ctrl/⌘+D/S/T/G.

### Everywhere

- X1. Light and dark theme (hand-written `.v-theme--dark` overrides).
- X2. Text size setting (mostly rem sizes; rows were in px).

## Checklist: kept, changed, dropped

Legend: ✅ kept as it was · 🔄 kept, with a difference explained · ➕ added · ❌ dropped (none).

### Route and lifecycle
- ✅ L1 Route `/segment`.
- ✅ L2 Keep-alive keeps the text, terms, selection and definitions (tested with a real `<keep-alive>`); nothing stored across restarts.
- ✅ L3 `activated()` focuses the text area.
- ✅ L4 Cmd/Ctrl+T (App level, untouched; checked in the browser).
- ✅ L5 Root class `segment-page` kept, so the selection popup still stays out of this page.
- 🔄 L6 **Fixed:** the Up/Down listener is now added on activation and removed on deactivation and unmount, so Up/Down no longer move Split's hidden selection or lose their default on other pages (checked in the browser: prevented on Split, not on Settings). It also leaves Up/Down alone when they come from the Dictionaries menu, a dialog, a divider or another field.

### Text area
- 🔄 A1 Same placeholder and attributes, several lines allowed. It is now `<UiTextField multiline tibetan>` from `src/ui/` with the board's look (30 px DDC Uchen, serif placeholder, accent ring on focus), **not `UiTibetanField`**: see decision 1.
- ✅ A2 Space types a tsheg at the caret (over the selection); Shift+Space types a space.
- ✅ A3 Wylie converted on keyup of Space or a tsheg, spaces, line breaks and the final shad kept, repeated tshegs collapsed.
- ✅ A4 Ctrl/Cmd+Enter splits.
- ✅ A5 Legacy-font paste repaired at the caret, then split; ordinary paste converted and split 50 ms later; several lines allowed.
- ✅ A6 Spaces decide the words, 500 ms after an edit, with the same parsing rules.
- ✅ A7 Selection follows its term across edits; only new terms are checked; merges recomputed.
- ✅ A8 Drop still not converted (unchanged).

### Split words, Clear, tokenizer
- 🔄 B1 Split words and Clear only when there is text, spinner while splitting. Redrawn: the header holds the "SPLIT" title, the hint "Add or remove spaces to change where words are split." (desktop only) and the two buttons; with no text the title sits above the card (Empty board). On a phone the buttons have no icons and are 44 px tall (Phone board).
- ✅ B2 Same tokenizer, loaded once; text rewritten with single spaces.
- ✅ B3 Selection kept at its position, definitions reloaded, the phone stays on the terms, then all terms checked and merges computed.
- 🔄 B4 Same message and syllable fallback, retried next time. Drawn in the danger colour with a triangle icon, and announced (`role="alert"`).
- ✅ B5 Splitting blank text empties everything.
- ✅ B6 Clear empties everything, returns to the terms on a phone, focuses the text area.

### Terms
- 🔄 T1 "N terms", "Segmenting...", "No terms". Difference: one term now reads "1 term" (was "1 terms").
- ✅ T2 Dictionaries menu in the header when the selected term has entries; closing it focuses the text area.
- ✅ T3 Text order, duplicates kept.
- ✅ T4 Click selects (accent background, `aria-selected`), lookup with `tibetanLookupKey`, phone switches to the definitions.
- 🔄 T5 No-entry marker: same rule (only once checked, checked with the raw term). Drawn in the faint colour with a circle-help icon labelled "No entry in your dictionaries", no italics (the boards do not draw it, and slanted Tibetan is synthetic).
- 🔄 T6 **Merge buttons kept**, same rule: every run of 2 up to 5 terms (`MAX_MERGE_TERM_COUNT`, unchanged; you wrote "2 or 3", the code has always offered up to 5) whose joined term has entries. Redrawn as on the board: a "]" bracket over the merged rows with a round button on its edge, tooltip "<joined term> · Merge N terms" (Tibetan in DDC Uchen), `aria-label` "Merge N terms: <joined term>". Brackets that cover the same rows are put side by side in lanes (30 px apart) instead of on top of each other, and the rows leave room for them. Positions now come from the row index (rows have a fixed 3.25rem height) instead of measuring the DOM, so the `$forceUpdate` calls are gone.
- ✅ T7 Merging: same list, text, selection and recheck rules.
- 🔄 T8 Up/Down: same moves (no wrap, Down selects the first when none is); the selected term is now scrolled into view.
- ✅ T9 Both empty-state texts, unchanged.

### Definitions
- 🔄 P1 Spinner and "Loading definitions...", now `UiSpinner`.
- 🔄 P2 "Select a term to see definitions", now a muted card with a book icon.
- 🔄 P3 `No definitions found for "<term>"`, now a muted card with a book-x icon, the term in DDC Uchen.
- ✅ P4 Enabled dictionaries, Settings order, 25 then 10 more; desktop entries in one card, phone one card per entry (as on Define).
- ✅ P5 Menu choice reset per lookup; Settings state reloaded on activation.
- ✅ P6 No Copy all, no Add my definition (not on the boards either).

### Dividers
- 🔄 R1 Horizontal divider, same clamps (15–70 %) and storage key. Differences: default **24 %** instead of 33 % (the board's card is about 20 %; 24 % keeps two lines visible), minimum height of the text card **9rem** instead of 100 px so a line of text always fits at larger text sizes.
- 🔄 R2 Vertical divider, same clamps (20–60 %), storage key and "only with terms". Default **27 %** instead of 35 % (≈ the board's 340 px at 1440 px). Minimum terms width 200 px kept; the definitions' 300 px minimum is gone (they take the rest).
- 🔄 R3 Same mouse and touch drag. Redrawn as the board's 14 px gutter with a 44×4 grip in `--line-strong`, accent on hover/drag. ➕ Focusable (`role="separator"`, label), Up/Down or Left/Right move it by 16 px.
- Stored positions from the old app are reused as they are.

### Phone
- 🔄 M1 Text and terms first; a tap shows "Back to terms" (accent link with a chevron, as on the board), the term in large accent Tibetan, and one card per entry. Text area 4.5rem tall instead of "at most 40 %".
- ✅ M2 No dividers.

### Help
- 🔄 H1 Same tabs and content, redrawn with `UiDialog` and `UiTabs` (the new Vuetify-free `DictionariesMenuHelp.vue`). Title "How to use the Split page". ➕ Navigation also lists Space (tsheg) and Shift+Space (word break), which were never documented.

### Everywhere
- ✅ X1 Light and dark: every colour comes from the tokens; the old `.v-theme--dark` overrides are gone.
- ✅ X2 Text size: sizes are in rem (rows included); checked at 125 %.
- ✅ No Vuetify component in `SegmentPage.vue`, `ResizableDivider.vue` or `SplitPageHelpDialogWithButton.vue`.
- No "Keep" feature and no passage-with-underlines view were added.

## Decisions for you to check

1. **The text area is `UiTextField multiline tibetan`, not `UiTibetanField`.** The old Split screen never used `TibetanTextField`; it had its own textarea logic, and `UiTibetanField` would break it: it converts Wylie with `preserveWhitespace: false` (spaces become tshegs, so the word breaks vanish), replaces trailing punctuation with a tsheg (the final shad goes), trims spaces after a tsheg as you type (Shift+Space at the end of a word would be removed at once), and refuses multi-line pastes. If you want a single shared component, `UiTibetanField` would need a mode (e.g. `multiline` + `keepSpaces`) that switches those off; that is a change to `src/ui/`, which I did not make.
2. **Default divider positions** (24 % / 27 %) and the 9rem minimum, see R1/R2. Users who dragged them keep their values.
3. **Merge brackets in lanes** when several cover the same rows (the board only shows non-overlapping ones). The longest goes in the outer lane. With this text the board's own example (`ཕ་རོལ་ཏུ་ཕྱིན་` 3 terms and `ཕ་རོལ་ཏུ་` 2 terms from the same row) draws two nested brackets.
4. **Merge icon** is the board's own SVG inline in `SegmentPage.vue`; no matching icon is in `src/ui/icons.js`. Lucide's `fold-vertical` is the closest if you prefer to register one.
5. **The definitions card starts level with the terms list** (46 px below the top of the lower area) rather than the board's 36 px, which left it 10 px higher than the list.
6. **No fade at the bottom of the definitions card**, as on Define.
7. **"1 term"** instead of "1 terms".
8. **The help reuses Define's global help styles** (`define-help-button`, `define-help-content` from `DefinePageHelpDialogWithButton.vue`) rather than copying them. If that file's styles move or get scoped, the Split help loses its look.
9. **Pre-existing, kept on purpose** (behaviour you may rely on):
   - Split words drops punctuation and line breaks from the text (B2), and merging rewrites the text the same way.
   - Up/Down inside the text area move through the terms, so they never move the caret between lines.
   - The no-entry marker and the merge check look a term up as it stands, while the definitions use `tibetanLookupKey` (T5): a term like `ཁ༔་` is marked as having no entry even when its definitions show.
   - Merges go up to 5 terms, not 3.

## What I checked, and what I could not

- **Web dev server, real data:** no dictionary database was in the checkout, so, as for Define, I extracted `public/packs/core.7z` (read only) into `public/TibetanTranslator.sqlite`, which `.gitignore` excludes; nothing under `public/packs/` changed. That is the core pack only. The real tokenizer (`/botok-dictionary.json`) was used.
- **Looked at in Chromium (screenshots):** desktop 1440×900 light and dark with a split text, a selected term, merge brackets (nested and side by side), a no-entry term and the merge tooltip; the Empty state (focused field, "No terms", "Paste text above to begin"); typing Wylie with Space and Shift+Space; "Select a term to see definitions"; "No definitions found for …"; a merge; Up/Down; the Dictionaries menu open; 125 % text size with a 42-term text; phone 390×844 light and dark (terms with brackets, entries with "Back to terms"); the help dialog on desktop (both tabs) and phone (dark). In the browser: Up/Down released on Settings and back on Split, Ctrl+T/Ctrl+G, focus on return, the divider moved with the keyboard.
- **Not checked on screen:** the tokenizer error message (the dictionary always loaded; covered by tests); a legacy-font paste (needs a real clipboard with Chogyal/Sambhota markup; covered by tests with the real converter); dragging the dividers with a mouse or a finger (covered by tests; the keyboard move was checked); the Tauri desktop app, iOS and Android; the optional packs.

## Changes outside the files I own

- **New test files** only: `tests/split-page.test.js`, `tests/resizable-divider.test.js`, `tests/split-help.test.js`.
- **Nothing edited** in `Entries.vue`, `EntriesEntry.vue`, `ScanViewer.vue`, `ResultsAndPaginationAndDictionaries.vue`, `QuickAddDialog.vue`, `UninstalledPacksNotice.vue`, the Dictionaries-menu mixins and help, `SearchPage.vue`, `TibetanTextField.vue`, `src/ui/`, `AppNav.vue`, `App.vue` or the tokens.
- **For the Define owner (Dictionaries menu):** the menu opens aligned to the button's right edge (decision 5 in `define.md`). On Split the button sits at the right of a ~340 px terms column, so the menu runs over the navigation rail (by about 65 px at 100 % text size, more at 125 %; screenshots of both). An `align` prop on `ResultsAndPaginationAndDictionaries.vue`, set to `start` from Split, would open it over the definitions instead.
- **For the shell owner:** `AppNav.vue` still styles `.help-button .v-icon`; the Split button no longer has a `v-icon` either, so only Search's help still uses those rules. `DictionariesMenuHelpTab.vue` is now only used by the Search help.
- **For `src/ui/`:** see decision 1 (a whitespace-keeping multi-line mode for `UiTibetanField`) and decision 4 (a merge icon).
