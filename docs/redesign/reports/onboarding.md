# First launch (onboarding): redesign report

- **Branch:** `claude/redesign-onboarding-llnchy`, from `redesign` at `24a6a58`. This session was set up to push there; nothing was pushed to `main` or `redesign`.
- **Status:** done, ready for review. No PR opened.

## Commits

| Commit | Subject |
| --- | --- |
| `1debd5e` | docs(onboarding): lists every behaviour of the old first-launch screen before its rebuild |
| `9544830` | feat(onboarding): rebuilds the first-launch screen in the new design, downloading packs while Quick lookup is shown |
| (this file) | docs(onboarding): reports on the first-launch rebuild, with the behaviours checklist ticked |

Every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Test results

`pnpm test` before the push: **1,196 passed, 1 failed** (64 files; 41 more tests than this branch had). The failure is `tests/apkg-reader.test.js`, which needs the local `INALCO_L1_voca.apkg` that is not in this checkout; that matches your baseline (1,156 with the file, so 1,155 passed / 1 failed without it). `pnpm build` succeeds.

No test was skipped or deleted. No existing test was tied to the old onboarding markup. New files:

- `tests/onboarding-screen.test.js` (37 tests): every behaviour below by its ID: the welcome text and count, each optional pack's name, description, highlights ("and N more"), download and installed sizes, toggling by card, checkbox and label (once, not twice), the button labels on desktop and phone, the Download total, both skips, the Quick lookup step (desktop only, Ctrl or ⌘ keys, the stored hotkey, the video with and without reduced motion, download progress underneath, Done in each download state), the download step (order, already-installed packs skipped, `db.reloadPack` after each, every row status, success, the three kinds of error, Retry, Skip after a failure, a failing reload), that nothing is stored before the last button, focus on each step, the Tab trap, and no Vuetify markup. PackManager, the database and the global lookup service are mocked; pack definitions, dictionary labels and `getPackHighlights` are the real ones. I checked that the toggle test fails when the click guard is removed.
- `tests/onboarding-flags.test.js` (4 tests): the real `PackManager.shouldShowOnboarding()` / `completeOnboarding()` / `resetOnboarding()` with Tauri mocked: never on the web, shown until completed, the two keys stored.

## Behaviours of the old screen

Written (commit `1debd5e`) before any code changed, by reading `OnboardingScreen.vue` and what it uses: `services/pack-manager.js` (download, progress, onboarding flags), `config/pack-definitions.js` (pack names, descriptions, sizes, highlights), `services/dictionary-catalog.js` (`getPackHighlights`), `services/dictionaries-details.js` (labels), `config/platform.js`, and the places outside the screen that depend on it (`App.vue`, `services/global-lookup.js` for the hotkey, `src-tauri/src/packs.rs` for the progress events).

### When it is shown (App.vue, PackManager)

- W1. Only where packs are modular (`supportsModularPacks()`: every Tauri build, desktop and mobile). Never in the web build.
- W2. `App.vue` `created()` awaits `PackManager.init()`, then shows the screen if `PackManager.shouldShowOnboarding()`: modular packs and `onboardingComplete` not set in storage. It is decided once per launch.
- W3. It is rendered by `App.vue` as `<onboarding-screen v-if="showOnboarding" @complete=…>`, a sibling of the app shell. The app (database init, global lookup, update check) keeps loading underneath; the shell is mounted behind it once the database is ready.
- W4. On `complete`, `App.vue` hides it and calls `db.setAllTermsVariable()` so terms from downloaded packs reach the Define list. It does not call `db.reloadPack()`.
- W5. The screen is a fixed overlay over the whole window (`z-index: 9999`), app background colour, content centred, 500 px wide (760 px on the Quick lookup step), scrolling if the window is short.

### What is stored so it is not shown again

- S1. `PackManager.completeOnboarding()` stores `onboardingComplete: true` and `onboardingVersion: 1`. Called by every exit: Get Started (with or without packs), and after a download.
- S2. Nothing is stored if the app is closed mid-way (before the last button): the screen comes back on the next launch. A pack that finished downloading stays installed.
- S3. The pack selection itself is not stored.

### Step 1: welcome and pack choice

- P1. App icon (`/img/app-icon.png`, 64 px), title "Welcome to Tibetan Translator".
- P2. Text: "The core dictionaries are included with the app. You can optionally download additional dictionary packs:".
- P3. The required pack (Core Dictionaries) as a green "Included" card: book icon, name, description ("All Tibetan-English dictionaries"), "Included" chip with a check, "146 MB installed". Not clickable.
- P4. "Optional packs:" then one card per optional pack (Tibetan Monolingual, Sanskrit & Academic), in `PACK_DEFINITIONS` order. Each card: checkbox, name, description, the **pack highlights** line (release 1.12): "Includes A, B, C, D, and N more", with the labels from `DictionariesDetails` for the pack's `highlights` ids and N = dictionaries in the pack minus the labels shown; then "65 MB download · 285 MB installed" (parsed from `estimatedSize`).
- P5. Clicking anywhere on an optional card, or on its checkbox, toggles it. Selected cards have an accent border and tint, hover tints too.
- P6. Nothing is selected at first. Optional packs can be left unselected: they are skippable.
- P7. Info note: "You can add or remove packs later from the Settings page."
- P8. Primary button:
  - phone (mobile platform) with a selection: "Download N MB" (download icon), N = sum of a hard-coded size table (65, 26, plus a stale 8 for a pack that no longer exists); starts the download.
  - phone without a selection: "Get Started" (arrow), completes onboarding.
  - desktop: always "Next" (arrow), goes to the Quick lookup step; the download waits until after that step.
- P9. There is no secondary button (no explicit "skip"): leaving everything unticked is the skip.

### Step 2: Quick lookup (desktop only)

- Q1. Shown only on desktop Tauri (`isTauri() && !isMobile()`), between the pack choice and the download.
- Q2. Keyboard icon, title "Quick Lookup", text "Look up Tibetan text from anywhere on your system using a keyboard shortcut."
- Q3. The demo video `/img/global-lookup-demo.mp4` (autoplay, loop, muted, inline) on the left, the steps on the right (two columns, 760 px).
- Q4. Three numbered steps: "Copy Tibetan text: Select text in any app and press ⌘/Ctrl C" (keycaps), "Press the lookup hotkey: ⌘/Ctrl ⇧ C" (keycaps; always the default hotkey, not the stored one), "See the definition: A popup will appear with dictionary results".
- Q5. Info note: "You can change this hotkey later in the Settings page."
- Q6. One button: "Download N MB" when packs were ticked (starts the download), otherwise "Get Started" (completes).
- Q7. No Back button on any step; the pack choice cannot be revisited.

### Download step

- D1. Downloads the selected packs one after the other (`PackManager.downloadPack` then `waitForDownload`), skipping any already installed.
- D2. While downloading: spinner, "Downloading...", the current pack's name, a linear progress bar and "N% complete" (from the `pack-download-progress` events: starting, downloading, extracting), and "Please wait while we download the dictionary databases. This may take a few minutes depending on your connection." Other selected packs are not listed. No cancel.
- D3. Done: green check, "You're all set!", "The additional dictionaries have been downloaded successfully. You can start using the app now!", button "Get Started" (completes onboarding). A watcher also marks it done when every selected pack shows as installed.
- D4. Error: red alert icon, "Download Failed", an error alert with the message (`e.message`, or "Download failed. Please check your internet connection." when there is none; Tauri rejects with a plain string, so in practice this fallback text is what shows), "Please check your internet connection and try again.", button "Retry Download" (refresh icon) which restarts the loop (packs already installed are skipped).
- D5. On error there is no way out but Retry: offline, the user is stuck on the screen until they quit the app.
- D6. The downloaded pack is not loaded into the running database by the screen (no `db.reloadPack`); only `App.vue`'s `setAllTermsVariable()` runs afterwards (W4).

### Layout, theme, keyboard

- L1. Desktop versus phone is decided by platform, not width: the phone has no Quick lookup step and its primary button starts the download directly. There is no width-specific layout; at 390 px the 500 px column simply shrinks.
- L2. Light and dark through Vuetify theme colours (`--v-theme-*`).
- L3. Keyboard: the optional cards are Vuetify clickable cards and the checkboxes are focusable (Space toggles); buttons are focusable. Nothing is focused when a step appears, focus is not kept inside the overlay (Tab can reach the app behind it), and there is no dialog role.
- L4. Sizes mostly in rem/Vuetify classes (follow Text size), card layout in px.
- L5. Written with `setup()` (Composition API), unlike the rest of the app's Options API components.

## Checklist: kept, changed, dropped

Legend: ✅ kept as it was · 🔄 kept, with a difference explained · ➕ added · ❌ dropped.

### When it is shown
- ✅ W1 Never on the web (tested with the real PackManager).
- ✅ W2 Same rule, decided by `App.vue`, which I did not touch.
- ✅ W3 Same component name, same `complete` event, rendered by `App.vue` as before.
- ✅ W4 `App.vue` still calls `setAllTermsVariable()` on `complete`; see D6 for what the screen now does itself.
- 🔄 W5 Still a fixed overlay at `z-index: 9999` over the whole window, scrolling when short. Redrawn as the board's 640 px card (14 px radius, 36/40 px padding, 560 px minimum height) on the app background; the Quick lookup card is 880 px (see decision 3).

### What is stored
- ✅ S1 Same two keys through `PackManager.completeOnboarding()`, called by every exit: Get started, Skip for now (phone), Done (desktop), Get started after a download, and the new Skip after a failure.
- ✅ S2 Nothing stored before the last button (tested). Closing mid-way brings the screen back; installed packs stay installed.
- ✅ S3 The selection is not stored.

### Pack choice
- 🔄 P1 The board's 52 px yellow square with ཀ in DDC Uchen (the same logo as the sidebar) instead of the PNG app icon. Same title.
- 🔄 P2 The board's text, computed: "35 dictionaries are already on your device and work offline, among them Rangjung Yeshe, Hopkins 2015 and Berzin. You can add more now or later in Settings." The count is the core pack's dictionary count; the three names are the labels of `RangjungYeshe`, `Hopkins2015` and `Berzin` (a constant in the component, decision 4).
- 🔄 P3 The "Included" core card is gone, as on the board; the text above says the same thing (included, offline, how many). Its "146 MB installed" is no longer shown on this screen: the core pack cannot be declined, so the size informs no choice here; it is still shown in Settings → Dictionary packs.
- 🔄 P4 **Highlights kept**, same wording ("Includes A, B, C, D, and N more"), same helper and labels, after the pack description in the board's muted 13.5 px line. Name at 15 px semibold with the **download size at the right** ("65 MB"), as on the board. ➕ The installed size is kept on a faint line below ("285 MB on this device once installed"); the board shows only the download size, and 285 MB on disk is worth knowing before ticking.
- 🔄 P5 Click anywhere on the card, on the checkbox or on the name toggles it (once). Redrawn as on the board: 1.5 px border, accent when ticked, 22 px checkbox (`UiCheckbox`, sized up to the board's 22 px inside this screen only). Hover darkens the border instead of tinting.
- ✅ P6 Nothing ticked at first; both packs can be left out.
- 🔄 P7 The info note is gone; the welcome text ends with "You can add more now or later in Settings." (the board's wording).
- 🔄 P8 With packs ticked: **"Download N MB"** and **"Skip for now"** on both platforms (the board's two buttons). N is now the sum of the ticked packs' sizes as written in `estimatedSize`, so it always matches the sizes on the cards (the old hard-coded table is gone). Download now **starts the download at once on desktop too**, then shows Quick lookup while it runs (decision 1). With nothing ticked: a single "Continue" (desktop) or "Get started" (phone), as before ("Next" became "Continue"). No icons in the buttons, as on the board.
- 🔄 P9 ➕ "Skip for now" is an explicit way to go on without the ticked packs.

### Quick lookup (desktop)
- ✅ Q1 Desktop only, after the pack choice.
- 🔄 Q2 The board's title "Quick lookup" and text "Look up Tibetan text from any app, without switching windows." No keyboard icon (the board has none).
- 🔄 Q3 **Video kept**, beside the steps in an 18rem column (stacked under them below 860 px). Not on the board; see decision 3. ➕ With "reduce motion" set in the system, the video does not autoplay and gets controls.
- 🔄 Q4 The board's three steps (accent-soft 34 px numbers, 15.5 px titles, the board's texts). Keycaps kept: "Select a word anywhere and copy it (⌘ C)"; step 2 now shows **the hotkey actually stored** (`GlobalLookup.getHotkey()`, formatted as in Settings: ⌘ ⇧ C on a Mac, Ctrl Shift C elsewhere), followed by "You can change it in Settings." Step 3 is the board's "A small window shows the entries, then closes when you click away."
- 🔄 Q5 The note is now the end of step 2's text (board).
- 🔄 Q6 One button, **"Done"**. While packs download, their progress is shown above it (pack name, percentage or "Unpacking…", bar), then "Packs downloaded and installed." or "The download failed. You can retry after this step." Done completes onboarding when there was nothing to download or the download has finished; otherwise it goes to the download step. The board's second button, "Not now", is not there (decision 2).
- ✅ Q7 Still no Back button.

### Download step
- ✅ D1 One pack after the other, in pack order, already-installed ones skipped.
- 🔄 D2 Title "Downloading dictionaries", "This may take a few minutes depending on your connection.", then **one row per ticked pack** (Waiting, N %, Unpacking…, Installed) with a `UiProgress` bar under the one in progress, styled like Settings' pack rows. The rows are a polite live region. No spinner (each row has its bar). Still no cancel and no button while downloading.
- 🔄 D3 "You're all set", "The new dictionaries are installed and ready to use.", the rows all "Installed" in green, button "Get started". The watcher is gone: the loop itself marks the end, which is what happened in practice.
- 🔄 D4 "Download failed", the error in a `UiAlert type="error"` (danger colours, `role="alert"`), "Check your internet connection and try again. You can also skip this and download the packs later from Settings.", the failed pack's row marked "Failed" in the danger colour, then "Retry download" (solid) and "Skip for now" (outline). **The Rust error string is now shown** (Tauri rejects with a string, which the old code turned into the fallback); an `Error`'s message, or the old fallback text, otherwise. Retry restarts the loop and skips what got installed. Drawn from the Dialogs board (title, muted text, buttons) and `UiAlert`, as there is no board for it.
- 🔄 D5 **Fixed:** "Skip for now" after a failure completes onboarding, so an offline user is no longer stuck on the screen. The packs can be installed later from Settings.
- 🔄 D6 **Changed:** after each pack, the screen calls `db.reloadPack(packId)`, as Settings' pack card does after an install, so the new dictionaries reach the running database (in native mode this re-reads the dictionary list as well as the terms; `App.vue` alone only refreshed the terms). A failing reload is logged and does not fail the download. See decision 5.

### Layout, theme, keyboard
- 🔄 L1 Phone versus desktop flow still decided by platform (no Quick lookup on a phone). ➕ A width layout at ≤ 600 px: the card becomes the screen (no border, radius or shadow; 20 px sides; safe-area insets top and bottom; 24 px title), checked at 390 px.
- 🔄 L2 Light and dark from the tokens only; no Vuetify theme colours.
- 🔄 L3 ➕ The screen is a `role="dialog"` with `aria-modal` and the title as its label; the title is focused when the screen opens and at each step; **Tab and Shift+Tab stay inside the screen**; the checkboxes are named by their pack (the name is their `<label>`); Space toggles; the focused pack card gets an accent outline (where `:has()` is supported, otherwise the checkbox's own ring).
- ✅ L4 Sizes in rem (checked at 125 % text size), borders and radii in px.
- 🔄 L5 Rewritten in the Options API like the other components.
- ✅ No Vuetify component in `OnboardingScreen.vue` (tested); it uses `UiAlert`, `UiButton`, `UiCheckbox`, `UiIcon`, `UiProgress`.

Nothing was dropped.

## Decisions for you to check

1. **Download starts as soon as it is pressed, on desktop too.** The board puts "Download 65 MB" on the pack card and Quick lookup after it; the old app said "Next" there and only downloaded after the tip. Starting at once makes the button do what it says and uses the time spent reading the tip. The progress shows at the bottom of the Quick lookup card; Done goes straight into the app if the download has finished, else to the download step.
2. **"Not now" on the Quick lookup board is left out.** There is nothing to postpone: Quick lookup is on by default and the step only explains it, so "Not now" would do the same as "Done". If you meant "Not now" to switch Quick lookup off (`GlobalLookup.setEnabled(false)`), that is a new behaviour; say so and it is one line.
3. **The demo video is kept** though the board does not draw it, in a column to the right of the steps, which widens that card to 880 px (55rem). Below 860 px the video goes under the steps. Note that the video shows the old design of the popup, so it will look dated after 2.0 until it is re-recorded.
4. **The three dictionaries named in the welcome text** (Rangjung Yeshe, Hopkins 2015, Berzin) are a constant in the component, because the core pack has no `highlights` in `pack-definitions.js` and that file is not mine. Adding `highlights` to the core pack there would let the screen read them like the optional packs. The board says "Hopkins"; the label in the data is "Hopkins 2015".
5. **`db.reloadPack()` after each download** (D6). I could not run this in the Tauri app. It is the same call Settings makes after an install; if it runs before `db.init()` has picked a mode it does nothing, and `init()` then loads the installed pack anyway.
6. **Wording changes:** "Next" → "Continue"; "Get Started" → "Get started"; "Retry Download" → "Retry download"; "Download Failed" → "Download failed"; "You're all set!" → "You’re all set"; the download texts are shorter (see D2–D4).
7. **Installed size line** ("285 MB on this device once installed") added under each optional pack; the board only has the download size.

## What I checked, and what I could not

- **Web dev server:** the web build never shows this screen (W1), so a database was not needed. I used a temporary page (`onboarding-preview.html`, not committed, deleted) that mounts the real component and fakes Tauri's `invoke` for `download_pack`, sending progress (downloading, then extracting) or failing with "Download failed: HTTP 503 Service Unavailable".
- **Looked at in Chromium (screenshots):** 1440×900 light and dark: pack choice (none and one ticked), Quick lookup while downloading, the download error, "You're all set"; 390×844 light and dark: pack choice with both ticked, two packs downloading (one unpacking, one waiting), the error; Quick lookup at 1024×700 with Windows keys and at 390 px; 125 % text size (pack choice and Quick lookup). In the browser: the title is focused on open, Tab cycles through the two checkboxes and the button and back, Space ticks a pack and the buttons change, the focused card shows the accent ring.
- **Not checked on screen:** the demo video playing (the test browser is an open-source Chromium build without H.264, so the frame stays empty there; the element, source and attributes are unchanged from the old screen and tested); the screen inside the running Tauri app on macOS, Windows, Linux, iOS or Android, including a real download, a real network failure and `db.reloadPack()` (D6); VoiceOver/NVDA reading the dialog and the live progress.

## Changes outside the files I own

- **New test files** only: `tests/onboarding-screen.test.js`, `tests/onboarding-flags.test.js`.
- **Nothing edited** in `App.vue`, `src/ui/`, `pack-manager.js`, `pack-definitions.js`, the tokens or the other screens.
- **For the `App.vue` step (Vuetify removal):**
  - While the screen is shown, the app shell behind it is still in the accessibility tree; the Tab trap keeps keyboard focus in, but a screen reader can still walk into the app. Setting `inert` on `.app-shell` while `showOnboarding` is true would close that.
  - The app-level snackbar (for example "Update to vX ready!") sits under the screen's `z-index: 9999`, as it did before, so it cannot be seen during onboarding.
  - `onOnboardingComplete()`'s `db.setAllTermsVariable()` is now redundant with the screen's own `reloadPack()` but harmless; keep it or drop it.
- **For `pack-definitions.js`:** a `highlights` list on the core pack (decision 4).
