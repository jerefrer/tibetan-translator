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

    <v-card-actions v-if="packs.length" class="import-actions">
      <v-spacer />
      <v-btn
        variant="tonal"
        color="primary"
        size="small"
        @click="onImportClick"
      >
        <v-icon start>mdi-file-upload</v-icon>
        Import a dictionary…
      </v-btn>
    </v-card-actions>

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
            color="error"
            @click="onRemove(pack)"
          >
            <v-icon>mdi-delete</v-icon>
            <v-tooltip activator="parent" location="top">Remove dictionary</v-tooltip>
          </v-btn>
        </template>
      </v-list-item>
    </v-list>

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
    </v-card-text>

    <CustomPackConflictModal
      v-model="conflictOpen"
      :existing-name="conflictContext.existingName"
      :existing-version="conflictContext.existingVersion"
      :new-version="conflictContext.newVersion"
      @confirm="onConfirmReplace"
      @cancel="onCancelReplace"
    />
  </v-card>
</template>

<script>
import { open } from '@tauri-apps/plugin-dialog';
import PackManager from '../services/pack-manager';
import CustomPackConflictModal from './CustomPackConflictModal.vue';
import { supportsModularPacks } from '../config/platform';

export default {
  name: 'CustomPackSection',
  components: { CustomPackConflictModal },
  inject: ['snackbar'],
  data() {
    return {
      conflictOpen: false,
      conflictContext: {
        existingName: 'This dictionary',
        existingVersion: '',
        newVersion: '',
        filePath: '',
      },
    };
  },
  computed: {
    isSupported() {
      return supportsModularPacks();
    },
    packs() {
      return PackManager.customPacks;
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
        await this.installFile(filePath);
      } catch (e) {
        console.error('[CustomPackSection] import failed:', e);
        this.snackbar.open('Invalid or corrupted file.');
      }
    },
    async installFile(filePath) {
      const result = await PackManager.installCustomPack(filePath);
      this.handleResult(result, filePath);
    },
    handleResult(result, filePath) {
      if (result.status === 'installed') {
        this.snackbar.open(`${result.pack.manifest.name} installed`);
        return;
      }
      if (result.status === 'conflict') {
        this.conflictContext = {
          existingName: 'This dictionary',
          existingVersion: '',
          newVersion: '',
          filePath,
        };
        this.conflictOpen = true;
        return;
      }
      if (result.errorKind === 'incompatible') {
        this.snackbar.open(
          "This file isn't compatible with your app version. Please get an up-to-date file."
        );
      } else if (result.errorKind === 'corrupt') {
        this.snackbar.open('Invalid or corrupted file.');
      } else {
        this.snackbar.open("This file isn't a valid dictionary.");
      }
    },
    async onConfirmReplace() {
      const { filePath } = this.conflictContext;
      const result = await PackManager.installCustomPack(filePath, { force: true });
      this.handleResult(result, filePath);
    },
    onCancelReplace() {
      this.conflictContext = {
        existingName: 'This dictionary',
        existingVersion: '',
        newVersion: '',
        filePath: '',
      };
    },
    async onRemove(pack) {
      await PackManager.removeCustomPack(pack.id);
      this.snackbar.open(`${pack.manifest.name} removed`);
    },
  },
};
</script>

<style lang="stylus" scoped>
.custom-pack-card
  .import-actions
    padding 0 1em

  .pack-item
    .v-list-item-subtitle
      color rgba(0, 0, 0, .6)

  .empty-state
    font-size .9em
    color rgba(0, 0, 0, .6)

    code
      background rgba(0, 0, 0, .05)
      padding .1em .3em
      border-radius 3px
      font-size .95em
</style>
