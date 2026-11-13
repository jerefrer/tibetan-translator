<script>
import PackManager from '../../services/pack-manager';
import db from '../../services/sql-database';
import { UiButton, UiDialog, UiIcon, UiMenu, UiProgress } from '../../ui';
import { orderedPackDefinitions, isPackInstalled, plural } from '../settings/pack-summary';

// "65 MB download, 285 MB installed" -> "65 MB"
const shortSize = (estimatedSize) =>
  (String(estimatedSize || '').match(/\d+(?:\.\d+)?\s*[KMG]B/) || [''])[0];

// The dictionary packs, the one place to install, update and remove them
// (board DesktopDictionaries: a card per pack; MobileDictionaries: a group of
// rows). An install or a removal is confirmed first; the progress of a
// download or an update replaces the pack's button. Only where packs are
// modular (the app): the page leaves it out on the web.
//
// Exposes askInstall(packId), for a dictionary of a pack not installed.
export default {
  name: 'DictionaryPacks',
  components: { UiButton, UiDialog, UiIcon, UiMenu, UiProgress },
  inject: { snackbar: { default: null } },
  props: {
    isPhone: { type: Boolean, default: false },
  },
  data() {
    return {
      checkingUpdates: false,
      installTarget: null,
      installOpen: false,
      removeTarget: null,
      removeOpen: false,
    };
  },
  computed: {
    ready() {
      return PackManager.isInitialized;
    },
    hasUpdates() {
      return PackManager.hasUpdates;
    },
    packs() {
      const downloading = PackManager.downloadingPacks;
      const updating = PackManager.updatingPacks;
      const updates = PackManager.availableUpdates;
      return orderedPackDefinitions().map((definition) => ({
        ...definition,
        installed: isPackInstalled(definition, PackManager.installedPacks),
        removable: !definition.included && !definition.required,
        downloading: downloading[definition.id] ? Math.round(downloading[definition.id].percentage || 0) : null,
        updating: updating[definition.id] ? Math.round(updating[definition.id].percentage || 0) : null,
        update: updates[definition.id] || null,
        meta: definition.included
          ? `${plural(definition.dictionaries.length, 'dictionary', 'dictionaries')} · always on this device`
          : [plural(definition.dictionaries.length, 'dictionary', 'dictionaries'), shortSize(definition.estimatedSize)]
            .filter(Boolean)
            .join(' · '),
      }));
    },
  },
  async mounted() {
    if (!PackManager.isInitialized) await PackManager.init();
    // Updates are looked for once the page opens (it stays alive afterwards),
    // quietly: the button says when there are none
    if (PackManager.isInitialized) {
      PackManager.checkForUpdates().catch((error) => console.warn('Update check failed:', error));
    }
  },
  methods: {
    askInstall(packId) {
      const pack = this.packs.find((candidate) => candidate.id === packId);
      if (!pack || pack.installed) return;
      this.installTarget = pack;
      this.installOpen = true;
    },
    async confirmInstall() {
      const pack = this.installTarget;
      this.installOpen = false;
      if (!pack) return;
      // Install turns into the progress: the focus goes to the pack's status
      // rather than falling to the document
      this.focusStatus(pack.id);
      try {
        await PackManager.downloadPack(pack.id);
        await PackManager.waitForDownload(pack.id);
        await db.reloadPack(pack.id);
        this.snackbar?.open(`${pack.name} installed`);
      } catch (error) {
        console.error('Download failed:', error);
        this.snackbar?.open(`Could not install ${pack.name}.`);
      }
      this.installTarget = null;
      this.focusStatus(pack.id);
    },
    askRemove(pack) {
      if (!pack.removable) return;
      this.removeTarget = pack;
      this.removeOpen = true;
    },
    async confirmRemove() {
      const pack = this.removeTarget;
      this.removeOpen = false;
      if (!pack) return;
      try {
        db.unloadPack(pack.id);
        await PackManager.removePack(pack.id);
        this.snackbar?.open(`${pack.name} removed`);
      } catch (error) {
        console.error('Remove failed:', error);
        this.snackbar?.open(`Could not remove ${pack.name}.`);
      }
      this.removeTarget = null;
    },
    async checkForUpdates() {
      this.checkingUpdates = true;
      try {
        await PackManager.checkForUpdates();
        if (!PackManager.hasUpdates) this.snackbar?.open('Every pack is up to date');
      } catch (error) {
        console.error('Update check failed:', error);
        this.snackbar?.open('Could not check for updates.');
      }
      this.checkingUpdates = false;
    },
    async updatePack(packId) {
      try {
        await PackManager.updatePack(packId);
        await PackManager.waitForUpdate(packId);
        await db.reloadPack(packId);
      } catch (error) {
        console.error('Update failed:', error);
      }
    },
    async updateAll() {
      for (const pack of this.packs) {
        if (pack.update) await this.updatePack(pack.id);
      }
    },
    focusStatus(packId) {
      this.$nextTick(() => {
        const active = document.activeElement;
        if (active && active !== document.body && active.isConnected) return;
        this.$el
          ?.querySelector?.(`[data-testid="pack-${packId}"] [data-testid="pack-status"]`)
          ?.focus();
      });
    },
    menuItems(pack) {
      return [{ key: 'remove', label: `Remove ${pack.name}…`, icon: 'trash-2', danger: true }];
    },
  },
};
</script>

<template>
  <section class="dictionary-packs" :class="{ 'is-phone': isPhone }" aria-labelledby="dictionary-packs-title" data-testid="dictionary-packs">
    <div class="dictionary-packs__head">
      <h2 id="dictionary-packs-title" class="dictionary-packs__label">Packs</h2>
      <div class="dictionary-packs__actions">
        <ui-button v-if="hasUpdates" size="sm" data-testid="packs-update-all" @click="updateAll">
          <ui-icon name="download" :size="15" />
          Update all
        </ui-button>
        <ui-button
          variant="ghost"
          size="sm"
          :loading="checkingUpdates"
          :disabled="!ready"
          data-testid="packs-check-updates"
          @click="checkForUpdates"
        >
          <ui-icon v-if="!checkingUpdates" name="refresh-cw" :size="15" />
          Check for updates
        </ui-button>
      </div>
    </div>

    <div class="dictionary-packs__list">
      <div
        v-for="pack in packs"
        :key="pack.id"
        class="dictionary-pack"
        :data-testid="'pack-' + pack.id"
      >
        <div class="dictionary-pack__top">
          <span class="dictionary-pack__name">{{ pack.name }}</span>

          <span v-if="pack.updating !== null" class="dictionary-pack__status is-busy" tabindex="-1" data-testid="pack-status">
            Updating {{ pack.updating }}%
          </span>
          <span v-else-if="pack.downloading !== null" class="dictionary-pack__status is-busy" tabindex="-1" data-testid="pack-status">
            Downloading {{ pack.downloading }}%
          </span>
          <template v-else-if="pack.installed">
            <ui-button v-if="pack.update" size="sm" variant="soft" data-testid="pack-update" @click="updatePack(pack.id)">
              <ui-icon name="download" :size="15" />
              Update<template v-if="pack.update.sizeMB"> · {{ pack.update.sizeMB }} MB</template>
            </ui-button>
            <span v-else class="dictionary-pack__status" tabindex="-1" data-testid="pack-status">
              {{ pack.included ? 'Included' : 'Installed' }}
            </span>
            <ui-menu v-if="pack.removable" :items="menuItems(pack)" align="end" @select="askRemove(pack)">
              <button type="button" class="dictionary-pack__more" :aria-label="'More for ' + pack.name" data-testid="pack-more">
                <ui-icon name="ellipsis" :size="18" />
              </button>
            </ui-menu>
          </template>
          <ui-button
            v-else-if="ready"
            size="sm"
            variant="soft"
            data-testid="pack-install"
            @click="askInstall(pack.id)"
          >
            <ui-icon name="download" :size="15" />
            Install
          </ui-button>
        </div>

        <ui-progress
          v-if="pack.updating !== null || pack.downloading !== null"
          :value="pack.updating ?? pack.downloading"
          :label="(pack.updating !== null ? 'Updating ' : 'Downloading ') + pack.name"
          class="dictionary-pack__progress"
        />
        <span class="dictionary-pack__meta">{{ pack.meta }}</span>
      </div>
    </div>

    <ui-dialog
      v-model="installOpen"
      :title="installTarget ? `Install ${installTarget.name}?` : 'Install'"
      :max-width="440"
    >
      <p v-if="installTarget" class="dictionary-packs__dialog-text">
        Adds its {{ installTarget.dictionaries.length }} dictionaries to every lookup
        ({{ installTarget.estimatedSize }}).
      </p>
      <template #actions>
        <ui-button variant="ghost" @click="installOpen = false">Cancel</ui-button>
        <ui-button data-testid="pack-confirm-install" @click="confirmInstall"><ui-icon name="download" :size="16" />Install</ui-button>
      </template>
    </ui-dialog>

    <ui-dialog v-model="removeOpen" title="Remove pack?" :max-width="420">
      <p v-if="removeTarget" class="dictionary-packs__dialog-text">
        <strong>{{ removeTarget.name }}</strong> and its {{ removeTarget.dictionaries.length }}
        dictionaries leave this device. You can install it again later.
      </p>
      <template #actions>
        <ui-button variant="ghost" data-testid="remove-cancel" @click="removeOpen = false">Cancel</ui-button>
        <ui-button variant="danger" data-testid="remove-confirm" @click="confirmRemove"><ui-icon name="trash-2" :size="16" />Remove</ui-button>
      </template>
    </ui-dialog>
  </section>
</template>

<style scoped>
.dictionary-packs {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.dictionary-packs__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  min-height: var(--control-sm);
}
.dictionary-packs__label {
  margin: 0;
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}
.dictionary-packs__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* Desktop: a card per pack, side by side */
.dictionary-packs__list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
  gap: 10px;
}
.dictionary-pack {
  box-sizing: border-box;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: var(--space-3) 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius-xl);
  background: var(--surface);
}
.dictionary-pack__top {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--control-sm);
}
.dictionary-pack__name {
  flex: 1;
  min-width: 0;
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--ink);
}
.dictionary-pack__status {
  font-size: var(--text-sm);
  color: var(--muted);
  white-space: nowrap;
}
.dictionary-pack__status.is-busy {
  font-weight: 600;
  color: var(--accent);
}
.dictionary-pack__more {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--control-sm);
  height: var(--control-sm);
  margin-right: -6px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--muted);
  cursor: pointer;
}
.dictionary-pack__more:hover {
  background: var(--soft);
  color: var(--ink);
}
.dictionary-pack__more:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.dictionary-pack__meta {
  font-size: var(--text-sm);
  color: var(--muted);
}
.dictionary-packs__dialog-text {
  margin: 0;
}

/* Phone: one white group of rows (board MobileDictionaries) */
.dictionary-packs.is-phone .dictionary-packs__label {
  padding: 0 var(--space-1);
}
.dictionary-packs.is-phone .dictionary-packs__list {
  display: flex;
  flex-direction: column;
  gap: 0;
  border-radius: var(--radius-group);
  background: var(--surface);
  overflow: hidden;
}
.dictionary-packs.is-phone .dictionary-pack {
  gap: 2px;
  padding: 10px var(--space-4);
  border: 0;
  border-top: 1px solid var(--soft);
  border-radius: 0;
}
.dictionary-packs.is-phone .dictionary-pack:first-child {
  border-top: 0;
}
.dictionary-packs.is-phone .dictionary-pack__name {
  font-size: var(--text-md);
  font-weight: 400;
}
</style>
