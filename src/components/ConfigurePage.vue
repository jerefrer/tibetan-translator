<script>
import draggable from 'vuedraggable';
import { useTheme } from 'vuetify';

import Storage from '../services/storage';
import DictionariesDetails from '../services/dictionaries-details';
import GlobalLookup from '../services/global-lookup';
import UpdateService from '../services/update-service';
import { isTauri } from '../config/platform';
import {
  getScannedDictionaries,
  isScanDownloaded,
  downloadScan,
  deleteScan,
  isAppMode
} from '../services/scan-service';
import PackManagerCard from './PackManagerCard.vue';

// Tauri event listener (lazy loaded)
let listen = null;
async function getTauriListen() {
  if (listen) return listen;
  try {
    // Only attempt to load in Tauri environment (check both Tauri 1.x and 2.x)
    if (!window.__TAURI__ && !window.__TAURI_INTERNALS__) return null;
    const { listen: l } = await import('@tauri-apps/api/event');
    if (typeof l === 'function') {
      listen = l;
      return listen;
    }
    return null;
  } catch (e) {
    console.warn('Failed to load Tauri event listener:', e);
    return null;
  }
}

export default {
  components: {
    draggable,
    PackManagerCard,
  },
  inject: ['snackbar'],
  setup() {
    const theme = useTheme();
    return { theme };
  },
  data() {
    return {
      dictionaries: Storage.get('dictionaries').sort((a, b) => {
        return a.position - b.position;
      }),
      themePreference: Storage.get('themePreference'),
      fontSize: Storage.get('fontSize'),
      scannedDictionaries: [],
      scanDownloadStatus: {},
      isAppMode: false,
      progressUnlisten: null,
      // Global lookup settings
      globalLookupSupported: false,
      globalLookupEnabled: true,
      globalLookupHotkey: '',
      globalLookupHotkeyDisplay: '',
      isRecordingHotkey: false,
      needsAccessibilityPermission: false,
      isMacOS: false,
      // App version and update settings
      appVersion: null,
      checkingForUpdates: false,
      updateAvailable: null,
    };
  },
  watch: {
    dictionaries: {
      deep: true,
      handler(newDictionaries) {
        Storage.set(
          'dictionaries',
          newDictionaries.map((dictionary, index) => {
            return { ...dictionary, position: index + 1 };
          })
        );
      },
    },
    themePreference(value) {
      Storage.set('themePreference', value);
      this.applyTheme(value);
    },
    fontSize(value) {
      Storage.set('fontSize', value);
      this.applyFontSize(value);
    },
    async globalLookupEnabled(value) {
      const result = await GlobalLookup.toggle(value);
      if (!result.success && result.needsPermission) {
        this.needsAccessibilityPermission = true;
      } else {
        this.needsAccessibilityPermission = false;
      }
    },
  },
  methods: {
    applyTheme(preference) {
      let actualTheme;
      if (preference === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        actualTheme = prefersDark ? 'dark' : 'light';
      } else {
        actualTheme = preference;
      }
      this.theme.global.name.value = actualTheme;
      Storage.set('darkTheme', actualTheme === 'dark');
    },
    applyFontSize(size) {
      document.documentElement.style.setProperty('--app-font-size', `${size}%`);
      document.documentElement.style.fontSize = `${size}%`;
    },
    getDetails(dictionary) {
      return DictionariesDetails[dictionary.name] || {};
    },
    getLanguageLabel(dictionary) {
      const details = this.getDetails(dictionary);
      if (!details.language || !Array.isArray(details.language)) return '';
      // language is like ["tib", "<->", "en"] or ["tib", "->", "skt"]
      const langs = details.language.filter(l => !['<->', '->', '<-'].includes(l));
      const langNames = {
        tib: 'Tib',
        en: 'En',
        skt: 'Skt',
        zh: 'Zh',
      };
      return langs.map(l => langNames[l] || l).join(' ↔ ');
    },
    showDictionaryInfo(dictionary) {
      const scrollTop = document.documentElement.scrollTop || window.scrollY;
      const details = this.getDetails(dictionary);
      if (!details.about) {
        this.snackbar.open(`<strong>${dictionary.name}</strong><br>No additional information available.`);
      } else {
        // Format the about text - split by | for line breaks
        const aboutHtml = details.about.split('|').join('<br>');
        this.snackbar.open(`<strong>${details.label || dictionary.name}</strong><br><br>${aboutHtml}`);
      }
      // Blur button to prevent focus-related scroll, restore scroll position
      document.activeElement?.blur();
      setTimeout(() => {
        document.documentElement.scrollTop = scrollTop;
        window.scrollTo(0, scrollTop);
      }, 0);
    },
    async loadScannedDictionaries() {
      this.scannedDictionaries = getScannedDictionaries();
      // Check download status for each
      for (const dict of this.scannedDictionaries) {
        this.scanDownloadStatus[dict.scanId] = {
          downloaded: await isScanDownloaded(dict.scanId),
          downloading: false,
          progress: 0,
          error: null
        };
      }
    },
    async setupProgressListener() {
      const listenFn = await getTauriListen();
      if (!listenFn) return;

      this.progressUnlisten = await listenFn('scan-download-progress', (event) => {
        const { scan_id, percent } = event.payload;
        if (this.scanDownloadStatus[scan_id]) {
          this.scanDownloadStatus[scan_id] = {
            ...this.scanDownloadStatus[scan_id],
            progress: Math.round(percent)
          };
        }
      });
    },
    async handleDownloadScan(scanId) {
      this.scanDownloadStatus[scanId] = {
        ...this.scanDownloadStatus[scanId],
        downloading: true,
        progress: 0,
        error: null
      };

      try {
        await downloadScan(scanId);
        this.scanDownloadStatus[scanId] = {
          downloaded: true,
          downloading: false,
          progress: 100,
          error: null
        };
        this.snackbar.open('Download complete!');
      } catch (e) {
        this.scanDownloadStatus[scanId] = {
          ...this.scanDownloadStatus[scanId],
          downloading: false,
          progress: 0,
          error: e.message || 'Download failed'
        };
        this.snackbar.open(`Download failed: ${e.message || 'Unknown error'}`);
      }
    },
    async handleDeleteScan(scanId) {
      try {
        await deleteScan(scanId);
        this.scanDownloadStatus[scanId] = {
          downloaded: false,
          downloading: false,
          progress: 0,
          error: null
        };
        this.snackbar.open('Deleted successfully');
      } catch (e) {
        this.snackbar.open(`Delete failed: ${e.message || 'Unknown error'}`);
      }
    },
    getEstimatedSize(pageCount) {
      // Rough estimate: ~200KB per page on average
      const sizeKB = pageCount * 200;
      if (sizeKB > 1024) {
        return `${Math.round(sizeKB / 1024)} MB`;
      }
      return `${sizeKB} KB`;
    },
    // Global lookup methods
    startRecordingHotkey() {
      this.isRecordingHotkey = true;
      this.$nextTick(() => {
        this.$refs.hotkeyInput?.focus();
      });
    },
    stopRecordingHotkey() {
      this.isRecordingHotkey = false;
    },
    async handleHotkeyKeydown(event) {
      if (!this.isRecordingHotkey) return;

      event.preventDefault();
      event.stopPropagation();

      const hotkeyString = GlobalLookup.keyEventToHotkeyString(event);

      if (hotkeyString) {
        this.globalLookupHotkey = hotkeyString;
        this.globalLookupHotkeyDisplay = GlobalLookup.formatHotkeyForDisplay(hotkeyString);
        this.isRecordingHotkey = false;

        // Update the global shortcut
        const result = await GlobalLookup.updateHotkey(hotkeyString);
        console.log('updateHotkey result:', result);
        if (result.success) {
          this.needsAccessibilityPermission = false;
          this.snackbar.open('Hotkey updated successfully');
        } else if (result.needsPermission) {
          this.needsAccessibilityPermission = true;
          this.snackbar.open('Accessibility permission required. Click "Grant Permission" below.');
        } else {
          this.snackbar.open(`Failed to register hotkey: ${result.error || 'Unknown error'}`);
        }
      }
    },
    async openAccessibilitySettings() {
      await GlobalLookup.requestAccessibilityPermission();
      this.snackbar.open('Please enable Tibetan Translator in Accessibility settings, then toggle Global Lookup off and on again.');
    },
    resetHotkeyToDefault() {
      const defaultHotkey = 'CommandOrControl+Shift+D';
      this.globalLookupHotkey = defaultHotkey;
      this.globalLookupHotkeyDisplay = GlobalLookup.formatHotkeyForDisplay(defaultHotkey);
      GlobalLookup.updateHotkey(defaultHotkey);
    },
    async checkForUpdates() {
      this.checkingForUpdates = true;
      try {
        const update = await UpdateService.checkOnly();
        if (update) {
          this.updateAvailable = update;
          this.snackbar.open(
            `Update to v${update.version} available! Downloading...`
          );
          // Start the download
          await UpdateService.checkAndDownload((newVersion) => {
            this.snackbar.open(
              `Update to v${newVersion} ready! Will install on restart.`
            );
          });
        } else {
          this.snackbar.open('You\'re running the latest version!');
        }
      } catch (e) {
        this.snackbar.open('Failed to check for updates');
        console.error('Update check failed:', e);
      } finally {
        this.checkingForUpdates = false;
      }
    }
  },
  async created() {
    // Apply font size setting
    this.applyFontSize(this.fontSize);

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this.themePreference === 'system') {
        this.applyTheme('system');
      }
    });

    // Listen for dictionary updates (after pack download/update)
    this.onDictionariesUpdated = () => {
      this.dictionaries = Storage.get('dictionaries').sort((a, b) => a.position - b.position);
    };
    window.addEventListener('dictionaries-updated', this.onDictionariesUpdated);
    // Check if running in app mode and load scanned dictionaries
    this.isAppMode = await isAppMode();
    await this.loadScannedDictionaries();
    await this.setupProgressListener();

    // Initialize global lookup settings
    this.globalLookupSupported = GlobalLookup.isSupported();
    if (this.globalLookupSupported) {
      this.isMacOS = GlobalLookup.isMacOS();
      this.globalLookupEnabled = GlobalLookup.isEnabled();
      this.globalLookupHotkey = GlobalLookup.getHotkey();
      this.globalLookupHotkeyDisplay = GlobalLookup.formatHotkeyForDisplay(this.globalLookupHotkey);

      // Check if we need accessibility permission on macOS
      if (this.isMacOS && this.globalLookupEnabled) {
        const hasPermission = await GlobalLookup.checkAccessibilityPermission();
        this.needsAccessibilityPermission = !hasPermission;
      }
    }

    // Get app version (Tauri only)
    if (isTauri()) {
      this.appVersion = await UpdateService.getVersion();
    }
  },
  unmounted() {
    // Clean up event listeners
    if (this.progressUnlisten) {
      this.progressUnlisten();
    }
    if (this.onDictionariesUpdated) {
      window.removeEventListener('dictionaries-updated', this.onDictionariesUpdated);
    }
  },
};
</script>

<template>
  <div class="configure-page-wrapper">
    <v-container class="configure-page">
    <!-- About / Version card (Tauri only) -->
    <v-card v-if="appVersion" class="app-info mb-4">
      <v-toolbar density="compact">
        <v-icon class="ml-2 mr-3">mdi-information-outline</v-icon>
        <v-toolbar-title>About</v-toolbar-title>
      </v-toolbar>
      <v-card-text>
        <div class="d-flex justify-space-between align-center">
          <div>
            <div class="font-weight-medium">Tibetan Translator</div>
            <div class="text-caption text-grey">Version {{ appVersion }}</div>
          </div>
          <v-btn
            variant="tonal"
            size="small"
            :loading="checkingForUpdates"
            @click="checkForUpdates"
          >
            Check for Updates
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

    <v-card class="theme-selector mb-4">
      <v-toolbar>
        <v-icon size="x-large" color="grey">mdi-theme-light-dark</v-icon>
        <v-toolbar-title>
          Appearance
        </v-toolbar-title>
      </v-toolbar>
      <div class="theme-buttons pa-4">
        <v-btn
          :variant="themePreference === 'system' ? 'flat' : 'outlined'"
          :color="themePreference === 'system' ? 'primary' : undefined"
          @click="themePreference = 'system'"
        >
          <v-icon start>mdi-monitor</v-icon>
          System
        </v-btn>
        <v-btn
          :variant="themePreference === 'light' ? 'flat' : 'outlined'"
          :color="themePreference === 'light' ? 'primary' : undefined"
          @click="themePreference = 'light'"
        >
          <v-icon start>mdi-white-balance-sunny</v-icon>
          Light
        </v-btn>
        <v-btn
          :variant="themePreference === 'dark' ? 'flat' : 'outlined'"
          :color="themePreference === 'dark' ? 'primary' : undefined"
          @click="themePreference = 'dark'"
        >
          <v-icon start>mdi-weather-night</v-icon>
          Dark
        </v-btn>
      </div>

      <v-divider />

      <div class="font-size-control pa-4">
        <div class="d-flex align-center mb-2">
          <v-icon size="small" class="mr-2">mdi-format-size</v-icon>
          <span class="text-body-2">Text Size</span>
          <v-spacer />
          <span class="text-body-2 text-grey">{{ fontSize }}%</span>
        </div>
        <div class="d-flex align-center gap-2">
          <v-icon size="small" color="grey">mdi-format-font-size-decrease</v-icon>
          <v-slider
            v-model="fontSize"
            :min="80"
            :max="130"
            :step="5"
            hide-details
            color="primary"
            track-color="grey-lighten-2"
            class="flex-grow-1"
          />
          <v-icon size="small" color="grey">mdi-format-font-size-increase</v-icon>
        </div>
        <div class="text-center mt-1">
          <v-btn
            v-if="fontSize !== 100"
            variant="text"
            size="x-small"
            color="grey"
            @click="fontSize = 100"
          >
            Reset to default
          </v-btn>
        </div>
      </div>
    </v-card>

    <!-- Global Lookup Settings (Desktop only) -->
    <v-card v-if="globalLookupSupported" class="global-lookup-settings mb-4">
      <v-toolbar>
        <v-icon size="x-large" color="grey">mdi-keyboard</v-icon>
        <v-toolbar-title>
          Global Lookup
          <div class="text-caption text-grey">
            Look up Tibetan text from anywhere on your system
          </div>
        </v-toolbar-title>
        <template v-slot:append>
          <v-switch
            v-model="globalLookupEnabled"
            hide-details
            color="primary"
            class="mr-2"
          />
        </template>
      </v-toolbar>

      <v-card-text>
        <!-- Permission warning for macOS -->
        <v-alert
          v-if="needsAccessibilityPermission && isMacOS && globalLookupEnabled"
          type="warning"
          variant="tonal"
          class="mb-4"
        >
          <div class="d-flex align-center justify-space-between flex-wrap">
            <div>
              <div class="font-weight-medium">Accessibility Permission Required</div>
              <div class="text-body-2">
                Global hotkeys need accessibility access to work system-wide.
              </div>
            </div>
            <v-btn
              color="warning"
              variant="flat"
              size="small"
              class="mt-2 mt-sm-0"
              @click="openAccessibilitySettings"
            >
              Grant Permission
            </v-btn>
          </div>
        </v-alert>

        <div class="hotkey-section" :class="{ 'content-disabled': !globalLookupEnabled }">
          <div class="text-body-1 mb-2">Hotkey</div>
          <div class="d-flex align-center ga-2">
            <v-text-field
              ref="hotkeyInput"
              :model-value="isRecordingHotkey ? 'Press any key combination...' : globalLookupHotkeyDisplay"
              readonly
              variant="outlined"
              density="compact"
              hide-details
              :class="{ 'recording': isRecordingHotkey }"
              class="hotkey-input"
              @keydown="handleHotkeyKeydown"
              @blur="stopRecordingHotkey"
            />
            <v-btn
              v-if="!isRecordingHotkey"
              variant="outlined"
              density="compact"
              @click="startRecordingHotkey"
            >
              Change
            </v-btn>
            <v-btn
              v-else
              variant="text"
              density="compact"
              @click="stopRecordingHotkey"
            >
              Cancel
            </v-btn>
            <v-btn
              variant="text"
              density="compact"
              @click="resetHotkeyToDefault"
            >
              Reset
            </v-btn>
          </div>
          <div class="text-caption text-grey mt-2">
            Copy Tibetan text anywhere, then press the hotkey to look it up
          </div>
        </div>
      </v-card-text>
    </v-card>

    <!-- Dictionary Packs Section (Tauri only) -->
    <pack-manager-card />

    <!-- Scanned Dictionaries Section -->
    <v-card v-if="scannedDictionaries.length > 0" class="scanned-dictionaries mb-4">
      <v-toolbar>
        <v-icon size="x-large" color="grey">mdi-book-open-page-variant</v-icon>
        <v-toolbar-title>
          Scanned Dictionaries
          <div class="text-caption text-grey">
            Download for offline access
          </div>
        </v-toolbar-title>
      </v-toolbar>

      <v-list>
        <v-list-item
          v-for="dict in scannedDictionaries"
          :key="dict.scanId"
          class="scanned-dict-item"
        >
          <v-list-item-title>{{ dict.label.replace(' (scanned dictionary)', '') }}</v-list-item-title>
          <v-list-item-subtitle>
            {{ dict.pageCount }} pages ({{ getEstimatedSize(dict.pageCount) }})
          </v-list-item-subtitle>

          <template v-slot:append>
            <!-- Download in progress - circular progress like iOS App Store -->
            <div
              v-if="scanDownloadStatus[dict.scanId]?.downloading"
              class="download-progress-container"
            >
              <v-progress-circular
                :model-value="scanDownloadStatus[dict.scanId]?.progress || 0"
                :size="36"
                :width="3"
                color="primary"
                bg-color="grey-lighten-2"
              />
              <span class="download-progress-text">
                {{ scanDownloadStatus[dict.scanId]?.progress || 0 }}%
              </span>
            </div>

            <!-- Downloaded - show delete button -->
            <v-btn
              v-else-if="scanDownloadStatus[dict.scanId]?.downloaded"
              icon
              variant="text"
              size="small"
              color="error"
              @click="handleDeleteScan(dict.scanId)"
            >
              <v-icon>mdi-delete</v-icon>
              <v-tooltip activator="parent" location="top">Delete download</v-tooltip>
            </v-btn>

            <!-- Not downloaded - show download button (only in app mode) -->
            <v-btn
              v-else-if="isAppMode"
              icon
              variant="text"
              size="small"
              color="primary"
              @click="handleDownloadScan(dict.scanId)"
            >
              <v-icon>mdi-download</v-icon>
              <v-tooltip activator="parent" location="top">Download for offline</v-tooltip>
            </v-btn>

            <!-- Web mode - show info -->
            <v-chip v-else size="small" color="grey" variant="outlined">
              Online only
            </v-chip>
          </template>
        </v-list-item>
      </v-list>

      <v-card-text v-if="!isAppMode" class="text-caption text-grey">
        Download for offline is only available in the desktop/mobile app.
      </v-card-text>
    </v-card>

    <v-card class="dictionaries-container">
      <v-toolbar>
        <v-icon size="x-large" color="grey">mdi-book-multiple</v-icon>
        <v-toolbar-title>
          Dictionary Preferences
          <div class="text-caption text-grey">
            Reorder or disable to match your preferences
          </div>
        </v-toolbar-title>
      </v-toolbar>

      <draggable v-model="dictionaries" handle=".handle" item-key="id">
        <template #item="{ element: dictionary, index }">
          <div
            class="dictionary list-item"
            :class="{
              disabled: !dictionary.enabled,
            }"
          >
            <v-icon class="handle" color="grey-darken-2">
              mdi-drag-horizontal-variant
            </v-icon>

            <div class="name">
              <span class="text-grey-darken-1">{{ index + 1 }}.</span>
              {{ getDetails(dictionary).label || dictionary.name }}
              <span v-if="getLanguageLabel(dictionary)" class="language-label text-caption text-grey">
                ({{ getLanguageLabel(dictionary) }})
              </span>
            </div>

            <v-btn
              icon
              variant="text"
              size="small"
              class="info-button"
              @click.stop.prevent="showDictionaryInfo(dictionary)"
            >
              <v-icon size="small" color="grey">mdi-information-outline</v-icon>
            </v-btn>

            <v-switch
              v-model="dictionary.enabled"
              hide-details
              class="switch"
              color="primary"
            />
          </div>
        </template>
      </draggable>
    </v-card>
  </v-container>
  </div>
</template>

<style lang="sass">
.configure-page-wrapper
  height: 100%
  overflow-y: auto

.configure-page
  margin-top: 30px
  padding-bottom: 20px

  .theme-selector
    width: 100%

    .v-toolbar .v-icon
      margin: 0 10px 0 10px

    .theme-buttons
      display: flex
      justify-content: flex-start
      gap: 8px
      flex-wrap: wrap

  .dictionaries-container
    width: 100%

    .v-toolbar .v-icon
      margin: 0 10px 0 10px

    .v-toolbar__title, .v-toolbar__title .text-caption
      line-height: 1em

    .v-toolbar__title .text-caption
      margin-top: 5px

    .dictionary
      display: flex
      align-items: center
      user-select: none
      height: 42px
      border-bottom: thin solid rgba(0, 0, 0, 0.08)

      &:last-child
        border-bottom: none

      &.disabled .v-icon:before, &.disabled .switch .v-input__control
        opacity: 0.25

      &.disabled > .name
        color: #525252

      .handle
        width: 48px
        display: flex
        align-items: center
        justify-content: center
        cursor: move
        height: 100%

      .v-icon:before, .name, &.disabled .switch .v-input__control
        transition: all 1s

      > .name
        flex: 1
        padding: 0 8px
        white-space: nowrap
        overflow: hidden
        text-overflow: ellipsis
        min-width: 0

      > .info-button
        flex: 0 0 auto
        margin: 0 4px

      > .switch
        margin: 0
        flex: 0 0 auto
        padding-right: 8px

      .switch .v-input__control
        height: 32px

      .switch .v-selection-control
        min-height: 32px

  .scanned-dictionaries
    width: 100%

    .v-toolbar .v-icon
      margin: 0 10px 0 10px

    .v-toolbar__title, .v-toolbar__title .text-caption
      line-height: 1em

    .v-toolbar__title .text-caption
      margin-top: 5px

    .scanned-dict-item
      border-bottom: thin solid rgba(0, 0, 0, 0.08)

      &:last-child
        border-bottom: none

    .download-progress-container
      position: relative
      display: flex
      align-items: center
      justify-content: center
      width: 44px
      height: 44px

    .download-progress-text
      position: absolute
      font-size: 0.5625rem
      font-weight: 600
      color: var(--v-theme-primary)

  .global-lookup-settings
    width: 100%

    .v-toolbar .v-icon
      margin: 0 10px 0 10px

    .v-toolbar__title, .v-toolbar__title .text-caption
      line-height: 1em

    .v-toolbar__title .text-caption
      margin-top: 5px

    .hotkey-section.content-disabled
      opacity: 0.5
      pointer-events: none

    .hotkey-input
      max-width: 200px

      &.recording
        .v-field
          border-color: rgb(var(--v-theme-primary))
          animation: pulse 1s infinite

    .hotkey-section .v-btn
      height: 40px

    @keyframes pulse
      0%, 100%
        opacity: 1
      50%
        opacity: 0.7

  .search-builder-settings
    width: 100%

    .v-toolbar .v-icon
      margin: 0 10px 0 10px

    .v-toolbar__title, .v-toolbar__title .text-caption
      line-height: 1em

    .v-toolbar__title .text-caption
      margin-top: 5px

  .database-reinitialization .v-toolbar .v-icon
    margin: 0 9px 0 -6px

    .fd-zone
      width: 100%

      > div:not(.dndtxt), > div:not(.dndtxt) form, > div:not(.dndtxt) form input
        position: absolute !important
        left: 0
        top: 0
        right: 0
        bottom: 0
        margin: 0

      > div:not(.dndtxt) form
        margin-top: -30px

// Mobile styles
@media (max-width: 600px)
  .configure-page
    margin-top: 20px !important
    padding: 20px 8px 0 8px !important

    .v-toolbar__content > .v-toolbar-title
      margin-inline-start: 0

    .dictionaries-container .dictionary
      .handle
        width: 32px

      > .name
        font-size: 0.875rem

        .language-label
          display: none
</style>
