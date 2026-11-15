<script>
import {
  getScannedDictionaries,
  isScanDownloaded,
  downloadScan,
  cancelScanDownload,
  deleteScan,
  isAppMode,
} from '../../services/scan-service';
import { wasCancelled } from '../../services/downloads';
import ResizeService from '../../services/resize-service';
import { UiButton, UiDialog, UiIcon, UiProgress, UiTooltip } from '../../ui';
import SettingsRow from './SettingsRow.vue';

// Tauri event listener, loaded lazily so the browser build never imports it
let listen = null;
async function getTauriListen() {
  if (listen) return listen;
  try {
    if (!window.__TAURI__ && !window.__TAURI_INTERNALS__) return null;
    const { listen: tauriListen } = await import('@tauri-apps/api/event');
    if (typeof tauriListen === 'function') {
      listen = tauriListen;
      return listen;
    }
    return null;
  } catch (e) {
    console.warn('Failed to load Tauri event listener:', e);
    return null;
  }
}

// Rough estimate: about 200 KB per scanned page
export function estimatedScanSize(pageCount) {
  const sizeKB = pageCount * 200;
  if (sizeKB > 1024) return `${Math.round(sizeKB / 1024)} MB`;
  return `${sizeKB} KB`;
}

// Page scans of the scanned dictionaries, downloadable for offline use in
// the app; online only in a browser. Rows of Settings' Offline content group:
// one that sums them up and folds out (open in the desktop app; folded on a
// phone, and in a browser where nothing can be downloaded),
// then one per dictionary.
export default {
  name: 'ScannedDictionariesCard',
  components: { SettingsRow, UiButton, UiDialog, UiIcon, UiProgress, UiTooltip },
  inject: ['snackbar'],
  data() {
    return {
      dictionaries: [],
      status: {},
      isAppMode: false,
      progressUnlisten: null,
      confirmOpen: false,
      pendingDelete: null,
      // Folded where there is nothing to download, or no room
      open: false,
    };
  },
  computed: {
    summary() {
      const where = this.isAppMode
        ? `${this.dictionaries.filter((dictionary) => this.status[dictionary.scanId]?.downloaded).length} of ${this.dictionaries.length} on this device`
        : 'read online';
      return `Page images, shown with “View scan” in an entry · ${where}`;
    },
  },
  async created() {
    this.isAppMode = await isAppMode();
    this.open = this.isAppMode && !ResizeService.isMobile();
    await this.load();
    await this.listenForProgress();
  },
  unmounted() {
    this.progressUnlisten?.();
  },
  methods: {
    label(dictionary) {
      return dictionary.label.replace(' (scanned dictionary)', '');
    },
    estimatedSize: estimatedScanSize,
    meta(dictionary) {
      const state = this.status[dictionary.scanId] || {};
      let where = 'read online';
      if (state.downloading) where = `downloading, ${state.progress || 0}%`;
      else if (state.downloaded) where = 'on this device';
      return `${dictionary.pageCount} pages · ${estimatedScanSize(dictionary.pageCount)} · ${where}`;
    },
    async load() {
      this.dictionaries = getScannedDictionaries();
      for (const dictionary of this.dictionaries) {
        this.status[dictionary.scanId] = {
          downloaded: await isScanDownloaded(dictionary.scanId),
          downloading: false,
          progress: 0,
          error: null,
        };
      }
    },
    async listenForProgress() {
      const listenFn = await getTauriListen();
      if (!listenFn) return;
      this.progressUnlisten = await listenFn('scan-download-progress', (event) => {
        const { scan_id: scanId, percent } = event.payload;
        if (this.status[scanId]) {
          this.status[scanId] = { ...this.status[scanId], progress: Math.round(percent) };
        }
      });
    },
    async download(scanId) {
      this.status[scanId] = { ...this.status[scanId], downloading: true, progress: 0, error: null };
      try {
        await downloadScan(scanId);
        this.status[scanId] = { downloaded: true, downloading: false, progress: 100, error: null };
        this.snackbar.open('Download complete!');
      } catch (e) {
        // A cancelled download keeps nothing: back to reading online
        if (wasCancelled(e)) {
          this.status[scanId] = { downloaded: false, downloading: false, progress: 0, error: null };
          this.snackbar.open('Download cancelled');
          return;
        }
        this.status[scanId] = {
          ...this.status[scanId],
          downloading: false,
          progress: 0,
          error: e.message || 'Download failed',
        };
        this.snackbar.open(`Download failed: ${e.message || 'Unknown error'}`);
      }
    },
    cancel(scanId) {
      cancelScanDownload(scanId).catch((e) => console.warn('Cancel failed:', e));
    },
    confirmRemove(dictionary) {
      this.pendingDelete = dictionary;
      this.confirmOpen = true;
    },
    async remove() {
      if (!this.pendingDelete) return;
      const scanId = this.pendingDelete.scanId;
      this.confirmOpen = false;
      this.pendingDelete = null;
      try {
        await deleteScan(scanId);
        this.status[scanId] = { downloaded: false, downloading: false, progress: 0, error: null };
        this.snackbar.open('Deleted successfully');
      } catch (e) {
        this.snackbar.open(`Delete failed: ${e.message || 'Unknown error'}`);
      }
    },
  },
};
</script>

<template>
  <div v-if="dictionaries.length > 0" class="offline-set" data-testid="scanned-card">
    <settings-row
      title="Scanned dictionaries"
      icon="book-image"
      :description="summary"
      clickable
      :expanded="open"
      data-testid="scanned-toggle"
      @click="open = !open"
    />
    <template v-if="open">
      <settings-row
        v-for="dictionary in dictionaries"
        :key="dictionary.scanId"
        :title="label(dictionary)"
        :description="meta(dictionary)"
        nested
        :data-testid="'scan-' + dictionary.scanId"
      >
        <template v-if="status[dictionary.scanId]?.downloading" #below>
          <ui-progress
            :value="status[dictionary.scanId]?.progress || 0"
            :label="'Downloading ' + label(dictionary)"
            class="offline-set__progress"
          />
        </template>
        <template v-if="status[dictionary.scanId]?.downloading">
          <span class="offline-set__percent" data-testid="scan-progress">{{ status[dictionary.scanId]?.progress || 0 }}%</span>
          <ui-tooltip text="Cancel download">
            <ui-button
              icon
              size="sm"
              variant="ghost"
              class="offline-set__cancel"
              :aria-label="'Cancel the download of ' + label(dictionary)"
              data-testid="scan-cancel"
              @click="cancel(dictionary.scanId)"
            >
              <ui-icon name="x" :size="17" />
            </ui-button>
          </ui-tooltip>
        </template>
        <ui-tooltip v-else-if="status[dictionary.scanId]?.downloaded" text="Delete download">
          <ui-button
            icon
            size="sm"
            variant="ghost"
            class="offline-set__delete"
            :aria-label="'Delete download of ' + label(dictionary)"
            data-testid="scan-delete"
            @click="confirmRemove(dictionary)"
          >
            <ui-icon name="trash-2" :size="17" />
          </ui-button>
        </ui-tooltip>
        <ui-button
          v-else-if="isAppMode"
          variant="soft"
          size="sm"
          :aria-label="'Download ' + label(dictionary) + ' for offline'"
          data-testid="scan-download"
          @click="download(dictionary.scanId)"
        ><ui-icon name="download" :size="15" />Download</ui-button>
      </settings-row>
      <p v-if="!isAppMode" class="offline-set__note" data-testid="scan-web-note">
        Downloading for offline use needs the desktop or mobile app.
      </p>
    </template>
    <ui-dialog v-model="confirmOpen" title="Delete downloaded pages?" :max-width="400">
      Delete <strong>{{ pendingDelete ? label(pendingDelete) : '' }}</strong>? It can be downloaded again later.
      <template #actions>
        <ui-button variant="ghost" data-testid="delete-cancel" @click="confirmOpen = false">Cancel</ui-button>
        <ui-button variant="danger" data-testid="delete-confirm" @click="remove"><ui-icon name="trash-2" :size="16" />Delete</ui-button>
      </template>
    </ui-dialog>
  </div>
</template>

<style>
/* Shared by the audio rows (AudioCard) */
.offline-set + .offline-set > .settings-row:first-child {
  border-top: 1px solid var(--line-soft);
}
.offline-set__progress {
  margin-top: 6px;
}
.offline-set__percent {
  width: var(--control-sm);
  text-align: right;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--accent);
}
.offline-set__delete.ui-button--ghost,
.offline-set__cancel.ui-button--ghost { color: var(--muted); }
.offline-set__cancel.ui-button--ghost:hover:not(:disabled) { color: var(--ink); }
.offline-set__delete.ui-button--ghost:hover:not(:disabled) { color: var(--danger-ink); background: var(--danger-soft); }
.offline-set__note {
  margin: 0;
  padding: var(--space-2) var(--space-4) var(--space-3) var(--space-8);
  border-top: 1px solid var(--line-soft);
  background: color-mix(in srgb, var(--bg-quiet) 60%, var(--surface));
  font-size: var(--text-xs);
  color: var(--muted);
}
</style>
