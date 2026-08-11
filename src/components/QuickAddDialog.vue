<template>
  <v-dialog :model-value="modelValue" max-width="560" @update:model-value="close">
    <v-card>
      <v-card-item>
        <v-card-title>{{ targets.length ? 'Add my definition' : 'Create a dictionary' }}</v-card-title>
        <!-- With a single dictionary the picker below is hidden, so this is the
             only thing that says where the definition is about to go. -->
        <v-card-subtitle v-if="targets.length === 1">
          Saving to {{ selectedTarget.name }}
        </v-card-subtitle>
      </v-card-item>

      <v-card-text class="quick-add-form">
        <template v-if="targets.length">
          <v-select
            v-if="targets.length > 1"
            v-model="targetKey"
            :items="targets"
            item-title="name"
            item-value="key"
            label="Add to"
            variant="outlined"
            color="primary"
            density="comfortable"
            hide-details
          />
          <TibetanTextField
            v-model="localTerm"
            label="Tibetan term"
            variant="outlined"
            color="primary"
            density="comfortable"
            :error-messages="termError ? [termError] : []"
            hide-details="auto"
          />
          <v-textarea
            v-model="definition"
            label="My definition"
            variant="outlined"
            color="primary"
            density="comfortable"
            rows="4"
            auto-grow
            autofocus
            hide-details="auto"
            :error-messages="error ? [error] : []"
          />
          <v-alert
            v-if="existingId"
            type="info"
            variant="tonal"
            density="compact"
          >
            This term is already in {{ selectedTarget.name }} — saving will
            replace the definition shown above.
          </v-alert>
        </template>

        <template v-else>
          <p>
            You don't have a personal dictionary yet. Name one to start
            collecting your own definitions.
          </p>
          <v-text-field
            v-model="newLexiconName"
            label="Dictionary name"
            variant="outlined"
            color="primary"
            density="comfortable"
            hide-details="auto"
            autofocus
          />
        </template>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close(false)">Cancel</v-btn>
        <!-- Solid, not tonal: tonal over this theme's deep red (#A30000) reads
             as a warning rather than as the action the dialog is here for. -->
        <v-btn
          v-if="targets.length"
          color="primary"
          variant="flat"
          :loading="saving"
          @click="save"
        >
          Save
        </v-btn>
        <v-btn v-else color="primary" variant="flat" :loading="saving" @click="createThenSave">
          Create
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import _ from 'underscore';
import TibetanTextField from './TibetanTextField.vue';
import Lexicon, { normalizeTerm, messageForError } from '../services/lexicon';
import Storage from '../services/storage';

export default {
  name: 'QuickAddDialog',
  components: { TibetanTextField },
  inject: ['snackbar'],
  props: {
    modelValue: { type: Boolean, default: false },
    term: { type: String, default: '' },
  },
  emits: ['update:modelValue', 'saved'],
  data() {
    return {
      localTerm: '',
      definition: '',
      targetKey: null,
      newLexiconName: '',
      existingId: null,
      error: '',
      termError: '',
      saving: false,
      // Assigned in created() so the watcher below always resolves to the
      // debounced call, even on the very first reactive update — same
      // pattern as LexiconPage.vue's onSearchInput.
      onLocalTermInput: null,
    };
  },
  computed: {
    targets() {
      return Lexicon.editableDictionaries().map((dictionary) => ({
        ...dictionary,
        key: `${dictionary.packId}:${dictionary.dictionaryId}`,
      }));
    },
    selectedTarget() {
      return this.targets.find((target) => target.key === this.targetKey) || this.targets[0] || null;
    },
  },
  watch: {
    modelValue(open) {
      if (!open) return;
      this.localTerm = this.term || '';
      this.definition = '';
      this.error = '';
      this.termError = '';
      this.newLexiconName = '';
      this.existingId = null;
      this.saving = false;

      const remembered = Storage.get('lastLexiconTarget');
      const known = this.targets.some((target) => target.key === remembered);
      this.targetKey = known ? remembered : this.targets[0]?.key || null;
      this.loadExisting();
    },
    targetKey() {
      this.loadExisting();
    },
    // The existence check must not go stale while the user edits the term:
    // loadExisting() previously only ran on dialog open and on a target
    // change, so retyping the term over an existing one never re-checked,
    // and saveEntry's upsert-by-term then silently overwrote whatever
    // already lived under the new term with no warning shown. Debounced
    // (not immediate) so it doesn't fire an exact-match lookup on every
    // keystroke/Wylie-conversion tick — same 250ms window LexiconPage.vue
    // uses for its own search-as-you-type lookup.
    localTerm() {
      this.onLocalTermInput();
    },
  },
  created() {
    this.onLocalTermInput = _.debounce(() => {
      this.loadExisting();
    }, 250);
  },
  methods: {
    close(value = false) {
      this.$emit('update:modelValue', value);
    },
    /** Pre-fill the definition when this term is already in the target dictionary.
     *
     * Uses an exact-match lookup (Lexicon.findEntry), not the paginated
     * substring search behind Lexicon.entries(): in a large dictionary, 50+
     * entries whose term OR definition merely contain this term as a
     * substring can sort ahead of the actual exact match and push it off
     * the page, silently reporting "not found" for a term that does exist —
     * whatever the user then types would overwrite it on save with no
     * warning shown. */
    async loadExisting() {
      this.existingId = null;
      const target = this.selectedTarget;
      const term = normalizeTerm(this.localTerm);
      if (!target || !term) return;
      try {
        const match = await Lexicon.findEntry(target.packId, target.dictionaryId, this.localTerm);
        if (match) {
          this.existingId = match.id;
          if (!this.definition) this.definition = match.definition;
        }
      } catch (e) {
        console.error('[QuickAddDialog] lookup failed:', e);
      }
    },
    async save() {
      const target = this.selectedTarget;
      if (!target) return;
      this.error = '';
      this.termError = '';
      if (!this.definition.trim()) {
        this.error = 'A definition is required.';
        return;
      }
      // loadExisting() is debounced 250ms behind localTerm (see the watcher
      // above). If the user edits the term and clicks Save inside that
      // window, existingId is stale and saveEntry's upsert-by-term would
      // silently overwrite an existing definition with no warning shown.
      // Cancel the pending debounced call and run the check synchronously
      // so existingId (and the "already in X" caption) reflect the current
      // term before the upsert. This runs AFTER the definition-required
      // guard, not before: loadExisting() has a side effect of filling in
      // this.definition when it's empty (to pre-load an existing
      // definition for editing), and running it before that guard would let
      // it silently populate the field and mask a real "definition is
      // required" validation failure.
      this.onLocalTermInput.cancel();
      await this.loadExisting();
      this.saving = true;
      try {
        const outcome = await Lexicon.saveEntry(
          target.packId,
          target.dictionaryId,
          this.localTerm,
          this.definition
        );
        if (!outcome) {
          this.termError = 'A Tibetan term is required.';
          return;
        }
        Storage.set('lastLexiconTarget', target.key);
        this.snackbar.open(outcome.created ? 'Added to your dictionary' : 'Your definition was updated');
        this.$emit('saved', outcome);
        this.close(false);
      } catch (e) {
        console.error('[QuickAddDialog] save failed:', e);
        this.error = messageForError(e, 'Could not save this entry.');
      } finally {
        this.saving = false;
      }
    },
    async createThenSave() {
      const name = this.newLexiconName.trim();
      if (!name) return;
      this.saving = true;
      try {
        const pack = await Lexicon.create(name);
        this.targetKey = `${pack.id}:1`;
        this.snackbar.open(`${pack.manifest.name} created`);
      } catch (e) {
        console.error('[QuickAddDialog] create failed:', e);
        this.snackbar.open(messageForError(e, 'Could not create this dictionary.'));
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>

<style lang="stylus" scoped>
// v-card-item already sets the gap under the title, so the extra padding-top
// this used to carry only widened the void the outlined fields now close.
.quick-add-form
  display flex
  flex-direction column
  gap 16px
</style>
