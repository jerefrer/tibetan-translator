# First launch (onboarding): redesign report

Work in progress. The behaviours list below was written before any code changed.

## Behaviours of the old screen

Written by reading `OnboardingScreen.vue` and what it uses: `services/pack-manager.js` (download, progress, onboarding flags), `config/pack-definitions.js` (pack names, descriptions, sizes, highlights), `services/dictionary-catalog.js` (`getPackHighlights`), `services/dictionaries-details.js` (labels), `config/platform.js`, and the places outside the screen that depend on it (`App.vue`, `services/global-lookup.js` for the hotkey, `src-tauri/src/packs.rs` for the progress events).

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
