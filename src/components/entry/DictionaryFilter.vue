<script>
import { foldForSearch } from '../../services/dictionary-catalog';
import { UiIcon } from '../../ui';

let uid = 0;

// Which dictionaries of the entry are shown: all of them, or one chosen in a
// list that can be searched (a term may have twenty). The button says what
// is shown and how many definitions; the × next to it goes back to all.
// `modelValue` is the chosen dictionary's id, null for all.
//
// A combobox: the focus stays in the search field, Up/Down move through the
// list, Enter chooses, Escape (or a click outside, or Tab) closes it.
export default {
  name: 'DictionaryFilter',
  components: { UiIcon },
  props: {
    // [{ id, text (plain name, told apart from a namesake), count }]
    dictionaries: { type: Array, default: () => [] },
    modelValue: { default: null },
    total: { type: Number, default: 0 },
  },
  emits: ['update:modelValue'],
  data() {
    return { open: false, query: '', active: 0, listId: `dict-filter-${++uid}` };
  },
  computed: {
    options() {
      const all = { id: null, text: 'All dictionaries', count: this.total };
      return [all, ...this.dictionaries];
    },
    // While searching, only the dictionaries that match
    shown() {
      const query = foldForSearch(this.query).trim();
      if (!query) return this.options;
      return this.dictionaries.filter((dictionary) => foldForSearch(dictionary.text).includes(query));
    },
    current() {
      return this.dictionaries.find((dictionary) => dictionary.id === this.modelValue) || this.options[0];
    },
  },
  watch: {
    query() {
      this.active = 0;
    },
  },
  beforeUnmount() {
    document.removeEventListener('pointerdown', this.onOutside, true);
  },
  methods: {
    toggle() {
      if (this.open) this.close();
      else this.show();
    },
    show() {
      this.open = true;
      this.query = '';
      // After the query watcher, which would put it back on the first option
      this.$nextTick(() => {
        this.active = Math.max(0, this.shown.findIndex((option) => option.id === this.modelValue));
      });
      document.addEventListener('pointerdown', this.onOutside, true);
      this.$nextTick(() => this.$refs.search?.focus());
    },
    close({ focus = false } = {}) {
      this.open = false;
      document.removeEventListener('pointerdown', this.onOutside, true);
      if (focus) this.$nextTick(() => this.$refs.trigger?.focus());
    },
    onOutside(event) {
      if (!this.$el.contains(event.target)) this.close();
    },
    choose(id) {
      this.$emit('update:modelValue', id);
      this.close({ focus: true });
    },
    onKeydown(event) {
      const count = this.shown.length;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!count) return;
        const step = event.key === 'ArrowDown' ? 1 : -1;
        this.active = (this.active + step + count) % count;
        this.$nextTick(() => document.getElementById(this.optionId(this.active))?.scrollIntoView?.({ block: 'nearest' }));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (count) this.choose(this.shown[this.active].id);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.close({ focus: true });
      } else if (event.key === 'Tab') {
        this.close();
      }
    },
    optionId(index) {
      return `${this.listId}-${index}`;
    },
  },
};
</script>

<template>
  <div class="dict-filter" :class="{ 'is-open': open }">
    <div class="dict-filter__bar">
      <button
        ref="trigger"
        type="button"
        class="dict-filter__trigger"
        :class="{ 'is-filtered': modelValue !== null }"
        aria-haspopup="listbox"
        :aria-expanded="open ? 'true' : 'false'"
        data-testid="entry-filter"
        @click="toggle"
      >
        <ui-icon name="book-open" :size="15" class="dict-filter__icon" />
        <span class="dict-filter__label">{{ current.text }} · {{ current.count }}</span>
        <ui-icon name="chevron-down" :size="15" class="dict-filter__chevron" />
      </button>
      <button
        v-if="modelValue !== null"
        type="button"
        class="dict-filter__clear"
        aria-label="Show every dictionary"
        title="Show every dictionary"
        data-testid="entry-filter-clear"
        @click="choose(null)"
      >
        <ui-icon name="x" :size="15" />
      </button>
    </div>

    <div v-if="open" class="dict-filter__panel">
      <label class="dict-filter__search">
        <ui-icon name="search" :size="15" class="dict-filter__search-icon" />
        <input
          ref="search"
          v-model="query"
          type="text"
          role="combobox"
          aria-label="Find a dictionary"
          aria-autocomplete="list"
          aria-expanded="true"
          :aria-controls="listId"
          :aria-activedescendant="shown.length ? optionId(active) : undefined"
          placeholder="Find a dictionary"
          autocomplete="off"
          spellcheck="false"
          data-testid="entry-filter-search"
          @keydown="onKeydown"
        />
      </label>
      <ul :id="listId" class="dict-filter__list" role="listbox" aria-label="Dictionaries of this entry">
        <li
          v-for="(option, index) in shown"
          :id="optionId(index)"
          :key="option.id ?? 'all'"
          role="option"
          class="dict-filter__option"
          :class="{ 'is-active': index === active, 'is-chosen': option.id === modelValue }"
          :aria-selected="index === active ? 'true' : 'false'"
          data-testid="entry-filter-option"
          @click="choose(option.id)"
          @mousemove="active = index"
        >
          <ui-icon v-if="option.id === modelValue" name="check" :size="15" class="dict-filter__check" />
          <span class="dict-filter__name">{{ option.text }}</span>
          <span class="dict-filter__count">{{ option.count }}</span>
        </li>
      </ul>
      <p v-if="!shown.length" class="dict-filter__none" data-testid="entry-filter-none">
        No dictionary of this entry matches.
      </p>
    </div>
  </div>
</template>

<style scoped>
.dict-filter {
  position: relative;
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--line-soft);
}
.dict-filter__bar {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}
.dict-filter__trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  max-width: 100%;
  min-height: var(--control-sm);
  padding: 0 10px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--ink);
  font: 500 var(--text-sm) var(--font-ui);
  cursor: pointer;
}
.dict-filter__trigger:hover {
  background: var(--soft);
}
.dict-filter__trigger.is-filtered {
  border-color: var(--accent-line);
  background: var(--accent-soft);
  color: var(--accent);
}
.dict-filter__trigger:focus-visible,
.dict-filter__clear:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.dict-filter__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dict-filter__icon,
.dict-filter__chevron {
  flex: none;
  color: var(--muted);
}
.dict-filter__trigger.is-filtered .dict-filter__icon,
.dict-filter__trigger.is-filtered .dict-filter__chevron {
  color: var(--accent);
}
.dict-filter__clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--control-sm);
  height: var(--control-sm);
  border: 0;
  border-radius: var(--radius-md);
  background: none;
  color: var(--muted);
  cursor: pointer;
}
.dict-filter__clear:hover {
  background: var(--soft);
  color: var(--ink);
}

.dict-filter__panel {
  position: absolute;
  z-index: 20;
  top: calc(100% - var(--space-1));
  left: 0;
  width: min(26rem, 100%);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: 6px;
  border: 1px solid var(--line);
  border-radius: var(--radius-xl);
  background: var(--surface);
  box-shadow: var(--shadow-pop);
}
.dict-filter__search {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 2.25rem;
  margin-bottom: 4px;
  padding: 0 10px;
  border-bottom: 1px solid var(--line-soft);
}
.dict-filter__search-icon {
  flex: none;
  color: var(--muted);
}
.dict-filter__search input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  font: var(--text-base) var(--font-ui);
  color: var(--ink);
}
.dict-filter__list {
  max-height: min(22rem, 50vh);
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}
.dict-filter__option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 2.125rem;
  padding: 0 10px;
  border-radius: var(--radius-sm);
  font-size: var(--text-base);
  cursor: pointer;
}
.dict-filter__option.is-active {
  background: var(--soft);
}
.dict-filter__option.is-chosen {
  color: var(--accent);
}
.dict-filter__check {
  flex: none;
  margin-left: -4px;
}
.dict-filter__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dict-filter__count {
  flex: none;
  font-size: var(--text-sm);
  font-variant-numeric: tabular-nums;
  color: var(--muted);
}
.dict-filter__none {
  margin: 0;
  padding: var(--space-3) 10px;
  font-size: var(--text-sm);
  color: var(--muted);
}

/* Phone: no rule under it, the list across the screen */
@media (max-width: 600px) {
  .dict-filter {
    padding-bottom: 0;
    border-bottom: 0;
  }
  .dict-filter__panel {
    width: 100%;
  }
  .dict-filter__option {
    min-height: 2.75rem;
  }
}
</style>
