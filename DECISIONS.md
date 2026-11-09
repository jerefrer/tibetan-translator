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
