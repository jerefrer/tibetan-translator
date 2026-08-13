<template>
  <v-dialog :model-value="modelValue" max-width="720" @update:model-value="close">
    <v-card>
      <v-card-item>
        <v-card-title>{{ dictionaryName ? `Import into ${dictionaryName}` : 'Import a spreadsheet' }}</v-card-title>
        <v-card-subtitle>{{ grid.sheetName }}</v-card-subtitle>
      </v-card-item>

      <v-card-text v-if="step === 'mapping'" data-test="mapping-step" class="import-form">
        <p v-if="termColumn === null" class="import-hint">
          We couldn't tell which column holds the Tibetan. Pick it below.
        </p>
        <v-select
          v-model="termColumn"
          :items="columnItems"
          label="Tibetan term"
          variant="outlined"
          color="primary"
          density="comfortable"
          hide-details
        />
        <v-select
          v-model="definitionColumn"
          :items="columnItems"
          label="Definition"
          variant="outlined"
          color="primary"
          density="comfortable"
          hide-details
        />
        <v-checkbox
          v-model="hasHeaderRow"
          color="primary"
          label="The first row is a header"
          hide-details
        />
      </v-card-text>

      <v-card-text v-else class="import-form">
        <p class="import-recap">{{ recap }}</p>

        <template v-if="diff.modified.length">
          <p class="import-section">
            These already exist. Unchecked ones keep the definition they have.
          </p>
          <div
            v-for="entry in diff.modified"
            :key="entry.row"
            class="modified"
            data-test="modified-entry"
          >
            <v-checkbox
              :model-value="!unchecked.includes(entry.row)"
              color="primary"
              density="compact"
              hide-details
              data-test="modified-checkbox"
              @update:model-value="toggle(entry.row, $event)"
            />
            <div class="modified-body">
              <div class="tibetan modified-term">{{ entry.term }}</div>
              <div class="modified-was">{{ entry.previousDefinition }}</div>
              <div class="modified-now">{{ entry.definition }}</div>
            </div>
          </div>
        </template>

        <p v-if="ignoredColumns.length" class="import-note" data-test="ignored-columns">
          {{ ignoredColumnsSentence }}
        </p>

        <!-- Flat: this is the least important thing in the dialog, and the
             default elevated panel outweighed the diff above it. -->
        <v-expansion-panels
          v-if="diff.ignored.length"
          variant="accordion"
          flat
          class="import-ignored"
        >
          <v-expansion-panel>
            <v-expansion-panel-title>
              {{ pluralize(diff.ignored.length, 'row', 'rows') }} ignored
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <div v-for="entry in diff.ignored" :key="entry.row" class="ignored-row">
                Row {{ entry.row }} — {{ reasonLabel(entry.reason) }}
              </div>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-card-text>

      <v-card-actions>
        <v-btn v-if="step === 'recap'" variant="text" @click="step = 'mapping'">
          Change columns
        </v-btn>
        <v-spacer />
        <v-btn variant="text" @click="close(false)">Cancel</v-btn>
        <v-btn
          v-if="step === 'mapping'"
          color="primary"
          variant="flat"
          :disabled="termColumn === null"
          data-test="continue-mapping"
          @click="step = 'recap'"
        >
          Continue
        </v-btn>
        <v-btn
          v-else
          color="primary"
          variant="flat"
          :loading="importing"
          :disabled="!willWrite"
          data-test="confirm-import"
          @click="confirm"
        >
          Import
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { detectLayout, diffRows } from '../services/lexicon-import';
import Lexicon, { messageForError } from '../services/lexicon';

const REASONS = {
  noTerm: 'no Tibetan in the term column',
  noDefinition: 'no definition',
  duplicate: 'the same term appears further down',
};

export default {
  name: 'ImportPreviewDialog',
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
    columnItems() {
      return this.labels.map((title, value) => ({ title, value }));
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
  font-size 1.0625rem
  font-weight 500

.import-hint, .import-section, .import-note
  font-size 0.875rem
  opacity 0.75
  margin 0

.import-form > .import-section
  margin-bottom -8px

.modified
  display flex
  align-items flex-start
  gap 4px

.modified-body
  padding-top 6px
  min-width 0

.modified-term
  font-size 1.0625rem

.modified-was
  opacity 0.6
  text-decoration line-through

.modified-now
  font-weight 500

.ignored-row
  font-size 0.875rem
  opacity 0.75
</style>
