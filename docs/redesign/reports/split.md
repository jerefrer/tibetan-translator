# Split screen: redesign report

Work in progress. The checklist below is filled in at the end of the rebuild.

## Behaviours of the old screen

Written before any code changed, by reading `SegmentPage.vue`, `ResizableDivider.vue`, `SplitPageHelpDialogWithButton.vue`, `MobileResponsiveMixin.js`, `DictionariesMenuMixin.js`, and the shared components the page mounts (`Entries.vue`, `ResultsAndPaginationAndDictionaries.vue`, rebuilt for Define), plus the places outside the page that depend on it (`App.vue`, `router.js`, `config/navigation.js`, `SelectedTibetanEntriesPopup.vue`).

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
