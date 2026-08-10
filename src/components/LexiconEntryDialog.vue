<template>
  <v-dialog :model-value="modelValue" max-width="560" @update:model-value="close">
    <v-card>
      <v-card-title>{{ isEditing ? 'Edit entry' : 'Add an entry' }}</v-card-title>

      <v-card-text>
        <TibetanTextField
          v-model="term"
          label="Tibetan term"
          :error-messages="termError ? [termError] : []"
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
