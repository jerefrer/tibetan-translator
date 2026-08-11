<template>
  <v-dialog :model-value="modelValue" max-width="560" @update:model-value="close">
    <v-card>
      <v-card-title>{{ isEditing ? 'Edit entry' : 'Add an entry' }}</v-card-title>

      <v-card-text>
        <TibetanTextField
          v-model="term"
          label="Tibetan term"
          :error-messages="termError ? [termError] : []"
          hide-details="auto"
          autofocus
        />
        <v-textarea
          v-model="definition"
          label="Definition"
          rows="4"
          auto-grow
          :error-messages="definitionError ? [definitionError] : []"
        />
        <p class="text-caption text-grey mt-2">
          A term already in this dictionary is updated rather than duplicated.
        </p>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close(false)">Cancel</v-btn>
        <v-btn color="primary" variant="tonal" :loading="saving" @click="save">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import TibetanTextField from './TibetanTextField.vue';
import Lexicon, { normalizeTerm } from '../services/lexicon';

export default {
  name: 'LexiconEntryDialog',
  components: { TibetanTextField },
  props: {
    modelValue: { type: Boolean, default: false },
    packId: { type: String, required: true },
    dictionaryId: { type: Number, required: true },
    entry: { type: Object, default: null },
    initialTerm: { type: String, default: '' },
  },
  emits: ['update:modelValue', 'saved'],
  data() {
    return {
      term: '',
      definition: '',
      termError: '',
      definitionError: '',
      saving: false,
    };
  },
  computed: {
    isEditing() {
      return !!(this.entry && this.entry.id);
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
    },
  },
  methods: {
    close(value = false) {
      this.$emit('update:modelValue', value);
    },
    async save() {
      this.termError = normalizeTerm(this.term) ? '' : 'A Tibetan term is required.';
      this.definitionError = this.definition.trim() ? '' : 'A definition is required.';
      if (this.termError || this.definitionError) return;

      this.saving = true;
      try {
        const outcome = await Lexicon.saveEntry(
          this.packId,
          this.dictionaryId,
          this.term,
          this.definition
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
        this.termError = 'Could not save this entry.';
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>
