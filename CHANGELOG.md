# Changelog

All notable changes to Tibetan Translator are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.11.0](https://github.com/jerefrer/tibetan-translator/compare/v1.10.0...v1.11.0) - 2026-08-13

### Added
- Import and export of your own dictionaries as spreadsheets — build a word list in Excel or Numbers, drop the file onto the app, and it works out which column is which on its own

## [1.10.0](https://github.com/jerefrer/tibetan-translator/compare/v1.9.2...v1.10.0) - 2026-08-11

### Added
- Automatic conversion of pasted pre-Unicode Tibetan text to Unicode

### Changed
- Entry dialogs now use lighter, outlined fields instead of solid-filled ones

### Fixed
- The add-definition button no longer sits in the middle of the search results bar

## [1.9.2](https://github.com/jerefrer/tibetan-translator/compare/app-v1.9.1...v1.9.2) - 2026-08-11

### Added
- Release notes preview before the app restarts to install an update

## [1.9.1](https://github.com/jerefrer/tibetan-translator/compare/app-v1.9.0...app-v1.9.1) - 2026-08-11

### Fixed
- The global lookup search field no longer shows a duplicate clear button

## [1.9.0](https://github.com/jerefrer/tibetan-translator/compare/app-v1.8.0...app-v1.9.0) - 2026-08-11

### Added
- A new Lexicon section for creating, viewing, and editing your own dictionaries and entries — now available on mobile too
- A quick-add option to create a dictionary entry directly from Define and Search
- The ability to rename your dictionaries and export them as .tibdict files
- An empty template for starting new dictionaries, ready for you to fill in
- A confirmation prompt before deleting a dictionary or entry, overwriting an existing definition, or replacing a dictionary you've edited locally
- Clearer, actionable messages when a dictionary operation fails

### Fixed
- The dictionary page now updates to match the app's selected card language
- Labels no longer overlap the Tibetan text in forms
- Quickly saving, quick-adding, or renaming entries no longer overwrites data, creates duplicates, or leaves stale entries in the list
- Dictionaries no longer show an incorrect last-modified date
- Exporting a dictionary no longer fails due to a missing permission
- Entry search no longer misses results or fails on searches containing certain characters
- Dictionary selection and pagination no longer get out of sync when switching between dictionaries
- The entry editor now shows errors properly when a save fails
- Word lookups, including from the quick-lookup hotkey, now find the right definition
- Renaming a dictionary no longer renames the wrong one
- Deleting a custom pack no longer targets the wrong folder

## [1.8.0](https://github.com/jerefrer/tibetan-translator/compare/app-v1.7.2...app-v1.8.0) - 2026-07-01

### Added
- Copy buttons for definitions

## [1.7.2](https://github.com/jerefrer/tibetan-translator/compare/app-v1.7.1...app-v1.7.2) - 2026-05-22

### Added
- A persistent badge when a new app update is available

## [1.7.1](https://github.com/jerefrer/tibetan-translator/compare/app-v1.7.0...app-v1.7.1) - 2026-05-21

### Added
- Enter as a way to trigger Wylie-to-Tibetan conversion, matching what the space bar already does

### Fixed
- Scan downloads no longer save to the wrong folder
- The progress indicator now updates while a scan downloads
- The popup no longer turns English text into garbled Tibetan when switched to Define mode

## [1.7.0](https://github.com/jerefrer/tibetan-translator/compare/app-v1.6.5...app-v1.7.0) - 2026-05-21

### Added
- Automatic detection of Wylie transliteration, plus a toggle to switch the popup between Define and Search modes

### Fixed
- The mode tabs no longer stretch to fill the popup's height

## [1.6.5](https://github.com/jerefrer/tibetan-translator/compare/app-v1.6.4...app-v1.6.5) - 2026-04-25

### Fixed
- Tibetan diacritics are no longer cut off in the autocomplete suggestion list

## [1.6.4](https://github.com/jerefrer/tibetan-translator/compare/app-v1.6.3...app-v1.6.4) - 2026-04-25

### Fixed
- Search results now follow your dictionary preference order instead of a fixed default order

## [1.6.3](https://github.com/jerefrer/tibetan-translator/compare/app-v1.6.2...app-v1.6.3) - 2026-04-25

### Added
- An automatic full-text search mode that activates when appropriate
- Popup search results in the same two-column layout as the Search page, with the dictionary shown inline
- A single shared screen combining drag-and-drop and file import for custom dictionary packs

### Changed
- The popup is faster, showing the clipboard word right away and loading its translations in the background

### Fixed
- Define mode now respects your custom dictionary order
- Search now matches words regardless of straight or curly apostrophes
- Header icons and titles are now aligned with list items throughout the settings screens
- Dictionaries in the list can be dragged and reordered again
- Definitions now show line breaks properly instead of a literal "\n"
- "+" pattern grammar entries now preserve their full templates and hints instead of being dropped or cut short
- Spacing around header icons is tighter, and the custom-pack import button sits below the list

## [1.6.2](https://github.com/jerefrer/tibetan-translator/compare/app-v1.5.2...app-v1.6.2) - 2026-04-23

### Added
- Support for installing custom dictionaries from a .tibdict file

## [1.5.2](https://github.com/jerefrer/tibetan-translator/compare/app-v1.5.1...app-v1.5.2) - 2026-02-20

### Fixed
- Dictionary order changes now apply immediately, without needing to restart the app

## [1.5.1](https://github.com/jerefrer/tibetan-translator/compare/app-v1.4.2...app-v1.5.1) - 2026-02-20

### Added
- The Padmakara Glossary as a new dictionary

### Fixed
- Entry ordering on the Define page now matches the dictionary order set in preferences

## [1.4.2](https://github.com/jerefrer/tibetan-translator/compare/app-v1.4.1...app-v1.4.2) - 2026-02-06

### Fixed
- The scrollbar position on the Settings page is now correct
- The app window on macOS can now be reopened after clicking the red close button

## [1.4.1](https://github.com/jerefrer/tibetan-translator/compare/app-v1.4.0...app-v1.4.1) - 2026-02-06

### Changed
- The default theme is light instead of following the system setting

## [1.4.0](https://github.com/jerefrer/tibetan-translator/compare/app-v1.3.1...app-v1.4.0) - 2026-02-06

### Fixed
- Tibetan-language searches no longer miss results due to a search engine bug

## [1.3.1](https://github.com/jerefrer/tibetan-translator/compare/app-v1.3.0...app-v1.3.1) - 2026-01-30

### Fixed
- The app reliably checks for and installs updates

## [1.3.0](https://github.com/jerefrer/tibetan-translator/compare/app-v1.2.0...app-v1.3.0) - 2026-01-30

- Maintenance and internal improvements

## [1.2.0](https://github.com/jerefrer/tibetan-translator/compare/app-v1.1.0...app-v1.2.0) - 2026-01-30

### Added
- Automatic updates, so the app can notify you and update itself when a new version is available
- A font-size slider in Settings to adjust text size throughout the app
- A Query Builder to the Search page for building more precise searches

### Fixed
- The appearance of search history items on the Search page is now correct

## [1.1.0](https://github.com/jerefrer/tibetan-translator/compare/app-v1.0.0...app-v1.1.0) - 2026-01-28

### Added
- Quick Lookup: trigger a popup with a hotkey to instantly see the definition of whatever Tibetan term is copied to your clipboard, with a new help guide and an onboarding tour on desktop
- A new Split page
- The correct keyboard shortcut symbols for your platform (e.g. ⌘ vs Ctrl) in help dialogs

### Changed
- The Configure page is now called Settings throughout the app and help dialogs, with a cog icon for it on mobile
- Pack icons consistently use the primary color
- The search or text field is automatically focused when you switch pages

### Fixed
- The keyboard shortcut display no longer has a spacing issue
- The Define page now shows dictionaries you just downloaded
- The Define page and popup no longer show a definition when no term was actually highlighted
- Pasting now correctly replaces trailing punctuation with a tsheg
- The Search page no longer has styling issues

## [1.0.0](https://github.com/jerefrer/tibetan-translator/compare/app-v0.11.0...app-v1.0.0) - 2026-01-20

### Added
- A new Split page
- A hotkey that pops up the definition of whatever word is on your clipboard

### Changed
- The Configure page is now called Settings, with a cog icon on mobile
- Dictionary lookups on desktop are faster and more reliable

### Fixed
- The Search page's visual style is now correct

## [0.11.0](https://github.com/jerefrer/tibetan-translator/compare/app-v0.10.0...app-v0.11.0) - 2026-01-06

### Added
- A core dictionary package plus two optional downloadable packs (Tibetan monolingual and Sanskrit academic), with a new download manager in onboarding and preferences
- Online and offline support for scanned dictionaries
- Ctrl/cmd-click and long-press to select just one dictionary when filtering
- Infinite scrolling to the define and search pages

### Changed
- The search and define pages have a fixed search bar and separate scrollbars for terms and definitions
- Search result ranking is better
- The scrollbar on the Configure page is restored and the theme buttons are left-aligned
- The Configure page shortcut key is G instead of C
- The dictionary browser looks better

### Fixed
- The define page on desktop no longer shows incorrect results
- The dictionary filter no longer has bugs
- The app no longer has visual glitches on iOS
- Dictionaries now load properly on mobile, and the app starts faster
- Various interface quirks and keyboard shortcut issues are resolved

## [0.10.0](https://github.com/jerefrer/tibetan-translator/compare/app-v0.9.11...app-v0.10.0) - 2026-01-02

### Added
- Support for using the app on iOS and Android
- Audio playback for definitions

### Changed
- Dictionaries include the latest data

### Fixed
- Phonetic search works correctly again

## [0.9.11](https://github.com/jerefrer/tibetan-translator/compare/app-v0.9.9...app-v0.9.11) - 2024-11-21

### Fixed
- Cut, Copy, Paste, Select All, Undo, and Redo are back in the Edit menu

## [0.9.9](https://github.com/jerefrer/tibetan-translator/compare/app-v0.9.8...app-v0.9.9) - 2024-11-21

### Added
- The app version number in the menu

### Changed
- The menu links have a cleaner layout

## [0.9.8](https://github.com/jerefrer/tibetan-translator/compare/app-v0.9.7...app-v0.9.8) - 2024-11-20

### Added
- Menu links to the project website, GitHub page, and sponsor page in the top bar

## [0.9.7](https://github.com/jerefrer/tibetan-translator/compare/app-v0.9.6...app-v0.9.7) - 2024-07-19

### Fixed
- Drag-and-drop now works correctly

## [0.9.6](https://github.com/jerefrer/tibetan-translator/compare/app-v0.9.4...app-v0.9.6) - 2024-07-18

### Fixed
- The app icon now displays at the correct size and looks sharper alongside other Mac apps

## [0.9.4](https://github.com/jerefrer/tibetan-translator/compare/app-v0.9.3...app-v0.9.4) - 2024-07-17

- Maintenance and internal improvements

## [0.9.3](https://github.com/jerefrer/tibetan-translator/compare/app-v0.9.2...app-v0.9.3) - 2024-07-17

### Changed
- The app icon has a new colorized, squircle-shaped design

### Fixed
- Opening the app on Mac no longer shows the "unidentified developer" security warning

## [0.9.2](https://github.com/jerefrer/tibetan-translator/compare/v0.8.2...app-v0.9.2) - 2024-07-12

### Added
- A placeholder hint in the search box

### Changed
- The light theme has a new red/yellow color scheme
- All dictionaries display in a single column instead of a grid
- Each dictionary definition now has the correct trailing tshek punctuation
- The dictionary database includes the latest corrections and fixes

### Fixed
- Help dialog colors are corrected and the toolbar title is centered
- Phonetics search in strict mode no longer incorrectly replaces "al" with "el"
- Pasting multi-line text into the translation page now works correctly
- Search no longer shows irrelevant partial-word matches

## [0.8.2](https://github.com/jerefrer/tibetan-translator/compare/v0.8.1...v0.8.2) - 2023-12-02

### Added
- A custom app icon for macOS

## [0.8.1] - 2023-12-02

### Added
- A desktop app version of Tibetan Translator
- The ability to install the app from your browser for a native-like experience on mobile and desktop
- An "experimental" label on the Translate tab to signal it's still a work in progress

### Changed
- The search page no longer has a fade-in animation, preventing a brief visual glitch when it loads

### Fixed
- Searches with no matching entries no longer trigger a bug
