<script>
import changelog from '../../../CHANGELOG.md?raw';
import UpdateService from '../../services/update-service';
import { renderReleaseNotes, releaseNotesFor } from '../../services/release-notes-markdown';
import { isTauri } from '../../config/platform';
import { UiButton, UiDialog, UiIcon, UiListItem, UiSpinner } from '../../ui';
import SettingsCard from './SettingsCard.vue';

// App version, update check / restart, and "What's new". In the app only:
// renders nothing in a browser, where there is no version to show.
//
// `rows` renders the same actions as <UiListItem> rows for the phone
// layout, to be placed inside the parent's <UiList>.
export default {
  name: 'AboutCard',
  components: { SettingsCard, UiButton, UiDialog, UiIcon, UiListItem, UiSpinner },
  inject: ['snackbar'],
  props: {
    rows: { type: Boolean, default: false },
  },
  data() {
    return {
      appVersion: null,
      checkingForUpdates: false,
      dialogOpen: false,
    };
  },
  computed: {
    updateReady() {
      return UpdateService.state.updateReady;
    },
    updateVersion() {
      return UpdateService.state.version;
    },
    updateDownloading() {
      return UpdateService.state.downloading;
    },
    updateProgress() {
      return UpdateService.state.downloadProgress;
    },
    // The downloaded update's notes when one waits for a restart, otherwise
    // this version's section of CHANGELOG.md.
    notesVersion() {
      return this.updateReady ? this.updateVersion : this.appVersion;
    },
    notesHtml() {
      const markdown = this.updateReady
        ? UpdateService.state.notes
        : releaseNotesFor(changelog, this.appVersion);
      return renderReleaseNotes(markdown);
    },
    versionLine() {
      if (this.updateReady) return `Version ${this.appVersion} → v${this.updateVersion} ready`;
      return `Tibetan Translator ${this.appVersion}`;
    },
  },
  async created() {
    if (isTauri()) {
      this.appVersion = await UpdateService.getVersion();
    }
  },
  methods: {
    openNotes() {
      this.dialogOpen = true;
    },
    async checkForUpdates() {
      this.checkingForUpdates = true;
      try {
        const update = await UpdateService.checkOnly();
        if (update) {
          this.snackbar.open(`Update to v${update.version} available! Downloading...`);
          // The reactive state drives the button and the Settings dot
          await UpdateService.checkAndDownload((newVersion) => {
            this.snackbar.open(`Update to v${newVersion} ready! Will install on restart.`);
          });
        } else {
          this.snackbar.open("You're running the latest version!");
        }
      } catch (e) {
        this.snackbar.open('Failed to check for updates');
        console.error('Update check failed:', e);
      } finally {
        this.checkingForUpdates = false;
      }
    },
    async confirmRestart() {
      this.dialogOpen = false;
      await UpdateService.installAndRelaunch();
    },
  },
};
</script>

<template>
  <template v-if="appVersion">
    <template v-if="rows">
      <ui-list-item
        :title="updateReady ? 'What’s new in v' + updateVersion : 'What’s new'"
        :subtitle="versionLine"
        clickable
        class="settings-row"
        data-testid="about-whats-new-row"
        @click="openNotes"
      >
        <template #append><ui-icon name="chevron-right" :size="18" class="settings-row__chevron" /></template>
      </ui-list-item>
      <ui-list-item
        v-if="updateReady"
        title="Restart to update"
        clickable
        class="settings-row settings-row--accent"
        data-testid="about-restart-row"
        @click="openNotes"
      >
        <template #append><ui-icon name="rotate-cw" :size="18" /></template>
      </ui-list-item>
      <ui-list-item
        v-else-if="updateDownloading"
        :title="'Downloading update… ' + updateProgress + '%'"
        class="settings-row"
        data-testid="about-downloading-row"
      />
      <ui-list-item
        v-else
        title="Check for updates"
        :clickable="!checkingForUpdates"
        class="settings-row"
        data-testid="about-check-row"
        @click="checkForUpdates"
      >
        <template #append>
          <ui-spinner v-if="checkingForUpdates" :size="18" />
          <ui-icon v-else name="refresh-cw" :size="18" class="settings-row__chevron" />
        </template>
      </ui-list-item>
    </template>

    <settings-card v-else title="About" :subtitle="versionLine" class="about-card" data-testid="about-card">
      <div class="about-card__actions">
        <ui-button variant="outline" data-testid="about-whats-new" @click="openNotes">What’s new</ui-button>
        <ui-button v-if="updateReady" data-testid="about-restart" @click="openNotes">
          <ui-icon name="rotate-cw" :size="16" />
          Restart to update
        </ui-button>
        <ui-button v-else-if="updateDownloading" variant="outline" disabled data-testid="about-downloading">
          Downloading… {{ updateProgress }}%
        </ui-button>
        <ui-button
          v-else
          variant="outline"
          :loading="checkingForUpdates"
          data-testid="about-check"
          @click="checkForUpdates"
        >
          Check for updates
        </ui-button>
      </div>
    </settings-card>

    <ui-dialog
      v-model="dialogOpen"
      :title="'What’s new in v' + notesVersion"
      :max-width="560"
    >
      <div v-if="notesHtml" class="release-notes" data-testid="release-notes" v-html="notesHtml" />
      <p v-else class="about-card__muted" data-testid="release-notes-empty">
        No release notes were published for this version.
      </p>
      <p v-if="updateReady" class="about-card__caption">
        The update is already downloaded and will be applied when the app restarts.
      </p>
      <template #actions>
        <template v-if="updateReady">
          <ui-button variant="ghost" data-testid="restart-later" @click="dialogOpen = false">Later</ui-button>
          <ui-button data-testid="restart-now" @click="confirmRestart">Restart now</ui-button>
        </template>
        <ui-button v-else variant="ghost" data-testid="notes-close" @click="dialogOpen = false">Close</ui-button>
      </template>
    </ui-dialog>
  </template>
</template>

<style>
.about-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.about-card__muted {
  margin: 0;
  color: var(--muted);
}
.about-card__caption {
  margin: var(--space-4) 0 0;
  font-size: var(--text-xs);
  color: var(--muted);
}

/* The dialog is teleported to <body>, so these are not nested in the card */
.release-notes {
  max-height: 50vh;
  overflow-y: auto;
}
.release-notes h4 {
  margin: var(--space-3) 0 var(--space-1);
  font-size: var(--text-base);
  font-weight: 600;
}
.release-notes h4:first-child {
  margin-top: 0;
}
.release-notes ul {
  margin: 0;
  padding-left: var(--space-5);
}
.release-notes li {
  font-size: var(--text-base);
  line-height: 1.5;
  margin-bottom: var(--space-1);
}
.release-notes p {
  font-size: var(--text-base);
  margin: 0 0 var(--space-2);
}
</style>
