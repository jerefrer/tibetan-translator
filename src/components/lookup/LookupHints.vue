<script>
import { UiButton } from '../../ui';

// The hint from བོད to EN: Tibetan read from Latin that is better searched in
// the definitions (Sanskrit with diacritics, or Wylie that starts no term).
export default {
  name: 'LookupHints',
  components: { UiButton },
  props: {
    mode: { type: String, required: true },
    text: { type: String, default: '' },
    // The Wylie behind the Tibetan in the field
    typedWylie: { type: String, default: '' },
    // What was typed when it carried Latin diacritics, kept as typed
    asTyped: { type: String, default: '' },
    headwordCount: { type: Number, default: 0 },
  },
  emits: ['switch'],
  computed: {
    // The Latin to search in the definitions, when བོད should offer it
    searchText() {
      if (this.mode !== 'bo' || !this.text) return '';
      if (this.asTyped) return this.asTyped;
      return this.headwordCount === 0 ? this.typedWylie : '';
    },
  },
};
</script>

<template>
  <section v-if="searchText" class="lookup-hint" data-testid="hint-search-definitions">
    <p v-if="headwordCount === 0" class="lookup-hint__text">
      No Tibetan term starts with <span class="lookup-hint__tibetan">{{ text }}</span>.
    </p>
    <ui-button class="lookup-hint__button" size="sm" @click="$emit('switch', { mode: 'en', text: searchText })">
      Search “{{ searchText }}” in the definitions
    </ui-button>
  </section>
</template>

<style scoped>
.lookup-hint {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--surface);
  border-radius: var(--radius-card);
  color: var(--ink);
  font-family: var(--font-ui);
}

.lookup-hint__text {
  margin: 0;
  font-size: var(--text-base);
  line-height: 1.45;
}

.lookup-hint__tibetan {
  font-family: var(--font-tibetan);
  font-size: 1.2em;
}

.lookup-hint__button {
  align-self: flex-start;
  max-width: 100%;
  overflow-wrap: anywhere;
}
</style>
