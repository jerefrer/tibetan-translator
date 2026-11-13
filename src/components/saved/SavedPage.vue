<script>
import ResizeService from '../../services/resize-service';
import Storage from '../../services/storage';
import { writeToClipboard } from '../../services/copy-service';
import { foldForSearch } from '../../services/dictionary-catalog';
import { loadGlosses, tibetanRuns } from '../../services/glosses';
import { clearSaved, removeSaved, savedTerms, setSavedTerms } from '../../services/saved-terms';
import { sortTibetan } from '../../services/tibetan-order';
import { wylieFor } from '../../services/transcription';
import { UiButton, UiIcon, UiSegmented, UiTextField } from '../../ui';

const plural = (count) => `${count} ${count === 1 ? 'term' : 'terms'}`;

// Saved: every term the user saved (the bookmark of an entry), each with a
// one-line gloss, newest first or in Tibetan order (by root letter, as
// dictionaries file them), to search (Tibetan, Wylie or gloss), open in
// Define, remove one by one, copy as a list (one term and its gloss per line,
// tab separated, for a spreadsheet, in the order shown), or clear, with an
// Undo for the clear. The
// sidebar shows the eight newest and links here; on a phone, Define's home
// does.
export default {
  name: 'SavedPage',
  components: { UiButton, UiIcon, UiSegmented, UiTextField },
  inject: { snackbar: { default: null } },
  data() {
    return {
      terms: savedTerms(),
      // term -> gloss ('' when no enabled dictionary has one)
      glosses: {},
      query: '',
      // 'newest' or 'tibetan', kept for the next visit
      order: Storage.get('savedOrder') === 'tibetan' ? 'tibetan' : 'newest',
      orderOptions: [
        { value: 'newest', label: 'Newest' },
        { value: 'tibetan', label: 'Tibetan order' },
      ],
      // The list as it was before Clear all, while it can be put back
      cleared: null,
      isPhone: ResizeService.isMobile(),
    };
  },
  computed: {
    shown() {
      const query = foldForSearch(this.query).trim();
      const terms = this.terms.filter((term) => !query || this.matches(term, query));
      return this.order === 'tibetan' ? sortTibetan(terms) : terms;
    },
    summary() {
      return this.query.trim() ? `${plural(this.shown.length)} of ${this.terms.length}` : plural(this.terms.length);
    },
  },
  watch: {
    order(order) {
      Storage.set('savedOrder', order);
    },
  },
  created() {
    ResizeService.subscribe('saved-page', () => {
      this.isPhone = ResizeService.isMobile();
    });
    this.loadMissingGlosses();
  },
  mounted() {
    window.addEventListener('saved-terms-updated', this.refresh);
    window.addEventListener('dictionaries-updated', this.reloadGlosses);
  },
  activated() {
    this.refresh();
  },
  deactivated() {
    this.cleared = null;
  },
  beforeUnmount() {
    ResizeService.unsubscribe('saved-page');
    window.removeEventListener('saved-terms-updated', this.refresh);
    window.removeEventListener('dictionaries-updated', this.reloadGlosses);
  },
  methods: {
    tibetanRuns,
    matches(term, query) {
      if (term.includes(this.query.trim())) return true;
      if (foldForSearch(this.glosses[term] || '').includes(query)) return true;
      try {
        return foldForSearch(wylieFor(term)).includes(query);
      } catch (error) {
        return false;
      }
    },
    refresh() {
      this.terms = savedTerms();
      this.loadMissingGlosses();
    },
    reloadGlosses() {
      this.glosses = {};
      this.loadMissingGlosses();
    },
    async loadMissingGlosses() {
      const missing = this.terms.filter((term) => !(term in this.glosses));
      if (!missing.length) return;
      try {
        const loaded = await loadGlosses(missing, Storage.get('dictionaries') || []);
        this.glosses = { ...this.glosses, ...Object.fromEntries(loaded) };
      } catch (error) {
        console.warn('[Saved] Glosses not loaded', error);
      }
    },
    open(term) {
      this.$router.push(`/define/${encodeURIComponent(term)}`);
    },
    remove(term) {
      removeSaved(term);
      this.terms = savedTerms();
    },
    clearAll() {
      this.cleared = savedTerms();
      clearSaved();
      this.terms = [];
    },
    // Terms saved since the clear (another window) stay, in front
    undoClear() {
      if (!this.cleared) return;
      const since = savedTerms().filter((term) => !this.cleared.includes(term));
      setSavedTerms([...since, ...this.cleared]);
      this.cleared = null;
      this.refresh();
    },
    async copyList() {
      const text = this.shown.map((term) => `${term}\t${this.glosses[term] || ''}`.trimEnd()).join('\n');
      try {
        await writeToClipboard(text);
        this.snackbar?.open(`Copied ${plural(this.shown.length)}`);
      } catch (error) {
        console.error('[Saved] copy failed', error);
        this.snackbar?.open('Copy failed');
      }
    },
  },
};
</script>

<template>
  <div class="saved-page" :class="{ 'is-phone': isPhone }" data-testid="saved-page">
    <div class="saved-page__column">
      <button
        v-if="isPhone"
        type="button"
        class="saved-page__back"
        data-testid="saved-back"
        @click="$router.push('/define')"
      >
        <ui-icon name="chevron-left" :size="22" :stroke-width="2.4" />
        Define
      </button>

      <header class="saved-page__header">
        <div class="saved-page__titles">
          <h1 class="saved-page__title">Saved</h1>
          <p v-if="terms.length" class="saved-page__summary" data-testid="saved-summary">{{ summary }}</p>
        </div>
        <div v-if="terms.length" class="saved-page__actions">
          <ui-button variant="outline" size="sm" data-testid="saved-copy" @click="copyList">
            <ui-icon name="copy" :size="15" />
            Copy the list
          </ui-button>
          <ui-button variant="outline" size="sm" class="saved-page__clear" data-testid="saved-clear" @click="clearAll">
            <ui-icon name="trash-2" :size="15" />
            Clear all
          </ui-button>
        </div>
      </header>

      <div v-if="cleared" class="saved-page__undo-bar" role="status" data-testid="saved-undo-bar">
        <span>{{ cleared.length }} {{ cleared.length === 1 ? 'term' : 'terms' }} removed</span>
        <ui-button variant="ghost" size="sm" data-testid="saved-undo" @click="undoClear">
          <ui-icon name="rotate-ccw" :size="15" />
          Undo
        </ui-button>
      </div>

      <template v-if="terms.length">
        <div class="saved-page__toolbar">
          <ui-text-field
            v-model="query"
            class="saved-page__search"
            prepend-icon="search"
            placeholder="Tibetan, Wylie or translation"
            aria-label="Search the saved terms"
            clearable
            autocomplete="off"
            spellcheck="false"
            data-testid="saved-search"
          />
          <ui-segmented v-model="order" :options="orderOptions" label="Order" data-testid="saved-order" />
        </div>

        <ul v-if="shown.length" class="saved-page__list" data-testid="saved-list">
          <li v-for="term in shown" :key="term" class="saved-row" data-testid="saved-row">
            <button type="button" class="saved-row__open" data-testid="saved-open" @click="open(term)">
              <span class="saved-row__term">{{ term }}</span>
              <span class="saved-row__gloss"><template v-for="(run, index) in tibetanRuns(glosses[term])" :key="index"><span v-if="run.tibetan" class="saved-row__gloss-tibetan">{{ run.text }}</span><template v-else>{{ run.text }}</template></template></span>
            </button>
            <button
              type="button"
              class="saved-row__remove"
              :aria-label="'Remove ' + term + ' from Saved'"
              title="Remove from Saved"
              data-testid="saved-remove"
              @click="remove(term)"
            >
              <ui-icon name="x" :size="16" />
            </button>
          </li>
        </ul>
        <p v-else class="saved-page__none" data-testid="saved-no-match">No saved term matches this search.</p>
      </template>

      <div v-else-if="!cleared" class="saved-page__empty" data-testid="saved-empty">
        <ui-icon name="bookmark" :size="32" :stroke-width="1.6" class="saved-page__empty-icon" />
        <p>
          Nothing saved yet. In an entry, <strong>Save</strong> keeps the term here
          and in the sidebar, to come back to it.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.saved-page {
  box-sizing: border-box;
  height: 100%;
  overflow-y: auto;
  padding: 28px var(--space-8) var(--space-8);
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-ui);
}
.saved-page__column {
  max-width: 50rem;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.saved-page__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
}
.saved-page__titles {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.saved-page__title {
  margin: 0;
  font-size: var(--text-heading);
  font-weight: 700;
  letter-spacing: -0.01em;
}
.saved-page__summary {
  margin: 0;
  font-size: var(--text-base);
  color: var(--muted);
}
.saved-page__actions {
  display: flex;
  gap: var(--space-2);
}
.saved-page__clear:hover:not(:disabled) {
  color: var(--danger-ink);
}
.saved-page__undo-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  background: var(--bg-quiet);
  font-size: var(--text-base);
}
.saved-page__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.saved-page__search {
  flex: 1 1 16rem;
  min-width: 0;
}
.saved-page__list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.saved-row {
  position: relative;
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--line-soft);
}
.saved-row__open {
  flex: 1;
  min-width: 0;
  /* Terms in one column, glosses in the next */
  display: grid;
  grid-template-columns: minmax(0, min(14rem, 35%)) minmax(0, 1fr);
  /* The gloss on the headword's line: DDC Uchen sits high in its box */
  align-items: baseline;
  gap: var(--space-4);
  min-height: 3.5rem;
  padding: var(--space-2) var(--space-3);
  border: 0;
  border-radius: var(--radius-lg);
  background: none;
  font: inherit;
  text-align: left;
  color: inherit;
  cursor: pointer;
}
.saved-row__open:hover {
  background: var(--bg-quiet);
}
.saved-row__open:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.saved-row__term {
  font-family: var(--font-tibetan);
  font-size: var(--text-result-tibetan);
  line-height: 1.5;
  color: var(--rubric);
  overflow-wrap: anywhere;
}
.saved-row__gloss {
  /* Room for Tibetan stacks and vowels inside the clipped line, the row no taller */
  padding-block: 0.4em;
  margin-block: -0.4em;
  min-width: 0;
  font-size: var(--text-base);
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.saved-row__gloss-tibetan {
  font-family: var(--font-tibetan);
  font-size: 1.15em;
  line-height: 1;
}
.saved-row__remove {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--control-sm);
  height: var(--control-sm);
  margin-left: var(--space-1);
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s ease;
}
.saved-row:hover .saved-row__remove,
.saved-row__remove:focus-visible {
  opacity: 1;
}
.saved-row__remove:hover {
  background: var(--soft);
  color: var(--ink);
}
.saved-row__remove:focus-visible {
  outline: 2px solid var(--accent);
}
@media (hover: none) {
  .saved-row__remove {
    opacity: 1;
  }
}
.saved-page__none {
  margin: 0;
  padding: var(--space-6) 0;
  color: var(--muted);
}
.saved-page__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  max-width: 26rem;
  margin: var(--space-8) auto 0;
  text-align: center;
  color: var(--muted);
}
.saved-page__empty p {
  margin: 0;
  line-height: 1.55;
}
.saved-page__empty-icon {
  color: var(--faint);
}
.saved-page__back {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  align-self: flex-start;
  min-height: 2.75rem;
  margin-left: -8px;
  padding: 0 var(--space-2) 0 0;
  border: 0;
  background: none;
  font: var(--text-md) var(--font-ui);
  color: var(--accent);
  cursor: pointer;
}
@media (prefers-reduced-motion: reduce) {
  .saved-row__remove {
    transition: none;
  }
}

/* Phone: a large title, the list as one white group on the grey ground */
.saved-page.is-phone {
  padding: var(--space-3) var(--space-4) var(--space-6);
  background: var(--bg-grouped);
}
.saved-page.is-phone .saved-page__title {
  font-size: var(--text-large-title);
}
.saved-page.is-phone .saved-page__list {
  border-radius: var(--radius-group);
  background: var(--surface);
  overflow: hidden;
}
.saved-page.is-phone .saved-row {
  border-bottom: 0;
  border-top: 1px solid var(--soft);
}
.saved-page.is-phone .saved-row:first-child {
  border-top: 0;
}
.saved-page.is-phone .saved-row__open {
  border-radius: 0;
}
.saved-page.is-phone .saved-page__toolbar {
  flex-direction: column;
  align-items: stretch;
}
</style>
