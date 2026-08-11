/**
 * The Tauri commands are registered TWICE, in two separate handler lists:
 *
 *   src-tauri/src/main.rs — the desktop binary
 *   src-tauri/src/lib.rs  — the mobile entry point (#[cfg_attr(mobile, …)])
 *
 * A command added to only one of them compiles cleanly, passes `cargo test`,
 * passes `pnpm build`, and then fails at runtime on the platform whose list
 * was missed — with nothing but a "command not found" in a console the user
 * never sees.
 *
 * That is not hypothetical: the whole editable-dictionary feature was added
 * to main.rs alone, so every one of its commands would have failed on iOS and
 * Android while the UI offered them as if they worked. This test is the guard.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '../src-tauri/src');

/**
 * Commands that legitimately live only in the desktop binary. Each one is
 * gated behind #[cfg(target_os = "macos")] in main.rs and has no mobile
 * counterpart, so its absence from lib.rs is deliberate rather than an
 * oversight. Adding to this list is a decision, not a formality.
 */
const DESKTOP_ONLY = new Set([
  'configure_window_for_fullscreen',
  'show_lookup_panel',
  'hide_lookup_panel',
]);

function registeredCommands(file) {
  const source = fs.readFileSync(path.join(SRC, file), 'utf-8');
  const block = source.match(/generate_handler!\[(.*?)\]/s);
  expect(block, `no generate_handler! block found in ${file}`).toBeTruthy();

  return new Set(
    block[1]
      .replace(/\/\/[^\n]*/g, '') // strip the section comments
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
}

describe('Tauri command registration', () => {
  const desktop = registeredCommands('main.rs');
  const mobile = registeredCommands('lib.rs');

  it('registers every non-desktop-only command on the mobile entry point too', () => {
    const missing = [...desktop].filter(
      (command) => !DESKTOP_ONLY.has(command) && !mobile.has(command)
    );

    expect(
      missing,
      `These commands are registered in main.rs but not lib.rs, so they will ` +
        `fail at runtime on iOS and Android. Add them to lib.rs's handler ` +
        `list, or to DESKTOP_ONLY in this test if they are genuinely ` +
        `desktop-only: ${missing.join(', ')}`
    ).toEqual([]);
  });

  it('does not register a command on mobile that the desktop build lacks', () => {
    const missing = [...mobile].filter((command) => !desktop.has(command));
    expect(missing, `registered in lib.rs but missing from main.rs`).toEqual([]);
  });

  it('keeps the desktop-only exception list honest', () => {
    // A command listed as desktop-only must actually still exist in main.rs;
    // otherwise the list quietly accumulates names that mean nothing.
    const stale = [...DESKTOP_ONLY].filter((command) => !desktop.has(command));
    expect(stale, `listed as desktop-only but not registered anywhere`).toEqual([]);
  });

  it('registers all seven lexicon commands on both platforms', () => {
    const lexiconCommands = [
      'create_lexicon',
      'rename_lexicon',
      'lexicon_entries',
      'lexicon_find_entry',
      'lexicon_upsert_entry',
      'lexicon_delete_entry',
      'lexicon_export',
    ];
    for (const command of lexiconCommands) {
      expect(desktop.has(command), `${command} missing from main.rs`).toBe(true);
      expect(mobile.has(command), `${command} missing from lib.rs`).toBe(true);
    }
  });
});
