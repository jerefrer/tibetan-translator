<script>
import DictionariesDetails from '../../services/dictionaries-details';
import PackManager from '../../services/pack-manager';
import ResizeService from '../../services/resize-service';
import Storage from '../../services/storage';
import { PACK_DEFINITIONS } from '../../config/pack-definitions';
import { isMacOS, supportsModularPacks } from '../../config/platform';
import {
  buildCatalog,
  buildDictionaryRows,
  enabledRank,
  filterDictionaryRows,
  moveDictionary,
} from '../../services/dictionary-catalog';
import { UiIcon, UiSegmented, UiSelect, UiTextField } from '../../ui';
import DictionaryDetail from './DictionaryDetail.vue';
import DictionaryList from './DictionaryList.vue';
import DictionaryPacks from './DictionaryPacks.vue';

const CATALOG = buildCatalog(DictionariesDetails, PACK_DEFINITIONS);

const LANGUAGE_OPTIONS = [
  { value: 'all', label: 'Any language' },
  { value: 'tib-only', label: 'Tibetan only' },
  { value: 'en', label: 'English' },
  { value: 'skt', label: 'Sanskrit' },
  { value: 'zh', label: 'Chinese' },
  { value: 'other', label: 'Other languages' },
];

// Subject tags offered as a filter; tags no dictionary carries are left out
const PURPOSES = [
  'comprehensive',
  'Sanskrit equivalents',
  'definitions',
  'learning',
  'Mahāvyutpatti',
  'archaic',
  'synonyms',
  'scan',
];

// What the former catalog's ?status= meant, in this page's terms
const STATUS_FROM_ROUTE = { all: 'all', installed: 'all', available: 'available' };

// How many changes Ctrl/Cmd+Z can take back
const HISTORY_LIMIT = 50;

const storedDictionaries = () => Storage.get('dictionaries') || [];
const byPosition = (dictionaries) =>
  [...dictionaries].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

// What a change touches: the order of the names and which are on. Undo and
// redo lay it over the list as it is then, so a dictionary added since (a
// pack installed, a glossary created) stays, and one gone stays gone.
const stateOf = (dictionaries) => ({
  order: byPosition(dictionaries).map((dictionary) => dictionary.name),
  enabled: Object.fromEntries(dictionaries.map((dictionary) => [dictionary.name, dictionary.enabled !== false])),
});
function withState(dictionaries, { order, enabled }) {
  const rank = new Map(order.map((name, index) => [name, index]));
  const current = byPosition(dictionaries);
  return current
    .map((dictionary, index) => ({ dictionary, index }))
    .sort((a, b) => (rank.get(a.dictionary.name) ?? order.length + a.index) - (rank.get(b.dictionary.name) ?? order.length + b.index))
    .map(({ dictionary }, index) => ({
      ...dictionary,
      enabled: dictionary.name in enabled ? enabled[dictionary.name] : dictionary.enabled,
      position: index + 1,
    }));
}

// Dictionaries (boards DesktopDictionaries, MobileDictionaries): the one place
// for everything about dictionaries. The packs (install, update, remove), the
// dictionaries in the order lookups use them, each switched on or off and
// reordered here, those of packs not installed, and what is known about the
// selected one.
//
// The order and the switches are Storage's `dictionaries` (the order lookups
// read); this page writes it on every change. `?find=` and `?status=` (the
// "not searched" notice, old links) set the search and the status filter;
// `?dictionary=` selects a dictionary, and on a phone opens it.
//
// Desktop: the list and its filters, the selected dictionary in a pane on the
// right. Phone: the list on the grouped ground, a tapped dictionary on a
// screen of its own with a way back; handles show after Reorder. Opening one
// is a step in the history (its ?dictionary=), so Android's Back, which steps
// back through the web view's history, closes it rather than the page.
//
// Keyboard (window, desktop, while the page is shown and no text field has
// the focus): Up/Down select, Alt+Up/Down move the selected dictionary,
// Ctrl/Cmd+Z undoes a move or a switch, Ctrl+Y or Ctrl/Cmd+Shift+Z redoes.
export default {
  name: 'DictionariesPage',
  components: {
    DictionaryDetail,
    DictionaryList,
    DictionaryPacks,
    UiIcon,
    UiSegmented,
    UiSelect,
    UiTextField,
  },
  inject: { snackbar: { default: null } },
  data() {
    return {
      stored: storedDictionaries(),
      // The changes made here, to take back and redo: { before, after, label },
      // each a stateOf() of the list
      past: [],
      future: [],
      // Set by a link's ?find= or ?status=, dropped when the page is opened bare
      filtersFromLink: false,
      // Read out after a move made from the keyboard
      announcement: '',
      // Phone: where the list was scrolled when a dictionary was opened
      listScroll: 0,
      query: '',
      status: 'all',
      language: 'all',
      purpose: 'any',
      selectedKey: '',
      isPhone: ResizeService.isMobile(),
      // Phone: the selected dictionary's screen is open (the route's ?dictionary=)
      showingDetail: false,
      // Phone: that screen was opened here, so its way back steps back
      detailOpenedHere: false,
      // Phone: the handles are shown
      reordering: false,
    };
  },
  computed: {
    modular() {
      return supportsModularPacks();
    },
    // Until it has loaded, which packs are installed is unknown
    packManagerReady() {
      return PackManager.isInitialized;
    },
    rows() {
      const installed = PackManager.installedPacks;
      return buildDictionaryRows({
        stored: this.stored,
        catalog: CATALOG,
        isPackInstalled: (packId) =>
          !this.modular || !!PACK_DEFINITIONS[packId]?.included || installed.includes(packId),
      });
    },
    filters() {
      return {
        query: this.query,
        status: this.status,
        language: this.language,
        purpose: this.purpose === 'any' ? '' : this.purpose,
      };
    },
    filtered() {
      return filterDictionaryRows(this.rows, this.filters);
    },
    filtersActive() {
      return !!this.query.trim() || this.status !== 'all' || this.language !== 'all' || this.purpose !== 'any';
    },
    reorderable() {
      return !this.filtersActive && (!this.isPhone || this.reordering);
    },
    statusOptions() {
      const options = [
        { value: 'all', label: 'All' },
        { value: 'on', label: 'On' },
        { value: 'off', label: 'Off' },
      ];
      if (this.modular) options.push({ value: 'available', label: 'Not installed' });
      return options;
    },
    languageOptions() {
      return LANGUAGE_OPTIONS;
    },
    purposeOptions() {
      const present = PURPOSES.filter((purpose) =>
        this.rows.some((row) => row.keywords.includes(purpose))
      );
      return [{ value: 'any', label: 'Any purpose' }, ...present.map((value) => ({ value, label: value }))];
    },
    // The selected row; on desktop the first one shown when none is
    selectedRow() {
      const chosen = this.filtered.find((row) => row.key === this.selectedKey);
      if (chosen || this.isPhone) return chosen || this.rows.find((row) => row.key === this.selectedKey) || null;
      return this.filtered[0] || null;
    },
    enabledCount() {
      return this.rows.filter((row) => row.enabled).length;
    },
    installedRows() {
      return this.rows.filter((row) => row.installed);
    },
    summary() {
      // In a browser every dictionary is bundled: only the switches count
      if (!this.modular) return `${this.enabledCount} of ${this.installedRows.length} used in lookups`;
      const parts = [`${this.enabledCount} used in lookups`, `${this.installedRows.length} on this device`];
      const available = this.rows.length - this.installedRows.length;
      if (available) parts.push(`${available} more in packs you can add`);
      return parts.join(' · ');
    },
    listTitle() {
      if (!this.filtersActive) return 'Order used in lookups';
      const count = this.filtered.length;
      return `${count} of ${this.rows.length} ${this.rows.length === 1 ? 'dictionary' : 'dictionaries'}`;
    },
    selectedRank() {
      return this.selectedRow?.enabled ? enabledRank(this.rows, this.selectedRow.key) : 0;
    },
    // The keys to move the selected dictionary with, as the hint shows them
    moveKeys() {
      return isMacOS() ? '⌥↑↓' : 'Alt+↑↓';
    },
    undoKey() {
      return isMacOS() ? '⌘Z' : 'Ctrl+Z';
    },
    selectedIndex() {
      return this.installedRows.findIndex((row) => row.key === this.selectedRow?.key);
    },
  },
  watch: {
    '$route.query': {
      immediate: true,
      handler(query) {
        if (!this.$route.path.startsWith('/dictionaries')) return;
        const fromLink = query.find !== undefined || query.status !== undefined;
        if (query.find !== undefined) this.query = String(query.find);
        if (query.status !== undefined) this.status = STATUS_FROM_ROUTE[query.status] || 'all';
        // A notice's filter is for that visit, not for the next time the page opens
        if (!fromLink && this.filtersFromLink) this.clearFilters();
        this.filtersFromLink = fromLink;
        this.showDetailOf(query.dictionary);
      },
    },
  },
  created() {
    // After a pack is installed, updated or removed
    this.onDictionariesUpdated = () => {
      this.stored = storedDictionaries();
    };
    window.addEventListener('dictionaries-updated', this.onDictionariesUpdated);
    ResizeService.subscribe('dictionaries-page', () => {
      this.isPhone = ResizeService.isMobile();
    });
  },
  mounted() {
    this.listenToKeyboard();
  },
  activated() {
    this.stored = storedDictionaries();
    this.listenToKeyboard();
  },
  deactivated() {
    window.removeEventListener('keydown', this.onKeydown);
    // Back on the list next time, not on a dictionary opened long ago
    this.showingDetail = false;
  },
  unmounted() {
    window.removeEventListener('dictionaries-updated', this.onDictionariesUpdated);
    window.removeEventListener('keydown', this.onKeydown);
    ResizeService.unsubscribe('dictionaries-page');
  },
  methods: {
    // A change made here, remembered so that it can be undone
    save(dictionaries, label) {
      const change = { before: stateOf(this.stored), after: stateOf(dictionaries), label };
      this.past = [...this.past, change].slice(-HISTORY_LIMIT);
      this.future = [];
      this.write(dictionaries);
    },
    write(dictionaries) {
      this.stored = dictionaries;
      Storage.set('dictionaries', dictionaries);
    },
    undo() {
      const change = this.past[this.past.length - 1];
      if (!change) return;
      this.past = this.past.slice(0, -1);
      this.future = [...this.future, change];
      this.write(withState(this.stored, change.before));
      this.snackbar?.open(`Undone: ${change.label}`);
    },
    redo() {
      const change = this.future[this.future.length - 1];
      if (!change) return;
      this.future = this.future.slice(0, -1);
      this.past = [...this.past, change];
      this.write(withState(this.stored, change.after));
      this.snackbar?.open(`Redone: ${change.label}`);
    },
    labelOf(key) {
      return this.rows.find((row) => row.key === key)?.label || key;
    },
    // Phone: a tapped dictionary opens as a step in the history
    select(key) {
      this.selectedKey = key;
      if (!this.isPhone) return;
      this.listScroll = this.$el.scrollTop;
      this.detailOpenedHere = true;
      this.$router.push({ path: '/dictionaries', query: { ...this.$route.query, dictionary: key } });
    },
    // The route's ?dictionary=: selected, and on a phone open; none, the list
    // back where it was scrolled
    showDetailOf(key) {
      if (key) {
        this.selectedKey = String(key);
        if (!this.isPhone) return;
        this.showingDetail = true;
        this.$nextTick(() => {
          if (this.$el) this.$el.scrollTop = 0;
        });
      } else if (this.showingDetail) {
        this.showingDetail = false;
        this.detailOpenedHere = false;
        this.$nextTick(() => {
          if (this.$el) this.$el.scrollTop = this.listScroll;
        });
      }
    },
    // The way back above a dictionary: the step back, as Android's Back, when
    // it was opened here; else (a link) the list in its place
    closeDetail() {
      if (this.detailOpenedHere) return this.$router.back();
      const { dictionary, ...query } = this.$route.query;
      this.$router.replace({ path: '/dictionaries', query });
    },
    toggle(key, enabled) {
      this.save(
        this.stored.map((dictionary) => (dictionary.name === key ? { ...dictionary, enabled } : dictionary)),
        `${this.labelOf(key)} switched ${enabled ? 'on' : 'off'}`
      );
    },
    reorder(keys, label = 'Order changed') {
      const rank = new Map(keys.map((key, index) => [key, index]));
      const sorted = byPosition(this.stored).sort(
        (a, b) => (rank.get(a.name) ?? keys.length) - (rank.get(b.name) ?? keys.length)
      );
      this.save(sorted.map((dictionary, index) => ({ ...dictionary, position: index + 1 })), label);
    },
    // The first row stands selected until one is chosen: pin it before it
    // moves, or the selection would stay on whatever comes first
    pinSelection() {
      if (this.selectedRow) this.selectedKey = this.selectedRow.key;
    },
    move(where) {
      this.pinSelection();
      const sorted = byPosition(this.stored);
      const from = sorted.findIndex((dictionary) => dictionary.name === this.selectedRow?.key);
      this.save(
        moveDictionary(sorted, from, where === 'top' ? 0 : sorted.length - 1),
        `${this.selectedRow.label} moved to the ${where}`
      );
    },
    // Alt+Up / Alt+Down: the selected dictionary one place up or down
    moveSelected(step) {
      this.pinSelection();
      const keys = this.installedRows.map((row) => row.key);
      const from = keys.indexOf(this.selectedRow?.key);
      const to = from + step;
      if (from < 0 || to < 0 || to >= keys.length) return;
      keys.splice(to, 0, keys.splice(from, 1)[0]);
      this.reorder(keys, `${this.selectedRow.label} moved ${step < 0 ? 'up' : 'down'}`);
      this.announcement = `${this.selectedRow.label} moved to position ${to + 1} of ${keys.length}`;
    },
    // Up / Down: the previous or next dictionary shown
    selectSibling(step) {
      const index = this.filtered.findIndex((row) => row.key === this.selectedRow?.key);
      const next = this.filtered[index + step];
      if (!next) return;
      this.selectedKey = next.key;
      this.$nextTick(() => {
        this.$el?.querySelector?.('.dictionary-row.is-selected')?.scrollIntoView?.({ block: 'nearest' });
      });
    },
    // Nothing focused, or the focus in the list
    inList(target) {
      return !target || target === document.body || !!target.closest?.('.dictionary-list');
    },
    listenToKeyboard() {
      window.removeEventListener('keydown', this.onKeydown);
      window.addEventListener('keydown', this.onKeydown);
    },
    onKeydown(event) {
      if (this.isPhone || event.defaultPrevented) return;
      // A text field keeps its own keys (its undo, its cursor), and so do a
      // dialog, a menu and a list box
      if (event.target?.closest?.(
        'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]'
      )) return;
      const mod = event.ctrlKey || event.metaKey;
      const key = String(event.key).toLowerCase();
      if (mod && key === 'z' && !event.shiftKey) {
        event.preventDefault();
        this.undo();
      } else if (mod && (key === 'y' || (key === 'z' && event.shiftKey))) {
        event.preventDefault();
        this.redo();
      } else if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && !mod) {
        const step = event.key === 'ArrowUp' ? -1 : 1;
        if (event.altKey) {
          event.preventDefault();
          if (this.reorderable) this.moveSelected(step);
        } else if (this.inList(event.target)) {
          // Elsewhere (a button of the detail, a pack) the arrows scroll
          event.preventDefault();
          this.selectSibling(step);
        }
      }
    },
    install(packId) {
      this.$refs.packs?.askInstall(packId);
    },
    clearFilters() {
      this.query = '';
      this.status = 'all';
      this.language = 'all';
      this.purpose = 'any';
    },
    toggleReordering() {
      this.reordering = !this.reordering;
    },
  },
};
</script>

<template>
  <div class="dictionaries-page" :class="{ 'is-phone': isPhone }" data-testid="dictionaries-page">
    <div v-show="!(isPhone && showingDetail && selectedRow)" class="dictionaries-page__main">
      <div v-if="isPhone" class="dictionaries-page__bar">
        <router-link to="/settings" class="dictionaries-page__back" data-testid="dictionaries-back">
          <ui-icon name="chevron-left" :size="22" :stroke-width="2.4" />
          Settings
        </router-link>
        <button
          type="button"
          class="dictionaries-page__bar-action"
          :disabled="filtersActive"
          :aria-pressed="reordering ? 'true' : 'false'"
          data-testid="dictionaries-reorder"
          @click="toggleReordering"
        >{{ reordering ? 'Done' : 'Reorder' }}</button>
      </div>

      <header class="dictionaries-page__header">
        <h1 class="dictionaries-page__title">Dictionaries</h1>
        <p class="dictionaries-page__summary" data-testid="dictionaries-summary">{{ summary }}</p>
      </header>

      <dictionary-packs v-if="modular && !isPhone" ref="packs" />

      <div class="dictionaries-page__toolbar">
        <ui-text-field
          v-model="query"
          class="dictionaries-page__search"
          prepend-icon="search"
          aria-label="Search by name, subject or language"
          placeholder="Name, subject or language"
          clearable
          autocomplete="off"
          spellcheck="false"
          data-testid="dictionaries-search"
        />
        <ui-segmented v-model="status" :options="statusOptions" label="Show" data-testid="dictionaries-status" />
        <div class="dictionaries-page__selects">
          <ui-select v-model="language" :options="languageOptions" aria-label="Languages it gives" class="dictionaries-page__select" data-testid="dictionaries-language" />
          <ui-select v-model="purpose" :options="purposeOptions" aria-label="Purpose" class="dictionaries-page__select" data-testid="dictionaries-purpose" />
        </div>
      </div>

      <div class="dictionaries-page__list-head">
        <h2 class="dictionaries-page__label" aria-live="polite">{{ listTitle }}</h2>
        <span v-if="!isPhone" class="dictionaries-page__hint">
          {{ filtersActive ? 'Clear the search and filters to reorder' : `Drag to reorder, or ${moveKeys} the selected one · ${undoKey} undoes` }}
        </span>
      </div>

      <dictionary-list
        :rows="filtered"
        :selected-key="isPhone ? '' : selectedRow?.key || ''"
        :reorderable="reorderable"
        :is-phone="isPhone"
        @select="select"
        @toggle="toggle"
        @reorder="reorder"
        @clear="clearFilters"
      />

      <dictionary-packs v-if="modular && isPhone" ref="packs" is-phone class="dictionaries-page__phone-packs" />
      <div class="ui-visually-hidden" aria-live="polite" data-testid="dictionaries-announcement">{{ announcement }}</div>
    </div>

    <aside
      v-if="!isPhone || (showingDetail && selectedRow)"
      class="dictionaries-page__detail"
      data-testid="dictionaries-detail-pane"
    >
      <button
        v-if="isPhone"
        type="button"
        class="dictionaries-page__back"
        data-testid="dictionary-detail-back"
        @click="closeDetail"
      >
        <ui-icon name="chevron-left" :size="22" :stroke-width="2.4" />
        Dictionaries
      </button>
      <dictionary-detail
        v-if="selectedRow"
        :row="selectedRow"
        :rank="selectedRank"
        :enabled-count="enabledCount"
        :can-move-up="selectedIndex > 0"
        :can-move-down="selectedIndex >= 0 && selectedIndex < installedRows.length - 1"
        :can-install="modular && packManagerReady"
        @toggle="toggle(selectedRow.key, $event)"
        @move="move"
        @install="install"
      />
      <p v-else class="dictionaries-page__nothing">Select a dictionary to see what it holds.</p>
    </aside>
  </div>
</template>

<style scoped>
/* Desktop: the list and its filters, scrolling on their own, and the
   selected dictionary in a pane on the right (board DesktopDictionaries) */
.dictionaries-page {
  box-sizing: border-box;
  display: flex;
  height: 100%;
  min-height: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-ui);
}
.dictionaries-page__main {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 28px var(--space-8) var(--space-8);
}
/* Rows stay readable on a wide window: the switch never drifts far from
   the name */
.dictionaries-page:not(.is-phone) .dictionaries-page__main > * {
  width: 100%;
  max-width: 60rem;
}
.dictionaries-page__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.dictionaries-page__title {
  margin: 0;
  font-size: var(--text-heading);
  font-weight: 700;
  letter-spacing: -0.01em;
}
.dictionaries-page__summary {
  margin: 0;
  font-size: var(--text-base);
  color: var(--muted);
}
.dictionaries-page__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.dictionaries-page__search {
  flex: 1 1 16rem;
  min-width: 0;
}
.dictionaries-page__selects {
  display: flex;
  gap: 10px;
}
.dictionaries-page__select {
  gap: 0;
}
.dictionaries-page__select :deep(.ui-select__trigger) {
  min-width: 9rem;
}
.dictionaries-page__list-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  margin: var(--space-1) 0 -10px;
  padding: 0 var(--space-2);
}
.dictionaries-page__label {
  margin: 0;
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}
.dictionaries-page__hint {
  font-size: var(--text-xs);
  color: var(--faint);
}
.dictionaries-page__detail {
  flex: none;
  box-sizing: border-box;
  width: var(--reader-panel-width);
  overflow-y: auto;
  padding: var(--space-7);
  border-left: 1px solid var(--line);
}
.dictionaries-page__nothing {
  margin: 0;
  color: var(--muted);
}
.dictionaries-page__back {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-height: 2.75rem;
  margin-left: -8px;
  padding: 0 var(--space-2) 0 0;
  border: 0;
  background: none;
  font: var(--text-md) var(--font-ui);
  color: var(--accent);
  text-decoration: none;
  cursor: pointer;
}
.dictionaries-page__back:focus-visible,
.dictionaries-page__bar-action:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

/* A narrow window: the detail pane narrower */
@media (max-width: 1180px) {
  .dictionaries-page:not(.is-phone) .dictionaries-page__detail {
    width: 22rem;
    padding: var(--space-6);
  }
  .dictionaries-page:not(.is-phone) .dictionaries-page__main {
    padding: var(--space-6);
  }
}

/* Phone: one column on the grouped ground (board MobileDictionaries) */
.dictionaries-page.is-phone {
  display: block;
  overflow-y: auto;
  background: var(--bg-grouped);
}
.dictionaries-page.is-phone .dictionaries-page__main {
  overflow: visible;
  gap: 14px;
  padding: var(--space-3) var(--space-4) var(--space-6);
}
.dictionaries-page__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 2.75rem;
}
.dictionaries-page__bar-action {
  min-height: 2.75rem;
  padding: 0 var(--space-1);
  border: 0;
  background: none;
  font: 600 var(--text-md) var(--font-ui);
  color: var(--accent);
  cursor: pointer;
}
.dictionaries-page__bar-action:disabled {
  color: var(--faint);
  cursor: default;
}
.dictionaries-page.is-phone .dictionaries-page__title {
  font-size: var(--text-large-title);
}
.dictionaries-page.is-phone .dictionaries-page__toolbar {
  flex-direction: column;
  align-items: stretch;
}
.dictionaries-page.is-phone .dictionaries-page__search {
  flex: none;
}
.dictionaries-page.is-phone :deep(.ui-segmented__option) {
  flex: 1;
}
.dictionaries-page.is-phone .dictionaries-page__selects > * {
  flex: 1;
  min-width: 0;
}
.dictionaries-page.is-phone .dictionaries-page__select :deep(.ui-select__trigger) {
  min-width: 0;
  width: 100%;
}
.dictionaries-page.is-phone .dictionaries-page__list-head {
  margin-bottom: -6px;
  padding: 0 var(--space-1);
}
.dictionaries-page__phone-packs {
  margin-top: var(--space-3);
}
.dictionaries-page.is-phone .dictionaries-page__detail {
  width: auto;
  overflow: visible;
  padding: var(--space-3) var(--space-4) var(--space-6);
  border-left: 0;
}
.dictionaries-page.is-phone .dictionaries-page__detail :deep(.dictionary-detail) {
  margin-top: var(--space-2);
  padding: 18px var(--space-4);
  border-radius: var(--radius-group);
  background: var(--surface);
}
</style>
