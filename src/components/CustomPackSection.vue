<template>
  <section v-if="isSupported" class="custom-packs" data-testid="custom-pack-section">
    <header class="custom-packs__header">
      <div>
        <h2 class="custom-packs__title">Your dictionaries</h2>
        <p class="custom-packs__subtitle">{{ packs.length }} installed</p>
      </div>
    </header>

    <ui-list v-if="packs.length" class="custom-packs__list">
      <ui-list-item
        v-for="pack in packs"
        :key="pack.id"
        :title="pack.manifest.name"
        :subtitle="packSubtitle(pack)"
        class="pack-item"
        data-testid="custom-pack"
      >
        <template #prepend>
          <ui-icon :name="packIcon(pack)" :size="22" class="pack-item__icon" />
        </template>
        <template #append>
          <ui-tooltip text="Manage entries">
            <ui-button
              variant="ghost"
              size="sm"
              icon
              aria-label="Manage entries"
              class="pack-action"
              data-testid="custom-pack-manage"
              @click="onManage(pack)"
            >
              <ui-icon name="notebook-pen" :size="18" />
            </ui-button>
          </ui-tooltip>
          <ui-tooltip text="Remove dictionary">
            <ui-button
              variant="ghost"
              size="sm"
              icon
              aria-label="Remove dictionary"
              class="pack-action pack-action--remove"
              data-testid="custom-pack-remove"
              @click="onRemove(pack)"
            >
              <ui-icon name="trash-2" :size="18" />
            </ui-button>
          </ui-tooltip>
        </template>
      </ui-list-item>
    </ui-list>

    <div v-else class="custom-packs__empty">
      <ui-icon name="notebook" :size="40" class="custom-packs__empty-icon" />
      <p>You don't have a dictionary of your own yet.</p>
      <p class="custom-packs__empty-hint">
        Create one, start from a spreadsheet, or drag a <code>.tibdict</code> file onto the window.
      </p>
    </div>

    <div class="custom-packs__actions">
      <ui-button variant="outline" size="sm" data-testid="custom-pack-new" @click="onCreate">
        <ui-icon name="plus" :size="16" />
        New dictionary
      </ui-button>
      <ui-button variant="outline" size="sm" data-testid="custom-pack-from-sheet" @click="onCreateFromSpreadsheet">
        <ui-icon name="file-spreadsheet" :size="16" />
        From a spreadsheet…
      </ui-button>
      <ui-button variant="outline" size="sm" data-testid="custom-pack-import" @click="onImportClick">
        <ui-icon name="file-up" :size="16" />
        Import a dictionary…
      </ui-button>
    </div>

    <ImportPreviewDialog
      v-if="importGrid"
      v-model="importOpen"
      :grid="importGrid"
      :pack-id="null"
      @create-requested="onCreateRequested"
    />

    <ui-dialog v-model="createOpen" title="New dictionary" :max-width="460">
      <div class="create-form">
        <ui-text-field
          v-model="newName"
          label="Name"
          :error="createError"
          data-testid="custom-pack-name"
          @keydown.enter.prevent="confirmCreate"
        />
        <ui-text-field
          v-model="newDescription"
          label="Description (optional)"
          multiline
          :rows="2"
          data-testid="custom-pack-description"
        />
      </div>
      <template #actions>
        <ui-button variant="outline" @click="createOpen = false">Cancel</ui-button>
        <ui-button :loading="creating" data-testid="custom-pack-create" @click="confirmCreate">
          Create
        </ui-button>
      </template>
    </ui-dialog>

    <ui-dialog v-model="removeOpen" title="Remove dictionary?" :max-width="520">
      <template v-if="removeTarget">
        <p class="remove-text">
          <strong>{{ removeTarget.manifest.name }}</strong> will be permanently deleted from
          this device. This cannot be undone.
        </p>
        <ui-alert v-if="removeHasLocalEdits" type="warning" class="remove-warning">
          This dictionary has entries you added or edited here, nowhere else. Consider
          exporting it first if you want to keep a copy.
        </ui-alert>
      </template>
      <template #actions>
        <ui-button variant="outline" @click="removeOpen = false">Cancel</ui-button>
        <ui-button variant="danger" :loading="removing" @click="confirmRemove">Remove</ui-button>
      </template>
    </ui-dialog>
  </section>
</template>

<script>
import { open } from '@tauri-apps/plugin-dialog';
import PackManager from '../services/pack-manager';
import TibdictInstaller from '../services/tibdict-installer';
import Lexicon, { messageForError } from '../services/lexicon';
import ImportPreviewDialog from './ImportPreviewDialog.vue';
import { supportsModularPacks } from '../config/platform';
import {
  UiAlert,
  UiButton,
  UiDialog,
  UiIcon,
  UiList,
  UiListItem,
  UiTextField,
  UiTooltip,
} from '../ui';
import { resolveIcon } from '../ui/icons';

export default {
  name: 'CustomPackSection',
  inject: ['snackbar'],
  components: {
    ImportPreviewDialog,
    UiAlert,
    UiButton,
    UiDialog,
    UiIcon,
    UiList,
    UiListItem,
    UiTextField,
    UiTooltip,
  },
  data() {
    return {
      createOpen: false,
      creating: false,
      newName: '',
      newDescription: '',
      createError: '',
      importOpen: false,
      importGrid: null,
      // Rows confirmed in the preview, waiting for the dictionary that will
      // hold them. Empty for a plain "New dictionary".
      pendingRows: [],
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
    // Manifests name an `mdi-*` icon; fall back when there is no Lucide match.
    packIcon(pack) {
      const icon = pack.manifest.icon;
      return icon && resolveIcon(icon) ? icon : 'book-plus';
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
        this.snackbar.open(messageForError(e, 'Could not remove this dictionary.'));
      } finally {
        this.removing = false;
      }
    },
    onManage(pack) {
      this.$router.push(`/glossary/${pack.id}`);
    },
    onCreate() {
      this.newName = '';
      this.newDescription = '';
      this.createError = '';
      this.creating = false;
      this.pendingRows = [];
      this.createOpen = true;
    },
    /** Pick a spreadsheet and preview it before any dictionary exists. */
    async onCreateFromSpreadsheet() {
      const path = await open({
        multiple: false,
        filters: [
          { name: 'Spreadsheets', extensions: ['xlsx', 'xls', 'ods', 'csv', 'tsv'] },
        ],
      });
      if (!path) return;
      try {
        const { readFile } = await import('@tauri-apps/plugin-fs');
        const data = await readFile(path);
        const fileName = String(path).split(/[\\/]/).pop();
        this.importGrid = await Lexicon.readSpreadsheet(Array.from(data), fileName);
        this.importOpen = true;
      } catch (e) {
        console.error('[CustomPackSection] could not read the spreadsheet:', e);
        this.snackbar.open(messageForError(e, 'Could not read this file.'));
      }
    },
    /** The preview was confirmed. Ask for a name, and only then create.
     *
     * Creating up front would leave an empty dictionary behind every time the
     * user backed out of the name dialog. */
    onCreateRequested(rows) {
      this.pendingRows = rows;
      this.importOpen = false;
      this.newName = this.importGrid?.sheetName || '';
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
        let message = `${pack.manifest.name} created`;
        if (this.pendingRows.length) {
          const { inserted } = await Lexicon.applyImport(pack.id, 1, this.pendingRows);
          message = `${pack.manifest.name} created with ${inserted} entries`;
        }
        this.createOpen = false;
        this.pendingRows = [];
        this.importGrid = null;
        this.snackbar.open(message);
        this.$router.push(`/glossary/${pack.id}`);
      } catch (e) {
        console.error('[CustomPackSection] create failed:', e);
        this.createError = messageForError(e, 'Could not create this dictionary.');
      } finally {
        this.creating = false;
      }
    },
  },
};
</script>

<style lang="stylus" scoped>
.custom-packs
  box-sizing border-box
  width 100%
  background var(--surface)
  color var(--ink)
  border 1px solid var(--line)
  border-radius var(--radius-card)
  box-shadow var(--shadow-card)
  font-family var(--font-ui)
  overflow hidden

.custom-packs__header
  display flex
  align-items center
  gap var(--space-3)
  padding var(--space-4) var(--space-5) var(--space-3)

.custom-packs__title
  margin 0
  font-size var(--text-md)
  font-weight 600

.custom-packs__subtitle
  margin 2px 0 0
  font-size var(--text-sm)
  color var(--muted)

.custom-packs__list
  border 0
  border-top 1px solid var(--soft)
  border-bottom 1px solid var(--soft)
  border-radius 0

.pack-item
  :deep(.ui-list-item__row)
    min-height 4rem
    padding var(--space-2) var(--space-3) var(--space-2) var(--space-5)

  :deep(.ui-list-item__title)
    font-weight 600

.pack-item__icon
  color var(--accent)

.pack-action
  color var(--muted)

  &:hover:not(:disabled)
    color var(--ink)
    background var(--soft)

.pack-action--remove:hover:not(:disabled)
  color var(--danger-ink)
  background var(--danger-soft)

.custom-packs__empty
  display flex
  flex-direction column
  align-items center
  gap var(--space-1)
  padding var(--space-5) var(--space-5) var(--space-2)
  text-align center
  font-size var(--text-body)

  p
    margin 0

.custom-packs__empty-icon
  color var(--faint)
  margin-bottom var(--space-2)

.custom-packs__empty-hint
  font-size var(--text-sm)
  color var(--muted)

  code
    padding 0.1em 0.35em
    border-radius var(--radius-xs)
    background var(--soft)
    font-size 0.95em

.custom-packs__actions
  display flex
  flex-wrap wrap
  gap var(--space-2)
  padding var(--space-4) var(--space-5)

.custom-packs__empty + .custom-packs__actions
  justify-content center
  padding-bottom var(--space-5)

.create-form
  display flex
  flex-direction column
  gap var(--space-4)

.remove-text
  margin 0

.remove-warning
  margin-top 14px
</style>
