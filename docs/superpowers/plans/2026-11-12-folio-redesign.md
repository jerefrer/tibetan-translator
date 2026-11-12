# Folio redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the app around three destinations (Lookup, Reader, Library) with the Folio look, on branch `feature/folio-redesign`, without weakening anything about Tibetan input.

**Architecture:** Pull the logic now buried in DefinePage, SearchPage and SegmentPage into small services first (with the old pages switched onto them, so their tests keep guarding behaviour), then build the new shell and screens on those services, then delete the old pages. Vue 3 Options API with mixins, as everywhere in this repo; the `src/ui` components and `src/css/tokens.css` tokens for every style.

**Tech Stack:** Vue 3 (Options API), Vue Router 4, Vitest + @vue/test-utils (happy-dom), Tauri 2, `tibetan-ewts-converter`, `tibetan-to-phonetics`, `tibetan-word-tokenizer`, `@fontsource/inter`.

**Spec:** `docs/superpowers/specs/2026-11-12-folio-redesign-design.md`. Mockups: `https://claude.ai/artifact/PFQ9QitLsfx38cTtuuT8tG`; their HTML source is copied to `docs/redesign/folio/` in Task 1 so implementers can read exact sizes and colours.

## Global Constraints

- Read `CLAUDE.md` first. Options API only, no `<script setup>`. Code, comments, test names and commit messages in English.
- Commit subjects: conventional commits with a conjugated verb stating the user-visible effect (`feat(lookup): looks up Tibetan and English from one field`), first line ≤ 72 chars, body says why, last line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never `git add -A`; add the files you touched.
- Every colour, font, size, radius and spacing comes from `src/css/tokens.css`; no raw hex in components. Light and dark both work.
- Tibetan input is first-class: `src/ui/UiTibetanField.vue` and `src/services/typed-wylie.js` are reused **unchanged in behaviour**; `tests/ui/tibetan-field.test.js`, `tests/legacy-paste-wiring.test.js` and `tests/typed-wylie.test.js` must stay green untouched. The Wylie converter is not modified.
- Keep these couplings or the app breaks silently: definitions render inside a `.definition` element with `abbr[data-title]` and `/define/<term>` links (App.vue's jQuery listeners and `src/services/decorator.js`); the phone bottom bar keeps the class `app-nav--bar`; the scrolling root keeps the class `app-content`; keep-alive keys are the first path segment, so route watchers must guard on `this.$route.path.startsWith('/lookup')` (etc.).
- The quick lookup popup (`src/components/GlobalLookupWindow.vue`) shares `Entries.vue`, `EntriesEntry.vue`, `UiTibetanField`, tokens and the decorator: any change to those keeps `tests/quick-lookup-window.test.js` and `tests/quick-lookup.test.js` green, and the popup's look is not redesigned.
- Never commit or push anything under `public/packs/`.
- Do not run `pnpm build:packs`.
- Mobile breakpoint: `window.innerWidth <= 600` via `MobileResponsiveMixin` / `ResizeService`.
- Full suite before every commit: `npx vitest run` → `FAIL (0)`.

## Review Focus

1. **Typing Wylie in Lookup** (`sangs rgyas` + space → `སངས་རྒྱས་`, a pasted Tibetan line, a legacy-font paste, a multi-line paste) behaves exactly as in Define today, and the "typed" echo shows `sangs rgyas` on phone and desktop. Pinned in Task 7.
2. **Switching བོད ↔ EN keeps meaningful text**: from བོད, EN gets the typed Latin when the typed memory has it, else the Tibetan as is; from EN, བོད gets the Latin converted as Wylie. A mode switch never leaves mangled Tibetan in an English search. Pinned in Task 7.
3. **Links inside definitions and deep links**: `/define/<term>` (decorator links, the quick lookup popup, old bookmarks) and `/search/<query>` open Lookup on that term or query, with the field filled. Pinned in Task 5 and Task 7.
4. **Coming back** to Lookup (keep-alive) or relaunching keeps the mode, the field, the selected term and the results; a pack installed or a dictionary switched off in Library meanwhile refreshes them. Pinned in Task 7 and Task 9.
5. **The phone**: the software keyboard must not hide the results (use `--visible-height`), a result opens the entry with a back link, and the Reader's word sheet can be dismissed. Pinned in Task 11 and Task 13.

---

## Phase 1 — Foundations

### Task 1: Folio tokens, Inter, and the mockups in the repo

**Files:**
- Modify: `src/css/tokens.css`, `src/css/fonts.css`, `package.json`, `pnpm-lock.yaml`
- Create: `docs/redesign/folio/` (copy of the 14 `*.dc.html` boards and `canvas.json` from the mockup source in the session scratchpad `…/scratchpad/folio/project/`; the controller gives the path)
- Test: `tests/design-tokens.test.js`

**Interfaces:**
- Produces tokens (light / dark values):
  - `--font-ui: 'Inter', system-ui, sans-serif` (Instrument Sans removed from `fonts.css` and `package.json`)
  - `--bg` `#FFFFFF` / `#161618`; `--bg-quiet` `#F7F7F6` / `#1C1C1F` (sidebar, In short box); `--bg-grouped` `#F2F2F1` / `#161618` (phone ground behind grouped lists)
  - `--line` `#E7E7E5` / `#2E2E33`; `--line-soft` `#EFEFED` / `#26262A`
  - `--ink` `#141416` / `#EDEDEF`; `--muted` `#5F6368` / `#A1A1AA`; `--faint` `#6B6F75` / `#8B8B94`
  - `--accent` `#1F5BB8` / `#7AA7F0`; `--accent-soft` `#E8EFFA` / `#1E2A3D`; `--rubric` `#8E1B1B` / `#F08A80` (keep the existing names, update values)
  - Sizes: `--sidebar-width: 248px`, `--results-width: 380px`, `--entry-max-width: 45rem`, `--reader-panel-width: 440px`, `--text-large-title: 2rem` (phone screen titles, weight 700), `--text-headword-xl: 3.25rem` (desktop entry), `--text-headword-lg: 2.5rem` (phone entry, Reader panel), `--text-result-tibetan: 1.3125rem` (21px result rows), `--radius-group: 14px`
  - Keep every other existing token (other components use them); `--rail-*` stay until Task 6 replaces the rail.

- [ ] **Step 1:** Copy the mockup boards into `docs/redesign/folio/` and add a `README.md` there: one line per board (from `canvas.json` titles), and "Source of truth for sizes and colours; the spec wins where they disagree".
- [ ] **Step 2: Write the failing tests** in `tests/design-tokens.test.js`: `should use Inter for the interface` (`--font-ui` starts with `'Inter'`), `should define the Folio surfaces in both themes` (each of `--bg-quiet`, `--bg-grouped`, `--line-soft`, `--sidebar-width`, `--results-width`, `--entry-max-width`, `--reader-panel-width`, `--text-large-title`, `--text-headword-xl`, `--text-headword-lg`, `--text-result-tibetan`, `--radius-group` exists in light; each colour one also exists in dark), `should bundle Inter offline` (`fonts.css` imports `@fontsource/inter` weights 400, 500, 600, 700, latin and latin-ext; no `instrument-sans`).
- [ ] **Step 3:** Run `npx vitest run tests/design-tokens.test.js` → the new tests FAIL.
- [ ] **Step 4:** `pnpm add @fontsource/inter` and `pnpm remove @fontsource/instrument-sans`; update `fonts.css` and `tokens.css` with the values above.
- [ ] **Step 5:** Run the full suite → PASS. Open `pnpm dev` at `/define` and `/ui-showcase` (Playwright, 1280px and 390px, light and dark): text renders in Inter, nothing unreadable.
- [ ] **Step 6: Commit** `style(app): switches the interface to Inter and the Folio palette`.

### Task 2: The search query model as a service

**Files:**
- Create: `src/services/search-query.js`
- Modify: `src/components/SearchPage.vue` (use the service; behaviour unchanged)
- Test: `tests/search-query.test.js` (switch it to the real functions), `tests/search-page.test.js` must stay green

**Interfaces:**
- Produces:
  - `parseSearchQuery(query: string) -> { regular: string[], phoneticsStrict: string[], phoneticsLoose: string[] }` — today's `searchTerms` / `regularSearchTerms` / `phoneticsStrictSearchTerms` / `phoneticsLooseSearchTerms` (`SearchPage.vue` ~L311-331, `phoneticsTerms` ~L365).
  - `phoneticVariants(terms: string[], kind: 'strict' | 'loose') -> string[]` — today's `termPhoneticVariants`.
  - `buildSearchSql({ regular, strictVariants, looseVariants }) -> string` — the SQL `performSearch` builds today, byte for byte, including `MAX_ENTRIES_PER_REQUEST`.
  - `groupSearchEntries(entries, { dictionaries, regular, phoneticsStrict, phoneticsLoose }) -> Array<{ term: string, entries: object[] }>` — today's `groups` (enabled filter, grouping, both sort orders).
  - `highlightSearchTerms(html: string, { regular, phoneticsStrict, phoneticsLoose }) -> string` — today's highlighting (skips tags, `<em>`).
  - `isPlainTibetanQuery(query: string) -> boolean` — today's `quickAddTerm` condition (a single plain Tibetan term).

- [ ] **Step 1: Write the failing tests**: point `tests/search-query.test.js` at the service. For every rule it re-implements today, import the real function instead and keep the same inputs and expected values. Add `should build the same SQL as the Search page did` for three queries: `wakefulness`, `ཡེ་ཤེས་ & wisdom`, `{jomden}` (expected strings: capture them from the current `performSearch` before moving code, by logging `lastSql()` in a throwaway run, and paste them into the test).
- [ ] **Step 2:** Run it → FAIL (module missing).
- [ ] **Step 3:** Move the code into `src/services/search-query.js`; `SearchPage.vue` computes through it.
- [ ] **Step 4:** Run the full suite → PASS (`search-page`, `search-page-decoration`, `search-layout` untouched and green).
- [ ] **Step 5: Commit** `refactor(search): moves query parsing, SQL and ranking into a service`.

### Task 3: Recents, saved terms and transcription services

**Files:**
- Create: `src/services/recents.js`, `src/services/saved-terms.js`, `src/services/transcription.js`
- Modify: `src/services/history.js`, `src/services/split-history.js` (built on `recents.js`, exports and storage keys unchanged), `src/utils.js` (add `phoneticsForWord`), `package.json` (move `tibetan-ewts-converter` from devDependencies to dependencies if `src/` did not already import it at runtime — `src/services/wylie-to-unicode.js` does, so check and fix the manifest only if needed)
- Test: `tests/recents.test.js`, `tests/saved-terms.test.js`, `tests/transcription.test.js`; `tests/history.test.js` and `tests/split-history.test.js` stay green untouched

**Interfaces:**
- Produces:
  - `createRecents({ key: string, limit: number, sameAs(a, b): boolean, replacesLatest(latest, next): boolean }) -> { list(): any[], record(item): void, clear(): void }`; `record` and `clear` dispatch `window` event `recents-updated` with `detail: { key }`.
  - `history.js`: `recentTerms()`, `recordTerm(term)`, `clearHistory()`, `HISTORY_LIMIT` — same behaviour, now via `createRecents({ key: 'defineHistory', limit: 20, … })`.
  - `split-history.js`: `recentTexts()`, `recordText(text)`, `SPLIT_HISTORY_LIMIT` — same.
  - `saved-terms.js`: storage key `savedTerms` (array, newest first, no limit); `savedTerms(): string[]`, `isSaved(term): boolean`, `toggleSaved(term): boolean` (returns the new state); dispatches `saved-terms-updated`.
  - `transcription.js`: `wylieFor(tibetan: string): string` (EWTS via `EwtsConverter#to_ewts`, trimmed, no trailing `/` or space), `phoneticsForTerm(tibetan: string): string` (one word, via `phoneticsForWord`).
  - `utils.js`: `phoneticsForWord(setting: string, text: string): string` — converts the whole text at once with the same "reuse the last converter" rule as `phoneticsFor`, using `Settings.defaultSettingId` of `tibetan-to-phonetics` when `setting` is `'default'`.

- [ ] **Step 1: Write the failing tests**:
  - `recents.test.js`: `should keep the newest first and drop beyond the limit`, `should move a duplicate to the top`, `should replace the latest when replacesLatest says so`, `should announce changes with recents-updated`.
  - `saved-terms.test.js`: `should save a term and report it saved`, `should unsave it on a second toggle`, `should keep the newest saved first`, `should announce changes with saved-terms-updated`.
  - `transcription.test.js`: `wylieFor('བཅོམ་ལྡན་འདས་')` → `"bcom ldan 'das"`; `wylieFor('སངས་རྒྱས་')` → `'sangs rgyas'`; `phoneticsForTerm('བཅོམ་ལྡན་འདས་')` is a non-empty string without spaces (pin the exact value the library returns once you have run it, e.g. `chomdendé`); `should not disturb phoneticsStrictFor` (call `phoneticsForTerm` then `phoneticsStrictFor('བཅོམ་')` and compare with a value computed before).
- [ ] **Step 2:** Run them → FAIL.
- [ ] **Step 3:** Implement. Rebuild `history.js` and `split-history.js` on `createRecents`.
- [ ] **Step 4:** Full suite → PASS.
- [ ] **Step 5: Commit** `refactor(history): shares one recents store between Define and Split, adds saved terms and transcription`.

### Task 4: In short and result glosses

**Files:**
- Create: `src/services/in-short.js`, `src/services/glosses.js`
- Test: `tests/in-short.test.js`, `tests/glosses.test.js`

**Interfaces:**
- Produces:
  - `inShort(entries: Array<{ dictionaryId: number, definition: string }>, { max = 4, minDictionaries = 2 } = {}) -> string[]` — entries arrive in the user's dictionary order. Algorithm (the spec's "In short"): for each entry, strip HTML, drop text in `[]`, `()` and `{}`, split on `;` and `,`, trim, drop trailing `.`, keep candidates of 1 to 4 words made only of Latin letters (with diacritics), spaces, `-` and `'`; key = lower case. Count distinct `dictionaryId`s per key; keep keys with count ≥ `minDictionaries`; sort by count desc, then by first appearance; return up to `max`, each with the casing of its first appearance.
  - `plainGloss(definitionHtml: string, maxLength = 120) -> string` — tags stripped, whitespace collapsed, cut on a word boundary with `…`.
  - `loadGlosses(terms: string[], dictionaries: Array<{ id, enabled, position }>) -> Promise<Map<string, string>>` — one `SqlDatabase.exec` for the terms not cached (`SELECT term, definition, dictionaryId FROM entries WHERE term IN (…)`, values escaped by doubling `'`; use the column names `performSearch` uses), keeps per term the entry of the first enabled dictionary in `position` order, returns `plainGloss` of it; module-level cache `Map`, cleared by `clearGlossCache()` and on the window events `all-terms-updated` and `dictionaries-updated`.

- [ ] **Step 1: Write the failing tests**:
  - `in-short.test.js`: `should keep glosses at least two dictionaries share` (RY `"Bhagavat; Blessed One"`, Hopkins `"Supramundane Victor; Blessed One; Buddha"`, Berzin `"blessed one"` → `['Blessed One']`), `should rank by how many dictionaries agree`, `should ignore bracketed notes and long phrases`, `should return nothing when no gloss is shared`, `should not count one dictionary twice`, `should cap at max`.
  - `glosses.test.js` (mock `../src/services/sql-database` with `exec: vi.fn()`): `should pick the first enabled dictionary in the user's order`, `should query only the terms not cached`, `should escape quotes in terms`, `should forget the cache when packs change` (dispatch `all-terms-updated`), `plainGloss should strip tags and cut on a word`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Full suite → PASS.
- [ ] **Step 5: Commit** `feat(lookup): summarises what dictionaries agree on and loads one-line glosses for result lists`.

---

## Phase 2 — Shell

### Task 5: Routes and navigation config

**Files:**
- Modify: `src/router.js`, `src/config/navigation.js`
- Create: `src/components/lookup/LookupPage.vue`, `src/components/reader/ReaderPage.vue`, `src/components/library/LibraryPage.vue` as placeholders (a heading and nothing else) so routes resolve; later tasks fill them
- Test: `tests/router-redirects.test.js`, `tests/navigation.test.js`

**Interfaces:**
- Produces routes:
  - `/` → `/lookup`
  - `/lookup/:term?` (component `LookupPage`; query `mode` = `bo` | `en`, `q` = the English-mode query)
  - `/reader` (`ReaderPage`)
  - `/library` (`LibraryPage`), `/library/settings` → `/library#settings` (redirect), `/library/glossary/:packId?/:dictionaryId?` (`LexiconPage`), `/library/dictionaries` (`DictionariesPage`, keeps `?find=&status=`)
  - Redirects keeping query and hash: `/define/:term?` → `/lookup/:term?` (with `mode=bo`), `/search/:query?` → `/lookup?mode=en&q=<query>`, `/segment` → `/reader`, `/settings` → `/library#settings` (and `?view=preferences` → `/library#dictionary-order`, `?find`/`?status` → `/library/dictionaries` with them), `/glossary/...` and `/lexicon/...` → `/library/glossary/...`, `/dictionaries` → `/library/dictionaries`
  - `/tests` and `/ui-showcase` unchanged.
- `navigation.js`: `NAV_ITEMS` becomes `lookup` (Lookup, `/lookup`, icon `search`, shortcut `D`), `reader` (Reader, `/reader`, icon `book-open`, shortcut `T`), `library` (Library, `/library`, icon `library`, shortcut `G` → `/library#settings`), all `mobile: true`; helpers `navItemsFor`, `routeSegment`, `activeNavId`, `shortcutPaths` keep their names; `shortcutPaths()` also maps `S` → `/lookup?mode=en` and `K` → `'focus-lookup'` (App.vue turns that into the window event `focus-lookup` after routing to `/lookup`).

- [ ] **Step 1: Write the failing tests**: in `router-redirects.test.js` one test per redirect above (`should open Lookup on the term when an old Define link is followed`, `should open Lookup in English mode on the query when an old Search link is followed`, `should keep the query string when redirecting the glossary`, …); in `navigation.test.js` rewrite the item list expectations to the three items and add `should map Cmd+S to Lookup in English mode` and `should map Cmd+K to focusing Lookup`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement (placeholders included). **Step 4:** Full suite. Tests of old pages that navigate by path (`/define`, `/search`, `/segment`, `/settings`) may now fail because they mount through the router: fix them by mounting the old page components directly as they will be deleted in Task 16 — do **not** delete them yet. → PASS.
- [ ] **Step 5: Commit** `feat(app): routes Define, Search and Split links to Lookup and Reader`.

### Task 6: Sidebar and tab bar

**Files:**
- Modify: `src/components/AppNav.vue` (rewrite), `src/components/App.vue` (layout: sidebar width, help slot removed, `K` shortcut, keep everything else in `created`/`mounted`), `src/ui/icons.js` (register new icons)
- Test: `tests/app-nav.test.js`, `tests/app.test.js`

**Interfaces:**
- Consumes: `recentTerms()` (Task 3), `savedTerms()` (Task 3), `NAV_ITEMS` (Task 5).
- Produces:
  - Desktop (`app-nav--sidebar`, width `--sidebar-width`, ground `--bg-quiet`, hairline right): logo (existing SVG asset) and "Tibetan Translator", the three items (test ids `nav-lookup`, `nav-reader`, `nav-library`), section **Recent** (test id `nav-recent`, first 8 of `recentTerms()`, Tibetan `--text-result-tibetan`-ish 17px rows linking to `/lookup/<term>`), section **Saved** (test id `nav-saved`, all saved, hidden when empty), spacer, **Settings** link (`nav-settings` → `/library#settings`) with the update dot (`nav-update-dot`) when `updateReady`. Both sections refresh on `recents-updated` / `saved-terms-updated`.
  - Phone (`app-nav--bar`, kept class): three tabs with icon and label, active in `--accent`, the update dot on Library.
  - App.vue: the per-page help dialogs leave the shell (they move to Library in Task 14); `Cmd/Ctrl+K` routes to `/lookup` then dispatches `focus-lookup`.

- [ ] **Step 1: Write the failing tests** (`app-nav.test.js`): `should show the three destinations on desktop and phone`, `should list recent lookups and refresh when one is recorded`, `should hide Saved when nothing is saved`, `should keep the bottom bar class the dictionaries menu relies on`, `should put the update dot on Settings (desktop) and Library (phone)`; (`app.test.js`) `should focus Lookup on Cmd+K`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement to the `Main.dc.html` / `MobileHome.dc.html` boards. **Step 4:** Full suite → PASS; Playwright screenshot at 1440 and 390, light and dark.
- [ ] **Step 5: Commit** `feat(app): replaces the rail with a sidebar of recent and saved terms, and three tabs on phones`.

---

## Phase 3 — Lookup

### Task 7: Lookup state, field and modes

**Files:**
- Create: `src/ui/UiSegmented.vue` (+ export in `src/ui/index.js`), `src/components/lookup/LookupField.vue`, `src/services/lookup-state.js`
- Modify: `src/components/lookup/LookupPage.vue`
- Test: `tests/ui/segmented.test.js`, `tests/lookup-field.test.js`, `tests/lookup-page.test.js`

**Interfaces:**
- Consumes: `UiTibetanField`, `nextTypedWylie` / `typedWylieFor` (`typed-wylie.js`), `wylieToTibetan` (`quick-lookup.js`), `parseSearchQuery` (Task 2).
- Produces:
  - `UiSegmented`: props `modelValue`, `options: Array<{ value, label, ariaLabel?, tibetan?: boolean }>`, `label` (aria); `role="radiogroup"`, buttons `role="radio"`, arrow keys move; emits `update:modelValue`.
  - `lookup-state.js`: storage key `lookupState` = `{ mode: 'bo' | 'en', term: string, query: string }`; `readLookupState()`, `writeLookupState(partial)`; `switchLookupMode({ mode, text, typedWylie }, newMode) -> string` (the text the field shows after switching: to `en` → `typedWylie || text`; to `bo` → `text` converted with `wylieToTibetan` when it holds Latin, else `text`).
  - `LookupField`: props `mode`, `modelValue`, `typedWylie`, `readAs` (string shown under the field, e.g. `Wylie bcom → བཅོམ་ · 5 terms`); emits `update:modelValue`, `update:mode`, `keydown`, `clear`; in `bo` renders `UiTibetanField` (test id `lookup-field`), in `en` a `UiTextField` (same test id) plus an **Advanced** link (`lookup-advanced`) that toggles today's `SearchBuilder` below (visibility in storage `searchBuilderVisible`, as today); the switch is `UiSegmented` with `བོད` (Tibetan font, aria "Tibetan") and `EN` (aria "English"), test id `lookup-mode`. The typed echo (`lookup-typed`) shows on desktop and phone.
  - `LookupPage` (state only in this task, layout in Task 11): data `mode`, `text`, `typedWylieState`; route sync — `/lookup/:term` selects a term (fills the field like Define's `setSearchTerm`), `?mode=en&q=` fills an English query; writes `lookupState`; `beforeRouteEnter` with no term and no `q` restores `lookupState`; listens to `focus-lookup`; guards watchers with `$route.path.startsWith('/lookup')`.

- [ ] **Step 1: Write the failing tests**:
  - `segmented.test.js`: `should mark the chosen option checked`, `should emit the option clicked`, `should move with the arrow keys`.
  - `lookup-field.test.js`: `should convert Wylie on space in Tibetan mode` (type `sangs rgyas ` → `སངས་རྒྱས་`), `should not convert in English mode`, `should show the typed Wylie on a phone too` (set `innerWidth` 390), `should toggle the query builder with Advanced in English mode only`.
  - `lookup-state.test.js` (or inside `lookup-page.test.js`): `should switch to English with the typed Latin when known`, `should switch to English with the text as is otherwise`, `should switch to Tibetan converting Latin as Wylie`, `should leave Tibetan as is when switching to Tibetan`.
  - `lookup-page.test.js`: `should fill the field with the term of the route`, `should open in English mode with the query of an old Search link` (push `/search/wisdom` → mode `en`, field `wisdom`), `should restore the last mode and term when opened bare`, `should keep the field and mode when coming back` (keep-alive: deactivate/activate), `should focus the field on focus-lookup`, `should refuse a second tsheg and repair a legacy-font paste` (dispatch the same events as `tests/legacy-paste-wiring.test.js` on the Lookup field).
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** Full suite → PASS.
- [ ] **Step 5: Commit** `feat(lookup): looks up Tibetan or English from one field with a བོད / EN switch`.

### Task 8: The entry

**Files:**
- Create: `src/components/entry/TermEntry.vue`, `src/components/entry/InShort.vue`, `src/components/entry/DictionaryTabs.vue`
- Modify: `src/components/EntriesEntry.vue` (add prop `hideDictionary: Boolean` default `false`; nothing else changes, the popup keeps its look)
- Test: `tests/term-entry.test.js`, `tests/define-entries.test.js` and the quick lookup tests stay green

**Interfaces:**
- Consumes: `SqlDatabase.getEntriesFor`, `tibetanLookupKey` (`utils.js`), `DictionariesMenuMixin` (enabled filter and user order via `entriesForEnabledDictionaries`), `Decorator.decorate`, `inShort`, `wylieFor`, `phoneticsForTerm`, `isSaved` / `toggleSaved`, `CopyService.entriesToText`, `QuickAddDialog`, `DictionaryAboutDialog`, `supportsModularPacks`.
- Produces `TermEntry`: props `term: string`, `compact: Boolean` (Reader panel: headword `--text-headword-lg`, no tabs, first 3 dictionaries, an **Open entry →** link emitting `open-entry`), `highlight: Function | null` (EN mode passes `html => highlightSearchTerms(html, parsed)`); emits `loaded(count)`, `open-entry(term)`. Renders (test ids in brackets): headword h1 (`entry-headword`, `--text-headword-xl` desktop / `-lg` phone, `--rubric`, DDC Uchen), transcription line `wylie · phonetics · N definitions` (`entry-transcription`), actions Copy (`entry-copy`, copies all shown definitions), Save (`entry-save`, `aria-pressed`), Add my definition (`entry-add`, Tauri only); `InShort` (`entry-in-short`, hidden when `inShort()` returns `[]`, glosses joined by ` · `, `--bg-quiet` box, uppercase label "In short"); `DictionaryTabs` (`entry-tabs`: `All · N`, then the dictionaries present in the user's order as many as fit the width, then **More…** as a `UiMenu`; the choice filters, resets on a new term); then one block per dictionary (`entry-source`): its name as a small button opening the About dialog, then its `EntriesEntry` rows with `hideDictionary` (they keep `.definition`, copy, scan, audio). Loading uses `UiSpinner`; no results shows the uninstalled-packs notice as Define does.

- [ ] **Step 1: Write the failing tests** (mock `sql-database` `getEntriesFor` with three dictionaries' entries; Storage `dictionaries` order RY, Hopkins, Berzin): `should show the headword, its Wylie and phonetics, and the count`, `should show In short when two dictionaries agree and hide it otherwise`, `should group definitions under each dictionary in the user's order`, `should leave out dictionaries switched off`, `should filter by a dictionary tab and go back with All`, `should put dictionaries that do not fit under More`, `should copy every definition shown`, `should save and unsave the term`, `should keep definitions inside .definition so links and abbreviations work`, `should show View scan for a scanned dictionary`, `should show three dictionaries and Open entry when compact`, `should highlight hits when given a highlighter`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement to `Main.dc.html` (desktop) and `MobileEntry.dc.html` (phone). **Step 4:** Full suite → PASS.
- [ ] **Step 5: Commit** `feat(lookup): shows a term as one page, with what dictionaries agree on and a tab per dictionary`.

### Task 9: Results lists

**Files:**
- Create: `src/components/lookup/HeadwordResults.vue`, `src/components/lookup/DefinitionResults.vue`
- Modify: `src/components/lookup/LookupPage.vue`
- Test: `tests/lookup-results.test.js`

**Interfaces:**
- Consumes: `termsStartingWith(allTerms, prefix)` (`quick-lookup.js`), `loadGlosses` (Task 4), `parseSearchQuery`, `phoneticVariants`, `buildSearchSql`, `groupSearchEntries`, `highlightSearchTerms` (Task 2), `InfiniteScrollMixin`, `previousQueries` storage (as SearchPage), `UninstalledPacksNotice`.
- Produces:
  - `HeadwordResults`: props `terms: string[]` (all matches), `selected: string`; renders 100 at a time (`TERMS_BATCH_SIZE`, sentinel), each row (`lookup-result`) the Tibetan at `--text-result-tibetan` and its gloss (loaded with `loadGlosses` for the rows rendered, a faint placeholder until then), the selected row in `--accent-soft`; emits `select(term)`.
  - `DefinitionResults`: props `query: string`; runs the search like `SearchPage.performSearch` (SQL via the service, `SqlDatabase.exec`), groups, shows 20 groups at a time; each row (`lookup-result`) the term and the first matching definition as plain highlighted text, plus `N definitions`; before any query, the previous queries list (`lookup-previous`) as Search shows it; stale results re-run like Search (`all-terms-updated`, `dictionaries-updated`, enabled dictionaries changed); emits `select(term)`, `count(n)`.
  - `LookupPage`: in `bo` the matches are `termsStartingWith(SqlDatabase.allTerms, text)` refreshed on `all-terms-updated` (version counter as DefinePage), the first match auto-selected after `DEBOUNCE_SEARCH_MS` as Define does, `recordTerm` on selection; in `en` the query runs on Enter and after `DEBOUNCE_SEARCH_MS` of no typing, `storeQuery` as Search does. The read-as line: `bo` → `Wylie <typed> → <tibetan> · N terms` (just `N terms` without typed Wylie), `en` → `Terms whose definitions say “<query>” · N terms`.

- [ ] **Step 1: Write the failing tests**: `should list the terms starting with the Tibetan typed, 100 at a time`, `should show each result's gloss from the first enabled dictionary`, `should select the first match after a pause and record it in Recent`, `should move the selection with Up and Down`, `should search the definitions in English mode and list one row per term`, `should support phonetic searches in English mode` (`{jomden}` → `བཅོམ་ལྡན་` first, reuse the fixture from `tests/search-page.test.js`), `should show previous queries before any English search`, `should search again when a pack was installed meanwhile`, `should show the uninstalled packs notice when nothing matches`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement to `Main.dc.html` (results column) and `MobileResults.dc.html`. **Step 4:** Full suite → PASS.
- [ ] **Step 5: Commit** `feat(lookup): lists matching headwords with a gloss, or the terms whose definitions match`.

### Task 10: Hints between the modes

**Files:**
- Create: `src/components/lookup/LookupHints.vue`
- Modify: `src/components/lookup/LookupPage.vue`
- Test: `tests/lookup-hints.test.js` (port the cases of `tests/define-page-hints.test.js`)

**Interfaces:**
- Consumes: `hasLatinDiacritics` (`non-wylie-input.js`), `typedWylieFor`, `wylieToTibetan`, `SqlDatabase.allTerms`.
- Produces `LookupHints` props `mode`, `text`, `typedWylie`, `asTyped` (today's `searchInsteadText`), `headwordCount`, `definitionCount`; emits `switch({ mode, text })`. Shows (test ids):
  - `hint-search-definitions` in `bo` when `asTyped` is set (today's rule), or when `headwordCount === 0` and `typedWylie` is set: "No Tibetan term starts with <tibetan>. Search “<latin>” in the definitions" → `switch({ mode: 'en', text: asTyped || typedWylie })`.
  - `hint-look-up-tibetan` in `en` when the query is only ASCII letters, spaces, `'` and `+`, and `wylieToTibetan(query)` starts at least one term of `allTerms`: "Look up <tibetan> as Tibetan" → `switch({ mode: 'bo', text: <tibetan> })`.

- [ ] **Step 1: Write the failing tests**: one per condition above, the negative cases (`should not offer English search while Tibetan terms match`, `should not offer Tibetan lookup for a query with digits`), and every case of `define-page-hints.test.js` re-expressed against `LookupHints`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement to `ModeAmbiguous.dc.html` / `ModeNotWylie.dc.html` (hint box styling only). **Step 4:** Full suite → PASS.
- [ ] **Step 5: Commit** `feat(lookup): offers the other mode when what was typed reads better there`.

### Task 11: Lookup layout on desktop and phone

**Files:**
- Create: `src/components/lookup/LookupHome.vue`
- Modify: `src/components/lookup/LookupPage.vue`
- Test: `tests/lookup-page.test.js`

**Interfaces:**
- Consumes: everything from Tasks 7-10, `MobileResponsiveMixin`, `recentTerms`, `clearHistory`, `savedTerms`, `loadGlosses`.
- Produces:
  - Desktop (> 600px): three panes — the app sidebar (Task 6), a results column `--results-width` with the field on top (`lookup-results-pane`), the entry pane (`lookup-entry-pane`) centred with `max-width: var(--entry-max-width)`, each pane scrolling on its own (the entry pane carries `app-content` for scroll memory). With nothing selected the entry pane shows `LookupHome`.
  - Phone: large title "Lookup" (`--text-large-title`), the field; with an empty field `LookupHome` (`lookup-home`): **Recent** with Clear (`lookup-recent`, rows with gloss), **Saved** (`lookup-saved`, hidden when empty), the tip "Type **sangs rgyas** for སངས་རྒྱས་, or switch to EN to search the definitions."; typing shows the results; tapping a result shows the entry full screen with a back link "Lookup" (`lookup-back`) — today's `mobileShowDefinition` pattern from `MobileResponsiveMixin`; the results list height respects `--visible-height` so the keyboard does not cover it.
  - Keyboard (desktop): Up/Down move through results from the field, Enter opens the selected result in `en` mode, Escape clears the field.

- [ ] **Step 1: Write the failing tests**: `should show three panes on desktop`, `should show Recent and Saved with glosses on an empty phone Lookup`, `should clear Recent`, `should open the entry full screen on a phone and come back with Lookup`, `should size the phone results to the visible height`, `should open the selected English result with Enter`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement to `Main.dc.html`, `MobileHome.dc.html`, `MobileResults.dc.html`, `MobileEntry.dc.html`, `ModeTibetan.dc.html`, `ModeEnglish.dc.html`. **Step 4:** Full suite → PASS; Playwright at 1440, 1024, 390 in light and dark: type `bcom`, `sangs rgyas `, switch to EN, `{jomden}`, `buddha nature`, open a result, go back.
- [ ] **Step 5: Commit** `feat(lookup): lays Lookup out in three panes on desktop and as a list and a page on phones`.

---

## Phase 4 — Reader

### Task 12: The segmenter as a service

**Files:**
- Create: `src/services/segmenter.js`
- Modify: `src/components/SegmentPage.vue` (use the service; behaviour unchanged)
- Test: `tests/segmenter.test.js`; `tests/split-page.test.js` stays green

**Interfaces:**
- Produces (moved from `SegmentPage.vue` ~L150-400): `splitIntoWords(text: string) -> Promise<string[]>` (tokenizer lazily created from `/botok-dictionary.json`, fallback split on `[་།\s]+` with a tsheg appended, only `TEXT` chunks); `wordsFromSpacedText(text: string) -> string[]` (today's `parseTextareaToTerms`); `findMerges(words: string[], hasEntries: (term) => Promise<boolean>, { maxCount = MAX_MERGE_TERM_COUNT, around = null } = {}) -> Promise<Array<{ start: number, count: number, term: string }>>` (today's `checkPossibleMerges` / `checkMergesAtIndex` / `updateMergesAroundIndex`, `around` limiting the check to indices near one); `mergeLanes(merges) -> Array<{ start, count, lane }>` (today's `mergeBrackets` lane layout).

- [ ] **Step 1: Write the failing tests**: `should split with the tokenizer and keep only text chunks`, `should fall back to tsheg splitting when the dictionary fails to load`, `should read word breaks from spaces`, `should find a two-word expression that has entries`, `should not look beyond five words`, `should recheck only around a changed index`, `should stack overlapping merges in lanes`.
- [ ] **Step 2:** FAIL. **Step 3:** Move the code. **Step 4:** Full suite → PASS.
- [ ] **Step 5: Commit** `refactor(split): moves word splitting and expression detection into a service`.

### Task 13: Reader

**Files:**
- Create: `src/components/reader/ReaderEditor.vue`, `src/components/reader/ReaderText.vue`, `src/components/reader/ReaderWordPanel.vue`
- Modify: `src/components/reader/ReaderPage.vue`
- Test: `tests/reader-page.test.js` (port the editor, splitting, terms, keyboard and phone cases of `tests/split-page.test.js`)

**Interfaces:**
- Consumes: Task 12, `TermEntry` (`compact`), `recentTexts` / `recordText`, `convertWylieInText`, `mayNeedLegacyRepair`, `SqlDatabase.getEntriesFor`, `tibetanLookupKey`.
- Produces:
  - `ReaderEditor`: today's Split text area rules exactly (`SegmentPage.vue` ~L459-528): Wylie converts on space/tsheg keyup with `convertWylieInText({ normalizeTrailingPunctuation: false, preserveWhitespace: true })`, plain space inserts a tsheg, Shift+Space a real space, Ctrl/Cmd+Enter emits `split`, paste repairs legacy fonts and splits; test id `reader-editor`; a **Paste** button (clipboard read, Tauri plugin or `navigator.clipboard`) and **Split**.
  - `ReaderText`: props `words`, `merges` (with lanes), `selected` (index or `{ start, count }`); each word a `<button>` (`reader-word`, DDC Uchen at 34px desktop / 26px phone), words without entries in `--faint`, merges as thin brackets under the words (`reader-merge`, clickable); emits `select(selection)`.
  - `ReaderWordPanel`: desktop a right panel `--reader-panel-width` (`reader-panel`); phone a bottom sheet (`reader-sheet`) over the text, 60% of `--visible-height`, with a grab handle, dismissed by swiping down, tapping the dimmed text, or Escape; shows `TermEntry compact` for the selected word or merge; **Open entry →** routes to `/lookup/<term>`.
  - `ReaderPage`: header "Reader" with **Edit** (back to the editor, spaces as breaks), **Show Wylie** (toggles a small `wylieFor` line under each word), **Clear**; empty state lists Recent texts (`reader-recent`); Up/Down move between words (window keydown while active, ignored in inputs and dialogs, as Split); the text is recorded with `recordText` when split.

- [ ] **Step 1: Write the failing tests**: `should convert Wylie on space in the editor`, `should insert a tsheg on space and a word break on Shift+Space`, `should split on Cmd+Enter and show one button per word`, `should repair a legacy-font paste`, `should show a word's entry in the side panel on desktop`, `should open a bottom sheet on a phone and close it with Escape`, `should look up a detected expression`, `should move between words with the arrow keys`, `should go back to the editor with word breaks kept`, `should reopen a recent text`, `should open the full entry in Lookup`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement to `DesktopReader.dc.html` and `MobileReader.dc.html`. **Step 4:** Full suite → PASS; Playwright at 1440 and 390 with a two-line text.
- [ ] **Step 5: Commit** `feat(reader): reads a Tibetan text word by word, with each word's entry beside it`.

---

## Phase 5 — Library

### Task 14: Library

**Files:**
- Modify: `src/components/library/LibraryPage.vue`, `src/components/settings/SettingsCard.vue` (grouped frame: small uppercase label above a `--radius-group` white group on `--bg-grouped` on phones, hairline sections on desktop), `src/components/LexiconPage.vue` and `src/components/DictionariesPage.vue` (back link "Library" on both layouts; route paths updated to `/library/...` in their `$router` calls), the three help dialog components (titles "Looking up a word", "Searching the definitions", "Reading a text", content updated to the new screens)
- Test: `tests/library-page.test.js`; `tests/settings-page.test.js`, `tests/dictionaries-page.test.js`, `tests/lexicon-*.test.js` updated for the new paths

**Interfaces:**
- Consumes: the existing cards (`AppearanceCard`, `GlobalLookupCard`, `DictionaryPreferencesCard`, `PackManagerCard`, `AudioCard`, `ScannedDictionariesCard`, `AboutCard`), `supportsModularPacks`, `isTauri`.
- Produces `LibraryPage` (large title "Library" on phones; a centred column `max-width: 40rem` on desktop), sections with these anchors and test ids: `library-collections` (rows **My glossary** → `/library/glossary`, **Dictionaries** → `/library/dictionaries` with "N on this device"), `library-device` ("Add to this device": `PackManagerCard`, `AudioCard`, `ScannedDictionariesCard`, Tauri only as today), `#settings` / `library-settings` (`AppearanceCard`, `GlobalLookupCard` desktop Tauri only, `#dictionary-order` `DictionaryPreferencesCard`), `library-help` (three rows opening the help dialogs, `AboutCard`). Arriving with a hash scrolls that section into view.

- [ ] **Step 1: Write the failing tests**: `should list the collections with their status`, `should show the device section only where packs are supported`, `should land on Settings from the sidebar link`, `should land on dictionary order from an old preferences link`, `should open each help dialog`, `should go back to Library from the glossary and the dictionaries`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement to `MobileLibrary.dc.html`. **Step 4:** Full suite → PASS; Playwright at 1440 and 390.
- [ ] **Step 5: Commit** `feat(library): gathers the glossary, dictionaries, downloads and settings in one Library`.

---

## Phase 6 — Finish

### Task 15: Onboarding and the rest of the app on the new look

**Files:**
- Modify: whatever still looks like the old design once Tasks 1-14 are in: `OnboardingScreen.vue`, `ScanViewer.vue`, `QuickAddDialog.vue`, `DictionaryAboutDialog.vue`, `UninstalledPacksNotice.vue`, dialogs and toasts in `src/ui` — tokens, spacing and type only, no behaviour change
- Test: existing tests stay green

- [ ] **Step 1:** Playwright tour at 1440 and 390, light and dark: onboarding (`localStorage` cleared, web build shows what it can), each dialog, the scan viewer, toasts. List what clashes (old radii, Instrument Sans leftovers, raw colours: `grep -rn "#[0-9A-Fa-f]\{6\}" src/components src/ui --include=*.vue`).
- [ ] **Step 2:** Fix each with tokens. **Step 3:** Full suite → PASS.
- [ ] **Step 4: Commit** `style(app): brings onboarding, dialogs and the scan viewer to the Folio look`.

### Task 16: Remove the old pages and document

**Files:**
- Delete: `src/components/DefinePage.vue`, `SearchPage.vue`, `SegmentPage.vue`, `ConfigurePage.vue`, `SearchInsteadHint.vue`, `TermEntries.vue`, `ResizableDivider.vue` and any component left with no importer (check each with `grep -rn "<Name>" src`), and their tests (`define-page*.test.js`, `search-page*.test.js`, `search-layout.test.js`, `split-page.test.js`, `split-help.test.js` if its dialog is gone, `resizable-divider.test.js`, `settings-page.test.js` cases for the page shell) — **only after** checking each deleted test's subject is covered by a Lookup, Reader or Library test; list any that is not and port it first.
- Modify: `CLAUDE.md` (routes, project structure, component patterns, keyboard shortcuts), `DECISIONS.md` (append: "2026-11-12 — Folio redesign on its own branch": chosen three destinations and the བོད / EN switch; alternatives: automatic language detection, converting only valid syllables; why; trade-offs; revisit if).
- Test: full suite

- [ ] **Step 1:** For every test file to delete, list its `it(...)` names and the new test that covers each; port the uncovered ones.
- [ ] **Step 2:** Delete the files; run `npx vitest run` → PASS; run `pnpm build` → succeeds with no warning about missing imports.
- [ ] **Step 3:** Update `CLAUDE.md` and `DECISIONS.md`.
- [ ] **Step 4:** Final Playwright tour (Review Focus 1-5 by hand, 1440 and 390, light and dark).
- [ ] **Step 5: Commit** `refactor(app): removes the Define, Search and Split pages that Lookup and Reader replace` and `docs: describes the Folio navigation and why it was chosen`.
