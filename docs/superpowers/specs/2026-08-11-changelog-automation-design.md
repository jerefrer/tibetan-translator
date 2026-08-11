# Changelog automation — design

Date: 2026-08-11
Status: approved

## Problem

Every GitHub release carries the same hardcoded sentence, set in
`.github/workflows/build.yml`:

```yaml
releaseBody: 'See the assets to download this version and install.'
```

`src-tauri/tauri.conf.json` points the updater at
`https://github.com/jerefrer/tibetan-translator/releases/latest/download/latest.json`,
and `tauri-action` bakes the release body into that asset's `notes` field. The
plugin then exposes it as `update.body`.

Nothing reads it. `update-service.js` uses only `update.version`: the update
downloads silently, raises a snackbar and a Settings badge, and the notes are
discarded. So today a user is never told what an update contains — not on the
releases page, and not in the app.

That makes this three pieces of work rather than one: write the notes, publish
them, and finally show them.

## Decisions

| Question | Decision |
|---|---|
| Audience | End users (translators, practitioners). Benefit-oriented prose, no scopes or file names. |
| Human review | Local draft, reviewed before the tag is pushed. Nothing reaches users unreviewed. |
| Language | English only, matching the app UI. |
| Source of truth | `CHANGELOG.md` in [Keep a Changelog](https://keepachangelog.com) format. |
| Generator | `claude -p --model sonnet`, run locally. |

`gh release edit` was rejected as the *primary* mechanism: `latest.json` is
uploaded as a release asset during the run, so a later edit of the release body
does not rewrite it. It is still the right tool for backfilling the bodies of
releases that already shipped, where no asset needs to change.

Rewriting the `latest.json` of past releases was considered and dropped. The
updater only ever reads `/releases/latest/`, so older assets are never fetched;
and the display added below ships in 1.9.2, so the earliest release whose notes
any client can render is the one after it. There is no version for which the
rewrite would reach a user.

### Style

Bullets never repeat the verb in their section heading — the heading already
says it. Under `### Added` the bullet names the thing that now exists; under
`### Fixed` it describes how the app behaves now. No trailing full stop. The
rule lives in the generator prompt so every future release matches.

## Tag scheme

Two tags exist per version today. `release:patch` pushes `v1.9.1`, which triggers
the workflow; `tauri-action` then receives `tagName: app-v__VERSION__` and GitHub
mints a second tag to hang the release on. The `app-v` pattern comes from the
`tauri-action` README example, written for workflows triggered by branch push
where the action does the tagging itself.

The remote holds 70 tags for 40 versions. Of the 33 published releases, 31 sit on
an `app-v*` tag and 2 — the oldest, `v0.8.1` and `v0.8.2` — sit directly on a `v*`
tag, from before the `app-v` pattern was copied in. Moving back to a single `v*`
tag is therefore a return to the original scheme rather than a new invention.

Eight `v*` tags have no release on either naming scheme: `v0.9.0`, `v0.9.1`,
`v0.9.5`, `v0.9.10`, `v1.0.1`, `v1.5.0`, `v1.6.0`, `v1.6.1`. Those are builds that
failed after the tag was pushed. Under a two-tag scheme an orphan `v*` looks like
a successful release until you cross-reference both lists.

Fix: `tagName: ${{ github.ref_name }}`. `tauri-action` attaches the release to the
existing tag rather than creating a parallel one. Existing releases keep their
current tags; nothing is rewritten retroactively, and the updater is unaffected
because its endpoint resolves `/releases/latest/` rather than a tag name.

Consequence: historical compare links target `app-v*`, new ones target `v*`. The
script resolves the real tag from `gh release list` instead of guessing the name.

## Commit history quality

| Period | Style | Usable |
|---|---|---|
| v1.8.0 → now | conventional commits, scoped | Yes, directly |
| v1.0.0 → v1.7.x | descriptive sentences, no prefix, mixed with dev noise | Yes, with semantic filtering |
| v0.9.x | very sparse (`v0.9.6..v0.9.7` holds one real commit) | Minimal, one-line entries |

Two consequences:

1. **Filtering is two-stage.** A prefix allowlist (`feat`, `fix`, `perf`, `style`)
   applies only where a conventional prefix exists. Everything else passes to the
   model, which discards what a user cannot perceive. A regex alone would either
   drop the entire pre-1.8 history or flood it with tooling commits.

2. **Ranges are cut by release, not by tag.** Commits tagged `v1.5.0` reached users
   in `v1.5.1`, because `v1.5.0` never shipped. Cutting by tag would erase that work
   from the changelog. Each entry spans *previous release → this release*.

## Components

### `scripts/lib/changelog-core.js` — pure, no I/O

- `parseCommits(rawLog)` → `[{hash, subject}]` from `git log` output
- `isNoiseCommit(subject)` → drops bump commits, merges, and the `chore`/`docs`/
  `test`/`refactor`/`build`/`ci` conventional types
- `filterCommits(commits)` → applies the above
- `renderSection({version, date, body, compareUrl})` → one Keep a Changelog block
- `insertSection(changelog, section, version)` → prepends; replaces in place when a
  section for that version already exists, so re-running is idempotent
- `extractSection(changelog, version)` → the body for one version, for the workflow
- `cleanNotes(raw)` → strips code fences and lead-in prose from the model's reply,
  so a chatty answer still lands as clean Markdown

### `scripts/generate-changelog.js` — CLI and I/O

Two modes over one shared generation path, so the backfill exercises the same code
the release path uses.

- `--next <version>`: range `last release → HEAD`, insert at the top of
  `CHANGELOG.md`, open `$VISUAL → $EDITOR → git core.editor → vi`, and abort the
  release if the section comes back empty.
- `--backfill`: iterate the releases reported by `gh release list`, generate every
  section, write the whole file. Run once.

### `scripts/extract-release-notes.js`

Prints one version's section on stdout for the workflow. Kept separate from the
generator so the YAML stays a one-liner and the workflow never loads the `gh` or
`claude` code paths.

### `scripts/bump-version.js`

Gains `--print`, which resolves the next version and exits without writing a
single file.

### `package.json`

`release:patch|minor|major` become:

```
check-tauri-versions
  → bump-version <type> --print     (resolve the version, touch nothing)
  → generate-changelog --next       (write notes, open editor, may abort)
  → bump-version <type>             (now actually write the version files)
  → add, commit, tag, push
```

The changelog step runs *before* the bump so that aborting it leaves the tree
clean. `generate-changelog` also restores `CHANGELOG.md` to its previous content
on abort, so a cancelled release leaves nothing behind.

### `.github/workflows/build.yml`

- `tagName: ${{ github.ref_name }}`
- a step reading `scripts/extract-release-notes.js` into `steps.notes.outputs.body`,
  which feeds `releaseBody`, falling back to the old generic sentence (with a
  workflow warning) when a version has no section

### `scripts/sync-release-notes.js`

Pushes each `CHANGELOG.md` section to the body of its GitHub release, so the 32
releases published before this work stop showing the placeholder. Dry run by
default; `--apply` to write. Skips releases whose body already matches. Only the
body is touched — assets, including `latest.json`, are left alone.

### In-app display

The plumbing already ran end to end; only the last step was missing:

- `src/services/update-service.js` publishes `update.body` as `state.notes`
- `src/services/release-notes-markdown.js` renders the `### heading` + `- bullet`
  subset the generator emits. The notes are remote content fetched from GitHub,
  so every span is HTML-escaped and the markup is rebuilt rather than trusted. A
  full Markdown dependency would be disproportionate for two node types.
- `ConfigurePage.vue` turns the restart confirmation into a **What's new in
  vX.Y.Z** dialog — notes in a scrollable body, `[Later]` / `[Restart now]` —
  and adds a *What's new* link beside the version line for reading without
  committing to a restart.

The restart dialog is the right home: it is the moment the user decides whether
to restart now, which is exactly the decision release notes inform.

### `tests/changelog.test.js` and `tests/release-notes-markdown.test.js`

Covers the deterministic surface only: log parsing, noise filtering, section
rendering, idempotent insertion, extraction, and model-output cleaning. The
`claude -p` call itself is not tested — model prose is not a fixture.

## Error handling

| Failure | Behaviour |
|---|---|
| `claude` missing or non-zero exit | Abort before tagging, print the CLI's stderr |
| Empty section after review | Abort the release; an empty changelog entry is a mistake, not a valid release |
| `gh` unauthenticated (backfill) | Abort with the auth hint; backfill is a one-off, no fallback needed |
| No commits in range | Abort — there is nothing to release |
| Section already present for the version | Replace it rather than duplicating |

## Out of scope

- Rewriting or consolidating the 8 orphan `v*` tags. They are history; the fix
  prevents new ones.
- Rewriting the `latest.json` of past releases — see the reasoning above; no
  client would ever read the result.
- Translating the changelog. English only, per the decision above.
- Changing `releaseName`, which stays `App v__VERSION__`.
- Showing the notes in the snackbar. It is too small for a list, and the restart
  dialog it leads to already carries them.
