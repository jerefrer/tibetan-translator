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

export const CustomPackImporter = {
  async install(filePath, options = {}) {
    const force = !!options.force;
    try {
      const pack = await invoke('install_custom_pack', { filePath, force });
      return { status: 'installed', pack };
    } catch (err) {
      const code = err?.code || '';
      const message = err?.message || String(err);

      if (code === 'conflict') {
        return { status: 'conflict', message };
      }
      return { status: 'error', errorKind: classifyError(err), message };
    }
  },
};

export default CustomPackImporter;
