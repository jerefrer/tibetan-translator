<script>
import SqlDatabase from '../../services/sql-database';
import { wylieToTibetan } from '../../services/quick-lookup';
import { UiButton } from '../../ui';

// What a query in EN may hold for it to read as plain Wylie: letters, spaces,
// the apostrophe (a-chung) and plus. Digits, `&`, `{}`, `[]`, `(` mean a search.
const PLAIN_WYLIE = /^[A-Za-z' +]+$/;

// The hints between the two modes: Tibetan read as Latin that is better
// searched in the definitions (བོད), Latin that reads as a Tibetan term (EN).
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
    definitionCount: { type: Number, default: 0 },
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
  methods: {
    // The Tibetan the query reads as, when it starts a term (allTerms is not
    // reactive: read again on every render)
    tibetanFor(text) {
      const query = (text || '').trim();
      if (this.mode !== 'en' || !query || !PLAIN_WYLIE.test(query)) return '';
      const tibetan = wylieToTibetan(query);
      if (!tibetan) return '';
      return (SqlDatabase.allTerms || []).some((term) => term.startsWith(tibetan)) ? tibetan : '';
    },
  },
};
</script>

<template>
  <section v-if="searchText" class="lookup-hint" data-testid="hint-search-definitions">
    <p class="lookup-hint__text">
      <template v-if="headwordCount === 0">
        No Tibetan term starts with <span class="lookup-hint__tibetan">{{ text }}</span>.
      </template>
      Did you mean the English word?
    </p>
    <ui-button class="lookup-hint__button" size="sm" @click="$emit('switch', { mode: 'en', text: searchText })">
      Search “{{ searchText }}” in the definitions
    </ui-button>
  </section>
  <section v-else-if="tibetanFor(text)" class="lookup-hint" data-testid="hint-look-up-tibetan">
    <p class="lookup-hint__text">That reads as Wylie.</p>
    <ui-button
      class="lookup-hint__button"
      size="sm"
      @click="$emit('switch', { mode: 'bo', text: tibetanFor(text) })"
    >
      Look up <span class="lookup-hint__tibetan">{{ tibetanFor(text) }}</span> as Tibetan
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
