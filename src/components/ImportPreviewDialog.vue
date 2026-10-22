<template>
  <ui-dialog
    :model-value="modelValue"
    :title="dictionaryName ? `Import into ${dictionaryName}` : 'Import a spreadsheet'"
    :description="grid.sheetName || ''"
    :max-width="720"
    @update:model-value="close"
  >
    <div v-if="step === 'mapping'" data-test="mapping-step" class="import-form">
      <p v-if="termColumn === null" class="import-hint">
        We couldn't tell which column holds the Tibetan. Pick it below.
      </p>
      <ui-select
        v-model="termColumnValue"
        :options="columnOptions"
        label="Tibetan term"
        placeholder="Pick a column"
        data-test="term-column"
      />
      <ui-select
        v-model="definitionColumnValue"
        :options="columnOptions"
        label="Definition"
        placeholder="Pick a column"
        data-test="definition-column"
      />
      <ui-checkbox v-model="hasHeaderRow" label="The first row is a header" />
    </div>

    <div v-else class="import-form">
      <p class="import-recap">{{ recap }}</p>

      <template v-if="diff.modified.length">
        <p class="import-section">
          These already exist. Unchecked ones keep the definition they have.
        </p>
        <div class="modified-list">
          <div
            v-for="entry in diff.modified"
            :key="entry.row"
            class="modified"
            data-test="modified-entry"
          >
            <ui-checkbox
              :model-value="!unchecked.includes(entry.row)"
              data-test="modified-checkbox"
              @update:model-value="toggle(entry.row, $event)"
            />
            <div class="modified-body">
              <div class="tibetan modified-term">{{ entry.term }}</div>
              <div class="modified-was">{{ entry.previousDefinition }}</div>
              <div class="modified-now">{{ entry.definition }}</div>
            </div>
          </div>
        </div>
      </template>

      <p v-if="ignoredColumns.length" class="import-note" data-test="ignored-columns">
        {{ ignoredColumnsSentence }}
      </p>

      <!-- The least important thing in the dialog: a plain collapsed row. -->
      <ui-accordion
        v-if="diff.ignored.length"
        :items="[{ value: 'ignored', title: `${pluralize(diff.ignored.length, 'row', 'rows')} ignored` }]"
        class="import-ignored"
      >
        <template #item-ignored>
          <div v-for="entry in diff.ignored" :key="entry.row" class="ignored-row">
            Row {{ entry.row }} — {{ reasonLabel(entry.reason) }}
          </div>
        </template>
      </ui-accordion>
    </div>

    <template #actions>
      <ui-button v-if="step === 'recap'" variant="ghost" @click="step = 'mapping'">
        Change columns
      </ui-button>
      <div class="ui-spacer" />
      <ui-button variant="outline" @click="close(false)">Cancel</ui-button>
      <ui-button
        v-if="step === 'mapping'"
        :disabled="termColumn === null"
        data-test="continue-mapping"
        @click="step = 'recap'"
      >
        Continue
      </ui-button>
      <ui-button
        v-else
        :loading="importing"
        :disabled="!willWrite"
        data-test="confirm-import"
        @click="confirm"
      >
        Import
      </ui-button>
    </template>
  </ui-dialog>
</template>

<script>
import { detectLayout, diffRows } from '../services/lexicon-import';
import Lexicon, { messageForError } from '../services/lexicon';
import { UiAccordion, UiButton, UiCheckbox, UiDialog, UiSelect } from '../ui';

const REASONS = {
  noTerm: 'no Tibetan in the term column',
  noDefinition: 'no definition',
  duplicate: 'the same term appears further down',
};

export default {
  name: 'ImportPreviewDialog',
  components: { UiAccordion, UiButton, UiCheckbox, UiDialog, UiSelect },
  inject: ['snackbar'],
  props: {
    modelValue: { type: Boolean, default: false },
    grid: { type: Object, default: () => ({ headers: [], rows: [] }) },
    // Null for the "create a dictionary from this file" flow: there is nothing
    // to diff against yet, so every row is new and the parent does the creating.
    packId: { type: String, default: null },
    dictionaryId: { type: Number, default: 1 },
    dictionaryName: { type: String, default: '' },
  },
  emits: ['update:modelValue', 'imported', 'create-requested'],
  data() {
    return {
      step: 'recap',
      hasHeaderRow: false,
      labels: [],
      termColumn: null,
      definitionColumn: null,
      existing: [],
      unchecked: [],
      importing: false,
    };
  },
  computed: {
    // UiSelect only takes non-empty string values, the columns are indexes.
    columnOptions() {
      return this.labels.map((label, index) => ({ label, value: String(index) }));
    },
    termColumnValue: {
      get() {
        return this.termColumn === null ? undefined : String(this.termColumn);
      },
      set(value) {
        this.termColumn = Number(value);
      },
    },
    definitionColumnValue: {
      get() {
        return this.definitionColumn === null ? undefined : String(this.definitionColumn);
      },
      set(value) {
        this.definitionColumn = Number(value);
      },
    },
    dataRows() {
      const rows = this.grid.rows || [];
      return this.hasHeaderRow ? rows.slice(1) : rows;
    },
    diff() {
      if (this.termColumn === null) {
        return { created: [], modified: [], unchangedCount: 0, ignored: [] };
      }
      return diffRows(
        this.dataRows,
        { termColumn: this.termColumn, definitionColumn: this.definitionColumn },
        this.existing
      );
    },
    recap() {
      const { created, modified, unchangedCount, ignored } = this.diff;
      const parts = [`${created.length} new`];
      // Nothing can be modified when there is no dictionary yet, so saying
      // "0 modified" there would report on something that cannot happen.
      if (this.packId) parts.push(`${modified.length} modified`);
      if (unchangedCount) parts.push(`${unchangedCount} unchanged`);
      if (ignored.length) parts.push(`${this.pluralize(ignored.length, 'row', 'rows')} ignored`);
      return parts.join(' · ');
    },
    ignoredColumns() {
      return this.labels.filter(
        (_, column) => column !== this.termColumn && column !== this.definitionColumn
      );
    },
    ignoredColumnsSentence() {
      const names = this.ignoredColumns.map((label) => `“${label}”`).join(', ');
      return this.ignoredColumns.length === 1
        ? `Column ${names} will be ignored.`
        : `Columns ${names} will be ignored.`;
    },
    retained() {
      return [
        ...this.diff.created,
        ...this.diff.modified.filter((entry) => !this.unchecked.includes(entry.row)),
      ];
    },
    willWrite() {
      return this.retained.length > 0;
    },
  },
  watch: {
    modelValue: { immediate: true, handler(open) { if (open) this.prepare(); } },
    grid() { if (this.modelValue) this.prepare(); },
  },
  methods: {
    async prepare() {
      const layout = detectLayout(this.grid);
      this.hasHeaderRow = layout.hasHeaderRow;
      this.labels = layout.labels;
      this.termColumn = layout.termColumn;
      this.definitionColumn = layout.definitionColumn;
      this.unchecked = [];
      this.importing = false;
      this.existing = [];

      if (this.packId) {
        try {
          // The diff needs the whole dictionary, not a page of it: a term
          // missed here would be classified as new and overwrite on save.
          const page = await Lexicon.entries(this.packId, this.dictionaryId, {
            limit: 1000000,
          });
          this.existing = page.entries || [];
        } catch (e) {
          console.error('[ImportPreviewDialog] could not read the dictionary:', e);
          this.snackbar.open(messageForError(e, 'Could not read this dictionary.'));
        }
      }

      this.step = this.termColumn === null ? 'mapping' : 'recap';
    },
    pluralize(count, one, many) {
      return `${count} ${count === 1 ? one : many}`;
    },
    reasonLabel(reason) {
      return REASONS[reason] || reason;
    },
    toggle(row, checked) {
      this.unchecked = checked
        ? this.unchecked.filter((value) => value !== row)
        : [...this.unchecked, row];
    },
    close(value = false) {
      this.$emit('update:modelValue', value);
    },
    async confirm() {
      // Without a pack there is nothing to write into yet — the parent creates
      // the dictionary and applies the rows, so cancelling here leaves nothing
      // behind.
      if (!this.packId) {
        this.$emit('create-requested', this.retained);
        return;
      }
      this.importing = true;
      try {
        const outcome = await Lexicon.applyImport(
          this.packId,
          this.dictionaryId,
          this.retained
        );
        this.$emit('imported', outcome);
        this.close(false);
      } catch (e) {
        console.error('[ImportPreviewDialog] import failed:', e);
        this.snackbar.open(messageForError(e, 'Could not import this file.'));
      } finally {
        this.importing = false;
      }
    },
  },
};
</script>

<style lang="stylus" scoped>
.import-form
  display flex
  flex-direction column
  gap 16px

.import-recap
  margin 0
  font-size var(--text-md)
  font-weight 600

.import-hint, .import-section, .import-note
  margin 0
  font-size var(--text-base)
  color var(--muted)

.import-form > .import-section
  margin-bottom -8px

.modified-list
  border 1px solid var(--line)
  border-radius var(--radius-xl)
  overflow hidden

.modified
  display flex
  align-items flex-start
  gap 12px
  padding 10px 16px

  & + .modified
    border-top 1px solid var(--soft)

  .ui-checkbox
    margin-top 10px

.modified-body
  min-width 0

.modified-term
  font-family var(--font-tibetan)
  font-size var(--text-tibetan-sm)
  line-height 1.7
  color var(--rubric)

.modified-was
  font-family var(--font-serif)
  color var(--muted)
  text-decoration line-through
  white-space pre-wrap

.modified-now
  font-family var(--font-serif)
  font-weight 600
  white-space pre-wrap

.ignored-row
  font-size var(--text-base)
  color var(--muted)
</style>
