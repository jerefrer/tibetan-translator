# Redesign mockups (reference)

Source files of the design canvas "Tibetan Translator Redesign" (private artifact: https://claude.ai/artifact/X4QzT2uuG9VuoXP4e8vGJr). `canvas.json` gives each board's position and title.

**Only option B is the reference** ("B · …" boards): the same three screens as today (Define, Search, Split), refined. Boards without the "B" prefix (Lookup, Reading, Library, Phone, Quick lookup) are option A, kept for comparison, and are **not** part of the plan.

## How to read them

- Each `*.dc.html` is one board, written as plain HTML and inline CSS. Open the file in a browser, or read the markup for exact spacing, sizes and colours.
- Palette: the app's current identity (background `#FAF3E0`, accent `#A30000`, sidebar `#A30000` with yellow `#FFC107` for the active item). Dark theme: see `DefineDark.dc.html`.
- Fonts: Instrument Sans and Source Serif 4 (to be bundled, not loaded from Google Fonts), DDC Uchen for Tibetan (`vendor/fonts`). The boards load DDC Uchen from a `/_blob/…` URL that only exists inside the canvas; ignore it and use the repo's font.
- Icons are inline strokes (width 1.8); the implementation uses Lucide.

## Illustrative content (not real data)

Scan page "479", the My glossary entries, recent searches, and the "12 more entries" notice counts are examples.

## Not drawn

Scanned rows in Search results, the unknown-term marker in Split, tablet layout, dark theme for screens other than Define. See the fidelity checklist in `docs/superpowers/plans/2026-10-22-redesign-big-bang.md`.
