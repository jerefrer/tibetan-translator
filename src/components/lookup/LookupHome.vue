<script>
import Storage from '../../services/storage';
import { loadGlosses, tibetanRuns } from '../../services/glosses';
import { clearHistory, recentTerms } from '../../services/history';
import { savedTerms } from '../../services/saved-terms';

const RECENT_ROWS = 8;

// What Lookup shows before anything is looked up (boards MobileHome and
// Main): the recent terms (with Clear), the saved ones, each with a one-line
// gloss, and the Wylie tip. On a phone under the field when it is empty; on a
// desktop in the entry pane while no term is selected.
export default {
  name: 'LookupHome',
  emits: ['open'],
  data() {
    return {
      recent: [],
      saved: [],
      // term -> gloss ('' when no enabled dictionary has one)
      glosses: {},
    };
  },
  created() {
    this.refresh();
  },
  mounted() {
    window.addEventListener('recents-updated', this.refresh);
    window.addEventListener('saved-terms-updated', this.refresh);
    window.addEventListener('dictionaries-updated', this.reloadGlosses);
    window.addEventListener('all-terms-updated', this.reloadGlosses);
  },
  activated() {
    this.refresh();
  },
  beforeUnmount() {
    window.removeEventListener('recents-updated', this.refresh);
    window.removeEventListener('saved-terms-updated', this.refresh);
    window.removeEventListener('dictionaries-updated', this.reloadGlosses);
    window.removeEventListener('all-terms-updated', this.reloadGlosses);
  },
  methods: {
    tibetanRuns,
    refresh() {
      this.recent = recentTerms().slice(0, RECENT_ROWS);
      this.saved = savedTerms();
      this.loadMissingGlosses();
    },
    reloadGlosses() {
      this.glosses = {};
      this.loadMissingGlosses();
    },
    async loadMissingGlosses() {
      const missing = [...this.recent, ...this.saved].filter((term) => !(term in this.glosses));
      if (!missing.length) return;
      try {
        const loaded = await loadGlosses(missing, Storage.get('dictionaries') || []);
        this.glosses = { ...this.glosses, ...Object.fromEntries(loaded) };
      } catch (error) {
        console.warn('[Lookup] Glosses not loaded', error);
      }
    },
    clearRecent() {
      clearHistory();
      this.recent = [];
    },
  },
};
</script>

<template>
  <div class="lookup-home" data-testid="lookup-home">
    <section v-if="recent.length" class="lookup-home__section" aria-labelledby="lookup-home-recent">
      <div class="lookup-home__head">
        <h2 id="lookup-home-recent" class="lookup-home__label">Recent</h2>
        <button type="button" class="lookup-home__clear" data-testid="lookup-recent-clear" @click="clearRecent">
          Clear
        </button>
      </div>
      <ul class="lookup-home__group" data-testid="lookup-recent">
        <li v-for="term in recent" :key="term">
          <button type="button" class="lookup-home__row" data-testid="lookup-home-term" @click="$emit('open', term)">
            <span class="lookup-home__term">{{ term }}</span>
            <span class="lookup-home__gloss"><template v-for="(run, index) in tibetanRuns(glosses[term])" :key="index"><span v-if="run.tibetan" class="lookup-home__gloss-tibetan">{{ run.text }}</span><template v-else>{{ run.text }}</template></template></span>
          </button>
        </li>
      </ul>
    </section>

    <section v-if="saved.length" class="lookup-home__section" aria-labelledby="lookup-home-saved">
      <div class="lookup-home__head">
        <h2 id="lookup-home-saved" class="lookup-home__label">Saved</h2>
      </div>
      <ul class="lookup-home__group" data-testid="lookup-saved">
        <li v-for="term in saved" :key="term">
          <button type="button" class="lookup-home__row" data-testid="lookup-home-term" @click="$emit('open', term)">
            <span class="lookup-home__term">{{ term }}</span>
            <span class="lookup-home__gloss"><template v-for="(run, index) in tibetanRuns(glosses[term])" :key="index"><span v-if="run.tibetan" class="lookup-home__gloss-tibetan">{{ run.text }}</span><template v-else>{{ run.text }}</template></template></span>
          </button>
        </li>
      </ul>
    </section>

    <p class="lookup-home__tip" data-testid="lookup-tip">
      Type <b>sangs rgyas</b> for <span class="lookup-home__tip-tibetan">སངས་རྒྱས་</span>, or switch to EN to search the definitions.
    </p>
  </div>
</template>

<style scoped>
.lookup-home {
  display: flex;
  flex-direction: column;
  gap: 18px;
  font-family: var(--font-ui);
  color: var(--ink);
}

.lookup-home__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.lookup-home__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0 var(--space-1);
}

.lookup-home__label {
  margin: 0;
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--faint);
}

.lookup-home__clear {
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent);
  font: var(--text-base) var(--font-ui);
  cursor: pointer;
}

.lookup-home__clear:hover {
  text-decoration: underline;
}

.lookup-home__group {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--line);
  border-radius: var(--radius-group);
  background: var(--surface);
  overflow: hidden;
}

/* Phone: white groups on the grouped ground, no border (board MobileHome) */
@media (max-width: 600px) {
  .lookup-home__group {
    border: 0;
  }
}

.lookup-home__group li + li {
  border-top: 1px solid var(--line-soft);
}

.lookup-home__row {
  box-sizing: border-box;
  display: flex;
  /* The gloss on the headword's line: DDC Uchen sits high in its box */
  align-items: baseline;
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

.lookup-home__row:hover {
  background: var(--bg-quiet);
}

.lookup-home__row:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.lookup-home__term {
  flex: 1;
  min-width: 0;
  font-family: var(--font-tibetan);
  font-size: var(--text-result-tibetan);
  line-height: 1.5;
  color: var(--rubric);
  overflow-wrap: anywhere;
}

.lookup-home__gloss {
  flex: 0 1 45%;
  min-width: 0;
  font-size: var(--text-sm);
  color: var(--faint);
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lookup-home__gloss-tibetan {
  font-family: var(--font-tibetan);
  font-size: 1.15em;
  line-height: 1;
}

.lookup-home__tip {
  margin: 0;
  padding: 0 var(--space-1);
  font-size: var(--text-sm);
  line-height: 1.5;
  color: var(--faint);
}

.lookup-home__tip b {
  font-weight: 600;
  color: var(--ink);
}

.lookup-home__tip-tibetan {
  font-family: var(--font-tibetan);
  font-size: var(--text-md);
  color: var(--rubric);
}
</style>
