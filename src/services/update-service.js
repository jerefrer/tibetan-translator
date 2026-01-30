/**
 * Auto-update service for desktop Tauri apps
 *
 * Handles silent update checking and downloading.
 * Updates are downloaded in the background and installed on next app restart.
 */

import { isTauri, isMobile } from '../config/platform';

class UpdateService {
  constructor() {
    this.updateReady = false;
    this.updateInfo = null;
    this.downloadProgress = 0;
    this.error = null;
  }

  /**
   * Check for updates and download silently if available
   * @param {Function} onUpdateReady - Called when update is downloaded and ready to install
   * @returns {Promise<Object|null>} Update info or null if no update available
   */
  async checkAndDownload(onUpdateReady) {
    // Only desktop Tauri apps support auto-updates (not web, not mobile)
    if (!isTauri() || isMobile()) return null;

    try {
      // Dynamic import to avoid loading on non-Tauri platforms
      const { check } = await import('@tauri-apps/plugin-updater');

      const update = await check();
      if (!update) return null; // No update available

      this.updateInfo = update;

      // Download silently in background
      await update.downloadAndInstall((progress) => {
        if (progress.event === 'Progress') {
          this.downloadProgress = Math.round(
            (progress.data.chunkLength / progress.data.contentLength) * 100
          );
        }
      });

      this.updateReady = true;
      if (onUpdateReady) onUpdateReady(update.version);

      return update;
    } catch (e) {
      this.error = e;
      console.error('Update check failed:', e);
      return null;
    }
  }

  /**
   * Check for updates without downloading
   * @returns {Promise<Object|null>} Update info or null if no update available
   */
  async checkOnly() {
    if (!isTauri() || isMobile()) return null;

    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      this.updateInfo = update;
      return update;
    } catch (e) {
      this.error = e;
      console.error('Update check failed:', e);
      return null;
    }
  }

  /**
   * Relaunch the app to apply the downloaded update
   */
  async installAndRelaunch() {
    if (!this.updateReady) return;

    try {
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (e) {
      console.error('Relaunch failed:', e);
    }
  }

  /**
   * Get the current app version
   * @returns {Promise<string>} Version string
   */
  async getVersion() {
    if (!isTauri()) return null;

    try {
      const { getVersion } = await import('@tauri-apps/api/app');
      return await getVersion();
    } catch (e) {
      console.error('Failed to get version:', e);
      return null;
    }
  }
}

export default new UpdateService();
