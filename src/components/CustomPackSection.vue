<template>
  <v-card v-if="isSupported" class="custom-pack-card mb-4">
    <v-toolbar>
      <v-icon size="x-large" color="grey">mdi-book-plus-outline</v-icon>
      <v-toolbar-title>
        Custom Dictionaries
        <div class="text-caption text-grey">
          {{ packs.length }} installed
        </div>
      </v-toolbar-title>
    </v-toolbar>

    <v-list v-if="packs.length">
      <v-list-item v-for="pack in packs" :key="pack.id" class="pack-item">
        <template v-slot:prepend>
          <v-icon :icon="packIcon(pack)" color="primary" />
        </template>

        <v-list-item-title>{{ pack.manifest.name }}</v-list-item-title>
        <v-list-item-subtitle v-if="packSubtitle(pack)">
          {{ packSubtitle(pack) }}
        </v-list-item-subtitle>

        <template v-slot:append>
          <v-btn
            icon
            variant="text"
            size="small"
            @click="onManage(pack)"
          >
            <v-icon>mdi-playlist-edit</v-icon>
            <v-tooltip activator="parent" location="top">Manage entries</v-tooltip>
          </v-btn>
          <v-btn
            icon
            variant="text"
            size="small"
            color="error"
            @click="onRemove(pack)"
          >
            <v-icon>mdi-delete</v-icon>
            <v-tooltip activator="parent" location="top">Remove dictionary</v-tooltip>
          </v-btn>
        </template>
      </v-list-item>
    </v-list>

    <v-card-actions v-if="packs.length" class="import-actions">
      <v-btn
        variant="tonal"
        color="primary"
        size="small"
        @click="onImportClick"
      >
        <v-icon start>mdi-file-upload</v-icon>
        Import a dictionary…
      </v-btn>
      <v-btn variant="tonal" color="primary" size="small" class="ml-2" @click="onCreate">
        <v-icon start>mdi-plus</v-icon>
        New dictionary
      </v-btn>
    </v-card-actions>

    <v-card-text v-else class="empty-state text-center py-6">
      <p class="mb-4">
        No custom dictionary yet. Drag a <code>.tibdict</code> file onto the window
        or use the button below.
      </p>
      <v-btn
        variant="tonal"
        color="primary"
        size="small"
        @click="onImportClick"
      >
        <v-icon start>mdi-file-upload</v-icon>
        Import a dictionary…
      </v-btn>
      <v-btn variant="tonal" color="primary" size="small" class="ml-2" @click="onCreate">
        <v-icon start>mdi-plus</v-icon>
        New dictionary
      </v-btn>
    </v-card-text>

    <v-dialog v-model="createOpen" max-width="460">
      <v-card>
        <v-card-title>New dictionary</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="newName"
            label="Name"
            density="comfortable"
            autofocus
            :error-messages="createError ? [createError] : []"
            @keyup.enter="confirmCreate"
          />
          <v-textarea
            v-model="newDescription"
            label="Description (optional)"
            rows="2"
            auto-grow
            density="comfortable"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="createOpen = false">Cancel</v-btn>
          <v-btn color="primary" variant="tonal" :loading="creating" @click="confirmCreate">
            Create
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="removeOpen" max-width="460">
      <v-card v-if="removeTarget">
        <v-card-title>Remove dictionary?</v-card-title>
        <v-card-text>
          <p>
            <strong>{{ removeTarget.manifest.name }}</strong> will be permanently deleted from
            this device. This cannot be undone.
          </p>
          <v-alert
            v-if="removeHasLocalEdits"
            type="warning"
            variant="tonal"
            density="compact"
            class="mt-3"
          >
            This dictionary has entries you added or edited here, nowhere else. Consider
            exporting it first if you want to keep a copy.
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="removeOpen = false">Cancel</v-btn>
          <v-btn color="error" variant="elevated" :loading="removing" @click="confirmRemove">
            Remove
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script>
import { open } from '@tauri-apps/plugin-dialog';
import PackManager from '../services/pack-manager';
import TibdictInstaller from '../services/tibdict-installer';
import Lexicon from '../services/lexicon';
import { supportsModularPacks } from '../config/platform';

export default {
  name: 'CustomPackSection',
  inject: ['snackbar'],
  data() {
    return {
      createOpen: false,
      creating: false,
      newName: '',
      newDescription: '',
      createError: '',
      removeOpen: false,
      removing: false,
      removeTarget: null,
    };
  },
  computed: {
    isSupported() {
      return supportsModularPacks();
    },
    packs() {
      return PackManager.customPacks;
    },
    // Same field the conflict modal treats as "edited since it came into
    // existence" (see CustomPackConflictModal.vue's hasLocalEdits and the
    // create_lexicon fix that leaves modifiedAt unset until an entry is
    // actually written): a freshly created, never-touched lexicon reads as
    // false, so the stronger export-first wording only shows once there is
    // something on this device that exists nowhere else.
    removeHasLocalEdits() {
      return !!this.removeTarget?.manifest?.modifiedAt;
    },
  },
  methods: {
    packIcon(pack) {
      return pack.manifest.icon || 'mdi-book-plus-outline';
    },
    packSubtitle(pack) {
      const parts = [];
      if (pack.manifest.version) parts.push(`v${pack.manifest.version}`);
      const dictCount = Array.isArray(pack.manifest.dictionaries)
        ? pack.manifest.dictionaries.length
        : 0;
      if (dictCount > 1) parts.push(`${dictCount} dictionaries`);
      return parts.join(' · ');
    },
    async onImportClick() {
      try {
        const selected = await open({
          multiple: false,
          filters: [{ name: 'Tibetan dictionary', extensions: ['tibdict'] }],
        });
        if (!selected) return;
        const filePath = typeof selected === 'string' ? selected : selected.path;
        await TibdictInstaller.install(filePath);
      } catch (e) {
        console.error('[CustomPackSection] import failed:', e);
        this.snackbar.open('Invalid or corrupted file.');
      }
    },
    onRemove(pack) {
      this.removeTarget = pack;
      this.removing = false;
      this.removeOpen = true;
    },
    async confirmRemove() {
      const pack = this.removeTarget;
      if (!pack) return;
      this.removing = true;
      try {
        await PackManager.removeCustomPack(pack.id);
        this.removeOpen = false;
        this.snackbar.open(`${pack.manifest.name} removed`);
      } catch (e) {
        console.error('[CustomPackSection] remove failed:', e);
        this.snackbar.open('Could not remove this dictionary.');
      } finally {
        this.removing = false;
      }
    },
    onManage(pack) {
      this.$router.push(`/lexicon/${pack.id}`);
    },
    onCreate() {
      this.newName = '';
      this.newDescription = '';
      this.createError = '';
      this.creating = false;
      this.createOpen = true;
    },
    async confirmCreate() {
      const name = this.newName.trim();
      if (!name) {
        this.createError = 'A name is required.';
        return;
      }
      this.creating = true;
      try {
        const pack = await Lexicon.create(name, this.newDescription.trim());
        this.createOpen = false;
        this.snackbar.open(`${pack.manifest.name} created`);
        this.$router.push(`/lexicon/${pack.id}`);
      } catch (e) {
        console.error('[CustomPackSection] create failed:', e);
        this.createError = 'Could not create this dictionary.';
      } finally {
        this.creating = false;
      }
    },
  },
};
</script>

<style lang="sass" scoped>
.custom-pack-card
  width: 100%

  // Same icon + title spacing as PackManagerCard, aligned with the v-list-item
  // prepend below. :deep is required because Vuetify renders its own DOM
  // that scoped selectors can't target.
  :deep(.v-toolbar__content)
    padding-inline-start: 16px

  :deep(.v-toolbar__content > .v-icon)
    margin-inline: 0 16px

  :deep(.v-toolbar-title)
    padding-inline-start: 0
    margin-inline-start: 0

  .v-toolbar__title, .v-toolbar__title .text-caption
    line-height: 1em

  .v-toolbar__title .text-caption
    margin-top: 5px

  .import-actions
    padding: 8px 16px

  .pack-item
    border-bottom: thin solid rgba(0, 0, 0, 0.08)
    min-height: 64px

    // Match PackManagerCard's prepend sizing so the item text lines up
    // identically across Dictionary Packs and Custom Dictionaries.
    :deep(.v-list-item__prepend)
      width: 24px
      min-width: 24px
      margin-right: 12px

    :deep(.v-list-item__content)
      padding-left: 0

  .empty-state
    font-size: 0.9em
    color: rgba(0, 0, 0, 0.6)

    code
      background: rgba(0, 0, 0, 0.05)
      padding: 0.1em 0.3em
      border-radius: 3px
      font-size: 0.95em
</style>
