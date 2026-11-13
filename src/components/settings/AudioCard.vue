<script>
import {
  getAudioDictionaries,
  isAudioDownloaded,
  downloadAudio,
  cancelAudioDownload,
  deleteAudio,
} from '../../services/audio-service';
import { wasCancelled } from '../../services/downloads';
import { isTauri } from '../../config/platform';
import ResizeService from '../../services/resize-service';
import { UiButton, UiDialog, UiIcon, UiProgress, UiTooltip } from '../../ui';
import SettingsRow from './SettingsRow.vue';

// Tauri event listener, loaded lazily so the browser build never imports it.
// Checks for the runtime itself, as the scanned dictionaries card does.
async function getTauriListen() {
  if (!window.__TAURI_INTERNALS__) return null;
  try {
    const { listen } = await import('@tauri-apps/api/event');
    return typeof listen === 'function' ? listen : null;
  } catch (e) {
    console.warn('Failed to load Tauri event listener:', e);
    return null;
  }
}

export function formatMegabytes(bytes) {
  return `${Math.round(bytes / 1048576)} MB`;
}

// Tauri rejects with the Rust error as a plain string
function errorMessage(e) {
  return (typeof e === 'string' ? e : e?.message) || 'Unknown error';
}

// Recordings of the dictionaries that have audio. They stream from GitHub;
// in the app each dictionary's set can be downloaded for offline listening.
// Rows of Settings' Offline content group, as the scanned dictionaries'
// (.offline-set): one that sums them up and folds out, then one per set.
export default {
  name: 'AudioCard',
  components: { SettingsRow, UiButton, UiDialog, UiIcon, UiProgress, UiTooltip },
  inject: ['snackbar'],
  data() {
    return {
      dictionaries: [],
      status: {},
      isAppMode: isTauri(),
      progressUnlisten: null,
      confirmOpen: false,
      pendingDelete: null,
      // Folded where there is nothing to download, or no room
      open: isTauri() && !ResizeService.isMobile(),
    };
  },
  computed: {
    summary() {
      const where = this.isAppMode
        ? `${this.dictionaries.filter((dictionary) => this.status[dictionary.audioId]?.downloaded).length} of ${this.dictionaries.length} on this device`
        : 'played online';
      return `Pronunciations in an entry · ${where}`;
    },
  },
  async created() {
    await this.load();
    await this.listenForProgress();
  },
  unmounted() {
    this.progressUnlisten?.();
  },
  methods: {
    formatMegabytes,
    meta(dictionary) {
      const state = this.status[dictionary.audioId] || {};
      let where = 'played online';
      if (state.downloading) where = `downloading, ${state.progress || 0}%`;
      else if (state.downloaded) where = 'on this device';
      return `${dictionary.count.toLocaleString('en-US')} recordings · ${formatMegabytes(dictionary.bytes)} · ${where}`;
    },
    async load() {
      this.dictionaries = await getAudioDictionaries();
      for (const dictionary of this.dictionaries) {
        this.status[dictionary.audioId] = {
          downloaded: await isAudioDownloaded(dictionary.audioId),
          downloading: false,
          progress: 0,
        };
      }
    },
    async listenForProgress() {
      const listen = await getTauriListen();
      if (!listen) return;
      this.progressUnlisten = await listen('audio-download-progress', (event) => {
        const { audio_id: audioId, percent } = event.payload;
        if (this.status[audioId]) {
          this.status[audioId] = { ...this.status[audioId], progress: Math.round(percent) };
        }
      });
    },
    async download(audioId) {
      this.status[audioId] = { ...this.status[audioId], downloading: true, progress: 0 };
      try {
        await downloadAudio(audioId);
        this.status[audioId] = { downloaded: true, downloading: false, progress: 100 };
        this.snackbar.open('Download complete!');
      } catch (e) {
        this.status[audioId] = { ...this.status[audioId], downloading: false, progress: 0 };
        this.snackbar.open(wasCancelled(e) ? 'Download cancelled' : `Download failed: ${errorMessage(e)}`);
      }
    },
    cancel(audioId) {
      cancelAudioDownload(audioId).catch((e) => console.warn('Cancel failed:', e));
    },
    confirmRemove(dictionary) {
      this.pendingDelete = dictionary;
      this.confirmOpen = true;
    },
    async remove() {
      if (!this.pendingDelete) return;
      const audioId = this.pendingDelete.audioId;
      this.confirmOpen = false;
      this.pendingDelete = null;
      try {
        await deleteAudio(audioId);
        this.status[audioId] = { downloaded: false, downloading: false, progress: 0 };
        this.snackbar.open('Deleted successfully');
      } catch (e) {
        this.snackbar.open(`Delete failed: ${errorMessage(e)}`);
      }
    },
  },
};
</script>

<template>
  <div v-if="dictionaries.length > 0" class="offline-set" data-testid="audio-card">
    <settings-row
      title="Audio recordings"
      :description="summary"
      clickable
      :expanded="open"
      data-testid="audio-toggle"
      @click="open = !open"
    />
    <template v-if="open">
      <settings-row
        v-for="dictionary in dictionaries"
        :key="dictionary.audioId"
        :title="dictionary.label"
        :description="meta(dictionary)"
        nested
        :data-testid="'audio-' + dictionary.audioId"
      >
        <template v-if="status[dictionary.audioId]?.downloading" #below>
          <ui-progress
            :value="status[dictionary.audioId]?.progress || 0"
            :label="'Downloading ' + dictionary.label"
            class="offline-set__progress"
          />
        </template>
        <template v-if="status[dictionary.audioId]?.downloading">
          <span class="offline-set__percent" data-testid="audio-progress">{{ status[dictionary.audioId]?.progress || 0 }}%</span>
          <ui-tooltip text="Cancel download">
            <ui-button
              icon
              size="sm"
              variant="ghost"
              class="offline-set__cancel"
              :aria-label="'Cancel the download of ' + dictionary.label"
              data-testid="audio-cancel"
              @click="cancel(dictionary.audioId)"
            >
              <ui-icon name="x" :size="17" />
            </ui-button>
          </ui-tooltip>
        </template>
        <ui-tooltip v-else-if="status[dictionary.audioId]?.downloaded" text="Delete download">
          <ui-button
            icon
            size="sm"
            variant="ghost"
            class="offline-set__delete"
            :aria-label="'Delete downloaded recordings of ' + dictionary.label"
            data-testid="audio-delete"
            @click="confirmRemove(dictionary)"
          >
            <ui-icon name="trash-2" :size="17" />
          </ui-button>
        </ui-tooltip>
        <ui-button
          v-else-if="isAppMode"
          variant="soft"
          size="sm"
          :aria-label="'Download recordings of ' + dictionary.label + ' for offline'"
          data-testid="audio-download"
          @click="download(dictionary.audioId)"
        ><ui-icon name="download" :size="15" />Download</ui-button>
      </settings-row>
    </template>
    <ui-dialog v-model="confirmOpen" title="Delete downloaded recordings?" :max-width="400">
      Delete <strong>{{ pendingDelete?.label }}</strong>? It can be downloaded again later.
      <template #actions>
        <ui-button variant="ghost" data-testid="delete-cancel" @click="confirmOpen = false">Cancel</ui-button>
        <ui-button variant="danger" data-testid="delete-confirm" @click="remove"><ui-icon name="trash-2" :size="16" />Delete</ui-button>
      </template>
    </ui-dialog>
  </div>
</template>
