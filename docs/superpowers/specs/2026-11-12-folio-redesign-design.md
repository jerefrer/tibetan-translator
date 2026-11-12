# Folio redesign — design

Branch: `feature/folio-redesign`, from `feature/mobile-polish` at `c3bde2c`.
Mockups (private, owner access only): https://claude.ai/artifact/PFQ9QitLsfx38cTtuuT8tG ("Folio", 14 boards).

The owner asked for the "carte blanche" redesign to be built for real on its own branch so it can be tried, with free hand on everything **except** that working with Tibetan must stay first-class: typing Wylie that turns into Tibetan, pasting Tibetan, phonetic search, Tibetan rendering. Nothing about Tibetan input may be weaker than on `feature/mobile-polish`.

## The idea

An app for **reading**, not for filling forms, where the Tibetan is the main character. One place to look things up, one place to read a text, one place for everything else.

## Navigation

Three destinations, everywhere:

| Destination | Replaces | Route |
| --- | --- | --- |
| **Lookup** | Define and Search | `/lookup/:term?` (query `q`, `mode`) |
| **Reader** | Split | `/reader` |
| **Library** | Settings, Glossary, Dictionaries | `/library`, `/library/<section>` |

- Old routes redirect so links, the quick lookup popup, deep links and muscle memory keep working: `/define/:term` → `/lookup/:term`; `/search/:query` → `/lookup?mode=en&q=<query>`; `/segment` → `/reader`; `/settings` → `/library/settings`; `/lexicon` (or the glossary route in use) → `/library/glossary`; `/dictionaries` → `/library/dictionaries`.
- **Desktop:** a 248px sidebar (`--bg-sidebar`): logo and app name, the three destinations, **Recent** (last looked-up headwords, Tibetan), **Saved** (bookmarked headwords), and Settings pinned at the bottom (opens `/library/settings`).
- **Phone:** a bottom tab bar with the three destinations. Screens open with a large iOS-style title. Settings live inside Library.
- Keyboard: `Cmd/Ctrl+K` focuses the Lookup field from anywhere. The existing shortcuts keep meaning what they meant: `Cmd/Ctrl+D` Lookup in Tibetan mode, `Cmd/Ctrl+S` Lookup in English mode, `Cmd/Ctrl+T` Reader, `Cmd/Ctrl+G` Library settings.

## Lookup

One field, with a two-way switch **བོད / EN** next to it (a segmented control, remembered in storage as `lookupMode`).

### བོད mode (default)

- The field is **exactly today's Tibetan field** (`src/ui/UiTibetanField.vue`): Wylie converts to Unicode on space, tsheg, Enter, paste and drop; pasted Tibetan in legacy fonts is repaired; a second tsheg is refused; the "typed `sangs rgyas`" line (today's `typed-wylie.js` echo) shows the Latin that was typed, now on the phone too. Same component, same tests; the redesign restyles it and nothing else. (The mockup's **Undo** is not built: the field has no such feature today and it would fight the conversion on the next space.) The converter itself is not changed (Sanskrit typed in Wylie, e.g. `buddha`, keeps converting).
- Results: the headwords matching what was typed, found the way Define finds them today, each row with the headword and a **one-line gloss** (its first definition, plain text, cut with an ellipsis).
- A hint offers **Search "bliss" in the definitions**, switching to EN mode with the original Latin, when either: today's rule fires (the text holds Latin diacritics such as `kākiṇī`, `non-wylie-input.js`), or no headword starts with the converted text and the "typed" memory knows the Latin. It replaces today's `SearchInsteadHint`.
- A line under the field says how the input was read: `Wylie bcom → བཅོམ་ · 5 terms`.

### EN mode

- Plain text, no conversion. Searches the definitions the way Search does today, with everything Search supports: `&` for several conditions, `{…}` loose phonetics, `[…]` strict phonetics, Wylie in parentheses. The query builder is kept behind an **Advanced** toggle under the field.
- Results: one row per Tibetan term whose definitions match (Search's grouping and ordering), with the matching definition as the gloss, hits highlighted.
- When the typed text is entirely valid Wylie that converts to an existing headword, a hint offers **Look up `<tibetan>`**, switching to བོད mode.

### The entry

- The headword large (52px desktop, 40px phone, DDC Uchen, `--rubric`), then a line with its Wylie and phonetics (`bcom ldan 'das · chomdendé`) and the definition count.
- **In short**: a short line of the translations most dictionaries agree on (see below). Hidden when nothing reaches the threshold.
- **Dictionary tabs**: `All · 49`, then the dictionaries present for this term in the user's order, as many as fit, then **More…** (a menu with the rest). Choosing one filters the definitions.
- The definitions: each dictionary's name above its definitions (small, `--muted`, semibold), the definitions in Source Serif 4. Everything an entry does today is kept: abbreviations, links to other terms (they open in Lookup), audio, scanned dictionaries with **View scan**, copy per definition, "About this dictionary".
- Actions on the headword: **Copy** (all the definitions shown, as Define's Copy all does today), **Save** (bookmark; toggles; shown in the sidebar and on the phone home), and **Add my definition** where it exists today (Tauri, opens the quick-add dialog).

### Layout

- **Desktop:** three panes like Mail or Apple's Dictionary: sidebar 248px | results 380px (field on top) | the entry, centred, max 720px. The selected result is highlighted. Arrow keys move through results, Enter opens.
- **Phone:** the Lookup home shows the field, then **Recent** (with Clear) and **Saved** as grouped white lists with a gloss on the right, then the Wylie tip. Typing shows the results list. Tapping a result pushes the entry screen with a back button labelled "Lookup".

## In short

A pure function picks, from a term's definitions, up to four short English glosses that at least **two different dictionaries** share. Glosses are taken from the plain text of each definition split on `;` and `,`, trimmed, lower-cased for comparison, stripped of bracketed notes, kept only if 1 to 4 words long and Latin. Ranked by the number of dictionaries that give them, then by the user's dictionary order. Shown with the casing of the first dictionary that gave it, joined with ` · `. If fewer than one gloss qualifies, the box is not shown.

## Reader

- Paste or type a text in an editor with today's Split rules: Wylie converts on space, a plain space inserts a tsheg, Shift+Space a real space (a word break), Ctrl/Cmd+Enter splits, pasted legacy fonts are repaired. It is split into words with the existing segmentation (`tibetan-word-tokenizer` and `/botok-dictionary.json`, with its fallback); each word is a button. **Edit** returns to the editor, where spaces are the word breaks as today.
- Longer expressions found across neighbouring words (today's merge detection, up to 5 words) are drawn as a thin bracket under them; tapping it looks the expression up.
- Tapping a word selects it and shows its entry, condensed: headword, Wylie and phonetics, In short, the first definitions, and **Open entry →** (to Lookup). Desktop: a 440px panel on the right. Phone: a bottom sheet over the text.
- Up/Down move between words as in Split. Recent texts (today's `splitHistory`) are offered when the Reader is empty.

## Library

One page, grouped like iOS Settings: a large title on the phone, a centred 640px column on desktop. Sections, top to bottom:

- **Collections**: rows to **My glossary** (today's glossary page, now `/library/glossary/...`) and **Dictionaries** (today's catalog, `/library/dictionaries`), each with a one-line status ("35 on this device"). Both open as sub-pages with a back link "Library".
- **Add to this device**: today's pack manager, audio and scanned-dictionaries cards (Tauri only, as today).
- **Settings** (anchor `#settings`, where the sidebar's Settings link and `/library/settings` land): Appearance, Quick lookup (desktop), Dictionary order and preferences.
- **Help and about**: the three help dialogs (renamed "Looking up a word", "Searching the definitions", "Reading a text") and the About card.

Each existing card keeps its behaviour; only its frame changes, to a grouped section with a small uppercase label above it.

## Visual system

- Fonts: **Inter** for the interface (bundled offline with `@fontsource/inter`, SIL OFL), **Source Serif 4** for definitions (already bundled), **DDC Uchen** for Tibetan (already bundled). Instrument Sans is dropped.
- Palette (light): white surfaces, `#F7F7F6` sidebar and quiet panels, `#F2F2F1` phone ground, lines `#E7E7E5` / `#EFEFED`, ink `#141416`, secondary text `#5F6368`, tertiary `#6B6F75`, accent `#1F5BB8` with `#E8EFFA` for its tint, Tibetan in `#8E1B1B`. Dark mode keeps working with matching tokens.
- Phone: large titles (32px, 700), grouped white lists with 14px corners on the grey ground, segmented controls. Desktop: quiet panes split by hairlines, no cards inside cards.
- All colours, sizes and fonts go through `src/css/tokens.css`.

## Unchanged

- The quick lookup popup window (`GlobalLookupWindow`), the database and pack layers, Tauri, onboarding (it only inherits the new tokens and fonts).
- Never push anything under `public/packs/` from this branch.

## Out of scope

- Changing the Wylie converter (e.g. converting only valid Tibetan syllables).
- Detecting the language automatically (option A of the mockups).
