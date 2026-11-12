<script>
import PackManager from '../../services/pack-manager';
import DictionariesDetails from '../../services/dictionaries-details';
import db from '../../services/sql-database';
import { supportsModularPacks } from '../../config/platform';
import { UiButton, UiDialog, UiIcon, UiProgress, UiSpinner, UiTooltip } from '../../ui';
import SettingsCard from './SettingsCard.vue';
import { orderedPackDefinitions, isPackInstalled, packSummary, plural } from './pack-summary';

// The dictionary packs on this device: install, update, remove, and the list
// of dictionaries each one holds. Only where packs are modular (the app).
export default {
  name: 'PackManagerCard',
  components: { SettingsCard, UiButton, UiDialog, UiIcon, UiProgress, UiSpinner, UiTooltip },
  data() {
    return {
      isSupported: false,
      confirmOpen: false,
      packToRemove: null,
      expandedPacks: [],
      checkingUpdates: false,
    };
  },
  computed: {
    isInitialized() {
      return PackManager.isInitialized;
    },
    hasUpdates() {
      return PackManager.hasUpdates;
    },
    packs() {
      const installed = PackManager.installedPacks;
      const downloading = PackManager.downloadingPacks;
      const updating = PackManager.updatingPacks;
      const updates = PackManager.availableUpdates;
      return orderedPackDefinitions().map((definition) => ({
        ...definition,
        installed: isPackInstalled(definition, installed),
        downloading: !!downloading[definition.id],
        downloadProgress: Math.round(downloading[definition.id]?.percentage || 0),
        updating: !!updating[definition.id],
        updateProgress: Math.round(updating[definition.id]?.percentage || 0),
        hasUpdate: !!updates[definition.id],
        updateSize: updates[definition.id]?.sizeMB,
      }));
    },
    summary() {
      const { installed, total, dictionaries } = packSummary(PackManager.installedPacks);
      return `${installed} of ${total} installed · ${plural(dictionaries, 'dictionary', 'dictionaries')} on this device`;
    },
  },
  async mounted() {
    this.isSupported = supportsModularPacks();
    if (this.isSupported && !PackManager.isInitialized) {
      await PackManager.init();
    }
  },
  methods: {
    meta(pack) {
      const count = plural((pack.dictionaries || []).length, 'dictionary', 'dictionaries');
      return pack.estimatedSize ? `${count} · ${pack.estimatedSize}` : count;
    },
    isExpanded(packId) {
      return this.expandedPacks.includes(packId);
    },
    toggleExpanded(packId) {
      const index = this.expandedPacks.indexOf(packId);
      if (index === -1) this.expandedPacks.push(packId);
      else this.expandedPacks.splice(index, 1);
    },
    dictionaryLabel(name) {
      return DictionariesDetails[name]?.label || name;
    },
    async downloadPack(packId) {
      // Install turns into the progress: the focus goes to the row's status
      // line rather than falling to the document, and again once that line
      // says "Installed" (or the download failed and Install is back)
      const started = PackManager.downloadPack(packId);
      this.focusPackStatus(packId);
      try {
        await started;
        await PackManager.waitForDownload(packId);
        await db.reloadPack(packId);
      } catch (e) {
        console.error('Download failed:', e);
      }
      this.focusPackStatus(packId);
    },
    focusPackStatus(packId) {
      this.$nextTick(() => {
        const active = document.activeElement;
        if (active && active !== document.body && active.isConnected) return;
        this.$el
          ?.querySelector?.(`[data-testid="pack-${packId}"]`)
          ?.querySelector('[data-testid="pack-status"], [data-testid="pack-install"], [data-testid="pack-update"]')
          ?.focus();
      });
    },
    confirmRemovePack(pack) {
      if (pack.required || pack.included) return;
      this.packToRemove = pack;
      this.confirmOpen = true;
    },
    async removePack() {
      if (!this.packToRemove) return;
      const packId = this.packToRemove.id;
      this.confirmOpen = false;
      try {
        db.unloadPack(packId);
        await PackManager.removePack(packId);
      } catch (e) {
        console.error('Remove failed:', e);
      }
      this.packToRemove = null;
    },
    async checkForUpdates() {
      this.checkingUpdates = true;
      try {
        await PackManager.checkForUpdates();
      } catch (e) {
        console.error('Update check failed:', e);
      }
      this.checkingUpdates = false;
    },
    async updatePack(packId) {
      try {
        await PackManager.updatePack(packId);
        await PackManager.waitForUpdate(packId);
        await db.reloadPack(packId);
      } catch (e) {
        console.error('Update failed:', e);
      }
    },
    async updateAllPacks() {
      try {
        for (const pack of this.packs) {
          if (pack.hasUpdate) await this.updatePack(pack.id);
        }
      } catch (e) {
        console.error('Update all failed:', e);
      }
    },
  },
};
</script>

<template>
  <settings-card
    v-if="isSupported"
    title="Dictionary packs"
    :subtitle="summary"
    class="pack-manager-card"
    data-testid="pack-manager-card"
  >
    <template #aside>
      <ui-button variant="outline" class="pack-manager-card__manage" data-testid="manage-in-dictionaries" @click="$router.push('/dictionaries')">
        Manage in Dictionaries
      </ui-button>
    </template>

    <div class="pack-manager-card__toolbar">
      <ui-button variant="ghost" size="sm" :loading="checkingUpdates" data-testid="packs-check-updates" @click="checkForUpdates">
        <ui-icon v-if="!checkingUpdates" name="refresh-cw" :size="16" />
        Check for updates
      </ui-button>
      <ui-button v-if="hasUpdates" size="sm" data-testid="packs-update-all" @click="updateAllPacks">
        <ui-icon name="download" :size="16" />
        Update all
      </ui-button>
    </div>

    <div v-if="isInitialized" class="pack-manager-card__list">
      <div
        v-for="pack in packs"
        :key="pack.id"
        class="pack-row"
        :data-testid="'pack-' + pack.id"
      >
        <div class="pack-row__head">
          <span class="pack-row__name">{{ pack.name }}</span>

          <span v-if="pack.updating" class="pack-row__status pack-row__status--amber" tabindex="-1" data-testid="pack-status">
            Updating {{ pack.updateProgress }}%
          </span>
          <span v-else-if="pack.downloading" class="pack-row__status pack-row__status--accent" tabindex="-1" data-testid="pack-status">
            Downloading {{ pack.downloadProgress }}%
          </span>
          <template v-else-if="pack.installed">
            <ui-button
              v-if="pack.hasUpdate"
              size="sm"
              variant="outline"
              data-testid="pack-update"
              @click="updatePack(pack.id)"
            >
              <ui-icon name="download" :size="16" />
              Update<template v-if="pack.updateSize"> · {{ pack.updateSize }} MB</template>
            </ui-button>
            <span v-else class="pack-row__status pack-row__status--ok" tabindex="-1" data-testid="pack-status">
              <ui-icon name="circle-check" :size="16" />
              Installed
            </span>
            <ui-tooltip v-if="!pack.included && !pack.required" text="Remove pack">
              <ui-button
                icon
                size="sm"
                variant="ghost"
                class="pack-row__remove"
                :aria-label="'Remove ' + pack.name"
                data-testid="pack-remove"
                @click="confirmRemovePack(pack)"
              >
                <ui-icon name="trash-2" :size="18" />
              </ui-button>
            </ui-tooltip>
          </template>
          <ui-button v-else size="sm" data-testid="pack-install" @click="downloadPack(pack.id)">
            Install
          </ui-button>
        </div>

        <ui-progress
          v-if="pack.updating || pack.downloading"
          :value="pack.updating ? pack.updateProgress : pack.downloadProgress"
          :label="(pack.updating ? 'Updating ' : 'Downloading ') + pack.name"
          class="pack-row__progress"
          :class="{ 'pack-row__progress--amber': pack.updating }"
        />

        <span v-if="pack.description" class="pack-row__description">{{ pack.description }}</span>
        <button
          type="button"
          class="pack-row__meta"
          :aria-expanded="String(isExpanded(pack.id))"
          data-testid="pack-toggle"
          @click="toggleExpanded(pack.id)"
        >
          {{ meta(pack) }}
          <ui-icon :name="isExpanded(pack.id) ? 'chevron-up' : 'chevron-down'" :size="14" />
        </button>

        <ul v-if="isExpanded(pack.id)" class="pack-row__dictionaries" data-testid="pack-dictionaries">
          <li v-for="name in pack.dictionaries" :key="name">{{ dictionaryLabel(name) }}</li>
        </ul>
      </div>
    </div>

    <div v-else class="pack-manager-card__loading">
      <ui-spinner />
      <span>Loading pack information...</span>
    </div>

    <ui-dialog v-model="confirmOpen" title="Remove pack?" :max-width="400">
      Are you sure you want to remove <strong>{{ packToRemove?.name }}</strong>?
      You can download it again later.
      <template #actions>
        <ui-button variant="ghost" data-testid="remove-cancel" @click="confirmOpen = false">Cancel</ui-button>
        <ui-button variant="danger" data-testid="remove-confirm" @click="removePack">Remove</ui-button>
      </template>
    </ui-dialog>
  </settings-card>
</template>

<style>
.pack-manager-card__manage {
  flex: none;
}
.pack-manager-card__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin: -6px 0 -6px calc(-1 * var(--space-3));
}
.pack-manager-card__list {
  display: flex;
  flex-direction: column;
}
/* Mockup (Dictionaries board, Packs panel): 12px rows split by a soft rule */
.pack-row {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: var(--space-3) 0;
  border-top: 1px solid var(--soft);
}
.pack-row:last-child {
  padding-bottom: var(--space-1);
}
.pack-row__head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--control-sm);
}
.pack-row__name {
  flex: 1;
  min-width: 0;
  font-size: 0.9375rem;
  font-weight: 600;
}
.pack-row__status {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-sm);
  font-weight: 600;
}
.pack-row__status--ok { color: var(--success-ink); }
.pack-row__status--accent { color: var(--accent); }
.pack-row__status--amber { color: var(--amber-line); }
.pack-row__remove.ui-button--ghost { color: var(--muted); }
.pack-row__remove.ui-button--ghost:hover:not(:disabled) { color: var(--danger-ink); background: var(--danger-soft); }
.pack-row__progress { margin: 3px 0; }
.pack-row__progress.ui-progress { background: var(--accent-soft); }
.pack-row__progress--amber .ui-progress__bar { background: var(--amber-line); }
.pack-row__description {
  font-size: var(--text-sm);
  color: var(--muted);
}
.pack-row__meta {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0;
  border: 0;
  background: none;
  color: var(--muted);
  font: var(--text-sm) var(--font-ui);
  cursor: pointer;
}
.pack-row__meta:hover { color: var(--ink); }
.pack-row__meta:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.pack-row__dictionaries {
  margin: var(--space-2) 0 0;
  padding: var(--space-2) var(--space-3) var(--space-2) var(--space-6);
  border-radius: var(--radius-md);
  background: var(--bg);
  font-size: var(--text-sm);
  color: var(--muted);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.pack-manager-card__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-6) 0;
  font-size: var(--text-sm);
  color: var(--muted);
}
@media (max-width: 600px) {
  .pack-manager-card .settings-card__header { flex-wrap: wrap; }
}
</style>
