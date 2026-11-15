<script>
// What Search shows before any query (the desktop's entry pane, a phone's
// list): what its queries can say, each one to try. The examples are the
// Help's (HelpTopic's Search topic); a click runs the search, SearchPage
// pushes the route.
export const SEARCH_EXAMPLES = [
  { query: 'wisdom', text: 'Contains the word' },
  { query: 'seven limbs', text: 'These words, one after the other' },
  { query: 'seven & limbs', text: 'Both, anywhere, in any order' },
  { query: "(dga' ba)", text: 'Wylie in parentheses is read as Tibetan' },
  { query: '[trenpa]', text: 'A Tibetan word pronounced like this' },
];

export default {
  name: 'SearchHome',
  props: {
    // The page's phone layout (MobileResponsiveMixin), not a CSS breakpoint
    phone: { type: Boolean, default: false },
  },
  emits: ['search'],
  data() {
    return { examples: SEARCH_EXAMPLES };
  },
};
</script>

<template>
  <div class="search-home" :class="{ 'search-home--phone': phone }" data-testid="search-home">
    <p class="search-home__lead">Search finds words inside the definitions of every dictionary. Try:</p>
    <ul class="search-home__group">
      <li v-for="example in examples" :key="example.query">
        <button type="button" class="search-home__row" data-testid="search-home-example" @click="$emit('search', example.query)">
          <span class="search-home__query">{{ example.query }}</span>
          <span class="search-home__text">{{ example.text }}</span>
        </button>
      </li>
    </ul>
    <p class="search-home__footer">The <b>Query builder</b>, under the field, combines conditions for you.</p>
  </div>
</template>

<style scoped>
.search-home {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: 30rem;
  font-family: var(--font-ui);
  color: var(--ink);
}

.search-home--phone {
  max-width: none;
  margin-bottom: var(--space-4);
}

.search-home__lead,
.search-home__footer {
  margin: 0;
  padding: 0 var(--space-1);
  font-size: var(--text-sm);
  line-height: 1.5;
  color: var(--faint);
}

.search-home__lead {
  color: var(--muted);
}

.search-home__footer b {
  font-weight: 600;
  color: var(--ink);
}

.search-home__group {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--line);
  border-radius: var(--radius-group);
  background: var(--surface);
  overflow: hidden;
}

/* Phone: a white group on the grouped ground, no border */
.search-home--phone .search-home__group {
  border: 0;
}

.search-home__group li + li {
  border-top: 1px solid var(--line-soft);
}

.search-home__row {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  min-height: 52px;
  padding: var(--space-2) var(--space-4);
  border: 0;
  background: none;
  color: var(--ink);
  text-align: left;
  cursor: pointer;
}

.search-home__row:hover {
  background: var(--bg-quiet);
}

.search-home__row:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.search-home__query {
  flex: none;
  max-width: 55%;
  font-family: var(--font-ui-tibetan);
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--ink);
  overflow-wrap: anywhere;
}

.search-home__text {
  flex: 1;
  min-width: 0;
  font-size: var(--text-sm);
  color: var(--faint);
  text-align: right;
}
</style>
