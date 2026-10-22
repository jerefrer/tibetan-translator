<template>
  <!-- One dialog, two states. Stacking a second dialog on top of this one
       leaves the form's buttons peeking out below the decision, which reads
       as an accident rather than a deliberate step. -->
  <ui-dialog
    :model-value="modelValue"
    :title="dialogTitle"
    :persistent="conflictOpen"
    :max-width="560"
    @update:model-value="close"
  >
    <div v-if="conflictOpen && existing" class="collision" data-testid="entry-conflict">
      <p class="tibetan collision-term">{{ existing.term }}</p>

      <div class="collision-block">
        <div class="collision-label">Already saved</div>
        <div class="collision-text">{{ existing.definition }}</div>
      </div>

      <div class="collision-block">
        <div class="collision-label">What you just wrote</div>
        <div class="collision-text">{{ definition }}</div>
      </div>
    </div>

    <div v-else class="entry-form" data-testid="entry-form">
      <ui-tibetan-field
        v-model="term"
        label="Tibetan term"
        :error="termError"
        enterkeyhint="next"
        data-testid="entry-term"
        @update:model-value="onTermInput"
      />
      <ui-text-field
        v-model="definition"
        label="Definition"
        multiline
        :rows="4"
        :error="definitionError"
        class="entry-definition"
        data-testid="entry-definition"
      />

      <ui-alert v-if="existing" type="info" data-testid="entry-collision-notice">
        This term is already in this dictionary. You'll be asked what to do
        with the existing definition when you save.
      </ui-alert>
    </div>

    <template #actions>
      <template v-if="conflictOpen && existing">
        <ui-button variant="ghost" @click="conflictOpen = false">Back</ui-button>
        <div class="ui-spacer" />
        <!-- Keeping both is the recoverable choice, so it carries the visual
             weight; replacing discards the user's earlier work and is offered
             without encouragement. -->
        <ui-button
          variant="outline"
          class="replace-button"
          :loading="saving"
          @click="resolveConflict('replace')"
        >
          Replace it
        </ui-button>
        <ui-button :loading="saving" @click="resolveConflict('merge')">Keep both</ui-button>
      </template>
      <template v-else>
        <ui-button
          v-if="deletable && isEditing"
          variant="ghost"
          class="delete-button"
          data-testid="entry-delete"
          @click="requestDelete"
        >
          <ui-icon name="trash-2" :size="18" />
          Delete
        </ui-button>
        <div class="ui-spacer" />
        <ui-button variant="outline" @click="close(false)">Cancel</ui-button>
        <ui-button :loading="saving" data-testid="entry-save" @click="save">Save</ui-button>
      </template>
    </template>
  </ui-dialog>
</template>

<script>
import _ from 'underscore';
import { UiAlert, UiButton, UiDialog, UiIcon, UiTextField, UiTibetanField } from '../ui';
import Lexicon, { normalizeTerm, messageForError } from '../services/lexicon';

export default {
  name: 'LexiconEntryDialog',
  components: { UiAlert, UiButton, UiDialog, UiIcon, UiTextField, UiTibetanField },
  props: {
    modelValue: { type: Boolean, default: false },
    packId: { type: String, required: true },
    dictionaryId: { type: Number, required: true },
    entry: { type: Object, default: null },
    initialTerm: { type: String, default: '' },
    // Offer a Delete button when editing. On a phone the list has no per-row
    // delete button, so this is the only way to remove an entry there.
    deletable: { type: Boolean, default: false },
  },
  emits: ['update:modelValue', 'saved', 'delete'],
  data() {
    return {
      term: '',
      definition: '',
      termError: '',
      definitionError: '',
      saving: false,
      /** A different entry already using the typed term, or null. */
      existing: null,
      conflictOpen: false,
      onTermInput: () => {},
    };
  },
  computed: {
    isEditing() {
      return !!(this.entry && this.entry.id);
    },
    dialogTitle() {
      if (this.conflictOpen && this.existing) return 'This term already exists';
      return this.isEditing ? 'Edit entry' : 'Add an entry';
    },
  },
  watch: {
    modelValue(open) {
      if (!open) return;
      this.term = this.entry?.term || this.initialTerm || '';
      this.definition = this.entry?.definition || '';
      this.termError = '';
      this.definitionError = '';
      this.saving = false;
      this.existing = null;
      this.conflictOpen = false;
      this.checkExisting();
    },
  },
  created() {
    this.onTermInput = _.debounce(() => this.checkExisting(), 250);
  },
  methods: {
    close(value = false) {
      this.$emit('update:modelValue', value);
    },
    /** Hand the entry to the parent, which asks for confirmation. */
    requestDelete() {
      this.$emit('delete', this.entry);
      this.close(false);
    },
    /**
     * Look up the typed term by exact match, so the user is told BEFORE saving
     * that they are about to write over something. The entry being edited is
     * not a collision with itself.
     */
    async checkExisting() {
      if (!normalizeTerm(this.term)) {
        this.existing = null;
        return;
      }
      try {
        const found = await Lexicon.findEntry(this.packId, this.dictionaryId, this.term);
        this.existing = found && found.id !== this.entry?.id ? found : null;
      } catch (e) {
        console.error('[LexiconEntryDialog] existence check failed:', e);
        this.existing = null;
      }
    },
    /** Apply the user's choice from the collision dialog. */
    resolveConflict(mode) {
      const merged = `${this.existing.definition}\n${this.definition}`;
      this.conflictOpen = false;
      this.commit(mode === 'merge' ? merged : this.definition);
    },
    async save() {
      this.termError = normalizeTerm(this.term) ? '' : 'A Tibetan term is required.';
      this.definitionError = this.definition.trim() ? '' : 'A definition is required.';
      if (this.termError || this.definitionError) return;

      // The debounced check may still be pending, and saving on a stale result
      // is exactly the silent overwrite this dialog exists to prevent.
      this.onTermInput.cancel();
      await this.checkExisting();
      if (this.existing) {
        this.conflictOpen = true;
        return;
      }

      await this.commit(this.definition);
    },
    async commit(definitionToSave) {
      this.saving = true;
      try {
        const outcome = await Lexicon.saveEntry(
          this.packId,
          this.dictionaryId,
          this.term,
          definitionToSave
        );
        if (!outcome) {
          this.termError = 'Could not save this entry.';
          return;
        }

        // lexicon_upsert_entry resolves purely by (dictionaryId, term), so
        // editing the term doesn't rename this row — it makes the upsert
        // above write a DIFFERENT one (outcome.id !== this.entry.id): either
        // a freshly inserted row, or a pre-existing row that already used
        // the new term. Either way the original row under the old term is
        // now a stale duplicate unless it's removed here. This also fires
        // with no visible term edit at all when the stored term and its
        // normalized form differ (e.g. entries imported from the Anki
        // pipeline keep a trailing shad, which tibetanLookupKey rewrites to
        // a tsheg) — pressing Save with no changes still normalizes the
        // term and lands on a different row.
        //
        // The upsert runs FIRST and the delete SECOND, never the reverse:
        // that ordering's only failure mode is an error surfaced to the user
        // with a transient duplicate they can retry away — the new
        // definition is always safely written before anything old is
        // touched. Deleting first would risk the opposite and strictly
        // worse outcome: if the write after the delete then failed, the
        // entry would be gone entirely, an unrecoverable loss of the user's
        // data instead of a recoverable duplicate.
        if (this.isEditing && outcome.id !== this.entry.id) {
          try {
            await Lexicon.deleteEntry(this.packId, this.entry.id);
          } catch (e) {
            console.error('[LexiconEntryDialog] cleanup of the renamed entry failed:', e);
            // Do NOT report success here: the new definition is safely
            // saved, but the old row under the previous term is still
            // present, so telling the user "saved" would hide a duplicate
            // that only looks like data loss the next time they see the
            // entry appear twice. Refresh the list (so the duplicate is at
            // least visible) but keep the dialog open with an explicit
            // error instead of closing it.
            this.$emit('saved', outcome);
            this.termError =
              'Saved, but the previous version of this entry could not be removed — you may see it twice.';
            return;
          }
        }

        this.$emit('saved', outcome);
        this.close(false);
      } catch (e) {
        console.error('[LexiconEntryDialog] save failed:', e);
        this.termError = messageForError(e, 'Could not save this entry.');
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>

<style lang="stylus" scoped>
.entry-form
  display flex
  flex-direction column
  gap 16px

.collision-term
  margin 0 0 4px
  font-family var(--font-tibetan)
  font-size var(--text-tibetan-lg)
  line-height 1.7
  color var(--rubric)

.collision-block
  & + .collision-block
    margin-top 14px

  .collision-label
    font-size var(--text-xs)
    font-weight 600
    letter-spacing 0.08em
    text-transform uppercase
    color var(--muted)
    margin-bottom 2px

  .collision-text
    font-family var(--font-serif)
    font-size var(--text-md)
    white-space pre-wrap
    line-height 1.5

.replace-button
  color var(--danger-ink)

.delete-button
  color var(--danger-ink)
  padding-left 8px

  &:hover:not(:disabled)
    background var(--danger-soft)
</style>
