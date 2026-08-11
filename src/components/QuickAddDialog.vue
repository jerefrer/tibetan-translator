<template>
  <v-dialog :model-value="modelValue" max-width="560" @update:model-value="close">
    <v-card>
      <v-card-title>Add my definition</v-card-title>

      <v-card-text>
        <template v-if="targets.length">
          <v-select
            v-if="targets.length > 1"
            v-model="targetKey"
            :items="targets"
            item-title="name"
            item-value="key"
            label="Add to"
            density="comfortable"
            class="mb-2"
          />
          <TibetanTextField v-model="localTerm" label="Tibetan term" />
          <v-textarea
            v-model="definition"
            label="My definition"
            rows="4"
            auto-grow
            autofocus
            :error-messages="error ? [error] : []"
          />
          <p v-if="existingId" class="text-caption text-grey">
            This term is already in {{ selectedTarget.name }} — saving will update it.
          </p>
        </template>

        <template v-else>
          <p class="mb-3">
            You don't have a personal dictionary yet. Create one to start collecting
            your own definitions.
          </p>
          <v-text-field
            v-model="newLexiconName"
            label="Name of the new dictionary"
            density="comfortable"
            autofocus
          />
        </template>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close(false)">Cancel</v-btn>
        <v-btn
          v-if="targets.length"
          color="primary"
          variant="tonal"
          :loading="saving"
          @click="save"
        >
          Save
        </v-btn>
        <v-btn v-else color="primary" variant="tonal" :loading="saving" @click="createThenSave">
          Create
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import TibetanTextField from './TibetanTextField.vue';
import Lexicon, { normalizeTerm } from '../services/lexicon';
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
      saving: false,
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
  },
  methods: {
    close(value = false) {
      this.$emit('update:modelValue', value);
    },
    /** Pre-fill the definition when this term is already in the target dictionary. */
    async loadExisting() {
      this.existingId = null;
      const target = this.selectedTarget;
      const term = normalizeTerm(this.localTerm);
      if (!target || !term) return;
      try {
        const page = await Lexicon.entries(target.packId, target.dictionaryId, {
          search: term,
          limit: 50,
          offset: 0,
        });
        const match = page.entries.find((entry) => entry.term === term);
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
      if (!this.definition.trim()) {
        this.error = 'A definition is required.';
        return;
      }
      this.saving = true;
      try {
        const outcome = await Lexicon.saveEntry(
          target.packId,
          target.dictionaryId,
          this.localTerm,
          this.definition
        );
        if (!outcome) {
          this.error = 'A Tibetan term is required.';
          return;
        }
        Storage.set('lastLexiconTarget', target.key);
        this.snackbar.open(outcome.created ? 'Added to your dictionary' : 'Your definition was updated');
        this.$emit('saved', outcome);
        this.close(false);
      } catch (e) {
        console.error('[QuickAddDialog] save failed:', e);
        this.error = 'Could not save this entry.';
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
        this.snackbar.open('Could not create this dictionary.');
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>
