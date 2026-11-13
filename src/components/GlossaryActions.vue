<template>
  <div class="glossary-actions" data-testid="glossary-actions">
    <!-- No glossary yet: the three ways to start one -->
    <div v-if="showEmpty" class="glossary-actions__empty" data-testid="glossary-empty">
      <ui-icon name="notebook-pen" :size="36" class="glossary-actions__empty-icon" />
      <h2 class="glossary-actions__empty-title">You don't have a glossary yet</h2>
      <p class="glossary-actions__empty-text">
        Write your own definitions, start from a spreadsheet, or add a
        <code>.tibdict</code> file someone shared. Its entries are searched along
        with every dictionary.
      </p>
      <div class="glossary-actions__buttons">
        <ui-button data-testid="custom-pack-new" @click="onCreate">
          <ui-icon name="plus" :size="16" />
          New glossary
        </ui-button>
        <ui-button variant="outline" data-testid="custom-pack-from-sheet" @click="onCreateFromSpreadsheet">
          <ui-icon name="file-spreadsheet" :size="16" />
          From a spreadsheet…
        </ui-button>
        <ui-button variant="outline" data-testid="custom-pack-import" @click="onImportClick">
          <ui-icon name="file-up" :size="16" />
          Add a .tibdict file…
        </ui-button>
      </div>
    </div>

    <spreadsheet-drop-dialog
      v-model="chooserOpen"
      title="New glossary from a spreadsheet"
      @path="previewPath"
      @file="previewFile"
    />

    <ImportPreviewDialog
      v-if="importGrid"
      v-model="importOpen"
      :grid="importGrid"
      :pack-id="null"
      @create-requested="onCreateRequested"
    />

    <ui-dialog v-model="createOpen" title="New glossary" :max-width="460">
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
          <ui-icon name="plus" :size="16" />
          Create
        </ui-button>
      </template>
    </ui-dialog>

    <ui-dialog v-model="removeOpen" title="Remove glossary?" :max-width="520">
      <template v-if="removeTarget">
        <p class="remove-text">
          <strong>{{ removeTarget.manifest.name }}</strong> will be permanently deleted from
          this device. This cannot be undone.
        </p>
        <ui-alert v-if="removeHasLocalEdits" type="warning" class="remove-warning">
          This glossary has entries you added or edited here, nowhere else. Consider
          exporting it first if you want to keep a copy.
        </ui-alert>
      </template>
      <template #actions>
        <ui-button variant="outline" @click="removeOpen = false">Cancel</ui-button>
        <ui-button variant="danger" :loading="removing" data-testid="custom-pack-confirm-remove" @click="confirmRemove"><ui-icon name="trash-2" :size="16" />Remove</ui-button>
      </template>
    </ui-dialog>
  </div>
</template>

<script>
import { open } from '@tauri-apps/plugin-dialog';
import PackManager from '../services/pack-manager';
import TibdictInstaller from '../services/tibdict-installer';
import Lexicon, { messageForError } from '../services/lexicon';
import ImportPreviewDialog from './ImportPreviewDialog.vue';
import SpreadsheetDropDialog from './SpreadsheetDropDialog.vue';
import { UiAlert, UiButton, UiDialog, UiIcon, UiTextField } from '../ui';

// What can be done to the user's glossaries as a whole, for My glossary's
// title menu (LexiconPage): create one (empty, or from a spreadsheet), add a
// .tibdict file, remove one after confirmation. Holds the dialogs; with
// `showEmpty` it also shows the page's empty state, the three ways to start.
// Methods: onCreate(), onCreateFromSpreadsheet(), onImportClick(), onRemove(pack).
export default {
  name: 'GlossaryActions',
  inject: ['snackbar'],
  components: {
    ImportPreviewDialog,
    SpreadsheetDropDialog,
    UiAlert,
    UiButton,
    UiDialog,
    UiIcon,
    UiTextField,
  },
  props: {
    showEmpty: { type: Boolean, default: false },
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
      // The dialog to drop or choose the spreadsheet in
      chooserOpen: false,
      // Rows confirmed in the preview, waiting for the dictionary that will
      // hold them. Empty for a plain "New dictionary".
      pendingRows: [],
      removeOpen: false,
      removing: false,
      removeTarget: null,
    };
  },
  computed: {
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
        console.error('[GlossaryActions] import failed:', e);
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
        console.error('[GlossaryActions] remove failed:', e);
        this.snackbar.open(messageForError(e, 'Could not remove this glossary.'));
      } finally {
        this.removing = false;
      }
    },
    onCreate() {
      this.newName = '';
      this.newDescription = '';
      this.createError = '';
      this.creating = false;
      this.pendingRows = [];
      this.createOpen = true;
    },
    /** The spreadsheet is dropped or chosen in a dialog, then previewed,
     * before any glossary exists. */
    onCreateFromSpreadsheet() {
      this.chooserOpen = true;
    },
    async previewPath(path) {
      await this.preview(async () => {
        const { readFile } = await import('@tauri-apps/plugin-fs');
        return { bytes: await readFile(path), name: String(path).split(/[\\/]/).pop() };
      });
    },
    async previewFile(file) {
      await this.preview(async () => ({ bytes: new Uint8Array(await file.arrayBuffer()), name: file.name }));
    },
    async preview(read) {
      try {
        const { bytes, name } = await read();
        this.importGrid = await Lexicon.readSpreadsheet(Array.from(bytes), name);
        this.importOpen = true;
      } catch (e) {
        console.error('[GlossaryActions] could not read the spreadsheet:', e);
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
        console.error('[GlossaryActions] create failed:', e);
        this.createError = messageForError(e, 'Could not create this glossary.');
      } finally {
        this.creating = false;
      }
    },
  },
};
</script>

<style lang="stylus" scoped>
.glossary-actions__empty
  display flex
  flex-direction column
  align-items center
  gap var(--space-2)
  max-width 30rem
  margin var(--space-8) auto 0
  padding var(--space-6)
  text-align center
  font-family var(--font-ui)
  color var(--ink)

.glossary-actions__empty-icon
  color var(--faint)

.glossary-actions__empty-title
  margin var(--space-2) 0 0
  font-size var(--text-title)
  font-weight 600

.glossary-actions__empty-text
  margin 0
  font-size var(--text-base)
  line-height 1.55
  color var(--muted)

  code
    padding 0.1em 0.35em
    border-radius var(--radius-xs)
    background var(--soft)
    font-size 0.95em

.glossary-actions__buttons
  display flex
  flex-wrap wrap
  justify-content center
  gap var(--space-2)
  margin-top var(--space-3)

.create-form
  display flex
  flex-direction column
  gap var(--space-4)

.remove-text
  margin 0

.remove-warning
  margin-top 14px
</style>
