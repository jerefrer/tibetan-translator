/**
 * Pack Manager Service
 *
 * Manages dictionary pack installation, removal, and state tracking.
 * Works with Tauri backend for actual file operations.
 */

import { reactive } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import Storage from './storage';
import { supportsModularPacks } from '../config/platform';
import { PACK_DEFINITIONS, getRequiredPackIds, SUPPORTED_SCHEMA_VERSION } from '../config/pack-definitions';

// Reactive state for pack management
const state = reactive({
  manifest: null,
  installedPacks: [],
  downloadingPacks: {}, // packId -> progress object
  updatingPacks: {}, // packId -> progress object for updates
  availableUpdates: {}, // packId -> { checksum, sizeMB }
  initialized: false,
  error: null,
  lastUpdateCheck: null,
});

export const PackManager = {
  // ============================================
  // State Accessors
  // ============================================

  get manifest() {
    return state.manifest;
  },

  get installedPacks() {
    return state.installedPacks;
  },

  get downloadingPacks() {
    return state.downloadingPacks;
  },

  get updatingPacks() {
    return state.updatingPacks;
  },

  get availableUpdates() {
    return state.availableUpdates;
  },

  get isInitialized() {
    return state.initialized;
  },

  get error() {
    return state.error;
  },

  get lastUpdateCheck() {
    return state.lastUpdateCheck;
  },

  get hasUpdates() {
    return Object.keys(state.availableUpdates).length > 0;
  },

  /**
   * Check if a specific pack is installed
   */
  isInstalled(packId) {
    return state.installedPacks.includes(packId);
  },

  /**
   * Check if all required packs are installed
   */
  hasRequiredPacks() {
    const requiredIds = getRequiredPackIds();
    return requiredIds.every((id) => this.isInstalled(id));
  },

  /**
   * Check if any pack is currently downloading
   */
  isDownloading() {
    return Object.keys(state.downloadingPacks).length > 0;
  },

  /**
   * Check if onboarding should be shown
   * Shows when: running in Tauri and not completed before
   * (Core pack is bundled, so just offer optional packs on first run)
   */
  shouldShowOnboarding() {
    if (!supportsModularPacks()) return false;
    if (Storage.get('onboardingComplete')) return false;
    return true;
  },

  // ============================================
  // Initialization
  // ============================================

  /**
   * Initialize pack manager
   * Sets up event listeners and loads current state
   */
  async init() {
    if (!supportsModularPacks()) {
      state.initialized = true;
      return;
    }

    try {
      // Set up download progress listener
      await listen('pack-download-progress', (event) => {
        const progress = event.payload;

        if (progress.status === 'complete') {
          // Remove from downloading, add to installed
          delete state.downloadingPacks[progress.packId];
          if (!state.installedPacks.includes(progress.packId)) {
            state.installedPacks.push(progress.packId);
          }
          // Save checksum for the newly downloaded pack
          const manifestInfo = state.manifest?.packs?.[progress.packId];
          if (manifestInfo?.checksum) {
            PackManager.savePackChecksum(progress.packId, manifestInfo.checksum);
          }
        } else {
          // Update progress
          state.downloadingPacks[progress.packId] = progress;
        }
      });

      // Set up update progress listener
      await listen('pack-update-progress', (event) => {
        const progress = event.payload;

        if (progress.status === 'complete') {
          delete state.updatingPacks[progress.packId];
        } else {
          state.updatingPacks[progress.packId] = progress;
        }
      });

      // Fetch manifest and installed packs in parallel
      const [manifest, installed] = await Promise.all([
        invoke('fetch_pack_manifest').catch((e) => {
          console.warn('Could not fetch pack manifest:', e);
          return null;
        }),
        invoke('get_installed_packs'),
      ]);

      state.manifest = manifest;
      state.installedPacks = installed;
      state.initialized = true;
    } catch (error) {
      console.error('Pack manager init failed:', error);
      state.error = error.message || String(error);
      state.initialized = true;
    }
  },

  // ============================================
  // Pack Operations
  // ============================================

  /**
   * Download and install a pack
   */
  async downloadPack(packId) {
    if (!supportsModularPacks()) return;
    if (state.downloadingPacks[packId]) return; // Already downloading

    // Initialize progress state
    state.downloadingPacks[packId] = {
      packId,
      downloaded: 0,
      total: 0,
      percentage: 0,
      status: 'starting',
    };

    try {
      await invoke('download_pack', { packId });
    } catch (error) {
      delete state.downloadingPacks[packId];
      throw error;
    }
  },

  /**
   * Download multiple packs sequentially
   */
  async downloadPacks(packIds) {
    for (const packId of packIds) {
      if (!this.isInstalled(packId)) {
        await this.downloadPack(packId);
        // Wait for download to complete
        await this.waitForDownload(packId);
      }
    }
  },

  /**
   * Wait for a pack download to complete
   */
  async waitForDownload(packId) {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!state.downloadingPacks[packId]) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  },

  /**
   * Remove an installed pack
   */
  async removePack(packId) {
    if (!supportsModularPacks()) return;

    const packDef = PACK_DEFINITIONS[packId];
    if (packDef?.required) {
      throw new Error('Cannot remove required pack');
    }

    await invoke('remove_pack', { packId });
    state.installedPacks = state.installedPacks.filter((id) => id !== packId);
  },

  /**
   * Get the file path for an installed pack's database
   */
  async getPackPath(packId) {
    if (!supportsModularPacks()) return null;
    return invoke('get_pack_path', { packId });
  },

  /**
   * Read pack database as bytes (for sql.js)
   */
  async getPackDatabase(packId) {
    if (!supportsModularPacks()) return null;
    return invoke('read_pack_database', { packId });
  },

  // ============================================
  // Onboarding
  // ============================================

  /**
   * Mark onboarding as complete
   */
  completeOnboarding() {
    Storage.set('onboardingComplete', true);
    Storage.set('onboardingVersion', 1);
  },

  /**
   * Reset onboarding (for testing)
   */
  resetOnboarding() {
    Storage.delete('onboardingComplete');
    Storage.delete('onboardingVersion');
  },

  // ============================================
  // Pack Info
  // ============================================

  /**
   * Get pack definition from local config
   */
  getPackDefinition(packId) {
    return PACK_DEFINITIONS[packId];
  },

  /**
   * Get all pack definitions
   */
  getAllPackDefinitions() {
    return PACK_DEFINITIONS;
  },

  /**
   * Get pack info from manifest (includes file sizes, checksums)
   */
  getPackManifestInfo(packId) {
    return state.manifest?.packs?.[packId] || null;
  },

  // ============================================
  // Update Management
  // ============================================

  /**
   * Check if manifest schema is compatible with this app
   */
  isSchemaCompatible() {
    if (!state.manifest) return false;
    return state.manifest.schemaVersion === SUPPORTED_SCHEMA_VERSION;
  },

  /**
   * Get local checksums from storage
   */
  getLocalChecksums() {
    return Storage.get('packChecksums') || {};
  },

  /**
   * Save checksum after download/update
   */
  savePackChecksum(packId, checksum) {
    const checksums = this.getLocalChecksums();
    checksums[packId] = checksum;
    Storage.set('packChecksums', checksums);
  },

  /**
   * Refresh manifest from server
   */
  async refreshManifest() {
    try {
      const manifest = await invoke('fetch_pack_manifest');
      state.manifest = manifest;
      return manifest;
    } catch (e) {
      console.warn('Could not fetch pack manifest:', e);
      return null;
    }
  },

  /**
   * Check for updates by comparing local checksums with manifest
   * Returns object with packId -> update info for packs with updates
   */
  async checkForUpdates() {
    if (!supportsModularPacks()) return {};

    // Refresh manifest
    await this.refreshManifest();

    if (!state.manifest) {
      console.warn('No manifest available for update check');
      return {};
    }

    // Check schema compatibility
    if (!this.isSchemaCompatible()) {
      console.warn(
        `Schema version mismatch: app supports ${SUPPORTED_SCHEMA_VERSION}, ` +
        `manifest has ${state.manifest.schemaVersion}. Updates disabled.`
      );
      state.availableUpdates = {};
      state.lastUpdateCheck = new Date().toISOString();
      return {};
    }

    const localChecksums = this.getLocalChecksums();
    const updates = {};

    for (const packId of state.installedPacks) {
      const manifestInfo = state.manifest.packs?.[packId];
      if (!manifestInfo) continue;

      const packDef = PACK_DEFINITIONS[packId];
      const localChecksum = localChecksums[packId];
      const remoteChecksum = manifestInfo.checksum;

      // For bundled packs (included: true), only show update if we have a local checksum
      // that differs. No checksum means using bundled version - don't prompt to "update".
      // For downloaded packs, show update if no checksum or checksum differs.
      const isBundled = packDef?.included;
      const hasUpdate = isBundled
        ? (localChecksum && localChecksum !== remoteChecksum)
        : (!localChecksum || localChecksum !== remoteChecksum);

      if (hasUpdate) {
        updates[packId] = {
          checksum: remoteChecksum,
          sizeMB: manifestInfo.files.compressed.sizeMB,
          size: manifestInfo.files.compressed.size,
        };
      }
    }

    state.availableUpdates = updates;
    state.lastUpdateCheck = new Date().toISOString();
    return updates;
  },

  /**
   * Update a pack (download new version)
   */
  async updatePack(packId) {
    if (!supportsModularPacks()) return;
    if (state.updatingPacks[packId]) return; // Already updating

    const updateInfo = state.availableUpdates[packId];
    if (!updateInfo) {
      throw new Error(`No update available for ${packId}`);
    }

    // Initialize progress state
    state.updatingPacks[packId] = {
      packId,
      downloaded: 0,
      total: updateInfo.size,
      percentage: 0,
      status: 'starting',
    };

    try {
      // Use the update command which handles core pack specially
      await invoke('update_pack', { packId });

      // Save the new checksum
      this.savePackChecksum(packId, updateInfo.checksum);

      // Remove from available updates
      delete state.availableUpdates[packId];
    } catch (error) {
      delete state.updatingPacks[packId];
      throw error;
    }
  },

  /**
   * Wait for a pack update to complete
   */
  async waitForUpdate(packId) {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!state.updatingPacks[packId]) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  },

  /**
   * Update all packs with available updates
   */
  async updateAllPacks() {
    const packIds = Object.keys(state.availableUpdates);
    for (const packId of packIds) {
      await this.updatePack(packId);
      await this.waitForUpdate(packId);
    }
  },
};

export default PackManager;
