/**
 * CustomPackImporter — orchestrates .tibdict installation from the frontend.
 *
 * Returns a normalized result object:
 *   { status: 'installed', pack }
 *   { status: 'conflict', message }  -- caller should ask user to confirm, then retry with force=true
 *   { status: 'error', errorKind, message }
 *
 * errorKind is one of:
 *   - 'incompatible'   : schema or format version mismatch
 *   - 'corrupt'        : ZIP or SQLite unreadable
 *   - 'notADictionary' : not a .tibdict / missing files / bad id
 *   - 'unknown'        : anything else
 */

import { invoke } from '@tauri-apps/api/core';

function classifyError(err) {
  const code = err?.code || '';
  if (code === 'schema') return 'incompatible';
  if (code === 'corrupt') return 'corrupt';
  if (code === 'format') return 'notADictionary';
  return 'unknown';
}

function classifyResult(promise) {
  return promise
    .then((pack) => ({ status: 'installed', pack }))
    .catch((err) => {
      const code = err?.code || '';
      const message = err?.message || String(err);
      if (code === 'conflict') {
        return {
          status: 'conflict',
          message,
          incomingManifest: err?.incomingManifest || null,
          existingManifest: err?.existingManifest || null,
        };
      }
      return { status: 'error', errorKind: classifyError(err), message };
    });
}

export const CustomPackImporter = {
  async install(filePath, options = {}) {
    const force = !!options.force;
    return classifyResult(invoke('install_custom_pack', { filePath, force }));
  },
  /** Install from in-memory bytes (used by HTML5 drag-drop, where only the file
   *  content is available — the webview's File API doesn't expose an OS path). */
  async installFromBytes(data, options = {}) {
    const force = !!options.force;
    return classifyResult(invoke('install_custom_pack_from_bytes', { data, force }));
  },
};

export default CustomPackImporter;
