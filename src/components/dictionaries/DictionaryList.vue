<script>
import draggable from 'vuedraggable';

import { UiIcon, UiSwitch } from '../../ui';

// The dictionaries as rows (boards DesktopDictionaries, MobileDictionaries):
// those on this device in the order lookups use them, each with its switch,
// then those of packs not installed. A row is selected by a click on it; its
// handle drags it, or moves it with Alt+Up / Alt+Down. Reordering only makes
// sense on the whole list, so the handles show only while `reorderable`.
//
// Emits select(key), toggle(key, enabled), reorder(keys) with the keys of the
// installed rows in their new order, and clear (the empty state's button).
export default {
  name: 'DictionaryList',
  components: { draggable, UiIcon, UiSwitch },
  props: {
    rows: { type: Array, required: true },
    selectedKey: { type: String, default: '' },
    reorderable: { type: Boolean, default: false },
    isPhone: { type: Boolean, default: false },
  },
  emits: ['select', 'toggle', 'reorder', 'clear'],
  data() {
    return {
      // Read out politely after a move from the keyboard
      announcement: '',
      keysHintId: `dictionary-list-keys-${this.$.uid}`,
    };
  },
  computed: {
    installedRows() {
      return this.rows.filter((row) => row.installed);
    },
    availableRows() {
      return this.rows.filter((row) => !row.installed);
    },
  },
  methods: {
    meta(row) {
      if (!row.installed) return [`In ${row.packName}`, row.direction].filter(Boolean).join(' · ');
      const parts = [row.direction || (row.custom ? 'My glossary' : ''), ...row.keywords.slice(0, 2)].filter(Boolean);
      const text = parts.length > 1 ? `${parts[0]} · ${parts.slice(1).join(', ')}` : parts.join('');
      return row.enabled ? text : ['Off', text].filter(Boolean).join(' · ');
    },
    handleLabel(row, index) {
      return `Move ${row.label}, position ${index + 1} of ${this.installedRows.length}`;
    },
    onDragged(rows) {
      this.$emit('reorder', rows.map((row) => row.key));
    },
    // Alt+Up / Alt+Down on the focused handle: the keyboard way to drag
    onHandleKeydown(event, index) {
      if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
      event.preventDefault();
      const target = index + (event.key === 'ArrowUp' ? -1 : 1);
      if (target < 0 || target >= this.installedRows.length) return;
      const keys = this.installedRows.map((row) => row.key);
      const [key] = keys.splice(index, 1);
      keys.splice(target, 0, key);
      this.$emit('reorder', keys);
      const row = this.installedRows[index];
      this.announcement = `${row.label} moved to position ${target + 1} of ${keys.length}`;
      // The row was moved in the page: keep the focus on its handle
      this.$nextTick(() => {
        this.$el.querySelectorAll('.dictionary-row__handle')[target]?.focus();
      });
    },
  },
};
</script>

<template>
  <div class="dictionary-list" :class="{ 'is-phone': isPhone, 'is-reorderable': reorderable }" data-testid="dictionary-list">
    <draggable
      v-if="installedRows.length"
      :model-value="installedRows"
      handle=".dictionary-row__handle"
      item-key="key"
      :disabled="!reorderable"
      class="dictionary-list__group"
      tag="div"
      @update:model-value="onDragged"
    >
      <template #item="{ element: row, index }">
        <div
          class="dictionary-row"
          :class="{ 'is-selected': row.key === selectedKey, 'is-off': !row.enabled }"
          data-testid="dictionary-row"
        >
          <span
            v-if="reorderable"
            class="dictionary-row__handle"
            role="button"
            tabindex="0"
            title="Drag to reorder, or Alt+Up / Alt+Down"
            :aria-label="handleLabel(row, index)"
            :aria-describedby="keysHintId"
            aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
            data-testid="dictionary-handle"
            @keydown="onHandleKeydown($event, index)"
          >
            <ui-icon name="grip-vertical" :size="16" />
          </span>
          <span v-if="!isPhone" class="dictionary-row__position" aria-hidden="true">{{ index + 1 }}</span>
          <button
            type="button"
            class="dictionary-row__main"
            :aria-current="row.key === selectedKey ? 'true' : undefined"
            data-testid="dictionary-select"
            @click="$emit('select', row.key)"
          >
            <span class="dictionary-row__name">{{ row.label }}</span>
            <span class="dictionary-row__meta">{{ meta(row) }}</span>
          </button>
          <ui-switch
            :model-value="row.enabled"
            :aria-label="'Use ' + row.label + ' in lookups'"
            class="dictionary-row__switch"
            data-testid="dictionary-switch"
            @update:model-value="$emit('toggle', row.key, $event)"
          />
        </div>
      </template>
    </draggable>

    <template v-if="availableRows.length">
      <h3 class="dictionary-list__subhead">Not on this device</h3>
      <div class="dictionary-list__group">
        <div
          v-for="row in availableRows"
          :key="row.key"
          class="dictionary-row is-available"
          :class="{ 'is-selected': row.key === selectedKey }"
          data-testid="dictionary-row"
        >
          <button
            type="button"
            class="dictionary-row__main"
            :aria-current="row.key === selectedKey ? 'true' : undefined"
            data-testid="dictionary-select"
            @click="$emit('select', row.key)"
          >
            <span class="dictionary-row__name">{{ row.label }}</span>
            <span class="dictionary-row__meta">{{ meta(row) }}</span>
          </button>
          <ui-icon v-if="isPhone" name="chevron-right" :size="16" class="dictionary-row__chevron" />
        </div>
      </div>
    </template>

    <div v-if="!rows.length" class="dictionary-list__empty" data-testid="dictionary-empty">
      <p>No dictionary matches.</p>
      <button type="button" class="dictionary-list__clear" @click="$emit('clear')">Clear the search and filters</button>
    </div>

    <span :id="keysHintId" class="ui-visually-hidden">Alt+Up or Alt+Down moves it up or down.</span>
    <div class="ui-visually-hidden" aria-live="polite" data-testid="dictionary-announcement">{{ announcement }}</div>
  </div>
</template>

<style scoped>
.dictionary-list {
  display: flex;
  flex-direction: column;
}
.dictionary-list__group {
  display: flex;
  flex-direction: column;
}
.dictionary-list__subhead {
  margin: var(--space-6) 0 var(--space-2);
  padding: 0 var(--space-2);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}

/* A row: handle, position, name and description (the button), switch.
   The button stretches over the row (::after), so a click anywhere but on
   the handle or the switch selects it. */
.dictionary-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 3.5rem;
  padding: 0 var(--space-4) 0 var(--space-2);
  border-bottom: 1px solid var(--line-soft);
  border-radius: 0;
  background: transparent;
  transition: background-color 0.15s ease;
}
/* Hovered or selected, a row is a rounded tile: no line under it, nor
   under the row above */
.dictionary-row:hover {
  border-bottom-color: transparent;
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--soft) 50%, transparent);
}
.dictionary-row.is-selected {
  border-bottom-color: transparent;
  border-radius: var(--radius-lg);
  background: var(--accent-soft);
}
.dictionary-row:has(+ .dictionary-row:hover),
.dictionary-row:has(+ .dictionary-row.is-selected) {
  border-bottom-color: transparent;
}
.dictionary-row__handle {
  position: relative;
  z-index: 1;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 2rem;
  color: var(--faint);
  cursor: grab;
  touch-action: none;
  border-radius: var(--radius-sm);
}
.dictionary-row__handle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.dictionary-row__position {
  flex: none;
  width: 1.5rem;
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: var(--muted);
}
.dictionary-list:not(.is-reorderable) .dictionary-row__position {
  margin-left: var(--space-2);
}
.dictionary-row__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  padding: var(--space-2) 0;
  border: 0;
  background: none;
  font: inherit;
  text-align: left;
  color: inherit;
  cursor: pointer;
}
.dictionary-row__main::after {
  content: '';
  position: absolute;
  inset: 0;
}
.dictionary-row__main:focus-visible {
  outline: none;
}
.dictionary-row:has(.dictionary-row__main:focus-visible) {
  box-shadow: inset 0 0 0 2px var(--accent);
  border-radius: var(--radius-lg);
}
.dictionary-row__name {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--text-md);
  font-weight: 500;
  color: var(--ink);
}
.dictionary-row__meta {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--text-sm);
  color: var(--muted);
}
.dictionary-row.is-off .dictionary-row__name,
.dictionary-row.is-available .dictionary-row__name {
  color: var(--muted);
}
.dictionary-row__switch {
  position: relative;
  z-index: 1;
  flex: none;
}
.dictionary-row__chevron {
  flex: none;
  color: var(--faint);
}
.dictionary-row.sortable-ghost {
  opacity: 0.4;
}
.dictionary-row.sortable-chosen {
  box-shadow: var(--shadow-pop);
}

.dictionary-list__empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-6) var(--space-2);
  color: var(--muted);
}
.dictionary-list__empty p {
  margin: 0;
}
.dictionary-list__clear {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: var(--accent);
  cursor: pointer;
}

/* Phone: white groups on the grey ground, taller rows (board MobileDictionaries) */
.dictionary-list.is-phone .dictionary-list__group {
  border-radius: var(--radius-group);
  background: var(--surface);
  overflow: hidden;
}
.dictionary-list.is-phone .dictionary-list__subhead {
  margin-top: var(--space-5);
  padding: 0 var(--space-1);
}
.dictionary-list.is-phone .dictionary-row {
  min-height: 3.75rem;
  padding: 0 var(--space-4);
  border-bottom: 0;
  border-top: 1px solid var(--soft);
}
.dictionary-list.is-phone .dictionary-row:first-child {
  border-top: 0;
}
.dictionary-list.is-phone .dictionary-row:hover,
.dictionary-list.is-phone .dictionary-row.is-selected {
  border-radius: 0;
  background: transparent;
}
.dictionary-list.is-phone .dictionary-row__name {
  font-weight: 400;
}
</style>
