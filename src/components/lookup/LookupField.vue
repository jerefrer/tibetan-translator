<script>
import { tibetanRuns } from '../../services/glosses';
import { UiTibetanField } from '../../ui';

// Lookup's field: Define's Tibetan field, unchanged (Wylie converted on
// space, tsheg, Enter, paste and drop; legacy fonts repaired; a second tsheg
// refused), with the "typed …" echo and how the input was read under it.
export default {
  name: 'LookupField',
  components: { UiTibetanField },
  props: {
    modelValue: { type: String, default: '' },
    typedWylie: { type: String, default: '' },
    // How the input was read, e.g. "Wylie bcom → བཅོམ་ · 5 terms"
    readAs: { type: String, default: '' },
  },
  emits: ['update:modelValue', 'keydown', 'clear'],
  methods: {
    tibetanRuns,
    focus() {
      this.$refs.input?.focus();
    },
  },
};
</script>

<template>
  <div class="lookup-field">
    <ui-tibetan-field
      ref="input"
      :model-value="modelValue"
      class="lookup-field__input"
      prepend-icon="search"
      placeholder="Type Tibetan or Wylie"
      aria-label="Term to look up"
      enterkeyhint="search"
      autofocus
      clearable
      data-testid="lookup-field"
      @update:model-value="$emit('update:modelValue', $event)"
      @keydown="$emit('keydown', $event)"
      @clear="$emit('clear')"
    />

    <div v-if="typedWylie || readAs" class="lookup-field__under">
      <span v-if="typedWylie" class="lookup-field__typed" data-testid="lookup-typed">typed <b>{{ typedWylie }}</b></span>
      <span v-if="readAs" class="lookup-field__read-as" data-testid="lookup-read-as"><template v-for="(run, index) in tibetanRuns(readAs)" :key="index"><span v-if="run.tibetan" class="lookup-field__tibetan">{{ run.text }}</span><template v-else>{{ run.text }}</template></template></span>
    </div>
  </div>
</template>

<style scoped>
.lookup-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.lookup-field__input :deep(.ui-field__input) {
  color: var(--rubric);
}

/* Empty, the Tibetan field reads like an ordinary one */
.lookup-field__input :deep(.ui-field__input:placeholder-shown) {
  font: var(--text-md) var(--font-ui);
}

.lookup-field__under {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  padding: 0 var(--space-1);
  font-size: var(--text-sm);
  color: var(--muted);
}

.lookup-field__typed b {
  font-weight: 600;
  color: var(--ink);
}

.lookup-field__tibetan {
  font-family: var(--font-tibetan);
  font-size: 1.15em;
  line-height: 1;
  color: var(--rubric);
}
</style>
