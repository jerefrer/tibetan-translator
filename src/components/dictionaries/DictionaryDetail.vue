<script>
import { substituteLinksWithATags } from '../../utils';
import { UiButton, UiIcon, UiSwitch } from '../../ui';

/** "1st", "2nd", "3rd", "4th", "11th", "22nd"... */
export function ordinal(number) {
  const tens = number % 100;
  if (tens >= 11 && tens <= 13) return `${number}th`;
  return number + ({ 1: 'st', 2: 'nd', 3: 'rd' }[number % 10] || 'th');
}

// What is known about one dictionary (board DesktopDictionaries, the right
// pane; on a phone, a screen of its own): its title and sources, languages
// and subjects, where it stands in lookups, and what can be done with it:
// move it, or search its definitions (Lookup in EN, kept to it; only when it
// is switched on, as lookups leave the others out).
//
// Emits toggle(enabled), move('top' | 'bottom') and install(packId).
export default {
  name: 'DictionaryDetail',
  components: { UiButton, UiIcon, UiSwitch },
  props: {
    row: { type: Object, required: true },
    // Its place among the dictionaries switched on (0 when off), out of how many
    rank: { type: Number, default: 0 },
    enabledCount: { type: Number, default: 0 },
    canMoveUp: { type: Boolean, default: false },
    canMoveDown: { type: Boolean, default: false },
    canInstall: { type: Boolean, default: false },
  },
  emits: ['toggle', 'move', 'install'],
  computed: {
    subtitle() {
      return this.row.summary && this.row.summary !== this.row.label ? this.row.summary : '';
    },
    // Bundled details: the lines after the title, links made clickable
    sourceLines() {
      return this.row.aboutLines.slice(1).map((line) => substituteLinksWithATags(line));
    },
    inLookups() {
      if (!this.row.installed) return 'Not on this device';
      if (!this.row.enabled) return 'No, switched off';
      return `Yes · ${ordinal(this.rank)} of ${this.enabledCount}`;
    },
    // Lookup's English search, kept to this dictionary (by its name)
    searchLink() {
      return { path: '/search', query: { dict: this.row.key } };
    },
    packState() {
      if (this.row.custom) return 'My glossary';
      const state = this.row.installed ? 'on this device' : 'not installed';
      return `${this.row.packName} · ${state}`;
    },
  },
};
</script>

<template>
  <article class="dictionary-detail" :aria-label="row.label" data-testid="dictionary-detail">
    <header class="dictionary-detail__header">
      <div class="dictionary-detail__titles">
        <h2 class="dictionary-detail__title" data-testid="dictionary-detail-title">{{ row.label }}</h2>
        <p v-if="subtitle" class="dictionary-detail__subtitle">{{ subtitle }}</p>
      </div>
      <ui-switch
        v-if="row.installed"
        :model-value="row.enabled"
        :aria-label="'Use ' + row.label + ' in lookups'"
        class="dictionary-detail__switch"
        data-testid="dictionary-detail-switch"
        @update:model-value="$emit('toggle', $event)"
      />
    </header>

    <div v-if="sourceLines.length" class="dictionary-detail__sources">
      <!-- eslint-disable-next-line vue/no-v-html -- bundled dictionary details -->
      <p v-for="(line, index) in sourceLines" :key="index" v-html="line" />
    </div>
    <p v-else-if="row.custom" class="dictionary-detail__sources">
      One of your glossaries. Its entries are in
      <router-link :to="'/glossary/' + row.packId">My glossary</router-link>.
    </p>

    <div v-if="row.direction || row.keywords.length" class="dictionary-detail__chips">
      <span v-if="row.direction" class="dictionary-detail__chip">{{ row.direction }}</span>
      <span v-for="keyword in row.keywords" :key="keyword" class="dictionary-detail__chip">{{ keyword }}</span>
    </div>

    <dl class="dictionary-detail__facts">
      <div class="dictionary-detail__fact">
        <dt>In lookups</dt>
        <dd data-testid="dictionary-detail-rank">{{ inLookups }}</dd>
      </div>
      <div class="dictionary-detail__fact">
        <dt>Pack</dt>
        <dd>{{ packState }}</dd>
      </div>
    </dl>

    <div v-if="row.installed" class="dictionary-detail__actions">
      <ui-button
        v-if="row.enabled"
        variant="outline"
        size="sm"
        data-testid="dictionary-search-definitions"
        @click="$router.push(searchLink)"
      >
        <ui-icon name="search" :size="15" />
        Search its definitions
      </ui-button>
      <ui-button variant="outline" size="sm" :disabled="!canMoveUp" data-testid="dictionary-move-top" @click="$emit('move', 'top')">
        <ui-icon name="arrow-up-to-line" :size="15" />
        Move to top
      </ui-button>
      <ui-button variant="outline" size="sm" :disabled="!canMoveDown" data-testid="dictionary-move-bottom" @click="$emit('move', 'bottom')">
        <ui-icon name="arrow-down-to-line" :size="15" />
        Move to bottom
      </ui-button>
    </div>
    <div v-else-if="canInstall" class="dictionary-detail__actions">
      <ui-button variant="soft" data-testid="dictionary-install" @click="$emit('install', row.packId)">
        <ui-icon name="download" :size="16" />
        Install {{ row.packName }}
      </ui-button>
    </div>
  </article>
</template>

<style scoped>
.dictionary-detail {
  display: flex;
  flex-direction: column;
  gap: 18px;
  font-family: var(--font-ui);
  color: var(--ink);
}
.dictionary-detail__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}
.dictionary-detail__titles {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dictionary-detail__title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 1.625rem;
  font-weight: 600;
  line-height: 1.2;
  overflow-wrap: anywhere;
}
.dictionary-detail__subtitle {
  margin: 0;
  font-family: var(--font-serif);
  font-size: var(--text-md);
  line-height: 1.45;
  color: var(--muted);
}
.dictionary-detail__switch {
  flex: none;
  margin-top: 6px;
}
.dictionary-detail__sources {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: var(--text-base);
  line-height: 1.55;
  color: var(--muted);
  overflow-wrap: anywhere;
}
.dictionary-detail__sources p {
  margin: 0;
}
.dictionary-detail__sources :deep(a),
.dictionary-detail__sources a {
  color: var(--accent);
}
.dictionary-detail__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.dictionary-detail__chip {
  display: inline-flex;
  align-items: center;
  min-height: 1.5rem;
  padding: 0 9px;
  border-radius: var(--radius-pill);
  background: var(--soft);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--ink);
}
.dictionary-detail__facts {
  margin: 0;
  border-bottom: 1px solid var(--line-soft);
}
.dictionary-detail__fact {
  display: grid;
  grid-template-columns: 7rem minmax(0, 1fr);
  gap: var(--space-3);
  padding: 10px 0;
  border-top: 1px solid var(--line-soft);
  font-size: var(--text-base);
}
.dictionary-detail__fact dt {
  color: var(--muted);
}
.dictionary-detail__fact dd {
  margin: 0;
}
.dictionary-detail__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>
