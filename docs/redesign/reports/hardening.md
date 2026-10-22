# Phase 5 (audit part): hardening report

- **Branch:** `claude/redesign-hardening-audit-bqbiuz`, from `redesign` at `63acf6e`. Nothing was pushed to `main` or `redesign`. No PR opened.
- **Status:** audit done, clear defects fixed (23 commits), the rest is listed under "Decisions for the owner".
- **How it was checked:** the web dev server (`pnpm dev`, port 8080) driven by Playwright (Chromium) with the real core pack, extracted read-only from `public/packs/core.7z` into the git-ignored `public/TibetanTranslator.sqlite` (deleted before the last commit). Nothing under `public/packs/` or `src-tauri/` was touched; `pnpm build:packs` and `pnpm build:database` were not run.
- **Tauri-only screens** (Glossary, Settings' desktop cards, first launch, Add my definition, quick lookup window): there is no Glossary report in `docs/redesign/reports/`, so its preview technique could not be followed. I used the approach of the quick-lookup report instead: a Playwright init script that defines `window.__TAURI_INTERNALS__` (invoke, transformCallback, window metadata) and answers the IPC from Node, `node:sqlite` on the extracted core pack for `pack_*` commands, an in-memory glossary of 40 entries (one with a 200-letter word) for `lexicon_*`, the real `pack-manifest.json` for `fetch_pack_manifest`, and a `download_pack` that never resolves for the first-launch screen. The main window then runs in its `tauri-packs-native` mode, the popup (`popup.html`) in its own.
- **Tests:** `pnpm test` before each push: **1,322 passed, 1 failed** (71 files). The failure is `tests/apkg-reader.test.js`, which needs the local `INALCO_L1_voca.apkg` that is not in this checkout; it fails the same way on the untouched branch. The untouched branch gave 1,299 passed / 1 failed in this checkout (the brief says 1,300); the 23 new tests are listed with each fix. `pnpm build` passes.
- **Screenshots** are in the session scratchpad (`shots/`, about 300 files), named `<what>-<width>-<theme>-<text size>.png`; the names below refer to them. None was committed.

## Checklist

Legend: **ok** checked, nothing to fix · **F*n*** fixed, see "Fixed" · **D*n*** needs a decision, see "Decisions for the owner" · **n/c** could not check · **n/a** does not apply. "Long" is long Tibetan terms, very long words without spaces, empty strings and 3,000 results, where they apply. "Kbd" is keyboard only: Tab order, visible focus, Escape, focus trap and return.

| Screen | Light | Dark | 1440 | 1180 | 1024 | 768 | 600 | 390 | 125% | 150% | Kbd | Reduced motion | Long |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Define, empty | ok | ok | ok | ok | ok | ok | ok | ok | ok | D9 | ok, D12 | ok | ok (empty field, clear) |
| Define, with a term | F8 | ok | F6 | ok | D1 | D1 | ok | F9 F12 | F12 | F12 D9 | F13 F14 | ok | F6, F16 (718/772 terms) |
| Define, no results + search-instead hint | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | n/a |
| Define, scanned entry + scan viewer | ok | ok (viewer is dark in both, by design) | ok | ok | ok | ok | ok | ok | ok | ok | F11 | ok | n/a |
| Define, Dictionaries menu | F8 | ok | D2 | D2 | D2 | D2 | F10 | F10 | F10 | F10 | ok | ok | ok |
| Define, About dialog | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| Define, help | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | n/a |
| Search, empty + recent searches | F8 | ok | ok | ok | ok | ok | ok | ok | ok | ok | F22 | ok | ok (long recent query wraps) |
| Search, results | ok | D4 | ok | ok | ok | ok | ok | F9 F19 | ok | ok | D3 (scroll) | ok | F15 F17 (2,960 results) |
| Search, query builder, 3 conditions | F4 F8 | ok | ok | ok | ok | ok | ok | ok | ok | ok | F22 | ok | ok |
| Search, no entries | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | n/a |
| Search, scanned rows (not drawn on any board) | ok | ok | ok | ok | ok | ok | ok | F19 | ok | ok | ok | ok | n/a |
| Split, empty | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | F5 | ok | n/a |
| Split, text split with merge brackets | ok | ok | ok | ok | ok | ok | ok | F9 | F12 | F12 | F21 F22 | ok | F20 (tall stacks) |
| Split, term with no entry (marker not drawn on any board) | F8 | F8 | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | n/a |
| Split, definitions | ok | ok | ok | ok | ok | ok | ok | F9 | ok | ok | F14 | ok | ok |
| Split, help | ok | ok | ok | ok | ok | ok | ok | D15 | ok | ok | ok | ok | n/a |
| Dictionaries | ok | ok | ok | ok | ok | ok | ok | ok (filter rows scroll sideways, by design) | ok | ok | F5 F14 | F18 | n/a |
| Glossary (Tauri mocked) | F4 F8 | ok | ok | F23 | F23 | F23 | ok | ok | ok | ok | ok | ok | ok (200-letter word wraps) |
| Settings (web, and Tauri mocked) | F4 | ok | ok | ok | ok | ok | ok | D5 | ok | ok | F4, D13, D14 | ok | ok |
| First launch (Tauri mocked) | F8 | ok | ok | ok (150%) | ok (125%) | ok | ok | ok | ok | ok | ok | ok | n/a |
| Quick lookup window (`popup.html`, Tauri mocked) | ok | ok | n/a (650×500 window; 560×480, 450 and 390 wide checked) | n/a | n/a | n/a | n/a | ok | ok | ok (cramped, D17) | F7 | ok | F7 |
| Toast | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | F18 | ok |
| Loading overlay | ok | D11 | ok | ok | ok | ok | ok | ok | ok (ring in px, by design) | ok | n/a | ok (spinner slows) | n/a |
| `/ui-showcase` (development only) | ok | ok | ok | ok | ok | ok | ok | D18 | ok | ok | D18 | ok | n/a |
| Everywhere: OS theme change with "System" | F1 | F1 | | | | | | | | | | | |

## Fixed

Each line is one commit on the branch; every commit message ends with the `Co-Authored-By` line. Tests named are new unless said otherwise.

**The three separate fixes asked for**

1. **F1** `6644ebf` fix(theme): follows an OS theme change on every page, not only after Settings was opened. The listener moved from the Appearance card to `App.vue` (`watchSystemTheme()` in `src/services/theme.js`); the card keeps saving and applying the choice. Tests: `theme.test.js`, `app.test.js` (two).
2. **F2** `bc965d1` chore: deletes `src/components/DropZone.vue` and the `filedrop` dependency. Confirmed unused: no import, no `<drop-zone>`/`<DropZone>` tag, no dynamic `import()` naming it, no `import.meta.glob`, and `filedrop` was imported only there. `pnpm build` and `pnpm test` pass.
3. **F3** `1f62380` chore: deletes the `sass` devDependency and `vue.config.js`. No `.scss`/`.sass` file or `lang="sass"`/`"scss"` block exists; `vue.config.js` is a Vue CLI/webpack config that Vite never reads, referenced only in an earlier report. `babel.config.js` is kept (the `babel-node` build scripts use it). `pnpm build` and `pnpm test` pass.

**Accessibility**

4. **F4** `25cabf2` names every switch and select: the 35 dictionary switches in Settings, the Global lookup switch, each builder row's "How to match" select, the glossary switcher. `UiSwitch` and `UiSelect` now put `aria-label` on the control (the Dictionaries menu already passed one, but it landed on the wrapper). Tests: `ui/reka-components.test.js` (two), `settings-page.test.js`.
5. **F5** `e00d6ad` the page content is a `<main>`; Split's dividers expose `aria-valuenow/min/max` (a focusable separator must); Define's infinite-scroll spinner is hidden from assistive technology inside the terms listbox; dictionary cards use `h2` instead of `h3` (no skipped level; same look). Test: `resizable-divider.test.js`.
6. **F21** `f7e98d2` Split's merge buttons sat inside the terms listbox; the listbox is now an inner wrapper holding only the terms, the brackets beside it, same place on screen (pixel diff of the list: identical). Test: `split-page.test.js` (rewritten T3 assertion).
7. **F11** `eec2d97` the scan viewer prevented the dialog's initial focus, so the focus stayed behind it and Tab walked the page underneath. It now focuses itself; Tab stays inside, Escape closes, the focus returns to "View scan". Test: `scan-viewer.test.js`.
8. **F22** `b82a0e8` focus no longer falls to the top of the document after: a recent search (field), removing a builder condition (row above), Hide / "Query builder" (each hands it to the other side), a merge in Split (text area), Split words and the Search button while loading (a loading `UiButton` is disabled, which drops the focus; it takes it back). Tests: `search-page.test.js` (two), `search-builder.test.js`, `split-page.test.js`, `ui/plain-components.test.js`.
9. **F8** `150311c` contrast: `--faint` text is 2.9:1 on the light background (3.3–3.7:1 in dark), under AA's 4.5:1. Text that used it now uses `--muted` (5.9:1 light, 6.9:1 dark): every placeholder (fields, selects, builder rows), a switched-off dictionary in the Dictionaries menu, Split's no-entry terms, the pack sizes on the first-launch cards. `--faint` stays on icons (chevrons, drag handles), where 3:1 suffices and it measures 3.2–3.3:1 on cards. See D8.
10. **F18** `2330c34` reduced motion: the toast no longer slides in, the indeterminate progress bar runs slower (as the spinner already did), the Dictionaries catalog jumps into view instead of scrolling smoothly. Test: `dictionary-catalog-component.test.js`.

**Clipping, overlap, layout**

11. **F6** `dcc81a3` Define: a term longer than the drawer was cut at the right edge, mid-letter, with no ellipsis (`text-overflow` does not apply to the bare text of a flex row). It now wraps after a tsheg; one-line rows keep their exact height and text position (measured: 48 px, text at the same offset). Screenshot `long-define-1440.png` (after: the 414-character term on ten lines; before, it was cut after about twenty letters).
12. **F7** `938715c` quick lookup window: same bug in its narrow terms column; the term now ends with a real ellipsis and has its full text as tooltip; rows keep one line. The "More" button moved out of the listbox. Tests: `quick-lookup-window.test.js` (two).
13. **F20** `baec20d` Split: the terms list clips each term for its ellipsis, and the clip stopped at the line, cutting the subjoined letters and vowels of tall stacks (the ུ of བསྒྲུབས, ཧཱུྃ). Room added under the line inside the clip, with a negative margin so rows do not move. Screenshot `vclip-compare.png` (left: before, clipped; right: unclipped reference); after the fix the only difference left is 1 px at the left edge.
14. **F9** `ed28cdf` phone: the floating help button covered the end of Define's terms and entries, Search's results and Split's lists for good, since nothing was left to scroll. Those lists now keep `--phone-help-clearance` (defined beside the button in `AppNav.vue`) after their last row. Screenshots `phoneend-light-*.png`, `phoneend-light-_search_tenderness-null.png`.
15. **F10** `8984dcb` the Dictionaries menu was capped at the window height minus a fixed margin, whatever the button's position, so it ran off the bottom when it opened low (Search under the builder; any screen at 125–150%) and, on a phone, under the bottom bar. It now uses Reka's available height and keeps clear of the bar. Screenshot `menu-search-1024-light-150.png`.
16. **F12** `a071234` "Showing 100 of 499 terms" (Define, Split) stayed on one line and ran under the Dictionaries button on a phone from 125% Text size. It wraps now, as Search's count did. Screenshot `dbg-define.png`.
17. **F19** `5edcded` Search on a phone: a long dictionary name (the Mahāvyutpatti's) left the term 13 px wide, drawn one letter per line. The chip now leaves the term at least 5rem and ends in an ellipsis only when needed. Screenshot `narrow-term-390.png`.
18. **F23** `dd21e7f` Glossary between 600 and 1180 px: each row kept 300 px for the term, squeezing the definition to about 140 px. The term column stops at 30% of the row; from 1180 px it is 300 px as before (1440 screenshot unchanged). Screenshot `tauri-768-light-100-_glossary.png`.

**Keep-alive**

19. **F13** `0a63bdc` Define: leaving the page emptied the route's term, which the cached page took as a new selection, so on return the field was replaced by the selected term, the list shrank to it and the definitions reloaded. Define now ignores the route while another page is open and a return to the term it already shows. Links to another term still work. Tests: `define-page.test.js` (two).
20. **F14** `dbb3402` every page came back scrolled to the top (the browser resets the scroll of detached elements). `App.vue` now notes the scrolled elements of the page being left and restores them (`src/services/scroll-memory.js`). Checked: Define terms list and entries, Split terms and definitions, Dictionaries, Settings, desktop and phone. Not Search, see D3. Test: `scroll-memory.test.js`.

**Performance**

21. **F15** `c789962` Search: each batch of 50 re-highlighted every result already shown; a batch at 2,800 results took 277 ms with a 193 ms long task. Each result is now highlighted once per search. Test: `search-page.test.js`.
22. **F16** `59771b8` Define: the term filter read the typed prefix through the component (a tracked reactive read) for each of the ~285,000 terms and used `indexOf`. Read once, `startsWith`. Same in the quick lookup window.
23. **F17** `c909253` Search: the Dictionaries menu counted results with one pass per dictionary (35 × 2,960); now one pass. Test: `dictionaries-menu.test.js`.

## Decisions for the owner

1. **D1 Define between 600 and 1180 px: the terms drawer keeps 360 px**, leaving the definitions about 210 px at 768 (`t-768-light-100-_define_.png`, `f150a.png` at 1024 and 150%). Options: (a) cap the drawer, e.g. `min(22.5rem, 40%)`, the same treatment as F23; (b) switch to the phone layout (terms, then definitions) below about 900 px; (c) keep. **Recommendation: (a)**, small and in line with the Glossary fix; (b) changes how the screen works on tablets.
2. **D2 The Dictionaries menu on Define opens over the navigation rail** (aligned to the button's right edge; decision 5 of `define.md`, kept then). Split was since changed to open towards the definitions (`menuAlign="start"`, commit `24a6a58`). Options: same `menuAlign="start"` on Define; keep. **Recommendation:** align start, for consistency with Split (`menu-define-1024-light-100.png`).
3. **D3 Search runs the query again each time you come back to it** (`'$route.params.query'` watcher: the route goes from no query to the stored one), which resets the results and their scroll (so F14 cannot keep it) and costs about 190 ms for "wisdom". Options: skip the re-run when the query is the one already shown (as F13 does for Define), re-running only if the dictionaries changed meanwhile; keep (always fresh). **Recommendation:** skip it; this is a behaviour change, so I left it.
4. **D4 Search highlights in dark** use the bright logo yellow `#FFC107` with dark text, loud on the dark page (`t-1440-dark-100-_search_compassion.png`, `dark1.png`). No board draws them. Options: `--amber-solid`/`--on-amber-solid` in dark; a dimmer yellow token; keep. **Recommendation:** `--amber-solid` in dark.
5. **D5 Tap targets under 44 px on a phone.** All are at least 24 px (WCAG 2.2 AA 2.5.8 passes); 44 is Apple's guideline (and AAA). Measured at 390 px: field clear buttons 36×36; builder "Hide" 45×32; result dictionary chips 96×23; Split merge buttons 28×28; theme buttons 38 tall; catalog filter chips 40 tall; slider thumb 18×18; switches 40×24. Options: invisible larger hit areas (a pseudo-element) for the clear buttons, merge buttons and slider thumb, without visual change; resize the controls; keep. **Recommendation:** invisible hit areas where neighbours allow (clear, merge, thumb); keep chips.
6. **D6 `user-scalable=no` in the viewport** blocks pinch zoom on phones (axe: critical). The Text size setting partly compensates. Options: allow zoom (web and app share `index.html`); keep. **Recommendation:** allow zoom on the web build at least; a decision because the app feel on iOS changes.
7. **D7 No level-one heading** on Define, Search, Split and Dictionaries (axe; screen-reader users navigate by headings). Options: a visually hidden `h1` with the page name; keep. **Recommendation:** visually hidden `h1`.
8. **D8 `--faint` itself** is under 4.5:1. F8 moved text off it rather than changing the token. Options: darken `--faint` (light around `#7E6F62`, dark around `#9A8B7D`) so any future text use passes, at the cost of slightly heavier icons; keep the per-use approach. **Recommendation:** keep, and note in `tokens.css` that `--faint` is for icons only.
9. **D9 The rail at 150% Text size**: "Dictionaries" overflows the 68 px item and is clipped at the rail edge (`rail-crops.png`). The slider stops at 130%, where it still fits (2–3 px margin), so 150% is only reachable by editing storage. Options: rail width in rem; let rail labels not grow past 130%; keep the slider at 130%. **Recommendation:** keep; revisit if the slider's maximum is raised.
10. **D10 Text size 150% is not reachable from Settings** (slider 80–130%). The matrix asked for 150%; it was checked by setting the stored value. Nothing to decide unless you want 150% offered.
11. **D11 Dark loading overlay**: the logo is darkened (`brightness(0.25)`) on a near-black background and is barely visible (`loading-390-dark.png`). It matches the old Vuetify look (Vuetify report, decision 3). Options: no filter in dark; keep. **Recommendation:** no filter in dark.
12. **D12 Phone Tab order**: the bottom bar comes before the page in the document, so Tab goes bar, help, then the field at the top. Only matters with a hardware keyboard on a tablet or phone. Options: a "skip to content" link; move the bar after the content in the DOM; keep. **Recommendation:** keep for now.
13. **D13 Dictionary preferences cannot be reordered from the keyboard** (drag handles only). Options: Alt+Up/Down on a focusable handle; Up/Down buttons; keep. **Recommendation:** Alt+Up/Down on the handle.
14. **D14 Settings, Install a pack:** the Install button turns into progress and the focus falls to the document (seen with the mock). Options: focus the pack's row or status; keep. **Recommendation:** focus the row's status line.
15. **D15 Help dialogs on a phone:** the third tab of Search's help ("P…") is cut at the right; the tab row scrolls sideways, so it is reachable (`gd2.png`). Options: tabs that grow and wrap; shorter labels; keep. **Recommendation:** keep.
16. **D16 Split, cosmetic:** the vertical divider's grip floats mid-height in empty space when both lists are short (`split-nodef-1440-dark.png`). Options: grip aligned with the top of the lists; keep.
17. **D17 Quick lookup window at 150%** is cramped at 650×500 (`popup-a-650x500-light-150.png`); it works. Window size is in `src-tauri` (quick-lookup report, decision 7).
18. **D18 `/ui-showcase`** (development only): four text fields without a label, two landmarks without unique names, horizontal overflow at 390 px. Not worth fixing unless the page is meant as documentation.
19. **D19 Audio player in definitions** still uses the legacy palette in `src/css/layout.css` (red button, yellow in dark), not the tokens; contrast passes. Not drawn on any board. Options: restyle on tokens; keep.
20. **D20 An empty definition** shows an empty card with its chip and copy button. Data question rather than layout; keep unless the packs can contain empty definitions.

Pre-existing items already listed in earlier reports and not re-decided here: Search's builder open by default, the toast over the phone's bottom bar, the scan viewer dark in light theme, the "Page N" offset difference between row and viewer.

## Performance numbers

Chromium on the test container, web dev server (not a production build), real core pack (285,459 distinct terms). "Paint" is from the action to two animation frames after the rows are in the DOM, by `performance.now()`; long tasks from a `PerformanceObserver` (`longtask`, over 50 ms). "×4" is CDP CPU throttling at 4×, a rough stand-in for a slower laptop or a phone.

| Case | Before ×1 | After ×1 | Before ×4 | After ×4 |
|---|---|---|---|---|
| Define, type "ye " (718 terms) | 401 ms, 4 long tasks, longest 121 ms | 65 ms, none | 1,257 ms, longest 365 ms | 224 ms, longest 171 ms |
| Define, paste ཕྱི་ (772 terms) | 115 ms, longest 71 ms | 34 ms, none | 454 ms, longest 423 ms | 127 ms, longest 193 ms |
| Search "wisdom" (2,960 results), first 50 | 225 ms, longest 91 ms | 187 ms, none | 586 ms, longest 375 ms | 396 ms, longest 204 ms |
| Search, one batch of 50 more at 2,800 shown | 277 ms, long task 193 ms | 122 ms, none | | |
| Search, last batch (2,950) | 411 ms, long task 207 ms | 183 ms, none | | |
| Search, scrolling to the end (all 2,960) | 39 long tasks up to 183 ms, reached 2,300 in 7.7 s | 9 long tasks up to 127 ms, reached 2,960 in 6.0 s | | |
| Layout shift (CLS) after load, every screen, 1440 and 390 | | all under 0.007 | | |

Still over about 100 ms of blocking, not fixed:
- At ×4 throttling, the first render of Define's definitions and Search's first 50 results still have one 170–200 ms task each: rendering decorated definitions (`dictionaries-abbreviations.js` is the biggest self time left). At ×1 there is none.
- Scrolling Search to the end still has a task of up to 127 ms once nearly 3,000 results are in the DOM (layout of a very long list). A virtualised list would remove it; that is a structural change, not done.
- Start-up in the browser: about 2.0 s from navigation to the app shell, almost all of it fetching and opening the 184 MB web database with sql.js. Not representative of the Tauri app, which opens packs natively.

## Not verified

- **The Tauri app itself** on macOS, Windows, Linux, iOS and Android: the main window, the quick lookup NSPanel, real IPC, real downloads, the global hotkey and clipboard, `db.reloadPack()`. Everything Tauri-only was seen through the IPC mock described at the top.
- **WebKit and WebKitGTK** (Tauri's engines on macOS/iOS and Linux): only Chromium was used. In particular: DDC Uchen's line metrics and stack clipping (F20 was measured in Chromium), `color-mix()`, `fit-content()` in grid tracks (F19), Reka's `--reka-popover-content-available-height` (F10), focusable scroll containers (WebKit does not make them focusable, so Define's terms list relies on Up/Down from the field there).
- **Screen readers** (VoiceOver, NVDA, TalkBack): accessible names and roles were checked with axe-core 4.10 and the DOM, not by listening.
- **Real touch input**: tap targets were measured, not tapped; swipe, pinch and long press only through existing tests.
- **The optional packs** (Tibetan Monolingual, Sanskrit & Academic): only the core pack was loaded; the uninstalled-packs notice was seen only in the popup.
- **Audio playback** in definitions, the first-launch video (no H.264 in this Chromium), What's new content, the updater.
- **Glossary import and export** flows past their dialogs (file pickers need Tauri).
- **Contrast of text over images** (scan viewer) and of the yellow highlight in light mode against every definition colour: axe passed, not measured by hand.
