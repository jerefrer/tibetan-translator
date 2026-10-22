# Redesign (big bang): plan

Status: proposed, not started.

Mockups (private, owner access only): https://claude.ai/artifact/X4QzT2uuG9VuoXP4e8vGJr. Source files are in `docs/redesign/mockups/` (see its README).
Option **B** ("the same screens as today, refined") is the reference. Option A (merged Lookup and Reading) is kept on the canvas for comparison only and is not part of this plan.

## Decisions already made

- Keep **Vue 3 (Options API) + Tauri 2**. No move to React Native, Flutter or separate native apps.
- Replace **Vuetify** with in-house components over unstyled primitives, **all at once** (no period where both coexist).
- Keep three main screens: **Define**, **Search**, **Split**. No merged Lookup, no Reading page, no "Collect", no "Keep" in Split.
- Desktop sidebar, two groups: tools (Define, Search, Split) at the top, then a divider, then **My glossary** above **Dictionaries**, and **Settings** at the bottom.
- Phone: bottom bar keeps four tabs (Define, Search, Split, Settings). My glossary and Dictionaries are rows at the top of Settings and open sub-screens with a back arrow.
- The CAT tool exploration is parked. If it is built later it is a separate product; the dictionary layer (packs, search) should then be extracted into a shared module.

## Why not a framework change

- One codebase already covers macOS, Windows, Linux, iOS, Android and web.
- The redesign is visual. The data layer (packs, `SqlDatabase`, `allTerms`, search) does not change.
- Tibetan is rendered by the browser engine with DDC Uchen today. Engines used by React Native or Flutter would need their own shaping tests on every platform before any commitment; that risk buys nothing here.

## Measured on the current code

- 31 `.vue` files use Vuetify, about 45 distinct components, concentrated in: `v-icon` (136), `v-btn` (110), the `v-card` family (about 100), then `v-alert`, `v-progress-circular`, `v-tooltip`, `v-tab`, `v-dialog`, `v-chip`, `v-text-field`.
- 26 hand-written `v-theme--dark` overrides.
- 12 test files mount components with Vuetify. **Not yet counted:** how many of them select Vuetify classes (`.v-btn`, …). Count this first.
- Not measured: Vuetify's share of the web bundle.

## Branch rules

- One long-lived branch, `redesign`. One clean commit per phase or per screen, so it can be reviewed in steps.
- **Never push anything under `public/packs/` from this branch.** `.github/workflows/update-packs.yml` triggers on a push of `public/packs/*.7z` or the manifest on any branch.
- `main` stays releasable. Urgent fixes ship from `main` as 1.12.x; merge `main` into `redesign` after each one.
- Freeze new features on pages the redesign rewrites, or do them twice. Prefer freezing.
- Tag the last old-design release (`v1.12.x`) so there is a way back.
- Commit subjects must state the user-visible effect (the changelog generator only sees subjects).

## Phase 0: scoping (1 session)

- Settle the open choices: icon set (Material Design Icons today), Reka UI for dialog/menu/tabs/select/switch/checkbox/slider/toast, the name "My glossary" (it wraps to two lines in the 88 px rail; "Glossary" would not), routes.
- **Self-host the fonts.** The mockups load Instrument Sans and Source Serif 4 from Google Fonts, which does not work offline in the desktop app. Bundle them (confirm their licences allow it). DDC Uchen is already in `vendor/fonts`.
- Count the tests that depend on Vuetify classes. Record the current web bundle size.
- Capture reference screenshots of the current app for later comparison.

### Phase 0 results (2026-10-22)

Decisions:
- Sidebar entry is named **Glossary** (one line in the 88 px rail); the page title stays "My glossary".
- Fonts **Instrument Sans** and **Source Serif 4** are bundled (SIL OFL), not loaded from Google Fonts.
- Icons: **Lucide** (confirmed). The mockups already use thin-stroke icons (stroke width 1.8), which is Lucide's style; Material Design Icons are filled and ship the whole font (about 1.2 MB of `.ttf`/`.eot` plus `.woff`/`.woff2`) while Lucide is tree-shaken per icon. Cost: 76 distinct `mdi-*` names to map, a mechanical job.

Baseline (web build, `pnpm build`, before any change):
- `vuetify` chunk 377 kB (116 kB gzip), `VTabs` chunk 165 kB (54 kB gzip), `vuetify` CSS 415 kB, `main` chunk 438 kB (142 kB gzip).
- Material Design Icons font files: `.eot` 1.2 MB, `.ttf` 1.2 MB, `.woff` 574 kB, `.woff2` 394 kB.
- Tests tied to Vuetify classes: only `tests/quick-add-dialog.test.js` selects `.v-*` classes (2 occurrences); `custom-pack-section`, `dictionary-catalog-component`, `import-preview-dialog`, `lexicon-entry-dialog`, `lexicon-page` and `setup.js` mount Vuetify without class selectors. The rewrite cost on tests is small.

Exit: decisions written down, baseline numbers recorded.

## Phase 1: foundations (1 to 2 sessions)

- Design tokens in one CSS file, light and dark: the mockup colours, radii, spacing, type sizes in `rem` so the "Text size" setting keeps working.
- App shell: two-group sidebar on desktop, four-tab bottom bar on phone (existing 600 px breakpoint).
- Routes for My glossary and Dictionaries; old routes redirect.
- The quick lookup window (`popup.js`, its own Vue instance) loads the same tokens and theme initialisation.
- Keep `<keep-alive>` and the custom events (`dictionaries-updated`, `all-terms-updated`) untouched.

Exit: empty pages render inside the new shell, in light and dark, on desktop and phone width.

## Phase 2: component library (2 sessions)

About fifteen components in `src/ui/`, each with a test and a `data-testid`:

- On Reka UI: Dialog, Tooltip, Tabs, Menu, Select, Switch, Checkbox, Slider, Toast.
- In plain CSS: Button, Card, Chip, Alert, Spinner, Table, Icon, TextField.

A development-only page shows all of them, light and dark.

Exit: every Vuetify component in use has a counterpart; tests pass.

## Phase 3: screens (5 to 7 sessions)

Lowest risk first, each checked against the B mockup:

1. Dictionaries (`DictionaryCatalog.vue` is already custom code).
2. My glossary (`LexiconPage`).
3. Settings (appearance, global lookup, packs summary, dictionary preferences, about).
4. Define, then Search (query builder, dictionaries menu, recent searches).
5. Split (editable text area, Split words / Clear, term list with merge buttons, resizable panes; see the fidelity checklist).
6. First launch, dialogs, quick lookup window.

Exit: no screen imports Vuetify.

## Phase 4: remove Vuetify (1 session) ✅

- [x] Remove the plugin, the dependency, the 26 dark overrides and dead CSS. Vuetify's CSS reset is kept as `src/css/reset.css` so nothing moves.
- [x] Compare bundle size before and after (desktop and web share one Vite build): main JS 1,065 → 525 kB, main CSS 901 → 73 kB, 3.6 MB of Material Design Icons fonts gone.

Done on `claude/remove-vuetify-p4840x`; see `docs/redesign/reports/vuetify-removal.md`.

## Phase 5: hardening (2 sessions)

- Dark theme, screen by screen.
- Phone width (390 px).
- Tibetan rendering on each platform: stacks, sizes, font fallback.
- Performance: long result lists, cold start, search.
- Accessibility: keyboard, focus, contrast.

Audit part done on `claude/redesign-hardening-audit-bqbiuz` (web dev server, Tauri mocked): clear defects fixed, open choices listed; see `docs/redesign/reports/hardening.md`. Tibetan rendering on each platform and the devices remain.

## Phase 6: release (1 session)

- Version **2.0.0** (visible everywhere).
- Release notes written with care: they are shown to users before the restart.
- iOS and Android must be validated by the owner on devices; allow for store review time.

## Risks specific to a big-bang release

- No per-screen rollback. Mitigation: the 683 existing tests, reference screenshots, the `v1.12.x` tag.
- One automatic update changes everything for everyone. The "What's new" dialog is the only guidance; no dual interface is planned.
- Tests tied to Vuetify classes are rewritten with the screens, not before.
- Mobile builds cannot be verified from the development environment used so far.

## Effort

Roughly 12 to 15 focused sessions in total. Phases 3 and 5 are the ones most likely to run over.

## Fidelity checklist: behaviour the redesign must keep

An earlier draft of the mockup lost some of these (Split's word merging, Define's term list). They were found by reading the templates, not by testing the running app, so treat the list as a starting point and diff each screen against the real one before calling it done.

**Define**
- Search field with Wylie-to-Tibetan conversion, clear button, Up/Down arrows to move through terms.
- **Terms drawer:** every term starting with what was typed ("Showing N of M terms"), infinite scroll, Dictionaries menu in its header.
- Definitions pane: Copy all, Add my definition, per-entry copy button, dictionary chip that opens the dictionary's about dialog.
- Scanned dictionaries: "Page N (approximate)" and View scan, opening the scan viewer (zoom, previous and next page).
- Notices: packs not installed, "search instead" hint for non-Tibetan input, "No results."
- Phone: terms list first, definitions after a tap.
- Audio plays from links inside some definitions (decorator); there is no headword audio button.

**Search**
- Query field with spinner and search button, recent searches with Clear history, query builder (contains, contains (Wylie), sounds precisely like, sounds more or less like; add or remove conditions), "Showing X of Y results", Dictionaries menu, Add my definition, infinite scroll ("All N results loaded"), scanned rows with View scan.

**Split**
- Editable text area (Wylie conversion on typing, paste repair for legacy fonts), Split words, Clear, tokenizer error message.
- Spaces in the text area decide where words are split.
- **Merge buttons** between adjacent terms when the merged term has entries (2 or 3 terms).
- Terms with no entry are marked; selected term; Up/Down to move.
- Resizable horizontal and vertical dividers; Dictionaries menu; empty states ("Paste text above to begin", "Add spaces between words or click Split words", "Select a term to see definitions", "No definitions found for …").
- Phone: terms list first, then definitions with "Back to terms".

**Everywhere**
- Keyboard shortcuts Cmd/Ctrl+D, S, T, G (Define, Search, Split, Settings); consider shortcuts for My glossary and Dictionaries.
- `<keep-alive>` page state, `activated()` hooks, light/dark/system theme, text size.

## Open questions

- Whether "Most often rendered as" (a summary of frequent English renderings) is wanted. It was in an early mockup, does not exist in the app, and needs heuristics on free-text definitions; leaving it out.
