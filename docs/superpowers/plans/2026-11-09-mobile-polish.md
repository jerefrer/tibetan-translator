# Mobile polish — implementation plan

Branch: `feature/mobile-polish`. Approved by the owner on 2026-11-09 after testing
the redesign on an iPhone. Goal: the app should feel finished and familiar on a
phone, and the keyboard must never hide what the user needs.

Read `CLAUDE.md` first (Vue 3 Options API, `src/ui` components, design tokens in
`src/css/tokens.css`, never raw colours). Phone layout = `ResizeService.isMobile()`
/ `window.innerWidth <= 600`. Tests: Vitest + @vue/test-utils, see
`tests/settings-page.test.js`, `tests/ui/`. Run the whole suite with
`./node_modules/.bin/vitest run` (pnpm may be unavailable). Test names follow
`should … when …`. Write the failing test first, then the code.

Out of scope here (done separately): anything native iOS (input accessory bar,
status-bar edge effect), the app logo / splash screen.

## Tasks

### 1. Confirm before deleting downloaded scans and audio
`src/components/settings/ScannedDictionariesCard.vue` and `AudioCard.vue` delete
on the first tap. Add the same confirmation `PackManagerCard.vue` uses (its
`confirmOpen` dialog: ghost Cancel + danger button). Wording: title
"Delete downloaded pages?" / "Delete downloaded recordings?", body naming the
dictionary and saying it can be downloaded again; danger button "Delete".
Update the existing delete tests in `tests/settings-page.test.js` (they click
delete and expect the call) to go through the dialog, and add a test that
Cancel deletes nothing.

### 2. Define field: placeholder and caret aligned like Search
`src/ui/UiTextField.vue`, `.ui-field--tibetan .ui-field__input` sets the Tibetan
font, a large size, `line-height: 1.5` and `padding-top: 0.3rem` so Tibetan glyphs
sit well. While the field is empty that offset also pushes the Latin placeholder
("Type a Tibetan term") and the caret down. Apply the Tibetan font/size/offset
only when the field has text (`:not(:placeholder-shown)`), so an empty field
looks exactly like Search's (`font: var(--text-md) var(--font-ui)`, no offset).
Check `src/ui/UiShowcasePage.vue` still renders; add a test in `tests/ui/` if a
behaviour is testable (e.g. the class/attribute driving it), otherwise say so.

### 3. Text-field focus without the halo
Same file: `.ui-field__control:focus-within` adds `box-shadow: 0 0 0 4px var(--ring)`
on top of the accent border. Remove the halo; keep the border turning
`var(--accent)`. Native fields have no ring; the border change is the focus cue.

### 4. Dialogs as bottom sheets above the keyboard on phones
`src/ui/UiDialog.vue` centres the dialog in the viewport. On iOS the keyboard
overlays the page without resizing it, so a centred dialog with a text field is
half hidden and cannot scroll to its buttons (seen on "Create a dictionary").
- Add a small service `src/services/keyboard-inset.js` that listens to
  `window.visualViewport` `resize`/`scroll` and sets a CSS variable
  `--keyboard-inset` on `<html>` = `max(0, window.innerHeight - vv.height - vv.offsetTop)`
  px, and `--visible-height` = `vv.height` px. Start it from `src/main.js`. No-op
  without `visualViewport`. Unit-test the computation as a pure function.
- In UiDialog, at phone width (`@media (max-width: 600px)`): anchor the dialog
  to the bottom (`top: auto; left: 0; right: 0; bottom: var(--keyboard-inset, 0px);
  transform: none; width: 100%`), round only the top corners, add
  `padding-bottom: max(22px, var(--safe-bottom))` when no keyboard, and
  `max-height: calc(var(--visible-height, 100dvh) - var(--safe-top) - var(--space-4))`
  with `overflow-y: auto`, so title, field and actions all stay reachable.
  Make the actions stretch (buttons share the width) on phones.
- Desktop stays as it is. Keep every existing UiDialog test passing.

### 5. Bottom tab bar: light, like iOS and Android
`src/components/AppNav.vue` (phone = `.app-nav--bar`), styled with
`--rail-bg` etc. in `tokens.css`. Today: a saturated red bar with white items and
a dark-red active pill. Make it: background `var(--surface)` (or `--bg`) with a
1px top border `var(--line)` (optionally `backdrop-filter: blur` on a
translucent surface), inactive items `var(--muted)`, active item icon and
label `var(--accent)` with no pill, safe-area padding kept. Only the phone bar
changes; the desktop rail keeps its look unless it shares the same tokens — if
so, introduce bar-specific tokens instead of changing the rail. Check both themes
(light and `[data-theme='dark']`). Update `tests/app-nav.test.js` if it asserts
styling classes.

### 6. Help out of the floating "?" button on phones
On phones a round "?" button floats over the content, bottom right
(`app-nav__help` slot in `AppNav.vue`, buttons in
`DefinePageHelpDialogWithButton.vue`, `SearchPageHelpDialogWithButton.vue`,
`SplitPageHelpDialogWithButton.vue`). Remove the floating button on phones only;
add a "Help" group to the phone Settings screen (`ConfigurePage.vue`, as
`UiListItem` rows like the existing ones) with one row per page help (Define,
Search, Split) that opens that page's existing help dialog. Desktop unchanged.
Find how the help components expose their dialog and reuse them; do not
duplicate the help content. Tests: the phone Settings shows the three rows and
a row opens its dialog; the phone nav renders no help button.

### 7. Define: a lighter selected term
`src/components/DefinePage.vue` (stylus, `.term-item.is-active`): background
`var(--accent)` + `var(--on-accent)` text. Use `background: var(--accent-soft)`,
`color: var(--accent)` instead (keep the hover rule).

### 8. Pressed feedback on touch
There is no hover on a phone, so taps give no feedback. Add `:active` styles:
a slightly darker background (`var(--soft)` on surfaces, `opacity: 0.85` on
solid/danger buttons) for `.ui-button`, `UiListItem` clickable rows,
`.term-item` in Define, the result cards if they are clickable, the bottom-bar
items. Keep them subtle; `-webkit-tap-highlight-color: transparent` stays.

### 9. Search: the query builder folded on phones by default
`src/components/SearchPage.vue`: `builderVisible` defaults to
`Storage.get('searchBuilderVisible') !== false`, so it is open on first use and
takes a third of a phone screen. On phones, default to hidden when the user has
never chosen (`searchBuilderVisible` unset); an explicit choice is still
remembered. Desktop default unchanged. Test both.

## For each task
1. Failing test (where the behaviour is testable), 2. code, 3. whole suite green,
4. `git add <the files of this task only>` (never `-A`; another session edits
native files in this tree), 5. commit. Commit subjects are user-visible effects,
conventional type, third-person verb, e.g.
`fix(settings): asks before deleting downloaded scans and audio`,
`fix(ui): keeps dialogs above the keyboard on phones`,
`feat(nav): makes the phone tab bar light, like other apps`. End every commit
message with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Done when
All nine tasks are committed, `./node_modules/.bin/vitest run` passes, and
`pnpm build` (or `./node_modules/.bin/vite build`) succeeds.

### 10. The app icon is the logo everywhere
Owner decision: the logo is the existing app icon `public/img/app-icon.png`.
Replace the yellow ཀ tile (`.onboarding__logo` in `OnboardingScreen.vue`, and
`.app-nav__logo` in `AppNav.vue` if it is the same tile) with
`<img src="/img/app-icon.png" alt="">` at the same size, no extra background,
and the loading/splash screen's grey logo with the same icon in colour. Remove
`--logo-bg` / `--logo-ink` only if nothing else uses them. Commit subject e.g.
`feat(brand): shows the app icon as the logo everywhere`.
