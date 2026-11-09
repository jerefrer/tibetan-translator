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
