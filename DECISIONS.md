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
**Trade-offs:** One more control next to the field, and the user has to pick the mode; a word typed in the wrong mode is converted (བོད) or searched as is (EN) until the switch or a hint is used. The pages' own tests went with them; what they covered and still exists was ported to the Lookup, Reader, TermEntry and Library tests first.
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
