/**
 * TibdictInstaller — shared install orchestration for .tibdict files.
 *
 * Both the "Import…" button (in CustomPackSection) and the window-wide
 * drag-and-drop handler (in App.vue) go through this module, so they share:
 *   - the same conflict-confirmation modal
 *   - the same snackbar messages
 *   - the same error classification
 *
 * The modal is rendered once at the App level; the button and drop handler
 * simply call `install(filePath)` / `installMany([...])`.
 */

import { reactive } from 'vue';
import PackManager from './pack-manager';

const state = reactive({
  conflictOpen: false,
  pendingFilePath: '',
  incomingManifest: null,
  existingManifest: null,
});

let snackbarOpen = null;

function notify(text) {
  if (typeof snackbarOpen === 'function') snackbarOpen(text);
}

function messageForError(result) {
  if (result.errorKind === 'incompatible') {
    return "This file isn't compatible with your app version. Please get an up-to-date file.";
  }
  if (result.errorKind === 'corrupt') return 'Invalid or corrupted file.';
  return "This file isn't a valid dictionary.";
}

async function runInstall(filePath, options = {}) {
  const result = await PackManager.installCustomPack(filePath, options);
  return result;
}

function openConflictModal(filePath, result) {
  state.pendingFilePath = filePath;
  state.incomingManifest = result.incomingManifest || null;
  state.existingManifest = result.existingManifest || null;
  state.conflictOpen = true;
}

function closeConflictModal() {
  state.conflictOpen = false;
  state.pendingFilePath = '';
  state.incomingManifest = null;
  state.existingManifest = null;
}

export const TibdictInstaller = {
  state,

  /** Wire the snackbar once at app startup. */
  setSnackbar(openFn) {
    snackbarOpen = openFn;
  },

  /** Install a single .tibdict file. Opens the conflict modal if needed. */
  async install(filePath) {
    const result = await runInstall(filePath);
    if (result.status === 'installed') {
      notify(`${result.pack.manifest.name} installed`);
      return;
    }
    if (result.status === 'conflict') {
      openConflictModal(filePath, result);
      return;
    }
    notify(messageForError(result));
  },

  /** Install multiple .tibdict files sequentially, with a recap snackbar. */
  async installMany(filePaths) {
    if (filePaths.length === 1) {
      await this.install(filePaths[0]);
      return;
    }
    let installed = 0;
    let cancelled = 0;
    for (const filePath of filePaths) {
      const result = await runInstall(filePath);
      if (result.status === 'installed') {
        installed++;
        continue;
      }
      if (result.status === 'conflict') {
        // Queue the first conflict for user confirmation; skip subsequent ones silently.
        if (!state.conflictOpen) {
          openConflictModal(filePath, result);
        }
        cancelled++;
        continue;
      }
      cancelled++;
    }
    const parts = [];
    if (installed > 0) parts.push(`${installed} installed`);
    if (cancelled > 0) parts.push(`${cancelled} skipped`);
    if (parts.length) notify(parts.join(', '));
  },

  /** Called by the conflict modal when user confirms the replacement. */
  async confirmReplace() {
    const filePath = state.pendingFilePath;
    const name = state.incomingManifest?.name || '';
    closeConflictModal();
    const result = await runInstall(filePath, { force: true });
    if (result.status === 'installed') {
      notify(`${result.pack.manifest.name || name} installed`);
    } else {
      notify(messageForError(result));
    }
  },

  /** Called by the conflict modal when user cancels. */
  cancelReplace() {
    closeConflictModal();
  },
};

export default TibdictInstaller;
