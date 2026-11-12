<script>
import { initialTypedWylie, nextTypedWylie, typedWylieFor } from '../../services/typed-wylie';
import {
  isLookupMode,
  readLookupState,
  switchLookupMode,
  writeLookupState,
} from '../../services/lookup-state';
import LookupField from './LookupField.vue';

// Lookup: one field, Tibetan (བོད) or English (EN).
// The route carries what is looked up: /lookup/<term> selects a Tibetan term,
// /lookup?mode=en&q=<query> an English query, and `mode` alone switches.
// The old /define/<term> and /search/<query> links are redirected here by
// the router. What was looked up last is kept in `lookupState`.
// (Results come with Task 9, the layout with Task 11.)
export default {
  name: 'LookupPage',
  components: { LookupField },
  beforeRouteEnter(to, from, next) {
    // Opened bare (sidebar, tab bar, app start): an instance kept alive goes
    // on showing what it shows; a new one takes back what was looked up last
    if (to.params.term || to.query.q) next();
    else next((vm) => vm.restoreIfEmpty(to));
  },
  data() {
    const { mode } = readLookupState();
    return {
      mode,
      text: '',
      // The Wylie behind the Tibetan in the field ("typed sangs rgyas")
      typedWylieState: initialTypedWylie(),
    };
  },
  computed: {
    typedWylie() {
      return typedWylieFor(this.typedWylieState, this.text);
    },
  },
  watch: {
    text(value) {
      this.typedWylieState = nextTypedWylie(this.typedWylieState, value || '');
    },
    $route(route) {
      // Kept alive while another page is open: its routes are not Lookup's
      if (!route.path.startsWith('/lookup')) return;
      this.applyRoute(route);
    },
  },
  created() {
    if (this.$route.path.startsWith('/lookup')) this.applyRoute(this.$route);
  },
  mounted() {
    this._onFocusLookup = () => this.focusField();
    window.addEventListener('focus-lookup', this._onFocusLookup);
  },
  activated() {
    this.$nextTick(() => this.focusField());
  },
  beforeUnmount() {
    window.removeEventListener('focus-lookup', this._onFocusLookup);
  },
  methods: {
    applyRoute(route) {
      const term = route.params.term;
      const query = route.query.q;
      if (term) {
        this.selectTerm(term);
        writeLookupState({ mode: 'bo', term });
      } else if (query) {
        this.mode = 'en';
        this.text = query;
        writeLookupState({ mode: 'en', query });
      } else if (isLookupMode(route.query.mode) && route.query.mode !== this.mode) {
        this.changeMode(route.query.mode, { updateRoute: false });
      }
    },
    // As Define's setSearchTerm: what was typed stays when the selected term
    // starts with it (picking ཀ་ཀ་ after typing ཀ keeps ཀ in the field)
    selectTerm(term) {
      if (this.mode !== 'bo' || !this.text || !term.includes(this.text)) this.text = term;
      this.mode = 'bo';
    },
    restoreIfEmpty(to) {
      if (this.text) return;
      const state = readLookupState();
      const mode = isLookupMode(to.query.mode) ? to.query.mode : state.mode;
      const query = { ...to.query, mode };
      if (mode === 'bo' && state.term) {
        this.$router.replace({ path: '/lookup/' + encodeURIComponent(state.term), query, hash: to.hash });
      } else if (mode === 'en' && state.query) {
        this.$router.replace({ path: '/lookup', query: { ...query, q: state.query }, hash: to.hash });
      } else {
        this.mode = mode;
      }
    },
    changeMode(newMode, { updateRoute = true } = {}) {
      if (!isLookupMode(newMode) || newMode === this.mode) return;
      const text = switchLookupMode(
        { mode: this.mode, text: this.text, typedWylie: this.typedWylie },
        newMode
      );
      this.mode = newMode;
      this.text = text;
      // The term stays the last one selected: the text converted to Tibetan
      // may not be a term
      writeLookupState(newMode === 'en' ? { mode: newMode, query: text } : { mode: newMode });
      // The route drops the term or query of the other mode, so that a link
      // to them (a definition link to the same term) is a change again
      if (updateRoute) this.$router.replace({ path: '/lookup', query: { mode: newMode } });
    },
    search() {
      const query = (this.text || '').trim();
      if (!query) return;
      this.$router.push({ path: '/lookup', query: { mode: 'en', q: query } });
    },
    clear() {
      this.text = '';
      writeLookupState(this.mode === 'en' ? { query: '' } : { term: '' });
      const route = { path: '/lookup', query: { mode: this.mode } };
      if (this.$route.fullPath !== this.$router.resolve(route).fullPath) this.$router.push(route);
    },
    onKeydown(event) {
      if (this.mode === 'en' && event.key === 'Enter') this.search();
    },
    focusField() {
      this.$refs.field?.focus();
    },
  },
};
</script>

<template>
  <section class="lookup-page" data-testid="lookup-page">
    <h1 class="ui-visually-hidden">Lookup</h1>
    <lookup-field
      ref="field"
      v-model="text"
      :mode="mode"
      :typed-wylie="typedWylie"
      @update:mode="changeMode"
      @keydown="onKeydown"
      @clear="clear"
      @submit="search"
    />
  </section>
</template>

<style scoped>
.lookup-page {
  box-sizing: border-box;
  max-width: var(--entry-max-width);
  padding: var(--space-6) var(--space-8);
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-ui);
}
</style>
