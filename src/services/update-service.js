/**
 * Auto-update service for desktop Tauri apps
 *
 * Handles silent update checking and downloading.
 * Updates are downloaded in the background and installed on next app restart.
 */

import { reactive } from 'vue';

import { isTauri, isMobile } from '../config/platform';

class UpdateService {
  constructor() {
    // Reactive so components (the Settings tab badge, the About card button)
    // re-render as the update lifecycle progresses.
    this.state = reactive({
      updateReady: false,
      version: null,
      downloading: false,
      downloadProgress: 0,
    });
    this.updateInfo = null;
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
      this.state.downloading = true;
      this.state.downloadProgress = 0;

      // Download silently in background. The updater reports the total size in
      // the `Started` event and per-chunk sizes in `Progress`, so accumulate
      // the chunks to get a real percentage.
      let downloaded = 0;
      let contentLength = 0;
      await update.downloadAndInstall((progress) => {
        if (progress.event === 'Started') {
          contentLength = progress.data.contentLength || 0;
        } else if (progress.event === 'Progress') {
          downloaded += progress.data.chunkLength || 0;
          this.state.downloadProgress = contentLength
            ? Math.round((downloaded / contentLength) * 100)
            : 0;
        }
      });

      this.state.downloading = false;
      this.state.downloadProgress = 100;
      this.state.updateReady = true;
      this.state.version = update.version;
      if (onUpdateReady) onUpdateReady(update.version);

      return update;
    } catch (e) {
      this.state.downloading = false;
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
    if (!this.state.updateReady) return;

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
