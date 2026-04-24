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
    </v-card-text>
  </v-card>
</template>

<script>
import { open } from '@tauri-apps/plugin-dialog';
import PackManager from '../services/pack-manager';
import TibdictInstaller from '../services/tibdict-installer';
import { supportsModularPacks } from '../config/platform';

export default {
  name: 'CustomPackSection',
  inject: ['snackbar'],
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
        await TibdictInstaller.install(filePath);
      } catch (e) {
        console.error('[CustomPackSection] import failed:', e);
        this.snackbar.open('Invalid or corrupted file.');
      }
    },
    async onRemove(pack) {
      await PackManager.removeCustomPack(pack.id);
      this.snackbar.open(`${pack.manifest.name} removed`);
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
