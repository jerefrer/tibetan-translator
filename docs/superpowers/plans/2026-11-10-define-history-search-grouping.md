# Define history and Search grouped by term — implementation plan

Branch: `feature/mobile-polish` (continue on it). Approved by the owner on
2026-11-09 from the mockup "Tibetan Translator — Define et Search" (boards
"Define vide · A" and "Search · C"). Read `CLAUDE.md` first: Vue 3 Options API,
`src/ui` components, design tokens only (no raw colours), Storage via
`src/services/storage.js`. Tests: Vitest + @vue/test-utils (`tests/define-page.test.js`,
`tests/define-entries.test.js`, `tests/search-*.test.js`, `tests/settings-page.test.js`).
Run the whole suite with `./node_modules/.bin/vitest run`. Test names:
`should … when …`. Failing test first, then the code.

## Part A — Define: recent terms and a Wylie tip on the empty screen

### A1. A history service
`src/services/history.js`: the terms the user opened in Define, most recent
first, de-duplicated, capped at 20, stored with `Storage` under `defineHistory`.
API: `recentTerms()`, `recordTerm(term)` (moves an existing term to the top),
`clearHistory()`. Ignore empty terms. Unit tests for each behaviour.

### A2. Record the opened term
In `src/components/DefinePage.vue`, record a term when its entries are shown
(the selected term the user lands on: tapping a term in the list, a /define/:term
route, a link inside a definition). Find the single place where the selected
term's entries get loaded and call `recordTerm` there. Test it.

### A3. The empty screen
When the field is empty and no term is selected (today: a blank area under the
field), show, as in board "Define vide · A":
- a "Recent" section label (small uppercase muted), a "Clear" text button on its
  right, and a card listing the recent terms: each row the Tibetan term
  (Tibetan font, `var(--rubric)`), its Wylie in small muted text on the right
  (use the existing Unicode-to-Wylie helper the app already has — search
  `src/utils.js` and `tibetan-*` libraries; if none exists, omit the Wylie).
  Tapping a row opens that term exactly as tapping it in the terms list does.
  At most 8 rows. Hidden when there is no history.
- a "Tip" card: "No Tibetan keyboard? Type in Wylie.", the example
  `sangs rgyas` → `སངས་རྒྱས་`, and "Each syllable turns into Tibetan when you
  type a space." Shown always on the empty screen (with or without history).
Use `src/ui` components (`UiList`/`UiListItem` if they fit, `UiButton` ghost
for Clear) and tokens. Phone and desktop. Tests: rows render from history, a
row opens its term, Clear empties it, tip present, nothing when a term is shown.

## Part B — Search: results grouped by Tibetan term

### B1. One shared "term and its definitions" component
Create `src/components/TermEntries.vue` (or a better name if one fits the
codebase) that renders one Tibetan headword and a list of definitions, each
with its dictionary label above it, exactly the way Define renders the entries
of the selected term today (look at how DefinePage/`Entries.vue`/
`EntriesEntry.vue` draw a definition card: label, decorated definition, scanned
dictionary page + "View scan", copy button). Prefer extracting/reusing
`EntriesEntry.vue` for each definition rather than duplicating it. Props: the
term (already decorated HTML allowed), the entries, an optional `limit` and a
`moreLink`/event for "N more in Define". Define keeps its look; if adopting the
shared component in Define is a large or risky change, keep Define as is and
make the Search group reuse `EntriesEntry.vue` so both look the same — record
which you did.

### B2. Group the results
`src/components/SearchPage.vue` sorts up to 5000 entries client-side
(`sortedEntries`, key `[startsWith, dictPos, rank, termLength]`) and shows them
50 at a time (`displayedCount`, `batchSize`, InfiniteScrollMixin).
- Group the sorted entries by `term`. Order the GROUPS by relevance:
  `[startsWith, best rank in the group, term length]` (no dictionary position);
  order the entries INSIDE a group by the user's dictionary position, then rank.
- Infinite scroll loads groups: 20 groups per batch (keep the existing
  sentinel/mixin, count groups instead of entries).
- Decoration (`highlightSearchTerms` etc.) stays lazy per entry as today; do not
  decorate entries of groups not yet shown.
- The count line becomes e.g. "Showing 20 of 312 terms · 2875 definitions"; the
  end-of-list text "All 312 terms loaded".
- Each group: the Tibetan headword as the title (highlighted as today), tappable,
  opening Define on that term (`/define/<term>`); then its definitions via B1,
  keeping hit highlighting and the dictionary "About" button behaviour.
- Update `tests/` that assert the flat result list (`search-result` test ids,
  counts) to the grouped structure; keep the test ids sensible
  (`search-group`, `search-group-term`, `search-result` for each definition).

### B3. How many definitions per term (a setting)
New preference `searchDefinitionsPerTerm`: 1, 3 (default), 5, 10 or "All".
- Search shows the first N definitions of a group, then a text button
  "N more in Define →" that opens Define on that term. "All" shows every one.
- Setting UI: in Settings, a "Search" card (desktop column + phone list, follow
  how `AppearanceCard.vue` and `ConfigurePage.vue` are built) with a labelled
  select (`UiSelect`) "Definitions per term in Search". Storage key as above.
- Tests: default 3 with the "more" link; "All" shows all and no link; the
  setting persists.

## For each task
Failing test → code → whole suite green → `git add <only this task's files>`
(never `-A`; another session may edit other files) → commit. Subjects are
user-visible effects, conventional type, third-person verbs, e.g.
`feat(define): shows your recent terms and a Wylie tip before you type`,
`feat(search): groups results by Tibetan term, most relevant first`,
`feat(settings): lets you choose how many definitions Search shows per term`.
End every message with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
Never touch `src-tauri/`, never push, never run `pnpm build:packs`.

## Done when
Parts A and B committed, the suite passes, `./node_modules/.bin/vite build`
succeeds. Report commits, results, "Rulings I made", and anything undone.
