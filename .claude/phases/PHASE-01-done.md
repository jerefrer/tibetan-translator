# Phase 01 — Foundations
Status: DONE

## Goal
Folio tokens and Inter, and the logic Lookup and Reader need pulled out of the old pages into tested services.

## Tasks
- [x] Tasks 1-4 of docs/superpowers/plans/2026-11-12-folio-redesign.md

## Acceptance Criteria
- Inter and the Folio palette in tokens.css; search-query, recents, saved-terms, transcription, in-short and glosses services exist with tests; the old pages run on them with their tests green.
- Full suite green.

## Decisions Made This Phase
- buildSearchSql takes raw phonetic terms (strictVariants/looseVariants names kept); recents events spy on window.dispatchEvent because tests/setup.js mocks addEventListener; tibetan-ewts-converter moved to dependencies with lockfile fixed.
