# Phase 04 — Reader
Status: DONE

## Goal
Reading a Tibetan text word by word with each word's entry beside it.

## Tasks
- [x] Tasks 12-13 of docs/superpowers/plans/2026-11-12-folio-redesign.md

## Acceptance Criteria
- Split's editor rules kept; words and expressions open a side panel (desktop) or sheet (phone).
- Full suite green.

## Decisions Made This Phase
- Reader: spaces are word breaks after a split (Ctrl+Enter after Edit reads the spaces, not the tokenizer); line breaks flatten as in Split; splitIntoWords tokenizes whitespace-separated chunks; Paste button in the editor only; Reader brackets 16px lane / 24px hit on phone.
