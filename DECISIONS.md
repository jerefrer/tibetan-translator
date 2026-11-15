# Decisions

## 2026-11-09 — Mobile store builds run locally, not in CI or EAS
**Chosen:** User decision: App Store and Google Play builds are made on the maintainer's Mac with `pnpm ios:release` and `pnpm android:release`, and uploaded by hand (Transporter / Play Console).
**Alternatives:** Expo EAS (does not apply: it builds Expo / React Native projects, not Tauri); GitHub Actions jobs for Android and iOS alongside the desktop matrix.
**Why:** One maintainer, a handful of releases a year. The signing identities already live on this Mac, Google Play requires the first upload to be manual anyway, and a CI pipeline would add a keystore, a distribution certificate, a provisioning profile and an App Store Connect API key to keep valid as secrets for very few runs.
**Trade-offs:** Mobile releases are not tied to the `v*` tag automatically and can lag behind desktop; they depend on this machine's toolchain (Xcode, Android SDK/NDK).
**Revisit if:** mobile releases become frequent, someone else needs to ship them, or a forgotten mobile release causes a real gap.

---

## 2026-11-09 — No public web version
**Chosen:** User decision: the app ships as desktop and mobile apps only. The `web` database mode stays in the code for development but is not deployed.
**Alternatives:** Hosting the browser build publicly.
**Why:** The web mode downloads the whole ~600 MB database through sql.js before the first lookup; serving every dictionary to anyone from a public site is more exposed with respect to the dictionary authors' rights; and Christian Steinert, whose data the app uses, already runs an online dictionary.
**Trade-offs:** No access from a machine where the app cannot be installed.
**Revisit if:** the database can be served per query from a backend, and the dictionary rights are settled.

---

## 2026-11-09 — Audio recordings stream from GitHub instead of shipping in the app
**Chosen:** User decision: the Heart of Tibetan Language recordings (4,622 mp3, 148 MB) leave the app bundle. They play from `raw.githubusercontent.com/jerefrer/tibetan-translator/main/public/audio`, and each dictionary's set can be downloaded for offline listening from Settings or during onboarding, as the scans can.
**Alternatives:** Keep them bundled (the Android bundle then exceeds Google Play's 200 MB base download); Play Asset Delivery for Android only; a zip per dictionary attached to a GitHub release.
**Why:** Tauri embeds all of `dist/` in the binary, so the recordings weighed on every installer, desktop included, for a feature few users open. Streaming from the repository needs no new hosting, and per-file downloads reuse the scans' pattern; `src/config/audio-manifest.json` (`pnpm build:audio-manifest`) lists the files.
**Trade-offs:** Without a connection and without a download, recordings do not play. Installed apps depend on `public/audio` staying at that path on `main`. A full offline download is about 4,600 requests (eight at a time).
**Revisit if:** GitHub rate-limits raw downloads, the recordings move, or offline audio becomes a common request.

---

## 2026-11-09 — Offline audio downloads one archive per dictionary
**Chosen:** Supersedes the per-file downloads of the previous entry. `pnpm build:audio` zips each dictionary's recordings (stored, not deflated) into `build/audio-archives/`, uploaded to the `dictionary-packs` release; the app downloads one archive and unpacks it. Streaming a single recording still reads `public/audio` on `main`.
**Alternatives:** Raising the per-file parallelism.
**Why:** Per-file downloads meant about 4,600 requests: on a phone each one costs a round trip, so the download took many minutes, and that many requests to raw.githubusercontent.com approaches its per-IP limit. One archive downloads at the speed of the connection.
**Trade-offs:** Changing the recordings now also means rebuilding and re-uploading the archives; an interrupted download restarts from zero.
**Revisit if:** the archives grow large enough that resuming an interrupted download matters.

---

## 2026-11-12 — Folio redesign on its own branch
**Chosen:** User decision: the Folio redesign (`docs/superpowers/specs/2026-11-12-folio-redesign-design.md`) is built on `feature/folio-redesign`. The app gets three destinations, Lookup, Reader and Library, in place of Define, Search, Split and Settings. Lookup has one field with a **བོད / EN** switch: བོད looks up Tibetan headwords with Define's Tibetan field unchanged (Wylie converted as typed), EN searches the definitions with everything Search supported (`&`, `{…}`, `[…]`, Wylie in parentheses, the query builder behind Advanced). The old routes redirect to the new ones.
**Alternatives:** Detecting the language of the field automatically (option A of the mockups); changing the Wylie converter to convert only valid Tibetan syllables, so that English typed in the Tibetan field stays English.
**Why:** Define and Search answered the same question from two pages, and users had to know which one to open. Automatic detection cannot tell Wylie from English reliably (`bde ba`, `ma`, `la`, `buddha` are both), and a wrong guess would mangle what the user typed; an explicit switch is one tap, and hints under the field offer the other mode when the text fits it better (Latin diacritics, no headword starting with the text, a query that reads as Wylie). Changing the converter would touch the most tested part of the app, which the quick lookup popup shares, and Sanskrit typed in Wylie (`buddha`) has to keep converting.
**Trade-offs:** One more control next to the field, and the user has to pick the mode; a word typed in the wrong mode is converted (བོད) or searched as is (EN) until the switch or a hint is used. The pages' own tests went with them. What they covered and still exists was ported first to the Lookup, Reader, TermEntry, Library and service tests; one gap found in review (Wylie in parentheses in an English query) was covered afterwards in the search-query and utils tests.
**Revisit if:** users keep typing English in བོད mode (or Wylie in EN) despite the hints, or a reliable language detector becomes available.

---

## 2026-11-12 — Folio redesign: choices made while building it
**Chosen:** Decisions taken during the build that a later reader may question:
- **Mode switch rules.** Switching to EN puts back the Latin that was typed (the "typed" memory), else the text as typed when it carried Latin diacritics (`kākiṇī`), else the Tibetan as is; switching to བོད converts Latin as Wylie and leaves Tibetan alone. A term in the route always means བོད, a `q` always EN, and the switch also replaces the route with `/lookup?mode=<mode>`, so that a definition link to the term already shown still fills the field.
- **`lookupState` storage key** (`{ mode, term, query }`), not the spec's `lookupMode`: one object restores mode, term and query together on return and relaunch. It falls back to Define's old `selectedTerm` when nothing was stored yet; previous English queries stay under Search's `previousQueries`.
- **The selected English result is local state**, not in the route: a term in the route always means a Tibetan lookup, so an EN result opens its entry without leaving EN mode.
- **Reader: spaces are word breaks.** Once a text is split, the editor keeps one space between words and a re-split reads the spaces back instead of running the tokenizer; Shift+Space types a word break. The tokenizer runs on a new text (paste, Paste, an emptied editor or a text with no space left). Expressions across words are looked up, not merged into the text as Split did.
- **The phone board's "Headwords · N / In definitions" row was dropped:** the བོད / EN switch does that job, and the spec has no such row.
- **Library shows the Settings cards inline**, not collapsed to rows as in the mockup, and the old phone sub-screens (Dictionary preferences) went with the Settings page.
**Alternatives:** The spec's `lookupMode` key; an English result in the route (`/lookup?mode=en&q=…&term=…`); always tokenizing the whole text on Split; the mockup's phone row and Library rows.
**Why:** Each keeps a behaviour users relied on in Define, Search or Split (restoring where they were, Split's word breaks, Search's queries) with fewer moving parts, and follows the spec where it and the mockups disagree.
**Trade-offs:** An English result cannot be linked to directly; the Reader keeps a flat word list (line breaks of a pasted text are not shown); Library is a long page on a phone.
**Revisit if:** users ask to share links to English results, need the text's lines in the Reader, or find Library too long.

---

---

## 2026-11-12 — Folio: glossary and dictionaries in the desktop sidebar, no "Look up as Tibetan" hint
**Chosen:** User decision, after trying the branch:
- The desktop sidebar lists My glossary and Dictionaries next to Lookup, Reader and Library. On a phone they stay rows of Library, and the tab bar keeps three tabs. Their "‹ Library" back link shows only on a phone.
- EN mode no longer offers "Look up `<tibetan>` as Tibetan". The བོད to EN hint stays.
- Lookup's results column grows with the window (`--results-width: clamp(380px, 38%, 600px)`), and the query builder stacks its match above its term when it is narrower than 30rem.
- Library on desktop is a 72rem column with each section's cards two by two; Settings puts the short cards in one column and the dictionary order in the other.
**Alternatives:** Three destinations on every layout, as the spec had it; keeping the EN hint for queries that read as Wylie.
**Why:** The three destinations came from the phone's tab bar, and the desktop sidebar has room to spare: the glossary and the catalog are used often enough to deserve one click. The EN hint fired for any English word that is also valid Wylie (`buddha`, `ma`, `la`), so it drew the eye on ordinary searches and offered nothing useful. The fixed 380px column left the entry with wide empty margins on a large window while the results and the query builder were cramped.
**Trade-offs:** Desktop and phone navigation now differ. A Wylie query typed in EN mode by mistake has to be switched to བོད by hand.
**Revisit if:** users often type Wylie in EN mode, or the sidebar grows crowded.

---

## 2026-11-12 — Folio: Library becomes Settings
**Chosen:** User decision: the Library page is renamed Settings (`/settings`, `SettingsPage`) everywhere. My glossary and Dictionaries get their own top-level routes (`/glossary/...`, `/dictionaries`); the old `/library...` and `/lexicon/...` routes redirect, keeping query and hash. On a phone the tab bar reads Lookup, Reader, Settings, with the glossary and dictionaries still rows of Settings. On desktop the sidebar separates Lookup and Reader from My glossary and Dictionaries with a hairline, and keeps Settings as its bottom link. The page is laid out as General (Appearance, Quick lookup), Downloads (pack manager, scanned dictionaries, audio), then Dictionary preferences beside Help and about.
**Alternatives:** Keeping the name Library; a Settings page that stays under `/library/settings`; dropping the sidebar separator.
**Why:** Once the desktop sidebar listed My glossary and Dictionaries, Library only held downloads, settings and help on desktop, so the name no longer described the page ("why not just Settings?"). Giving each page its own first path segment also removes the keep-alive special case for `library/<second>`.
**Trade-offs:** Old links and bookmarks depend on the redirects; the `#settings` anchor is gone, so a link into the page now targets `#dictionary-order` or the top; a phone's Settings tab holds the collections as well as the settings.
**Revisit if:** the collections grow beyond what a Settings row suits, or users look for downloads under another name.

---

---

## 2026-11-12 — Folio: draggable dividers, thicker expression bars in Reader
**Chosen:** User decision, after trying the branch:
- The divider between Lookup's results and entry, and the one before Reader's entry panel, can be dragged (`UiResizeHandle`, `PaneWidthMixin`). Arrow keys move them by 16px and a double-click goes back to the default. The width is stored (`lookupResultsWidth`, `readerPanelWidth`) and applied as `--results-width` / `--reader-panel-width`, never leaving the other pane less than 420px (Lookup) or 400px (Reader).
- Reader's expression brackets become rounded bars. On desktop they are 4px thick in 14px lanes, with 18px hit areas. On a phone they are 5px thick in 22px lanes, with 30px hit areas. Hovering a bar tints the words it covers.
- Reader's entry panel starts at the header's padding, so the entry's buttons line up with Edit and Show Wylie.
**Alternatives:** Fixed widths, as the mockups had them; a different gesture for expressions (long-press, or selecting several words).
**Why:** Screens and reading habits differ too much for one width to suit everyone. The 2px brackets with 11px hit areas could hardly be clicked, and nothing showed which words a bracket covered before clicking it.
**Trade-offs:** Taller lanes add space under every line of a text that has expressions. A width chosen in a large window is capped, not kept, in a smaller one.
**Revisit if:** the lanes make long texts feel loose, or users ask for more than one stored layout.

---

## 2026-11-13 — Folio: Dictionaries, Settings and My glossary redrawn
**Chosen:** User decision, on mockups added to the Folio canvas (boards DesktopDictionaries, DesktopGlossary, DesktopSettings and their phone versions):
- **Dictionaries** is the one place for dictionaries: the packs (install with confirmation, update, remove; the update check also runs quietly when the page opens), the dictionaries in lookup order with their switches and handles, those of packs not installed, and a detail pane (sources, languages, subjects, place in lookups, Move to top / bottom, Install). It replaces DictionaryCatalog, Settings' Dictionary preferences and PackManagerCard. On desktop, Up/Down select, Alt+Up/Down move the selected dictionary, Ctrl/Cmd+Z undoes a move or a switch and Ctrl+Y / Ctrl/Cmd+Shift+Z redoes.
- **Settings** holds settings only, as rows (name and a line of explanation on the left, control on the right) in groups: General, Quick lookup, Offline content, About, Help; on desktop an index of the groups on the left. Scans and recordings fold under one row each (open in the desktop app, folded on a phone and in a browser).
- **My glossary**: the title is the glossary picker; its menu lists the glossaries and creates (empty, from a spreadsheet, a .tibdict file) or removes them. CustomPackSection became GlossaryActions, the dialogs without the list. With no glossary, the page offers the three ways to start.
**Alternatives:** Keeping the existing cards in new frames (what the first Folio pass did); a Settings sub-page per group on desktop.
**Why:** The first pass had restyled these screens without designing them. Dictionaries were managed in two places (order and switches in Settings, browsing and packs in Dictionaries), a pack could be installed from three places with three behaviours, a dictionary's "about" had three renderings, and My glossary showed its own name twice, once in a wrapping dropdown.
**Trade-offs:** "Search its definitions" from a dictionary's detail, proposed on the mockups, needs a per-dictionary filter in Lookup's English search and was left for later. The undo history lives with the page and is lost on relaunch.
**Revisit if:** users look for the dictionary order in Settings, or ask for undo across sessions.

---

## 2026-11-13 — Folio: one help panel, a Saved page, a searchable dictionary filter
**Chosen:** User decisions, picked among proposals:
- **Help** becomes one panel for the whole app instead of three tabbed dialogs reachable only from Settings. It opens on the topic of the screen, from the sidebar's Help, F1 or Cmd/Ctrl+/ on desktop (beside the page, which stays usable), and from a "?" by the Lookup and Reader titles or Settings' rows on a phone (over the screen). Topics are short; a field finds them, including by words they do not use (`phonetic`, `csv`); search examples are buttons that run them.
- **Saved** gets its page (`/saved`: search in Tibetan, Wylie or gloss, Tibetan or recent order, copy as a tab-separated list, Clear all with Undo). The sidebar shows eight terms per section, a × to forget or unsave one, Clear for Recent, and folds each section (remembered).
- **The entry's dictionary tabs** become one filter, "All dictionaries · N", whose list can be searched and shows each dictionary's count. Two dictionaries sharing a name are told apart by their languages.
**Alternatives:** Help: keep the dialogs and add a "?" per screen. Saved: sidebar changes only, or drop Saved. Tabs: a table of contents beside the entry that scrolls to a dictionary, or nothing.
**Why:** The help was split in three and hidden in Settings. Saved grew without limit in the sidebar with no way to clear it. Tabs could not hold twenty dictionaries: two or three fitted, the rest went to a long menu that could not be searched.
**Trade-offs:** The filter hides the other dictionaries rather than scrolling to one. The help's text is now the app's to keep up to date: a feature that changes needs its topic changed.
**Revisit if:** users ask to jump to a dictionary while keeping the others in view, or for help topics in other languages.

---

## 2026-11-13 — Folio: the help is a dialog after all; no Tibetan order in Saved yet
**Chosen:** User decision: the help panel beside the page became a dialog, the topics on the left and the one chosen on the right (a list, then a topic, on a phone). Saved lists the newest first only; its "Tibetan order" option is gone.
**Alternatives:** Keeping the side panel (the page stays usable while reading); an overlay drawer.
**Why:** Beside Lookup's three panes the panel made four columns, all of them too narrow at common window widths. Trying an example while reading was the panel's one advantage; the dialog keeps the examples, and closes to show their result. `Intl.Collator('bo')` has no Tibetan rules in ICU: it sorts by code point, filing བསྒྲུབ་ under its prefix བ instead of its root letter ག, which is not the order Tibetan readers expect.
**Trade-offs:** The help covers the page while it is open. Saved cannot be browsed in dictionary order.
**Revisit if:** a root-letter sort key is written (prefix, superscript, root, subscript, vowel), which would also serve Saved and the glossary.

---

## 2026-11-13 — Tibetan order by root letter, written twice (JS and Rust)
**Chosen:** A Tibetan sort key of our own: each syllable read into root, prefix/superscript group, prefix, superscript, subscripts, vowel, suffixes and a fused vowel particle (དགའི་), compared in that order, the letters' Unicode order being the traditional one. Saved offers it beside Newest; the glossary always lists in it. The glossary's order lives in SQL (a `TIBETAN` collation registered on the lexicon connections), so the same algorithm exists in `src/services/tibetan-order.js` and `src-tauri/src/tibetan_order.rs`, held to one order by the shared fixture `tests/fixtures/tibetan-order.json`.
**Alternatives:** `Intl.Collator('bo')` (no Tibetan rules: code point order). Sorting the glossary in JS (only sorts the page shown: entries come 50 at a time with LIMIT/OFFSET). Fetching the whole glossary to sort it (changes the paging and the memory a large glossary needs). A sort-key column stored with each entry (a migration of every installed glossary, and keys to keep in step on import and edit).
**Why:** Readers expect བསྒྲུབ་ under ག, not under its prefix བ. The collation keeps paging and search in SQLite as they were. A plain-letter syllable is ambiguous (དགས་ dgas or dags): three letters read as prefix + root when the first can prefix the second, the rule the converters follow.
**Trade-offs:** Two implementations to keep alike; the fixture catches a divergence only on the words it holds. Sanskrit stacks and malformed syllables get a stable but approximate place (after the readable syllables of their first letter).
**Revisit if:** a maintained Tibetan collation appears (ICU, a crate, an npm package), or the two implementations drift.

---

## 2026-11-13 — Tibetan in gold on the dark theme
**Chosen:** User decision: `--rubric` is gold (`#D9B36C`) on the dark theme; the light theme keeps the logo's dark red.
**Alternatives:** The lightened red it had (`#F08A80`); a vermilion (`#E5735E`); a duller red (`#D27A70`).
**Why:** Lightened enough to read on the dark ground, the red turned salmon, nearly the dark theme's danger colour (`--danger-ink: #FF9A8D`): every Tibetan word looked like an error, and a list of them shouted. Gold keeps the idea of the light theme (red ink on paper becomes gold ink on dark paper, as precious Tibetan texts are written) and contrasts about 9:1 with the page.
**Trade-offs:** Gold is near the amber of notices and search hits; hits are filled blocks with dark text, Tibetan is coloured text without a ground, so they stay apart.
**Revisit if:** amber text (not a filled block) comes to sit beside Tibetan.

---

## 2026-11-13 — Scans: eight pages at a time; every download can be cancelled
**Chosen:** User decision: scanned dictionaries still download page by page from Christian Steinert's repository, but eight at a time over one kept-alive client; a `.complete` marker says a scan is whole. Scans, recordings and packs can be cancelled through one registry (`src-tauri/src/downloads.rs`, keys `scan:`/`audio:`/`pack:`); a cancelled download keeps nothing and rejects with `"cancelled"`, which the screens report as cancelled rather than failed.
**Alternatives:** One archive per scanned dictionary in the `dictionary-packs` release, as the recordings (one request, as fast as the connection; but ~136 MB for Jäschke and more for Das to build, upload and rebuild whenever the scans change).
**Why:** Measured: 32 pages took 15.4 s one at a time and 3.0 s eight at a time, the time going into each request's wait rather than the transfer. Nothing new to host or keep in step. Before the marker, any PNG on disk made a scan read as downloaded, so an interrupted download looked complete.
**Trade-offs:** Still about 700 requests to a repository we do not control. A scan downloaded before the marker existed, with pages its source lacks, reads as incomplete until downloaded again (which skips the pages present and writes the marker). A pack can no longer be cancelled once it is being unpacked.
**Revisit if:** the upstream repository moves or throttles, or downloads still feel slow on phones (then the archives).

## 2026-11-13 — Lookup and Search are two pages again
**Chosen:** User decision: Lookup's བོད / EN switch is gone. Lookup (`/lookup/<term>`) looks up a Tibetan term; Search (`/search?q=…&dict=…`) searches the definitions, with its own tab (phone: Lookup, Search, Reader, Settings) and sidebar entry, and opens a result's entry in its own entry pane rather than sending the user to Lookup. The two pages share the layout (`lookup-layout.css`), TermEntry, DefinitionResults and the freshness of their results (`ResultsFreshnessMixin`), but no text: switching never converts a query into a term or back. The only bridges are explicit buttons: Lookup's hint "Search … in the definitions" when Latin starts no term, and Search's "Look up … in Lookup" when the query is a Tibetan term.
**Alternatives:** Keep the switch and improve its conversions; Search sending a chosen result to Lookup, as the old app did.
**Why:** Used for real, the unified field still held two different searches, only hidden behind a small switch, and the conversions made when switching (English read as Wylie, Tibetan sent to the definitions) produced equivalences that meant nothing and confused the user. Opening the entry in Search keeps the list of results in view while reading.
**Trade-offs:** One more tab on a phone (four). The term and the query each live on their own page, so going from one to the other takes a button, not a toggle.
**Revisit if:** A way to tell Tibetan intent from English intent reliably appears, making one field honest again.

---

## 2026-11-13 — The Tibetan page is called Define again
**Chosen:** User decision: the page that opens a Tibetan term's entry is "Define" (route `/define/<term>`), beside "Search". Code names (LookupPage, `lookup/` folder, `lookupState`) stay.
**Alternatives:** Keep "Lookup"; rename the code too.
**Why:** "Lookup" and "Search" are near-synonyms, so neither name said which page does what; "Define" (give me this word's definition) vs "Search" (look inside the definitions) does. Cmd+D matches again, and the links inside definitions were already `/define/<term>`.
**Trade-offs:** Code names and the UI disagree (LookupPage shows "Define"); "Quick lookup" keeps its name as a feature, not a page.
**Revisit if:** the code is renamed for another reason.

---

## 2026-11-15 — Feedback goes to feedback@tibetantoolbox.org, and returning users see A new look once
**Chosen:** User decision for the address: `feedback@tibetantoolbox.org`, on the project's domain. Settings > About has a Send feedback row everywhere (a `mailto:` carrying the version and platform, opened through `tauri-plugin-opener` in the app, scoped to `mailto:*` in the main window only) with the address visible and a Copy button. Define's home shows a card, "A new look", once, to users who had data before the redesign: `newLook` in Storage is `pending` or `seen`, set at launch before the app writes anything of its own, from any of `onboardingComplete`, `autoFillWords` (main wrote it at every launch, web and app, so it is the most reliable signal), `dictionaries`, recent or saved terms. The card says what moved from the release before (Split is now Reader; My glossary and Dictionaries have their own pages; the shortcuts) and asks "Is something harder than before, missing, or not working?".
**Alternatives:** The personal address; a feedback form or a hosted issue tracker; a `mailto:` alone; showing the card to everyone, or on every launch; asking "do you prefer the old design?".
**Why:** The project's domain keeps the personal address out of the app. Many desktops have no mail client, so a `mailto:` alone would silently do nothing: the address is shown and copyable. A new user has nothing to compare with, so the card is for people with prior data only; it must be recorded before launch code writes defaults (`autoFillWords` is written while App.vue is imported, hence `src/record-returning-user.js` is imported first in `main.js`). There is no way back to the old design, so asking which one people prefer would only collect complaints nobody can act on, and invites status-quo bias; asking what is harder than before finds the regressions to fix.
**Trade-offs:** A user who cleared the app's storage looks new and sees no card. A dismissed card never comes back. Mail goes to one inbox someone has to read.
**Revisit if:** the inbox gets more than it can be answered, or a form or tracker becomes worth hosting.
